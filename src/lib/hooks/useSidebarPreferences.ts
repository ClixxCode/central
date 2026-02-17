'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getUserPreferences,
  updateSidebarPreferences,
} from '@/lib/actions/user-preferences';

export const sidebarPreferencesKeys = {
  all: ['sidebarPreferences'] as const,
  preferences: () => [...sidebarPreferencesKeys.all, 'preferences'] as const,
};

export function useSidebarPreferences() {
  return useQuery({
    queryKey: sidebarPreferencesKeys.preferences(),
    queryFn: async () => {
      const result = await getUserPreferences();
      if (!result.success) throw new Error(result.error ?? 'Failed to fetch preferences');
      return result.preferences!.sidebar ?? { hiddenNavItems: [], navOrder: [] };
    },
    staleTime: 60 * 1000,
  });
}

export function useUpdateSidebarPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { hiddenNavItems?: string[]; navOrder?: string[] }) =>
      updateSidebarPreferences(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: sidebarPreferencesKeys.preferences() });
      const prev = queryClient.getQueryData(sidebarPreferencesKeys.preferences());
      queryClient.setQueryData(sidebarPreferencesKeys.preferences(), (old: { hiddenNavItems: string[]; navOrder: string[] } | undefined) => ({
        hiddenNavItems: old?.hiddenNavItems ?? [],
        navOrder: old?.navOrder ?? [],
        ...input,
      }));
      return { prev };
    },
    onError: (_err, _input, context) => {
      if (context?.prev) {
        queryClient.setQueryData(sidebarPreferencesKeys.preferences(), context.prev);
      }
      toast.error('Failed to update sidebar preferences');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sidebarPreferencesKeys.preferences() });
      queryClient.invalidateQueries({ queryKey: ['userPreferences'] });
    },
  });
}
