import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { googleCalendarConnections } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

function validateState(state: string, expectedUserId: string): boolean {
  try {
    const decoded = Buffer.from(state, 'base64url').toString();
    const [userId, timestamp, hmac] = decoded.split(':');

    if (userId !== expectedUserId) return false;

    // Check timestamp is within 10 minutes
    const ts = parseInt(timestamp, 10);
    if (Date.now() - ts > 10 * 60 * 1000) return false;

    // Verify HMAC
    const payload = `${userId}:${timestamp}`;
    const expectedHmac = crypto
      .createHmac('sha256', process.env.AUTH_SECRET!)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac));
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', appUrl));
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL('/settings/integrations?calendar=error', appUrl)
    );
  }

  if (!validateState(state, user.id)) {
    return NextResponse.redirect(
      new URL('/settings/integrations?calendar=error', appUrl)
    );
  }

  // Exchange code for tokens
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${appUrl}/api/google-calendar/callback`,
    }),
  });

  if (!tokenResponse.ok) {
    console.error('Token exchange failed:', await tokenResponse.text());
    return NextResponse.redirect(
      new URL('/settings/integrations?calendar=error', appUrl)
    );
  }

  const tokens = await tokenResponse.json();

  // Get the connected Google account email
  const userinfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  let email = 'unknown';
  if (userinfoResponse.ok) {
    const userinfo = await userinfoResponse.json();
    email = userinfo.email;
  }

  // Upsert the connection
  const now = new Date();
  const expiresAt = Math.floor(Date.now() / 1000) + tokens.expires_in;

  await db
    .insert(googleCalendarConnections)
    .values({
      userId: user.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      scope: tokens.scope ?? null,
      email,
      connectedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: googleCalendarConnections.userId,
      set: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        scope: tokens.scope ?? null,
        email,
        updatedAt: now,
      },
    });

  return NextResponse.redirect(
    new URL('/settings/integrations?calendar=connected', appUrl)
  );
}
