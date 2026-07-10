import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  validateMcpAccessToken: vi.fn(),
  recordMcpAuditEvent: vi.fn(),
  listMcpBoards: vi.fn(),
  listMcpTasks: vi.fn(),
  getMcpTask: vi.fn(),
  createMcpTask: vi.fn(),
  updateMcpTask: vi.fn(),
}));

vi.mock('@/lib/mcp/oauth-service', () => ({
  validateMcpAccessToken: mocks.validateMcpAccessToken,
  recordMcpAuditEvent: mocks.recordMcpAuditEvent,
}));
vi.mock('@/lib/mcp/task-tools', () => ({
  listMcpBoards: mocks.listMcpBoards,
  listMcpTasks: mocks.listMcpTasks,
  getMcpTask: mocks.getMcpTask,
  createMcpTask: mocks.createMcpTask,
  updateMcpTask: mocks.updateMcpTask,
}));

import { POST } from '@/app/api/mcp/route';

const token = {
  id: 'a1111111-1111-4111-8111-111111111111',
  userId: 'b1111111-1111-4111-8111-111111111111',
  clientId: 'c1111111-1111-4111-8111-111111111111',
  scopes: ['tasks:read'],
  expiresAt: new Date('2026-07-10T13:00:00.000Z'),
};
const boardId = 'd1111111-1111-4111-8111-111111111111';
const taskId = 'e1111111-1111-4111-8111-111111111111';
const createdTaskId = 'f1111111-1111-4111-8111-111111111111';

