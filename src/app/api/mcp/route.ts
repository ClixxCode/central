import { randomUUID } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { NextRequest, NextResponse } from 'next/server';
import * as z from 'zod/v4';
import { mcpResourceUrl } from '@/lib/mcp/oauth-http';
import { recordMcpAuditEvent, validateMcpAccessToken } from '@/lib/mcp/oauth-service';
import { createMcpTask, getMcpTask, listMcpBoards, listMcpTasks, updateMcpTask } from '@/lib/mcp/task-tools';

export const runtime = 'nodejs';

const READ_SCOPE = 'tasks:read';
const WRITE_SCOPE = 'tasks:write';
const TASK_SCOPES = [READ_SCOPE, WRITE_SCOPE];

type McpAccessToken = NonNullable<Awaited<ReturnType<typeof validateMcpAccessToken>>>;
type McpSession = {
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
  userId: string;
  accessTokenId: string;
};

// MCP clients make follow-up requests with this header. Module memory is the
// appropriate session store for a single Node runtime; clients must reinitialize
// after an instance recycle and receive only tools allowed by their token scope.
const sessions = new Map<string, McpSession>();

function protocolError(status: number, code: number, message: string) {
  return NextResponse.json({ jsonrpc: '2.0', error: { code, message }, id: null }, { status });
}

function bearerChallenge(request: NextRequest, error: 'invalid_token' | 'insufficient_scope') {
  return `Bearer resource="${mcpResourceUrl(request)}", error="${error}", scope="${TASK_SCOPES.join(' ')}"`;
}

function unauthorized(request: NextRequest, insufficientScope = false) {
  const status = insufficientScope ? 403 : 401;
  return NextResponse.json(
    { error: insufficientScope ? 'insufficient_scope' : 'invalid_token' },
    { status, headers: { 'WWW-Authenticate': bearerChallenge(request, insufficientScope ? 'insufficient_scope' : 'invalid_token') } }
  );
}

async function authenticate(request: NextRequest): Promise<McpAccessToken | NextResponse> {
  const match = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i);
  if (!match) return unauthorized(request);

  const token = await validateMcpAccessToken(match[1]);
  if (!token) return unauthorized(request);
  if (!token.scopes.some((scope) => TASK_SCOPES.includes(scope))) return unauthorized(request, true);
  return token;
}

function isResponse(value: McpAccessToken | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}

async function auditInvocation(input: {
  token: McpAccessToken;
  toolName: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}) {
  await recordMcpAuditEvent({
    userId: input.token.userId,
    clientId: input.token.clientId,
    accessTokenId: input.token.id,
    eventType: 'mcp.tool_invoked',
    toolName: input.toolName,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    metadata: input.metadata,
  });
}

function redactedMutationInput(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, key === 'title' ? '[redacted]' : value])
  );
}

async function auditMutation(input: {
  token: McpAccessToken;
  toolName: string;
  resourceType: 'board' | 'task';
  resourceId: string;
  outcome: 'success' | 'rejected';
  mutationInput: Record<string, unknown>;
  affectedBoardId?: string;
  affectedTaskId?: string;
}) {
  await recordMcpAuditEvent({
    userId: input.token.userId,
    clientId: input.token.clientId,
    accessTokenId: input.token.id,
    eventType: 'mcp.tool_completed',
    toolName: input.toolName,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    metadata: {
      outcome: input.outcome,
      input: redactedMutationInput(input.mutationInput),
      affectedBoardId: input.affectedBoardId,
      affectedTaskId: input.affectedTaskId,
    },
  });
}

