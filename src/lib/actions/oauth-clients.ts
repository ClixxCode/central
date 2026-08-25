'use server';

import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  oauthAccessTokens,
  oauthClients,
  oauthGrants,
  oauthRefreshTokens,
} from '@/lib/db/schema';
import { requireAdmin, requireAuth } from '@/lib/auth/session';
import { registerOAuthClient } from '@/lib/oauth/clients';
import { revokeGrant } from '@/lib/oauth/tokens';
import { recordOAuthAudit } from '@/lib/oauth/audit';
import { mcpResourceUrl } from '@/lib/oauth/config';

export async function listOAuthConnections() {
  const user = await requireAuth();
  const grants = await db
    .select({
      id: oauthGrants.id,
      clientId: oauthGrants.clientId,
      clientName: oauthGrants.clientName,
      scopes: oauthGrants.scopes,
      createdAt: oauthGrants.createdAt,
      updatedAt: oauthGrants.updatedAt,
      lastUsedAt: oauthGrants.lastUsedAt,
    })
    .from(oauthGrants)
    .where(and(eq(oauthGrants.userId, user.id), isNull(oauthGrants.revokedAt)))
    .orderBy(desc(oauthGrants.lastUsedAt), desc(oauthGrants.createdAt));
  return { success: true as const, grants };
}

export async function revokeOAuthConnection(grantId: string) {
  const user = await requireAuth();
  const revoked = await revokeGrant(grantId, user.id);
  if (!revoked) return { success: false as const, error: 'Connection not found' };
  recordOAuthAudit({ userId: user.id, event: 'grant.revoked', outcome: 'success' });
  return { success: true as const };
}

export async function listStaticOAuthClients() {
  await requireAdmin();
  const clients = await db
    .select({
      id: oauthClients.id,
      clientId: oauthClients.clientId,
      clientName: oauthClients.clientName,
      redirectUris: oauthClients.redirectUris,
      tokenEndpointAuthMethod: oauthClients.tokenEndpointAuthMethod,
      active: oauthClients.active,
      createdAt: oauthClients.createdAt,
      lastUsedAt: oauthClients.lastUsedAt,
    })
    .from(oauthClients)
    .where(eq(oauthClients.registrationType, 'static'))
    .orderBy(desc(oauthClients.createdAt));
  return { success: true as const, clients };
}

export async function createStaticOAuthClient(input: {
  name: string;
  redirectUris: string[];
}) {
  const admin = await requireAdmin();
  try {
    const client = await registerOAuthClient({
      clientName: input.name,
      redirectUris: input.redirectUris,
      tokenEndpointAuthMethod: 'client_secret_basic',
      applicationType: 'web',
      registrationType: 'static',
      createdBy: admin.id,
    });
    recordOAuthAudit({
      userId: admin.id,
      clientId: client.clientId,
      event: 'client.static_created',
      outcome: 'success',
    });
    return {
      success: true as const,
      clientId: client.clientId,
      clientSecret: client.clientSecret!,
      mcpUrl: mcpResourceUrl(),
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to create OAuth client',
    };
  }
}

export async function revokeStaticOAuthClient(clientId: string) {
  const admin = await requireAdmin();
  const [client] = await db
    .update(oauthClients)
    .set({ active: false, updatedAt: new Date() })
    .where(and(eq(oauthClients.clientId, clientId), eq(oauthClients.registrationType, 'static')))
    .returning({ clientId: oauthClients.clientId });
  if (!client) return { success: false as const, error: 'OAuth client not found' };
  const now = new Date();
  await Promise.all([
    db.update(oauthGrants).set({ revokedAt: now }).where(eq(oauthGrants.clientId, clientId)),
    db.update(oauthAccessTokens).set({ revokedAt: now }).where(eq(oauthAccessTokens.clientId, clientId)),
    db.update(oauthRefreshTokens).set({ revokedAt: now }).where(eq(oauthRefreshTokens.clientId, clientId)),
  ]);
  recordOAuthAudit({
    userId: admin.id,
    clientId,
    event: 'client.static_revoked',
    outcome: 'success',
  });
  return { success: true as const };
}
