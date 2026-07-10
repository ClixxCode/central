import { randomUUID } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { NextRequest, NextResponse } from 'next/server';
import * as z from 'zod/v4';
import { mcpResourceUrl } from '@/lib/mcp/oauth-http';
import { recordMcpAuditEvent, validateMcpAccessToken } from '@/lib/mcp/oauth-service';
import { getMcpTask, listMcpBoards, listMcpTasks } from '@/lib/mcp/task-tools';

export const runtime = 'nodejs';

const REQUIRED_SCOPE = 'tasks:read';

type McpAccessToken = NonNullable<Awaited<ReturnType<typeof validateMcpAccessToken>>>;
type McpSession = {
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
  userId: string;
  accessTokenId: string;
};

// MCP clients make follow-up requests with this header. Module memory is the
// appropriate session store for a single Node runtime; deployments that span
// instances can safely re-initialize because the server exposes read-only tools.
const sessions = new Map<string, McpSession>();

function protocolError(status: number, code: number, message: string) {
  return NextResponse.json({ jsonrpc: '2.0', error: { code, message }, id: null }, { status });
}

function bearerChallenge(request: NextRequest, error: 'invalid_token' | 'insufficient_scope') {
  return `Bearer resource="${mcpResourceUrl(request)}", error="${error}", scope="${REQUIRED_SCOPE}"`;
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
  if (!token.scopes.includes(REQUIRED_SCOPE)) return unauthorized(request, true);
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

function toolError(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

function createMcpServer(token: McpAccessToken): McpServer {
  const server = new McpServer({ name: 'central', version: '1.0.0' });

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