function mcpRequest(body: object, init: { sessionId?: string; authorization?: string } = {}) {
  return new NextRequest('https://central.example/api/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: init.authorization ?? 'Bearer mcp_at_valid',
      ...(init.sessionId ? { 'mcp-session-id': init.sessionId, 'mcp-protocol-version': '2025-06-18' } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function initialize() {
  const response = await POST(mcpRequest({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'Central MCP route test', version: '1.0.0' },
    },
  }));
  expect(response.status).toBe(200);
  expect((await response.json()).result.serverInfo).toMatchObject({ name: 'central' });
  const sessionId = response.headers.get('mcp-session-id');
  expect(sessionId).toBeTruthy();
  return sessionId!;
}

describe('/api/mcp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'https://central.example';
    mocks.validateMcpAccessToken.mockResolvedValue(token);
    mocks.recordMcpAuditEvent.mockResolvedValue({ id: 'audit-event' });
  });

  it('rejects missing or invalid bearer tokens before an MCP session is initialized', async () => {
    const missing = await POST(mcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }, { authorization: '' }));
    mocks.validateMcpAccessToken.mockResolvedValueOnce(null);
    const invalid = await POST(mcpRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }));

    expect(missing.status).toBe(401);
    expect(missing.headers.get('www-authenticate')).toContain('resource="https://central.example/api/mcp"');
    expect(invalid.status).toBe(401);
    expect(mocks.validateMcpAccessToken).toHaveBeenCalledTimes(1);
  });

  it('requires a task scope before MCP dispatch', async () => {
    mocks.validateMcpAccessToken.mockResolvedValue({ ...token, scopes: [] });
    const response = await POST(mcpRequest({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }));

    expect(response.status).toBe(403);
    expect(response.headers.get('www-authenticate')).toContain('error="insufficient_scope"');
  });

  it('initializes a Streamable HTTP session and exposes only Central read tools', async () => {
    const sessionId = await initialize();
    const response = await POST(mcpRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, { sessionId }));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      'central_list_boards',
      'central_list_tasks',
      'central_get_task',
    ]);
    expect(result.result.tools.every((tool: { annotations: { readOnlyHint: boolean } }) => tool.annotations.readOnlyHint)).toBe(true);
  });

  it('dispatches task tools through the current-user access layer and audits every invocation', async () => {
    mocks.listMcpBoards.mockResolvedValue([{ id: boardId, name: 'Launch', description: null, type: 'standard' }]);
    mocks.listMcpTasks.mockResolvedValue({ access: true, tasks: [{ id: taskId, title: 'Ship', boardId, shortId: null, status: 'todo', section: null, dueDate: null, parentTaskId: null }] });
    mocks.getMcpTask.mockResolvedValue({ access: false, task: null });
    const sessionId = await initialize();

    const listBoards = await POST(mcpRequest({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'central_list_boards', arguments: {} } }, { sessionId }));
    const listTasks = await POST(mcpRequest({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'central_list_tasks', arguments: { board_id: boardId, limit: 12 } } }, { sessionId }));
    const getTask = await POST(mcpRequest({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'central_get_task', arguments: { task_id: taskId } } }, { sessionId }));

    await expect(listBoards.json()).resolves.toMatchObject({ result: { content: [{ text: expect.stringContaining('Launch') }] } });
    await expect(listTasks.json()).resolves.toMatchObject({ result: { content: [{ text: expect.stringContaining('Ship') }] } });
    await expect(getTask.json()).resolves.toMatchObject({ result: { isError: true, content: [{ text: 'Task not found or access denied.' }] } });
    expect(mocks.listMcpTasks).toHaveBeenCalledWith(token.userId, boardId, 12);
    expect(mocks.getMcpTask).toHaveBeenCalledWith(token.userId, taskId);
    expect(mocks.recordMcpAuditEvent).toHaveBeenCalledTimes(3);
    expect(mocks.recordMcpAuditEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({
      eventType: 'mcp.tool_invoked', toolName: 'central_list_tasks', resourceId: boardId, metadata: { limit: 12 },
    }));
  });

  it('does not permit a token to reuse another token session', async () => {
    const sessionId = await initialize();
    mocks.validateMcpAccessToken.mockResolvedValue({ ...token, id: 'f1111111-1111-4111-8111-111111111111' });
    const response = await POST(mcpRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, { sessionId }));

    expect(response.status).toBe(403);
  });

  it('does not expose write tools to a read-only token', async () => {
    const sessionId = await initialize();
    const response = await POST(mcpRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, { sessionId }));
    const result = await response.json();

    expect(result.result.tools.map((tool: { name: string }) => tool.name)).not.toContain('central_create_task');

    const writeCall = await POST(mcpRequest({
      jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'central_create_task', arguments: { board_id: boardId, title: 'Nope', status: 'todo' } },
    }, { sessionId }));
    await expect(writeCall.json()).resolves.toMatchObject({ result: { isError: true, content: [{ text: expect.stringContaining('not found') }] } });
    expect(mocks.createMcpTask).not.toHaveBeenCalled();
  });

  it('validates explicit targets and rejects unsupported task fields before mutation', async () => {
    mocks.validateMcpAccessToken.mockResolvedValue({ ...token, scopes: ['tasks:write'] });
    const sessionId = await initialize();

    const noTarget = await POST(mcpRequest({
      jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'central_create_task', arguments: { title: 'Missing board', status: 'todo' } },
    }, { sessionId }));
    const unsupported = await POST(mcpRequest({
      jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'central_update_task', arguments: { task_id: taskId, assignee_ids: [token.userId] } },
    }, { sessionId }));

    await expect(noTarget.json()).resolves.toMatchObject({ result: { isError: true, content: [{ text: expect.stringContaining('Input validation error') }] } });
    await expect(unsupported.json()).resolves.toMatchObject({ result: { isError: true, content: [{ text: expect.stringContaining('Unrecognized key') }] } });
    expect(mocks.createMcpTask).not.toHaveBeenCalled();
    expect(mocks.updateMcpTask).not.toHaveBeenCalled();
    expect(mocks.recordMcpAuditEvent).not.toHaveBeenCalled();
  });

  it('runs write mutations only with tasks:write and records redacted, outcome-level audit events', async () => {
    mocks.validateMcpAccessToken.mockResolvedValue({ ...token, scopes: ['tasks:read', 'tasks:write'] });
    mocks.createMcpTask.mockResolvedValue({
      success: true,
      task: { id: createdTaskId, boardId, title: 'Private launch', shortId: null, status: 'todo', section: null, dueDate: null, parentTaskId: null },
    });
    mocks.updateMcpTask.mockResolvedValue({ success: false, error: 'Task not found or access denied' });
    const sessionId = await initialize();

    const create = await POST(mcpRequest({
      jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'central_create_task', arguments: { board_id: boardId, title: 'Private launch', status: 'todo' } },
    }, { sessionId }));
    const update = await POST(mcpRequest({
      jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'central_update_task', arguments: { task_id: taskId, title: 'Secret revision' } },
    }, { sessionId }));

    await expect(create.json()).resolves.toMatchObject({ result: { content: [{ text: expect.stringContaining(createdTaskId) }] } });
    await expect(update.json()).resolves.toMatchObject({ result: { isError: true, content: [{ text: 'Task not found or access denied' }] } });
    expect(mocks.createMcpTask).toHaveBeenCalledWith(token.userId, { boardId, title: 'Private launch', status: 'todo', section: undefined, dueDate: undefined });
    expect(mocks.updateMcpTask).toHaveBeenCalledWith(token.userId, { taskId, title: 'Secret revision', status: undefined, section: undefined, dueDate: undefined });
    expect(mocks.recordMcpAuditEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({
      userId: token.userId,
      clientId: token.clientId,
      toolName: 'central_create_task',
      eventType: 'mcp.tool_completed',
      resourceType: 'board',
      resourceId: boardId,
      metadata: expect.objectContaining({ outcome: 'success', input: expect.objectContaining({ title: '[redacted]' }), affectedTaskId: createdTaskId }),
    }));
    expect(mocks.recordMcpAuditEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({
      toolName: 'central_update_task',
      eventType: 'mcp.tool_completed',
      resourceType: 'task',
      resourceId: taskId,
      metadata: expect.objectContaining({ outcome: 'rejected', input: expect.objectContaining({ title: '[redacted]' }), affectedTaskId: taskId }),
    }));
  });
});
