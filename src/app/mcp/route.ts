import { createMcpHandler } from '@modelcontextprotocol/server';
import { buildCentralMcpServer } from '@/lib/mcp/server';
import { verifyMcpBearer } from '@/lib/oauth/tokens';
import { assertCanonicalRequestHost } from '@/lib/oauth/http';
import { protectedResourceMetadataUrl } from '@/lib/oauth/config';
import type { SessionUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const handler = createMcpHandler(
  ({ authInfo }) => {
    const actor = authInfo?.extra?.actor as SessionUser | undefined;
    if (!authInfo || !actor) throw new Error('Authenticated MCP actor is missing');
    return buildCentralMcpServer({ actor, clientId: authInfo.clientId, scopes: authInfo.scopes });
  },
  {
    legacy: 'stateless',
    responseMode: 'auto',
    onerror: (error) => console.error('[mcp]', error),
  }
);

function challenge(status = 401, error = 'invalid_token', description = 'A valid OAuth access token is required') {
  return Response.json(
    { error, error_description: description },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'WWW-Authenticate': `Bearer resource_metadata="${protectedResourceMetadataUrl()}", scope="central:read"${
          error ? `, error="${error}"` : ''
        }`,
      },
    }
  );
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set(
    'Access-Control-Expose-Headers',
    'Mcp-Session-Id, MCP-Protocol-Version, WWW-Authenticate'
  );
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function serve(request: Request): Promise<Response> {
  try {
    assertCanonicalRequestHost(request);
  } catch {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return withCors(challenge());
  const identity = await verifyMcpBearer(authorization.slice(7));
  if (!identity) return withCors(challenge());
  if (!identity.authInfo.scopes.includes('central:read')) {
    return withCors(challenge(403, 'insufficient_scope', 'central:read is required'));
  }
  return withCors(await handler.fetch(request, { authInfo: { ...identity.authInfo, extra: { ...identity.authInfo.extra, actor: identity.user } } }));
}

export async function POST(request: Request) {
  return serve(request);
}

export async function GET(request: Request) {
  return serve(request);
}

export async function DELETE(request: Request) {
  return serve(request);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        'Authorization, Content-Type, MCP-Protocol-Version, Mcp-Session-Id, Mcp-Method, Mcp-Name, Last-Event-ID',
      'Access-Control-Expose-Headers':
        'Mcp-Session-Id, MCP-Protocol-Version, WWW-Authenticate',
    },
  });
}
