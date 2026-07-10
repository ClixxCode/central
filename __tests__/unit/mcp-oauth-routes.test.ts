import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  validateMcpAuthorizationRequest: vi.fn(),
  issueMcpAuthorizationCode: vi.fn(),
  exchangeMcpAuthorizationCode: vi.fn(),
  rotateMcpRefreshToken: vi.fn(),
  registerMcpOAuthClient: vi.fn(),
  McpOAuthError: class McpOAuthError extends Error {
    constructor(
      public readonly code: 'invalid_client' | 'invalid_grant' | 'invalid_scope',
      message: string
    ) {
      super(message);
    }
  },
}));

vi.mock('@/lib/auth/session', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/lib/mcp/oauth-service', () => ({
  McpOAuthError: mocks.McpOAuthError,
  validateMcpAuthorizationRequest: mocks.validateMcpAuthorizationRequest,
  issueMcpAuthorizationCode: mocks.issueMcpAuthorizationCode,
  exchangeMcpAuthorizationCode: mocks.exchangeMcpAuthorizationCode,
  rotateMcpRefreshToken: mocks.rotateMcpRefreshToken,
  registerMcpOAuthClient: mocks.registerMcpOAuthClient,
}));

import { GET as authorizationServerMetadata } from '@/app/.well-known/oauth-authorization-server/route';
import { GET as protectedResourceMetadata } from '@/app/.well-known/oauth-protected-resource/api/mcp/route';
import { GET as authorize } from '@/app/oauth/authorize/route';
import { POST as consent } from '@/app/oauth/consent/route';
import { POST as token } from '@/app/oauth/token/route';
import { POST as register } from '@/app/oauth/register/route';
import { signAuthorizationRequest } from '@/lib/mcp/oauth-http';

const user = { id: 'a1111111-1111-4111-8111-111111111111' };
const authorizationRequest = {
  clientId: 'claude-desktop',
  redirectUri: 'https://claude.ai/api/mcp/auth_callback',
  scopes: ['tasks:read'],
  codeChallenge: 'x'.repeat(43),
  state: 'opaque-state',
};
const validatedRequest = { ...authorizationRequest, clientName: 'Claude Desktop' };

function request(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`https://request-origin.test${path}`, init);
}

