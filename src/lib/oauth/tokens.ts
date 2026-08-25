import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  oauthAccessTokens,
  oauthAuthorizationCodes,
  oauthGrants,
  oauthRefreshTokens,
  users,
  type OAuthScope,
} from '@/lib/db/schema';
import type { SessionUser } from '@/lib/auth/session';
import type { AuthInfo } from '@modelcontextprotocol/server';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  AUTHORIZATION_CODE_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  mcpResourceUrl,
} from './config';
import { digestToken, randomOpaqueToken, verifyPkce } from './crypto';
import { OAuthRequestError } from './http';

function expiresIn(seconds: number): Date {
  return new Date(Date.now() + seconds * 1000);
}

export async function upsertGrant(input: {
  userId: string;
  clientId: string;
  clientName: string;
  resource: string;
  scopes: OAuthScope[];
}) {
  const existing = await db.query.oauthGrants.findFirst({
    where: and(
      eq(oauthGrants.userId, input.userId),
      eq(oauthGrants.clientId, input.clientId),
      eq(oauthGrants.resource, input.resource)
    ),
  });
  const scopes = [
    ...new Set([...(existing && !existing.revokedAt ? existing.scopes : []), ...input.scopes]),
  ] as OAuthScope[];
  const [grant] = await db
    .insert(oauthGrants)
    .values({ ...input, scopes })
    .onConflictDoUpdate({
      target: [oauthGrants.userId, oauthGrants.clientId, oauthGrants.resource],
      set: {
        clientName: input.clientName,
        scopes,
        revokedAt: null,
        updatedAt: new Date(),
      },
    })
    .returning();
  return grant;
}

export async function findCoveringGrant(input: {
  userId: string;
  clientId: string;
  resource: string;
  scopes: OAuthScope[];
}) {
  const grant = await db.query.oauthGrants.findFirst({
    where: and(
      eq(oauthGrants.userId, input.userId),
      eq(oauthGrants.clientId, input.clientId),
      eq(oauthGrants.resource, input.resource),
      isNull(oauthGrants.revokedAt)
    ),
  });
  return grant && input.scopes.every((scope) => grant.scopes.includes(scope)) ? grant : null;
}

export async function createAuthorizationCode(input: {
  userId: string;
  grantId: string;
  clientId: string;
  redirectUri: string;
  resource: string;
  scopes: OAuthScope[];
  codeChallenge: string;
}): Promise<string> {
  const code = randomOpaqueToken('central_code_');
  await db.insert(oauthAuthorizationCodes).values({
    ...input,
    codeHash: digestToken(code),
    expiresAt: expiresIn(AUTHORIZATION_CODE_TTL_SECONDS),
  });
  return code;
}

async function issueTokenPair(input: {
  userId: string;
  grantId: string;
  clientId: string;
  resource: string;
  scopes: OAuthScope[];
  familyId?: string;
}) {
  const accessToken = randomOpaqueToken('central_at_');
  const refreshToken = randomOpaqueToken('central_rt_');
  const accessExpiresAt = expiresIn(ACCESS_TOKEN_TTL_SECONDS);
  const refreshExpiresAt = expiresIn(REFRESH_TOKEN_TTL_SECONDS);
  const familyId = input.familyId ?? crypto.randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(oauthAccessTokens).values({
      tokenHash: digestToken(accessToken),
      userId: input.userId,
      grantId: input.grantId,
      clientId: input.clientId,
      resource: input.resource,
      scopes: input.scopes,
      expiresAt: accessExpiresAt,
    });
    await tx.insert(oauthRefreshTokens).values({
      tokenHash: digestToken(refreshToken),
      familyId,
      userId: input.userId,
      grantId: input.grantId,
      clientId: input.clientId,
      resource: input.resource,
      scopes: input.scopes,
      expiresAt: refreshExpiresAt,
    });
  });

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: input.scopes.join(' '),
  };
}

export async function exchangeAuthorizationCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  resource: string;
  codeVerifier: string;
}) {
  const authorizationCode = await db.query.oauthAuthorizationCodes.findFirst({
    where: and(
      eq(oauthAuthorizationCodes.codeHash, digestToken(input.code)),
      eq(oauthAuthorizationCodes.clientId, input.clientId),
      eq(oauthAuthorizationCodes.redirectUri, input.redirectUri),
      eq(oauthAuthorizationCodes.resource, input.resource),
      gt(oauthAuthorizationCodes.expiresAt, new Date()),
      isNull(oauthAuthorizationCodes.usedAt)
    ),
  });
  if (!authorizationCode) {
    throw new OAuthRequestError('invalid_grant', 'Authorization code is invalid, expired, or already used');
  }
  if (!verifyPkce(input.codeVerifier, authorizationCode.codeChallenge)) {
    throw new OAuthRequestError('invalid_grant', 'PKCE verification failed');
  }
  const [consumed] = await db
    .update(oauthAuthorizationCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(oauthAuthorizationCodes.id, authorizationCode.id), isNull(oauthAuthorizationCodes.usedAt)))
    .returning({ id: oauthAuthorizationCodes.id });
  if (!consumed) {
    throw new OAuthRequestError('invalid_grant', 'Authorization code has already been used');
  }
  return issueTokenPair({
    userId: authorizationCode.userId,
    grantId: authorizationCode.grantId,
    clientId: authorizationCode.clientId,
    resource: authorizationCode.resource,
    scopes: authorizationCode.scopes,
  });
}

