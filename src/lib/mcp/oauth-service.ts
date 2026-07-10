import 'server-only';

import crypto from 'crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  mcpAccessTokens,
  mcpAuditEvents,
  mcpAuthorizationCodes,
  mcpOAuthClients,
  mcpRefreshTokens,
  type McpAuditMetadata,
} from '@/lib/db/schema';

const AUTHORIZATION_CODE_TTL_MS = 5 * 60 * 1000;
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class McpOAuthError extends Error {
  constructor(
    public readonly code: 'invalid_client' | 'invalid_grant' | 'invalid_scope',
    message: string
  ) {
    super(message);
    this.name = 'McpOAuthError';
  }
}

export function hashMcpCredential(credential: string): string {
  return crypto.createHash('sha256').update(credential).digest('hex');
}

function generateCredential(prefix: string): string {
  return `${prefix}${crypto.randomBytes(32).toString('base64url')}`;
}

function normalizedScopes(scopes: readonly string[]): string[] {
  return [...new Set(scopes.map((scope) => scope.trim()).filter(Boolean))];
}

function assertRedirectUri(redirectUri: string): void {
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    throw new McpOAuthError('invalid_client', 'Redirect URI must be an absolute URL');
  }

  const isLocalHttp =
    url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  if ((url.protocol !== 'https:' && !isLocalHttp) || url.hash) {
    throw new McpOAuthError('invalid_client', 'Redirect URI must use HTTPS and cannot include a fragment');
  }
}

function assertRequestedScopes(requestedScopes: readonly string[], allowedScopes: readonly string[]): string[] {
  const scopes = normalizedScopes(requestedScopes);
  if (scopes.length === 0 || scopes.some((scope) => !allowedScopes.includes(scope))) {
    throw new McpOAuthError('invalid_scope', 'Requested scopes are not permitted for this client');
  }

  return scopes;
}

function pkceChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function matchesPkceChallenge(verifier: string, expectedChallenge: string): boolean {
  const actual = Buffer.from(pkceChallenge(verifier));
  const expected = Buffer.from(expectedChallenge);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export async function registerMcpOAuthClient(input: {
  clientId: string;
  name: string;
  redirectUris: string[];
  allowedScopes: string[];
}) {
  const clientId = input.clientId.trim();
  const name = input.name.trim();
  const redirectUris = [...new Set(input.redirectUris.map((uri) => uri.trim()).filter(Boolean))];
  const allowedScopes = normalizedScopes(input.allowedScopes);

  if (!clientId || !name || redirectUris.length === 0 || allowedScopes.length === 0) {
    throw new McpOAuthError('invalid_client', 'Client ID, name, redirect URI, and allowed scopes are required');
  }
  redirectUris.forEach(assertRedirectUri);

  const [client] = await db
    .insert(mcpOAuthClients)
    .values({ clientId, name, redirectUris, allowedScopes })
    .returning();

  return client;
}

/** Issue a short-lived authorization code after an authenticated user approves a client. */
export async function issueMcpAuthorizationCode(input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string;
  now?: Date;
}) {
  const client = await db.query.mcpOAuthClients.findFirst({
    where: eq(mcpOAuthClients.clientId, input.clientId),
  });
  if (!client) throw new McpOAuthError('invalid_client', 'OAuth client is not registered');
  if (!client.redirectUris.includes(input.redirectUri)) {
    throw new McpOAuthError('invalid_grant', 'Redirect URI does not match the registered client');
  }

  const scopes = assertRequestedScopes(input.scopes, client.allowedScopes);
  const codeChallenge = input.codeChallenge.trim();
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge)) {
    throw new McpOAuthError('invalid_grant', 'A valid S256 PKCE code challenge is required');
  }

  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + AUTHORIZATION_CODE_TTL_MS);
  const authorizationCode = generateCredential('mcp_ac_');

  await db.insert(mcpAuthorizationCodes).values({
    clientId: client.id,
    userId: input.userId,
    codeHash: hashMcpCredential(authorizationCode),
    redirectUri: input.redirectUri,
    scopes,
    codeChallenge,
    expiresAt,
  });
  await recordMcpAuditEvent({
    userId: input.userId,
    clientId: client.id,
    eventType: 'oauth.authorization_code_issued',
    metadata: { scopes, expiresAt: expiresAt.toISOString() },
  });

  return { authorizationCode, expiresAt };
}

