import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import crypto from 'crypto';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar email';

function createState(userId: string): string {
  const timestamp = Date.now().toString();
  const payload = `${userId}:${timestamp}`;
  const hmac = crypto
    .createHmac('sha256', process.env.AUTH_SECRET!)
    .update(payload)
    .digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64url');
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL!));
  }

  const state = createState(user.id);
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/google-calendar/callback`;

  const params = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: CALENDAR_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params}`);
}