export async function rotateRefreshToken(input: {
  refreshToken: string;
  clientId: string;
  resource: string;
  requestedScopes?: OAuthScope[];
}) {
  const tokenHash = digestToken(input.refreshToken);
  const token = await db.query.oauthRefreshTokens.findFirst({
    where: eq(oauthRefreshTokens.tokenHash, tokenHash),
  });
  if (!token || token.clientId !== input.clientId || token.resource !== input.resource) {
    throw new OAuthRequestError('invalid_grant', 'Refresh token is invalid');
  }
  if (token.rotatedAt || token.revokedAt) {
    await revokeRefreshFamily(token.familyId);
    throw new OAuthRequestError('invalid_grant', 'Refresh token reuse detected');
  }
  if (token.expiresAt <= new Date()) {
    throw new OAuthRequestError('invalid_grant', 'Refresh token has expired');
  }
  const scopes = input.requestedScopes ?? token.scopes;
  if (scopes.some((scope) => !token.scopes.includes(scope))) {
    throw new OAuthRequestError('invalid_scope', 'Refresh requests cannot expand the original scope');
  }

  const [rotated] = await db
    .update(oauthRefreshTokens)
    .set({ rotatedAt: new Date() })
    .where(and(eq(oauthRefreshTokens.id, token.id), isNull(oauthRefreshTokens.rotatedAt)))
    .returning({ id: oauthRefreshTokens.id });
  if (!rotated) {
    await revokeRefreshFamily(token.familyId);
    throw new OAuthRequestError('invalid_grant', 'Refresh token reuse detected');
  }

  const grant = await db.query.oauthGrants.findFirst({
    where: and(eq(oauthGrants.id, token.grantId), isNull(oauthGrants.revokedAt)),
  });
  const user = await db.query.users.findFirst({
    where: and(eq(users.id, token.userId), isNull(users.deactivatedAt)),
  });
  if (!grant || !user) throw new OAuthRequestError('invalid_grant', 'Authorization grant is no longer active');

  return issueTokenPair({
    userId: token.userId,
    grantId: token.grantId,
    clientId: token.clientId,
    resource: token.resource,
    scopes,
    familyId: token.familyId,
  });
}

export async function revokeRefreshFamily(familyId: string): Promise<void> {
  await db
    .update(oauthRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(oauthRefreshTokens.familyId, familyId), isNull(oauthRefreshTokens.revokedAt)));
}

export async function revokeOpaqueToken(rawToken: string, clientId: string): Promise<void> {
  const hash = digestToken(rawToken);
  await Promise.all([
    db
      .update(oauthAccessTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(oauthAccessTokens.tokenHash, hash), eq(oauthAccessTokens.clientId, clientId))),
    db.query.oauthRefreshTokens.findFirst({
      where: and(eq(oauthRefreshTokens.tokenHash, hash), eq(oauthRefreshTokens.clientId, clientId)),
    }).then((token) => (token ? revokeRefreshFamily(token.familyId) : undefined)),
  ]);
}

export interface VerifiedMcpIdentity {
  user: SessionUser;
  authInfo: AuthInfo;
  grantId: string;
}

export async function verifyMcpBearer(rawToken: string): Promise<VerifiedMcpIdentity | null> {
  const [row] = await db
    .select({
      tokenId: oauthAccessTokens.id,
      tokenExpiresAt: oauthAccessTokens.expiresAt,
      tokenScopes: oauthAccessTokens.scopes,
      tokenClientId: oauthAccessTokens.clientId,
      tokenResource: oauthAccessTokens.resource,
      grantId: oauthAccessTokens.grantId,
      userId: users.id,
      email: users.email,
      name: users.name,
      image: users.avatarUrl,
      role: users.role,
    })
    .from(oauthAccessTokens)
    .innerJoin(users, eq(users.id, oauthAccessTokens.userId))
    .innerJoin(oauthGrants, eq(oauthGrants.id, oauthAccessTokens.grantId))
    .where(
      and(
        eq(oauthAccessTokens.tokenHash, digestToken(rawToken)),
        eq(oauthAccessTokens.resource, mcpResourceUrl()),
        gt(oauthAccessTokens.expiresAt, new Date()),
        isNull(oauthAccessTokens.revokedAt),
        isNull(oauthGrants.revokedAt),
        isNull(users.deactivatedAt)
      )
    )
    .limit(1);
  if (!row) return null;

  void Promise.all([
    db.update(oauthAccessTokens).set({ lastUsedAt: new Date() }).where(eq(oauthAccessTokens.id, row.tokenId)),
    db.update(oauthGrants).set({ lastUsedAt: new Date() }).where(eq(oauthGrants.id, row.grantId)),
  ]).catch(() => {});

  return {
    user: {
      id: row.userId,
      email: row.email,
      name: row.name,
      image: row.image,
      role: row.role,
    },
    grantId: row.grantId,
    authInfo: {
      token: rawToken,
      clientId: row.tokenClientId,
      scopes: row.tokenScopes,
      expiresAt: Math.floor(row.tokenExpiresAt.getTime() / 1000),
      resource: new URL(row.tokenResource),
      extra: { userId: row.userId, grantId: row.grantId },
    },
  };
}

export async function revokeGrant(grantId: string, userId: string): Promise<boolean> {
  const [grant] = await db
    .update(oauthGrants)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(oauthGrants.id, grantId), eq(oauthGrants.userId, userId), isNull(oauthGrants.revokedAt)))
    .returning({ id: oauthGrants.id });
  if (!grant) return false;
  await Promise.all([
    db
      .update(oauthAccessTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(oauthAccessTokens.grantId, grantId), isNull(oauthAccessTokens.revokedAt))),
    db
      .update(oauthRefreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(oauthRefreshTokens.grantId, grantId), isNull(oauthRefreshTokens.revokedAt))),
  ]);
  return true;
}
