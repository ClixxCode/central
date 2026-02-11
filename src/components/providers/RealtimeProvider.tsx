'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/lib/supabase/client';
import { notificationKeys } from '@/lib/hooks/useNotifications';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useCurrentUser();
  const userId = user?.id;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`user-notifications-${userId}`)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: unknown) => {
          console.log('[Realtime] notification change', payload);
          queryClient.invalidateQueries({ queryKey: notificationKeys.all });
        }
      )
      .subscribe((status: string, err?: Error) => {
        console.log('[Realtime] notifications channel status:', status, err ?? '');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return <>{children}</>;
}
