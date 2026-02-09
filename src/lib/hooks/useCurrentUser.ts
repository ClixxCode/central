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

/**
 * Client-side hook to get the current user.
 * Uses useSession() as the primary source, with a server action fallback
 * for cases where the client-side session doesn't resolve (e.g. some users
 * whose /api/auth/session fetch fails or hangs).
 */
export function useCurrentUser(): {
  user: CurrentUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
} {
  const { data: session, status } = useSession();

  const sessionUser: CurrentUser | null = session?.user
    ? {
        id: session.user.id,
        email: session.user.email!,
        name: session.user.name ?? null,
        image: session.user.image ?? null,
        role: session.user.role,
      }
    : null;

  // Fallback: fetch current user via server action when useSession() fails.
  // Only fires when session status is not 'loading' and no user was returned.
  const { data: serverUser, isLoading: isServerLoading } = useQuery({
    queryKey: ['currentUser', 'serverFallback'],
    queryFn: async () => {
      const result = await getCurrentUserAction();
      if (!result.success || !result.user) return null;
      return result.user;
    },
    enabled: status !== 'loading' && !sessionUser,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const user = sessionUser ?? serverUser ?? null;
  const isLoading = status === 'loading' || (!sessionUser && isServerLoading);
  const isAuthenticated = !!user;

  return {
    user,
    isLoading,
    isAuthenticated,
    isAdmin: user?.role === 'admin',
  };
}
