import { auth } from './config';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: 'admin' | 'user';
};

/**
 * Get the current session (cached per request)
 */
export const getSession = cache(async () => {
  return await auth();
});

/**
 * Get the real JWT user, ignoring impersonation.
 * Used by impersonation actions to verify the real user is admin.
 */
export async function getRealUser(): Promise<SessionUser | null> {
  const session = await getSession();

  if (!session?.user) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email!,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
    role: session.user.role,
  };
}

/**
 * Get the current user from session.
 * If impersonation cookie is set and real user is admin, returns the impersonated user.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const realUser = await getRealUser();
  if (!realUser) return null;

  // Check for impersonation cookie
  if (realUser.role === 'admin') {
    const cookieStore = await cookies();
    const impersonateUid = cookieStore.get('central-impersonate-uid')?.value;

    if (impersonateUid && impersonateUid !== realUser.id) {
      const [targetUser] = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          image: users.image,
          role: users.role,
        })
        .from(users)
        .where(eq(users.id, impersonateUid))
        .limit(1);

      if (targetUser) {
        return {
          id: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
          image: targetUser.image ?? null,
          role: targetUser.role as 'admin' | 'user',
        };
      }
    }
  }

  return realUser;
}

/**
 * Get impersonation state for layout rendering.
 * Returns info about the impersonated user if active.
 */
export async function getImpersonationState(): Promise<{
  isImpersonating: boolean;
  userName?: string;
  userEmail?: string;
}> {
  const realUser = await getRealUser();
  if (!realUser || realUser.role !== 'admin') {
    return { isImpersonating: false };
  }

  const cookieStore = await cookies();
  const impersonateUid = cookieStore.get('central-impersonate-uid')?.value;

  if (!impersonateUid || impersonateUid === realUser.id) {
    return { isImpersonating: false };
  }

  const [targetUser] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, impersonateUid))
    .limit(1);

  if (!targetUser) {
    return { isImpersonating: false };
  }

  return {
    isImpersonating: true,
    userName: targetUser.name ?? undefined,
    userEmail: targetUser.email,
  };
}

/**
 * Require authentication - redirects to login if not authenticated
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return user;
}

/**
 * Require admin role - throws if not admin
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth();

  if (user.role !== 'admin') {
    throw new Error('Admin access required');
  }

  return user;
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return !!session?.user;
}

/**
 * Check if user is admin
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === 'admin';
}
