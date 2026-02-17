'use server';

import { db } from '@/lib/db';
import { googleCalendarConnections } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const TOKEN_EXPIRY_BUFFER = 5 * 60; // 5 minutes in seconds

export async function getCalendarConnection(userId: string) {
  const [connection] = await db
    .select()
    .from(googleCalendarConnections)
    .where(eq(googleCalendarConnections.userId, userId))
    .limit(1);

  return connection ?? null;
}

export async function getValidGoogleToken(userId: string): Promise<string | null> {
  const connection = await getCalendarConnection(userId);
  if (!connection) return null;

  const now = Math.floor(Date.now() / 1000);

  // Token is still valid (with buffer)
  if (connection.expiresAt > now + TOKEN_EXPIRY_BUFFER) {
    return connection.accessToken;
  }

  // Refresh the token
  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.AUTH_GOOGLE_ID!,
        client_secret: process.env.AUTH_GOOGLE_SECRET!,
        refresh_token: connection.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      console.error('Token refresh failed:', await response.text());
      // If refresh fails (e.g., revoked), delete the connection
      if (response.status === 400 || response.status === 401) {
        await db
          .delete(googleCalendarConnections)
          .where(eq(googleCalendarConnections.userId, userId));
      }
      return null;
    }

    const data = await response.json();

    await db
      .update(googleCalendarConnections)
      .set({
        accessToken: data.access_token,
        expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
        updatedAt: new Date(),
      })
      .where(eq(googleCalendarConnections.userId, userId));

    return data.access_token;
  } catch (error) {
    console.error('Token refresh error:', error);
    return null;
  }
}

export async function revokeGoogleToken(userId: string): Promise<boolean> {
  const connection = await getCalendarConnection(userId);
  if (!connection) return true;

  try {
    // Revoke with Google
    await fetch(`${GOOGLE_REVOKE_URL}?token=${connection.accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  } catch {
    // Best-effort revocation — continue even if Google revoke fails
  }

  // Delete from DB
  await db
    .delete(googleCalendarConnections)
    .where(eq(googleCalendarConnections.userId, userId));

  return true;
}
