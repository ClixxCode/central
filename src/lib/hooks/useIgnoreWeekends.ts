'use client';

import { useQuery } from '@tanstack/react-query';
import { getUserPreferences } from '@/lib/actions/user-preferences';

export function useIgnoreWeekends(): boolean {
  const { data } = useQuery({
    queryKey: ['userPreferences'],
    queryFn: async () => {
      const result = await getUserPreferences();
      return result.success ? result.preferences : null;
    },
    staleTime: 5 * 60 * 1000,
  });
  return data?.ignoreWeekends ?? true;
}
