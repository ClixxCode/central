'use server';

import { requireAuth } from '@/lib/auth/session';
import { generateToken, revokeToken, listTokens } from '@/lib/extension/auth';

export async function createExtensionToken(name?: string) {
  const user = await requireAuth();

  try {
    const rawToken = await generateToken(user.id, name);
    return { success: true, token: rawToken };
  } catch (error) {
    console.error('Failed to create extension token:', error);
    return { success: false, error: 'Failed to create token' };
  }
}

export async function listExtensionTokens() {
  const user = await requireAuth();

  try {
    const tokens = await listTokens(user.id);
    return { success: true, tokens };
  } catch (error) {
    console.error('Failed to list extension tokens:', error);
    return { success: false, error: 'Failed to list tokens' };
  }
}

export async function revokeExtensionToken(tokenId: string) {
  const user = await requireAuth();

  try {
    const revoked = await revokeToken(tokenId, user.id);
    if (!revoked) {
      return { success: false, error: 'Token not found' };
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to revoke extension token:', error);
    return { success: false, error: 'Failed to revoke token' };
  }
}