function toolError(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

function createMcpServer(token: McpAccessToken): McpServer {
  const server = new McpServer({ name: 'central', version: '1.0.0' });

  if (token.scopes.includes(READ_SCOPE)) {
    server.registerTool(
    'central_list_boards',
    {
      title: 'List Central boards',
      description: 'List the Central boards currently accessible to the connected user.',
      annotations: { readOnlyHint: true },
    },
    async () => {
      await auditInvocation({ token, toolName: 'central_list_boards', resourceType: 'board' });
      const boards = await listMcpBoards(token.userId);
      return { content: [{ type: 'text', text: JSON.stringify({ boards }) }] };
    }
    );

    server.registerTool(
    'central_list_tasks',
    {
      title: 'List Central tasks',
      description: 'List active tasks on one Central board the connected user can access.',
      inputSchema: {
        board_id: z.string().uuid().describe('Central board ID from central_list_boards.'),
        limit: z.number().int().min(1).max(100).optional().describe('Maximum number of tasks to return (default 50).'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ board_id, limit }) => {
      await auditInvocation({
        token,
        toolName: 'central_list_tasks',
        resourceType: 'board',
        resourceId: board_id,
        metadata: { limit: limit ?? 50 },
      });
      const result = await listMcpTasks(token.userId, board_id, limit);
      if (!result.access) return toolError('Board not found or access denied.');
      return { content: [{ type: 'text', text: JSON.stringify({ boardId: board_id, tasks: result.tasks }) }] };
    }
    );

    server.registerTool(
    'central_get_task',
    {
      title: 'Get a Central task',
      description: 'Get one Central task when it remains accessible to the connected user.',
      inputSchema: {
        task_id: z.string().uuid().describe('Central task ID.'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ task_id }) => {
      await auditInvocation({
        token,
        toolName: 'central_get_task',
        resourceType: 'task',
        resourceId: task_id,
      });
      const result = await getMcpTask(token.userId, task_id);
      if (!result.access || !result.task) return toolError('Task not found or access denied.');
      return { content: [{ type: 'text', text: JSON.stringify({ task: result.task }) }] };
    }
    );
  }

  if (token.scopes.includes(WRITE_SCOPE)) {
    server.registerTool(
      'central_create_task',
      {
        title: 'Create a Central task',
        description: 'Create a task on one Central board the connected user can access.',
        inputSchema: z.object({
          board_id: z.string().uuid().describe('Explicit Central board ID from central_list_boards.'),
          title: z.string().trim().min(1).max(500).describe('Task title.'),
          status: z.string().trim().min(1).max(100).describe('Board workflow status ID.'),
          section: z.string().trim().min(1).max(100).optional().describe('Optional board section ID.'),
          due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Optional due date, YYYY-MM-DD.'),
        }).strict(),
        annotations: { readOnlyHint: false },
      },
      async ({ board_id, title, status, section, due_date }) => {
        const result = await createMcpTask(token.userId, {
          boardId: board_id,
          title,
          status,
          section,
          dueDate: due_date,
        });
        await auditMutation({
          token,
          toolName: 'central_create_task',
          resourceType: 'board',
          resourceId: board_id,
          outcome: result.success ? 'success' : 'rejected',
          mutationInput: { board_id, title, status, section, due_date },
          affectedBoardId: result.task?.boardId ?? board_id,
          affectedTaskId: result.task?.id,
        });
        if (!result.success || !result.task) return toolError(result.error ?? 'Unable to create task.');
        return { content: [{ type: 'text', text: JSON.stringify({ task: result.task }) }] };
      }
    );

    server.registerTool(
      'central_update_task',
      {
        title: 'Update a Central task',
        description: 'Update approved fields on one Central task the connected user can access.',
        inputSchema: z.object({
          task_id: z.string().uuid().describe('Explicit Central task ID.'),
          title: z.string().trim().min(1).max(500).optional().describe('Replacement task title.'),
          status: z.string().trim().min(1).max(100).optional().describe('Replacement board workflow status ID.'),
          section: z.string().trim().min(1).max(100).nullable().optional().describe('Replacement section ID, or null to clear.'),
          due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().describe('Replacement due date, YYYY-MM-DD, or null to clear.'),
        }).strict().refine(
          (value) => value.title !== undefined || value.status !== undefined || value.section !== undefined || value.due_date !== undefined,
          'At least one supported field must be supplied.'
        ),
        annotations: { readOnlyHint: false },
      },
      async ({ task_id, title, status, section, due_date }) => {
        const result = await updateMcpTask(token.userId, {
          taskId: task_id,
          title,
          status,
          section,
          dueDate: due_date,
        });
        await auditMutation({
          token,
          toolName: 'central_update_task',
          resourceType: 'task',
          resourceId: result.task?.id ?? task_id,
          outcome: result.success ? 'success' : 'rejected',
          mutationInput: { task_id, title, status, section, due_date },
          affectedBoardId: result.task?.boardId,
          affectedTaskId: result.task?.id ?? task_id,
        });
        if (!result.success || !result.task) return toolError(result.error ?? 'Unable to update task.');
        return { content: [{ type: 'text', text: JSON.stringify({ task: result.task }) }] };
      }
    );
  }

  return server;
}

async function parsedBody(request: NextRequest): Promise<unknown | null> {
  try {
    return await request.clone().json();
  } catch {
    return null;
  }
}

async function handle(request: NextRequest): Promise<Response> {
  const token = await authenticate(request);
  if (isResponse(token)) return token;

  const sessionId = request.headers.get('mcp-session-id');
  if (sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return protocolError(404, -32001, 'MCP session not found.');
    if (session.userId !== token.userId || session.accessTokenId !== token.id) {
      return protocolError(403, -32003, 'MCP session does not belong to this token.');
    }
    return session.transport.handleRequest(request);
  }

  const body = await parsedBody(request);
  if (!body || !isInitializeRequest(body)) {
    return protocolError(400, -32000, 'A valid MCP initialize request or session ID is required.');
  }

  const server = createMcpServer(token);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: randomUUID,
    enableJsonResponse: true,
    onsessioninitialized: (newSessionId) => {
      sessions.set(newSessionId, { server, transport, userId: token.userId, accessTokenId: token.id });
    },
    onsessionclosed: async (closedSessionId) => {
      sessions.delete(closedSessionId);
      await server.close();
    },
  });
  await server.connect(transport);
  return transport.handleRequest(request, { parsedBody: body });
}

export async function POST(request: NextRequest) {
  try {
    return await handle(request);
  } catch {
    return protocolError(500, -32603, 'Internal server error.');
  }
}

export async function GET(request: NextRequest) {
  try {
    return await handle(request);
  } catch {
    return protocolError(500, -32603, 'Internal server error.');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    return await handle(request);
  } catch {
    return protocolError(500, -32603, 'Internal server error.');
  }
}
