import { beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';
import { mcpAccessTokens, mcpAuditEvents, mcpRefreshTokens } from '@/lib/db/schema';

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
  clientFindFirst: vi.fn(),
  codeFindFirst: vi.fn(),
  tokenFindFirst: vi.fn(),
  refreshTokenFindFirst: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  db: {
    insert: mocks.insert,
    update: mocks.update,
    query: {
      mcpOAuthClients: { findFirst: mocks.clientFindFirst },
      mcpAuthorizationCodes: { findFirst: mocks.codeFindFirst },
      mcpAccessTokens: { findFirst: mocks.tokenFindFirst },
      mcpRefreshTokens: { findFirst: mocks.refreshTokenFindFirst },
    },
  },
}));

const now = new Date('2026-07-10T15:00:00.000Z');
const userId = 'a1111111-1111-4111-8111-111111111111';
const client = {
  id: 'b2222222-2222-4222-8222-222222222222',
  clientId: 'claude-desktop',
  redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
  allowedScopes: ['tasks:read', 'tasks:write'],
};
const verifier = 'x'.repeat(43);

function s256Challenge(value: string) {
  return crypto.createHash('sha256').update(value).digest('base64url');
}

function mockInsert() {
  const values = vi.fn(() => ({
    returning: vi.fn().mockResolvedValue([{ id: 'audit-event' }]),
  }));
  mocks.insert.mockReturnValue({ values });
  return values;
}

function mockUpdate(rows: unknown[]) {
  const returning = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  mocks.update.mockReturnValue({ set });
  return { set, where, returning };
}

