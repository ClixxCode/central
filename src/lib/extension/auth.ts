import crypto from 'crypto';
import { db } from '@/lib/db';
import { extensionTokens } from '@/lib/db/schema';
import { users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { SessionUser } from '@/lib/auth/session';

const TOKEN_PREFIX = 'cntrl_';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Authenticate a request using a Bearer token from the Authorization header.
 * Returns a SessionUser or null if the token is invalid.
 */
export async function requireTokenAuth(request: Request): Promise<SessionUser | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const rawToken = authHeader.slice(7);
  if (!rawToken.startsWith(TOKEN_PREFIX)) return null;

  const tokenHash = hashToken(rawToken);

  const result = await db
    .select({
      tokenId: extensionTokens.id,
      userId: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      role: users.role,
    })
    .from(extensionTokens)
    .innerJoin(users, eq(users.id, extensionTokens.userId))
    .where(eq(extensionTokens.tokenHash, tokenHash))
    .limit(1);

  if (result.length === 0) return null;

  const row = result[0];

  // Update lastUsedAt (fire-and-forget)
  db.update(extensionTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(extensionTokens.id, row.tokenId))
    .catch(() => {});

  return {
    id: row.userId,
    email: row.email,
    name: row.name,
    image: row.image ?? null,
    role: row.role as 'admin' | 'user',
  };
}

/**
 * Generate a new API token for a user. Returns the raw token (only shown once).
 */
export async function generateToken(userId: string, name?: string): Promise<string> {
  const randomBytes = crypto.randomBytes(20).toString('hex'); // 40 hex chars
  const rawToken = `${TOKEN_PREFIX}${randomBytes}`;
  const tokenHash = hashToken(rawToken);

  await db.insert(extensionTokens).values({
    userId,
    tokenHash,
    name: name || 'API Token',
  });

  return rawToken;
}

/**
 * Revoke (hard delete) a token.
 */
export async function revokeToken(tokenId: string, userId: string): Promise<boolean> {
  const result = await db
    .delete(extensionTokens)
    .where(and(eq(extensionTokens.id, tokenId), eq(extensionTokens.userId, userId)))
    .returning({ id: extensionTokens.id });

  return result.length > 0;
}

/**
 * List all tokens for a user.
 */
export async function listTokens(userId: string) {
  return db
    .select({
      id: extensionTokens.id,
      name: extensionTokens.name,
      lastUsedAt: extensionTokens.lastUsedAt,
      createdAt: extensionTokens.createdAt,
    })
    .from(extensionTokens)
    .where(eq(extensionTokens.userId, userId));
}