/** Atomically consume an authorization code and return a bearer token exactly once. */
export async function exchangeMcpAuthorizationCode(input: {
  clientId: string;
  authorizationCode: string;
  redirectUri: string;
  codeVerifier: string;
  now?: Date;
}) {
  const client = await db.query.mcpOAuthClients.findFirst({
    where: eq(mcpOAuthClients.clientId, input.clientId),
  });
  if (!client) throw new McpOAuthError('invalid_client', 'OAuth client is not registered');

  const now = input.now ?? new Date();
  const authorizationCode = await db.query.mcpAuthorizationCodes.findFirst({
    where: and(
      eq(mcpAuthorizationCodes.codeHash, hashMcpCredential(input.authorizationCode)),
      eq(mcpAuthorizationCodes.clientId, client.id),
      eq(mcpAuthorizationCodes.redirectUri, input.redirectUri),
      gt(mcpAuthorizationCodes.expiresAt, now),
      isNull(mcpAuthorizationCodes.consumedAt)
    ),
  });
  if (!authorizationCode || !matchesPkceChallenge(input.codeVerifier, authorizationCode.codeChallenge)) {
    throw new McpOAuthError('invalid_grant', 'Authorization code is invalid, expired, or already used');
  }

  const [consumedCode] = await db
    .update(mcpAuthorizationCodes)
    .set({ consumedAt: now })
    .where(
      and(
        eq(mcpAuthorizationCodes.id, authorizationCode.id),
        isNull(mcpAuthorizationCodes.consumedAt),
        gt(mcpAuthorizationCodes.expiresAt, now)
      )
    )
    .returning({ id: mcpAuthorizationCodes.id });
  if (!consumedCode) {
    throw new McpOAuthError('invalid_grant', 'Authorization code has already been used');
  }

  const tokens = await issueMcpTokenPair({
    clientId: client.id,
    userId: authorizationCode.userId,
    scopes: authorizationCode.scopes,
    now,
  });

  await recordMcpAuditEvent({
    userId: authorizationCode.userId,
    clientId: client.id,
    accessTokenId: tokens.accessTokenId,
    eventType: 'oauth.access_token_issued',
    metadata: { scopes: authorizationCode.scopes, expiresAt: tokens.expiresAt.toISOString() },
  });

  return { ...tokens, scopes: authorizationCode.scopes };
}

async function issueMcpTokenPair(input: {
  clientId: string;
  userId: string;
  scopes: string[];
  now: Date;
  refreshTokenFamilyId?: string;
}) {
  const accessToken = generateCredential('mcp_at_');
  const refreshToken = generateCredential('mcp_rt_');
  const expiresAt = new Date(input.now.getTime() + ACCESS_TOKEN_TTL_MS);
  const refreshTokenExpiresAt = new Date(input.now.getTime() + REFRESH_TOKEN_TTL_MS);
  const refreshTokenFamilyId = input.refreshTokenFamilyId ?? crypto.randomUUID();
  const [accessTokenRecord] = await db
    .insert(mcpAccessTokens)
    .values({
      clientId: input.clientId,
      userId: input.userId,
      tokenHash: hashMcpCredential(accessToken),
      scopes: input.scopes,
      expiresAt,
    })
    .returning({ id: mcpAccessTokens.id });
  await db.insert(mcpRefreshTokens).values({
    familyId: refreshTokenFamilyId,
    clientId: input.clientId,
    userId: input.userId,
    tokenHash: hashMcpCredential(refreshToken),
    scopes: input.scopes,
    expiresAt: refreshTokenExpiresAt,
  });

  return {
    accessToken,
    accessTokenId: accessTokenRecord.id,
    expiresAt,
    refreshToken,
    refreshTokenExpiresAt,
  };
}

/**
 * Rotate a refresh token. Reuse of an already rotated credential revokes the
 * entire family, preventing a stolen old token from continuing a session.
 */
export async function rotateMcpRefreshToken(input: {
  clientId: string;
  refreshToken: string;
  now?: Date;
}) {
  const client = await db.query.mcpOAuthClients.findFirst({
    where: eq(mcpOAuthClients.clientId, input.clientId),
  });
  if (!client) throw new McpOAuthError('invalid_client', 'OAuth client is not registered');

  const now = input.now ?? new Date();
  const refreshToken = await db.query.mcpRefreshTokens.findFirst({
    where: and(
      eq(mcpRefreshTokens.tokenHash, hashMcpCredential(input.refreshToken)),
      eq(mcpRefreshTokens.clientId, client.id)
    ),
  });
  if (!refreshToken || refreshToken.expiresAt <= now) {
    throw new McpOAuthError('invalid_grant', 'Refresh token is invalid or expired');
  }

  if (refreshToken.revokedAt) {
    await revokeMcpRefreshTokenFamily(refreshToken.familyId, now);
    await recordMcpAuditEvent({
      userId: refreshToken.userId,
      clientId: client.id,
      eventType: 'oauth.refresh_token_reuse_detected',
    });
    throw new McpOAuthError('invalid_grant', 'Refresh token reuse detected');
  }

  const [rotated] = await db
    .update(mcpRefreshTokens)
    .set({ revokedAt: now, rotatedAt: now })
    .where(and(eq(mcpRefreshTokens.id, refreshToken.id), isNull(mcpRefreshTokens.revokedAt)))
    .returning({ id: mcpRefreshTokens.id });
  if (!rotated) {
    await revokeMcpRefreshTokenFamily(refreshToken.familyId, now);
    throw new McpOAuthError('invalid_grant', 'Refresh token reuse detected');
  }

  const tokens = await issueMcpTokenPair({
    clientId: client.id,
    userId: refreshToken.userId,
    scopes: refreshToken.scopes,
    now,
    refreshTokenFamilyId: refreshToken.familyId,
  });
  await recordMcpAuditEvent({
    userId: refreshToken.userId,
    clientId: client.id,
    accessTokenId: tokens.accessTokenId,
    eventType: 'oauth.refresh_token_rotated',
  });

  return { ...tokens, scopes: refreshToken.scopes };
}

