import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({
  user: { id: 'a1111111-1111-4111-8111-111111111111' },
  clients: new Map<string, { id: string; clientId: string; name: string; redirectUris: string[]; allowedScopes: string[]; createdAt: Date }>(),
  codes: new Map<string, { clientId: string; userId: string; redirectUri: string; scopes: string[]; codeChallenge: string }>(),
  tokens: new Map<string, { id: string; userId: string; clientId: string; scopes: string[]; expiresAt: Date }>(),
  audits: [] as Array<Record<string, unknown>>,
}));

const mocks = vi.hoisted(() => ({
  listMcpBoards: vi.fn(),
  listMcpTasks: vi.fn(),
  getMcpTask: vi.fn(),
  createMcpTask: vi.fn(),
  updateMcpTask: vi.fn(),
}));

const McpOAuthError = vi.hoisted(() => class McpOAuthError extends Error {
  constructor(
    public readonly code: 'invalid_client' | 'invalid_grant' | 'invalid_scope',
    message: string
  ) {
    super(message);
  }
});

vi.mock('@/lib/auth/session', () => ({ getCurrentUser: vi.fn(async () => state.user) }));
vi.mock('@/lib/mcp/oauth-service', () => ({
  McpOAuthError,
  registerMcpOAuthClient: vi.fn(async (input: { clientId: string; name: string; redirectUris: string[]; allowedScopes: string[] }) => {
    const client = { id: 'b2222222-2222-4222-8222-222222222222', ...input, createdAt: new Date('2026-07-10T12:00:00.000Z') };
    state.clients.set(client.clientId, client);
    return client;
  }),
  validateMcpAuthorizationRequest: vi.fn(async (input: { clientId: string; redirectUri: string; scopes: string[]; codeChallenge: string }) => {
    const client = state.clients.get(input.clientId);
    if (!client) throw new McpOAuthError('invalid_client', 'OAuth client is not registered');
    if (!client.redirectUris.includes(input.redirectUri)) throw new McpOAuthError('invalid_grant', 'Redirect URI does not match');
    if (input.scopes.some((scope) => !client.allowedScopes.includes(scope))) throw new McpOAuthError('invalid_scope', 'Requested scopes are not permitted');
    return { ...input, clientName: client.name };
  }),
  issueMcpAuthorizationCode: vi.fn(async (input: { clientId: string; userId: string; redirectUri: string; scopes: string[]; codeChallenge: string }) => {
    const code = 'mcp_ac_connection_flow';
    state.codes.set(code, input);
    return { authorizationCode: code, expiresAt: new Date(Date.now() + 300_000) };
  }),
  exchangeMcpAuthorizationCode: vi.fn(async (input: { clientId: string; authorizationCode: string; redirectUri: string; codeVerifier: string }) => {
    const grant = state.codes.get(input.authorizationCode);
    if (!grant || grant.clientId !== input.clientId || grant.redirectUri !== input.redirectUri || !input.codeVerifier) {
      throw new McpOAuthError('invalid_grant', 'Authorization code is invalid');
    }
    state.codes.delete(input.authorizationCode);
    const accessToken = 'mcp_at_connection_flow';
    const token = { id: 'c3333333-3333-4333-8333-333333333333', userId: grant.userId, clientId: 'b2222222-2222-4222-8222-222222222222', scopes: grant.scopes, expiresAt: new Date(Date.now() + 3_600_000) };
    state.tokens.set(accessToken, token);
    return { accessToken, refreshToken: 'mcp_rt_connection_flow', expiresAt: token.expiresAt, scopes: token.scopes };
  }),
  rotateMcpRefreshToken: vi.fn(),
  validateMcpAccessToken: vi.fn(async (accessToken: string) => state.tokens.get(accessToken) ?? null),
  recordMcpAuditEvent: vi.fn(async (event: Record<string, unknown>) => {
    state.audits.push(event);
    return { id: 'audit-event' };
  }),
}));
vi.mock('@/lib/mcp/task-tools', () => mocks);

import { POST as register } from '@/app/oauth/register/route';
import { GET as authorize } from '@/app/oauth/authorize/route';
import { POST as consent } from '@/app/oauth/consent/route';
import { POST as token } from '@/app/oauth/token/route';
import { POST as mcp } from '@/app/api/mcp/route';

const redirectUri = 'https://claude.ai/api/mcp/auth_callback';
const codeChallenge = 'x'.repeat(43);

function request(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`https://central.example${path}`, init);
}

describe('MCP OAuth connection flow', () => {
  beforeEach(() => {
    state.clients.clear();
    state.codes.clear();
    state.tokens.clear();
    state.audits.length = 0;
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'https://central.example';
    process.env.AUTH_SECRET = 'connection-flow-test-secret';
  });

  it('registers a Claude-style public client, grants consent, exchanges a code, and initializes MCP', async () => {
    const registration = await register(request('/oauth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_name: 'Claude', redirect_uris: [redirectUri], scope: 'tasks:read', token_endpoint_auth_method: 'none' }),
    }));
    expect(registration.status).toBe(201);
    const { client_id: clientId } = await registration.json();

    const authorization = await authorize(request(`/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=tasks%3Aread&code_challenge=${codeChallenge}&code_challenge_method=S256&state=claude-state`));
    expect(authorization.status).toBe(200);
    const consentHtml = await authorization.text();
    const signedRequest = consentHtml.match(/name="request" value="([^"]+)"/)?.[1];
    expect(signedRequest).toBeTruthy();

    const approved = await consent(request('/oauth/consent', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ request: signedRequest!, decision: 'approve' }),
    }));
    const callback = new URL(approved.headers.get('location')!);
    expect(callback.origin + callback.pathname).toBe(redirectUri);
    expect(callback.searchParams.get('state')).toBe('claude-state');

    const exchanged = await token(request('/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, code: callback.searchParams.get('code')!, redirect_uri: redirectUri, code_verifier: 'connection-flow-verifier' }),
    }));
    expect(exchanged.status).toBe(200);
    const credentials = await exchanged.json();

    const initialized = await mcp(request('/api/mcp', {
      method: 'POST',
      headers: { authorization: `Bearer ${credentials.access_token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'Claude', version: 'test' } } }),
    }));
    expect(initialized.status).toBe(200);
    await expect(initialized.json()).resolves.toMatchObject({ result: { serverInfo: { name: 'central' } } });
    const sessionId = initialized.headers.get('mcp-session-id');
    expect(sessionId).toBeTruthy();

    const tools = await mcp(request('/api/mcp', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${credentials.access_token}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId!,
        'mcp-protocol-version': '2025-06-18',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    }));
    await expect(tools.json()).resolves.toMatchObject({
      result: {
        tools: [
          { name: 'central_list_boards' },
          { name: 'central_list_tasks' },
          { name: 'central_get_task' },
        ],
      },
    });
  });
});