describe('MCP OAuth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'https://central.example/';
    process.env.AUTH_SECRET = 'test-oauth-secret';
  });

  it('publishes authorization-server and path-derived protected-resource metadata', async () => {
    const authorizationMetadata = await (await authorizationServerMetadata(request('/.well-known/oauth-authorization-server'))).json();
    const resourceMetadata = await (await protectedResourceMetadata(request('/.well-known/oauth-protected-resource/api/mcp'))).json();

    expect(authorizationMetadata).toMatchObject({
      issuer: 'https://central.example',
      authorization_endpoint: 'https://central.example/oauth/authorize',
      token_endpoint: 'https://central.example/oauth/token',
      registration_endpoint: 'https://central.example/oauth/register',
      code_challenge_methods_supported: ['S256'],
      protected_resources: ['https://central.example/api/mcp'],
    });
    expect(resourceMetadata).toEqual({
      resource: 'https://central.example/api/mcp',
      authorization_servers: ['https://central.example'],
      bearer_methods_supported: ['header'],
      scopes_supported: ['tasks:read', 'tasks:write'],
    });
  });

  it('redirects unauthenticated authorization requests to Central login', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const response = await authorize(request(`/oauth/authorize?response_type=code&client_id=claude-desktop&redirect_uri=${encodeURIComponent(authorizationRequest.redirectUri)}&scope=tasks%3Aread&code_challenge=${authorizationRequest.codeChallenge}&code_challenge_method=S256`));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login?callbackUrl=');
    expect(mocks.validateMcpAuthorizationRequest).not.toHaveBeenCalled();
  });

  it('renders a no-store consent page only for a validated authenticated authorization request', async () => {
    mocks.getCurrentUser.mockResolvedValue(user);
    mocks.validateMcpAuthorizationRequest.mockResolvedValue(validatedRequest);
    const response = await authorize(request(`/oauth/authorize?response_type=code&client_id=claude-desktop&redirect_uri=${encodeURIComponent(authorizationRequest.redirectUri)}&scope=tasks%3Aread&code_challenge=${authorizationRequest.codeChallenge}&code_challenge_method=S256&state=opaque-state`));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.text()).resolves.toContain('Connect Claude Desktop?');
  });

  it('issues an authorization code only after explicit consent and redirects with the preserved state', async () => {
    mocks.getCurrentUser.mockResolvedValue(user);
    mocks.validateMcpAuthorizationRequest.mockResolvedValue(validatedRequest);
    mocks.issueMcpAuthorizationCode.mockResolvedValue({ authorizationCode: 'mcp_ac_new' });
    const form = new URLSearchParams({ request: signAuthorizationRequest(authorizationRequest), decision: 'approve' });
    const response = await consent(request('/oauth/consent', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form,
    }));

    expect(mocks.issueMcpAuthorizationCode).toHaveBeenCalledWith(expect.objectContaining({ userId: user.id, scopes: ['tasks:read'] }));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://claude.ai/api/mcp/auth_callback?code=mcp_ac_new&state=opaque-state');
  });

  it('returns OAuth errors for malformed authorization and token requests', async () => {
    const invalidAuthorization = await authorize(request('/oauth/authorize?response_type=token'));
    expect(invalidAuthorization.status).toBe(400);
    await expect(invalidAuthorization.json()).resolves.toMatchObject({ error: 'invalid_grant' });

    const invalidToken = await token(request('/oauth/token', { method: 'POST', body: 'grant_type=authorization_code' }));
    expect(invalidToken.status).toBe(400);
    await expect(invalidToken.json()).resolves.toMatchObject({ error: 'invalid_request' });
  });

  it('exchanges code and refresh grants through the credential service', async () => {
    mocks.exchangeMcpAuthorizationCode.mockResolvedValue({
      accessToken: 'mcp_at_code', refreshToken: 'mcp_rt_code', expiresAt: new Date(Date.now() + 60_000), scopes: ['tasks:read'],
    });
    mocks.rotateMcpRefreshToken.mockResolvedValue({
      accessToken: 'mcp_at_refresh', refreshToken: 'mcp_rt_refresh', expiresAt: new Date(Date.now() + 60_000), scopes: ['tasks:read'],
    });

    const codeResponse = await token(request('/oauth/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: 'claude-desktop', code: 'mcp_ac_code', redirect_uri: authorizationRequest.redirectUri, code_verifier: 'a'.repeat(43) }),
    }));
    const refreshResponse = await token(request('/oauth/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: 'claude-desktop', refresh_token: 'mcp_rt_code' }),
    }));

    await expect(codeResponse.json()).resolves.toMatchObject({ access_token: 'mcp_at_code', token_type: 'Bearer', scope: 'tasks:read' });
    await expect(refreshResponse.json()).resolves.toMatchObject({ access_token: 'mcp_at_refresh', refresh_token: 'mcp_rt_refresh' });
    expect(mocks.rotateMcpRefreshToken).toHaveBeenCalledWith({ clientId: 'claude-desktop', refreshToken: 'mcp_rt_code' });
  });

  it('registers PKCE-only dynamic clients and rejects unsupported client metadata', async () => {
    mocks.registerMcpOAuthClient.mockResolvedValue({
      clientId: 'mcp_client_new', name: 'Claude Desktop', redirectUris: [authorizationRequest.redirectUri], allowedScopes: ['tasks:read'], createdAt: new Date('2026-07-10T12:00:00.000Z'),
    });
    const response = await register(request('/oauth/register', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_name: 'Claude Desktop', redirect_uris: [authorizationRequest.redirectUri], scope: 'tasks:read', token_endpoint_auth_method: 'none' }),
    }));
    const unsupported = await register(request('/oauth/register', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ redirect_uris: [authorizationRequest.redirectUri], scope: 'tasks:read', token_endpoint_auth_method: 'client_secret_basic' }),
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ client_id: 'mcp_client_new', token_endpoint_auth_method: 'none' });
    expect(mocks.registerMcpOAuthClient).toHaveBeenCalledWith(expect.objectContaining({ allowedScopes: ['tasks:read'] }));
    expect(unsupported.status).toBe(400);
    await expect(unsupported.json()).resolves.toMatchObject({ error: 'invalid_client_metadata' });
  });
});
