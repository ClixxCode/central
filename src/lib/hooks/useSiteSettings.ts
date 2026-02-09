'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSiteSettings, updateSiteSettings } from '@/lib/actions/site-settings';

export const siteSettingsKeys = {
  all: ['site-settings'] as const,
};

export function useSiteSettings() {
  return useQuery({
    queryKey: siteSettingsKeys.all,
    queryFn: async () => {
      const result = await getSiteSettings();
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch site settings');
      }
      return result.data;
    },
  });
}

export function useUpdateSiteSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSiteSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: siteSettingsKeys.all });
    },
  });
}
