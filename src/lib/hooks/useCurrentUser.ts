'use client';

import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUserAction } from '@/lib/actions/quick-add';

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: 'admin' | 'user';
}

function isImpersonating(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((c) => c.trim().startsWith('central-impersonating='));
}

/**
 * Client-side hook to get the current user.
 * Uses useSession() as the primary source, with a server action fallback
 * for cases where the client-side session doesn't resolve (e.g. some users
 * whose /api/auth/session fetch fails or hangs).
 *
 * During impersonation, always uses the server action (which reads the
 * impersonation cookie) instead of the JWT session.
 */
export function useCurrentUser(): {
  user: CurrentUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isImpersonating: boolean;
} {
  const impersonating = isImpersonating();
  const { data: session, status } = useSession();

  const sessionUser: CurrentUser | null =
    !impersonating && session?.user
      ? {
          id: session.user.id,
          email: session.user.email!,
          name: session.user.name ?? null,
          image: session.user.image ?? null,
          role: session.user.role,
        }
      : null;

  // During impersonation: always fetch from server action.
  // Otherwise: fallback when useSession() fails.
  const { data: serverUser, isLoading: isServerLoading } = useQuery({
    queryKey: ['currentUser', 'serverFallback', impersonating],
    queryFn: async () => {
      const result = await getCurrentUserAction();
      if (!result.success || !result.user) return null;
      return result.user;
    },
    enabled: impersonating || (status !== 'loading' && !sessionUser),
    staleTime: impersonating ? 0 : 5 * 60 * 1000,
    retry: 2,
  });

  const user = sessionUser ?? serverUser ?? null;
  const isLoading = impersonating
    ? isServerLoading
    : status === 'loading' || (!sessionUser && isServerLoading);
  const isAuthenticated = !!user;

  return {
    user,
    isLoading,
    isAuthenticated,
    isAdmin: user?.role === 'admin',
    isImpersonating: impersonating,
  };
}
