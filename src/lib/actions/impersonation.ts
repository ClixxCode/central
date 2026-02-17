'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, isNull } from 'drizzle-orm';
import { getRealUser } from '@/lib/auth/session';

const IMPERSONATE_UID_COOKIE = 'central-impersonate-uid';
const IMPERSONATING_COOKIE = 'central-impersonating';
const MAX_AGE_SECONDS = 60 * 60; // 1 hour

export async function startImpersonation(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const realUser = await getRealUser();

  if (!realUser || realUser.role !== 'admin') {
    return { success: false, error: 'Admin access required' };
  }

  if (userId === realUser.id) {
    return { success: false, error: 'Cannot impersonate yourself' };
  }

  // Validate target user exists and is not deactivated
  const [targetUser] = await db
    .select({ id: users.id, deactivatedAt: users.deactivatedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!targetUser) {
    return { success: false, error: 'User not found' };
  }

  if (targetUser.deactivatedAt) {
    return { success: false, error: 'Cannot impersonate a deactivated user' };
  }

  const cookieStore = await cookies();

  // httpOnly cookie with the target user ID (read by server)
  cookieStore.set(IMPERSONATE_UID_COOKIE, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });

  // Client-readable cookie (signals impersonation to client code)
  cookieStore.set(IMPERSONATING_COOKIE, '1', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });

  return { success: true };
}

export async function stopImpersonation(): Promise<void> {
  const realUser = await getRealUser();

  if (!realUser) {
    redirect('/login');
  }

  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATE_UID_COOKIE);
  cookieStore.delete(IMPERSONATING_COOKIE);

  redirect('/settings/admin/users');
}
