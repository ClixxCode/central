'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient, useIsMutating, type QueryKey } from '@tanstack/react-query';
import { getSupabaseClient } from '@/lib/supabase/client';

interface RealtimeInvalidationConfig {
  channel: string;
  table: string;
  filter?: string;
  queryKeys: QueryKey[];
  enabled?: boolean;
  debounceMs?: number;
}

export function useRealtimeInvalidation({
  channel,
  table,
  filter,
  queryKeys,
  enabled = true,
  debounceMs = 300,
}: RealtimeInvalidationConfig): void {
  const queryClient = useQueryClient();
  const isMutating = useIsMutating();
  const isMutatingRef = useRef(isMutating);
  isMutatingRef.current = isMutating;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Store queryKeys in a ref so the effect doesn't re-subscribe on every render
  const queryKeysRef = useRef(queryKeys);
  queryKeysRef.current = queryKeys;

  useEffect(() => {
    if (!enabled) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channelInstance = supabase
      .channel(channel)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        },
        (payload: unknown) => {
          console.log(`[Realtime] ${channel} change`, payload);
          if (timerRef.current) {
            clearTimeout(timerRef.current);
          }
          timerRef.current = setTimeout(() => {
            // Skip invalidation while this tab has active mutations
            // to avoid overwriting local edits (e.g. typing in a title)
            if (isMutatingRef.current > 0) return;
            for (const key of queryKeysRef.current) {
              queryClient.invalidateQueries({ queryKey: key });
            }
          }, debounceMs);
        }
      )
      .subscribe((status: string, err?: Error) => {
        console.log(`[Realtime] ${channel} status:`, status, err ?? '');
      });

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      supabase.removeChannel(channelInstance);
    };
  }, [channel, table, filter, enabled, debounceMs, queryClient]);
}