describe('MCP OAuth service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('issues only a hashed, PKCE-bound authorization code for a registered redirect URI', async () => {
    mocks.clientFindFirst.mockResolvedValue(client);
    const values = mockInsert();
    const { issueMcpAuthorizationCode, hashMcpCredential } = await import('@/lib/mcp/oauth-service');

    const result = await issueMcpAuthorizationCode({
      clientId: client.clientId,
      userId,
      redirectUri: client.redirectUris[0],
      scopes: ['tasks:read'],
      codeChallenge: s256Challenge(verifier),
      now,
    });

    expect(result.authorizationCode).toMatch(/^mcp_ac_/);
    expect(result.expiresAt).toEqual(new Date(now.getTime() + 5 * 60 * 1000));
    expect(values).toHaveBeenNthCalledWith(1, expect.objectContaining({
      clientId: client.id,
      userId,
      codeHash: hashMcpCredential(result.authorizationCode),
      scopes: ['tasks:read'],
    }));
    expect(mocks.insert).toHaveBeenNthCalledWith(2, mcpAuditEvents);
  });

  it('rejects an unregistered redirect URI and scopes outside the client grant', async () => {
    mocks.clientFindFirst.mockResolvedValue(client);
    mockInsert();
    const { issueMcpAuthorizationCode, McpOAuthError } = await import('@/lib/mcp/oauth-service');

    await expect(issueMcpAuthorizationCode({
      clientId: client.clientId,
      userId,
      redirectUri: 'https://attacker.example/callback',
      scopes: ['tasks:read'],
      codeChallenge: s256Challenge(verifier),
      now,
    })).rejects.toBeInstanceOf(McpOAuthError);

    await expect(issueMcpAuthorizationCode({
      clientId: client.clientId,
      userId,
      redirectUri: client.redirectUris[0],
      scopes: ['admin:all'],
      codeChallenge: s256Challenge(verifier),
      now,
    })).rejects.toMatchObject({ code: 'invalid_scope' });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('consumes a valid authorization code once and stores only a token hash', async () => {
    mocks.clientFindFirst.mockResolvedValue(client);
    mocks.codeFindFirst.mockResolvedValue({
      id: 'c3333333-3333-4333-8333-333333333333',
      userId,
      codeChallenge: s256Challenge(verifier),
      scopes: ['tasks:read'],
    });
    const consumption = mockUpdate([{ id: 'c3333333-3333-4333-8333-333333333333' }]);
    mocks.insert.mockImplementation((table) => {
      const returning = vi.fn().mockResolvedValue([{ id: table === mcpAccessTokens ? 'token-id' : 'audit-event' }]);
      return { values: vi.fn(() => ({ returning })) };
    });
    const { exchangeMcpAuthorizationCode, hashMcpCredential } = await import('@/lib/mcp/oauth-service');

    const result = await exchangeMcpAuthorizationCode({
      clientId: client.clientId,
      authorizationCode: 'mcp_ac_not-persisted',
      redirectUri: client.redirectUris[0],
      codeVerifier: verifier,
      now,
    });

    expect(result.accessToken).toMatch(/^mcp_at_/);
    expect(consumption.set).toHaveBeenCalledWith({ consumedAt: now });
    const accessTokenValues = mocks.insert.mock.results[0].value.values;
    expect(accessTokenValues).toHaveBeenCalledWith(expect.objectContaining({
      userId,
      clientId: client.id,
      tokenHash: hashMcpCredential(result.accessToken),
      scopes: ['tasks:read'],
    }));
    const refreshTokenValues = mocks.insert.mock.results[1].value.values;
    expect(mocks.insert).toHaveBeenNthCalledWith(2, mcpRefreshTokens);
    expect(refreshTokenValues).toHaveBeenCalledWith(expect.objectContaining({
      userId,
      clientId: client.id,
      tokenHash: hashMcpCredential(result.refreshToken),
      scopes: ['tasks:read'],
    }));
  });

  it('rejects an unknown or previously consumed authorization code', async () => {
    mocks.clientFindFirst.mockResolvedValue(client);
    mocks.codeFindFirst.mockResolvedValue(undefined);
    const { exchangeMcpAuthorizationCode } = await import('@/lib/mcp/oauth-service');

    await expect(exchangeMcpAuthorizationCode({
      clientId: client.clientId,
      authorizationCode: 'mcp_ac_used',
      redirectUri: client.redirectUris[0],
      codeVerifier: verifier,
      now,
    })).rejects.toMatchObject({ code: 'invalid_grant' });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('validates active tokens, rejects missing tokens, and writes validation audit events', async () => {
    mocks.tokenFindFirst.mockResolvedValue({
      id: 'token-id', userId, clientId: client.id, scopes: ['tasks:read'], expiresAt: new Date(now.getTime() + 1000),
    });
    mockUpdate([]);
    mockInsert();
    const { validateMcpAccessToken } = await import('@/lib/mcp/oauth-service');

    await expect(validateMcpAccessToken('mcp_at_active', now)).resolves.toMatchObject({ userId, scopes: ['tasks:read'] });
    expect(mocks.insert).toHaveBeenCalledWith(mcpAuditEvents);

    mocks.tokenFindFirst.mockResolvedValue(undefined);
    await expect(validateMcpAccessToken('mcp_at_revoked', now)).resolves.toBeNull();
  });

  it('revokes a token without deleting it and persists a structured audit event', async () => {
    const revocation = mockUpdate([{ id: 'token-id', userId, clientId: client.id }]);
    const values = mockInsert();
    const { revokeMcpAccessToken } = await import('@/lib/mcp/oauth-service');

    await expect(revokeMcpAccessToken('mcp_at_active', now)).resolves.toBe(true);
    expect(revocation.set).toHaveBeenCalledWith({ revokedAt: now });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'oauth.access_token_revoked', userId, clientId: client.id, accessTokenId: 'token-id',
    }));
  });

  it('rotates refresh credentials and stores the replacement as a hash in the same family', async () => {
    mocks.clientFindFirst.mockResolvedValue(client);
    mocks.refreshTokenFindFirst.mockResolvedValue({
      id: 'refresh-id',
      familyId: 'd4444444-4444-4444-8444-444444444444',
      userId,
      clientId: client.id,
      scopes: ['tasks:read'],
      expiresAt: new Date(now.getTime() + 1000),
      revokedAt: null,
    });
    const rotation = mockUpdate([{ id: 'refresh-id' }]);
    mocks.insert.mockImplementation((table) => {
      const returning = vi.fn().mockResolvedValue([{ id: table === mcpAccessTokens ? 'next-access-token' : 'audit-event' }]);
      return { values: vi.fn(() => ({ returning })) };
    });
    const { hashMcpCredential, rotateMcpRefreshToken } = await import('@/lib/mcp/oauth-service');

    const result = await rotateMcpRefreshToken({ clientId: client.clientId, refreshToken: 'mcp_rt_old', now });

    expect(rotation.set).toHaveBeenCalledWith({ revokedAt: now, rotatedAt: now });
    expect(result.refreshToken).toMatch(/^mcp_rt_/);
    const replacementValues = mocks.insert.mock.results[1].value.values;
    expect(mocks.insert).toHaveBeenNthCalledWith(2, mcpRefreshTokens);
    expect(replacementValues).toHaveBeenCalledWith(expect.objectContaining({
      familyId: 'd4444444-4444-4444-8444-444444444444',
      tokenHash: hashMcpCredential(result.refreshToken),
    }));
  });

  it('treats replay of a rotated refresh token as reuse and revokes its active family', async () => {
    mocks.clientFindFirst.mockResolvedValue(client);
    mocks.refreshTokenFindFirst.mockResolvedValue({
      id: 'old-refresh-id',
      familyId: 'd4444444-4444-4444-8444-444444444444',
      userId,
      clientId: client.id,
      scopes: ['tasks:read'],
      expiresAt: new Date(now.getTime() + 1000),
      revokedAt: new Date(now.getTime() - 1000),
    });
    const familyRevocation = mockUpdate([]);
    const values = mockInsert();
    const { rotateMcpRefreshToken } = await import('@/lib/mcp/oauth-service');

    await expect(rotateMcpRefreshToken({ clientId: client.clientId, refreshToken: 'mcp_rt_replayed', now }))
      .rejects.toMatchObject({ code: 'invalid_grant' });
    expect(familyRevocation.set).toHaveBeenCalledWith({ revokedAt: now });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'oauth.refresh_token_reuse_detected' }));
  });

  it('revokes every active token in a refresh family', async () => {
    mocks.clientFindFirst.mockResolvedValue(client);
    mocks.refreshTokenFindFirst.mockResolvedValue({
      id: 'refresh-id',
      familyId: 'd4444444-4444-4444-8444-444444444444',
      userId,
      clientId: client.id,
      scopes: ['tasks:read'],
      expiresAt: new Date(now.getTime() + 1000),
      revokedAt: null,
    });
    const revocation = mockUpdate([{ id: 'refresh-id' }, { id: 'replacement-refresh-id' }]);
    const values = mockInsert();
    const { revokeMcpRefreshToken } = await import('@/lib/mcp/oauth-service');

    await expect(revokeMcpRefreshToken({ clientId: client.clientId, refreshToken: 'mcp_rt_active', now })).resolves.toBe(true);
    expect(revocation.set).toHaveBeenCalledWith({ revokedAt: now });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'oauth.refresh_token_revoked' }));
  });

  it('persists tool audit records without credential material', async () => {
    const values = mockInsert();
    const { recordMcpAuditEvent } = await import('@/lib/mcp/oauth-service');

    await recordMcpAuditEvent({
      userId,
      clientId: client.id,
      eventType: 'tool.invoked',
      toolName: 'tasks.list',
      metadata: { boardId: 'board-1' },
    });

    expect(mocks.insert).toHaveBeenCalledWith(mcpAuditEvents);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'tool.invoked', toolName: 'tasks.list', metadata: { boardId: 'board-1' },
    }));
  });
});