async function revokeMcpRefreshTokenFamily(familyId: string, now: Date): Promise<void> {
  await db
    .update(mcpRefreshTokens)
    .set({ revokedAt: now })
    .where(and(eq(mcpRefreshTokens.familyId, familyId), isNull(mcpRefreshTokens.revokedAt)));
}

/** Revoke all active descendants of a refresh-token family for a client session. */
export async function revokeMcpRefreshToken(input: {
  clientId: string;
  refreshToken: string;
  now?: Date;
}): Promise<boolean> {
  const client = await db.query.mcpOAuthClients.findFirst({
    where: eq(mcpOAuthClients.clientId, input.clientId),
  });
  if (!client) return false;

  const refreshToken = await db.query.mcpRefreshTokens.findFirst({
    where: and(
      eq(mcpRefreshTokens.tokenHash, hashMcpCredential(input.refreshToken)),
      eq(mcpRefreshTokens.clientId, client.id)
    ),
  });
  if (!refreshToken) return false;

  const now = input.now ?? new Date();
  const revoked = await db
    .update(mcpRefreshTokens)
    .set({ revokedAt: now })
    .where(and(eq(mcpRefreshTokens.familyId, refreshToken.familyId), isNull(mcpRefreshTokens.revokedAt)))
    .returning({ id: mcpRefreshTokens.id });
  if (revoked.length === 0) return false;

  await recordMcpAuditEvent({
    userId: refreshToken.userId,
    clientId: client.id,
    eventType: 'oauth.refresh_token_revoked',
  });
  return true;
}

/** Validate a bearer token for MCP tool execution and record its use. */
export async function validateMcpAccessToken(accessToken: string, now = new Date()) {
  const token = await db.query.mcpAccessTokens.findFirst({
    where: and(
      eq(mcpAccessTokens.tokenHash, hashMcpCredential(accessToken)),
      gt(mcpAccessTokens.expiresAt, now),
      isNull(mcpAccessTokens.revokedAt)
    ),
  });
  if (!token) return null;

  await db
    .update(mcpAccessTokens)
    .set({ lastUsedAt: now })
    .where(eq(mcpAccessTokens.id, token.id));
  await recordMcpAuditEvent({
    userId: token.userId,
    clientId: token.clientId,
    accessTokenId: token.id,
    eventType: 'oauth.access_token_validated',
  });

  return { id: token.id, userId: token.userId, clientId: token.clientId, scopes: token.scopes, expiresAt: token.expiresAt };
}

/** Revoke a bearer token while retaining its audit trail. */
export async function revokeMcpAccessToken(accessToken: string, now = new Date()): Promise<boolean> {
  const [token] = await db
    .update(mcpAccessTokens)
    .set({ revokedAt: now })
    .where(and(eq(mcpAccessTokens.tokenHash, hashMcpCredential(accessToken)), isNull(mcpAccessTokens.revokedAt)))
    .returning({ id: mcpAccessTokens.id, userId: mcpAccessTokens.userId, clientId: mcpAccessTokens.clientId });
  if (!token) return false;

  await recordMcpAuditEvent({
    userId: token.userId,
    clientId: token.clientId,
    accessTokenId: token.id,
    eventType: 'oauth.access_token_revoked',
  });
  return true;
}

export async function recordMcpAuditEvent(input: {
  userId?: string;
  clientId?: string;
  accessTokenId?: string;
  eventType: string;
  toolName?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: McpAuditMetadata;
}) {
  const [event] = await db
    .insert(mcpAuditEvents)
    .values({
      userId: input.userId,
      clientId: input.clientId,
      accessTokenId: input.accessTokenId,
      eventType: input.eventType,
      toolName: input.toolName,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metadata: input.metadata ?? {},
    })
    .returning();

  return event;
}
