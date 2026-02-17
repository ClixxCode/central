'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getCalendarConnectionStatus,
  getTodaysEvents,
  disconnectGoogleCalendar,
  getTeamAvailability,
  createCalendarHolds,
  listAllUsers,
  type HoldInput,
} from '@/lib/actions/google-calendar';
import {
  getUserPreferences,
  updateCalendarPreferences,
} from '@/lib/actions/user-preferences';
import { trackEvent } from '@/lib/analytics';

export const calendarKeys = {
  all: ['google-calendar'] as const,
  connection: () => [...calendarKeys.all, 'connection'] as const,
  todaysEvents: () => [...calendarKeys.all, 'todays-events'] as const,
  availability: (emails: string[], timeMin: string, timeMax: string) =>
    [...calendarKeys.all, 'availability', { emails, timeMin, timeMax }] as const,
  users: () => [...calendarKeys.all, 'users'] as const,
  preferences: () => [...calendarKeys.all, 'preferences'] as const,
};

export function useCalendarConnection() {
  return useQuery({
    queryKey: calendarKeys.connection(),
    queryFn: () => getCalendarConnectionStatus(),
  });
}

export function useTodaysEvents(timeZone: string) {
  return useQuery({
    queryKey: calendarKeys.todaysEvents(),
    queryFn: () => getTodaysEvents(timeZone),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useTeamAvailability(
  emails: string[],
  timeMin: string,
  timeMax: string,
  timeZone: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: calendarKeys.availability(emails, timeMin, timeMax),
    queryFn: async () => {
      const result = await getTeamAvailability({ emails, timeMin, timeMax, timeZone });
      if (!result.success) throw new Error(result.error ?? 'Failed to check availability');
      return result.data!;
    },
    enabled: options?.enabled ?? (emails.length > 0 && !!timeMin && !!timeMax),
  });
}

export function useCreateCalendarHolds() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (holds: HoldInput[]) => createCalendarHolds({ holds }),
    onSuccess: (result) => {
      if (result.created > 0) {
        toast.success(`Created ${result.created} calendar hold${result.created > 1 ? 's' : ''}`);
      }
      if (result.errors.length > 0) {
        result.errors.forEach((err) => toast.error(err));
      }
      queryClient.invalidateQueries({ queryKey: calendarKeys.todaysEvents() });
    },
    onError: () => {
      toast.error('Failed to create calendar holds');
    },
  });
}

export function useDisconnectCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => disconnectGoogleCalendar(),
    onSuccess: () => {
      toast.success('Google Calendar disconnected');
      trackEvent('calendar_disconnected');
      queryClient.invalidateQueries({ queryKey: calendarKeys.connection() });
      queryClient.invalidateQueries({ queryKey: calendarKeys.todaysEvents() });
    },
    onError: () => {
      toast.error('Failed to disconnect calendar');
    },
  });
}

export function useAllUsers() {
  return useQuery({
    queryKey: calendarKeys.users(),
    queryFn: async () => {
      const result = await listAllUsers();
      if (!result.success) throw new Error('Failed to fetch users');
      return result.data!;
    },
  });
}

export function useCalendarPreferences() {
  return useQuery({
    queryKey: calendarKeys.preferences(),
    queryFn: async () => {
      const result = await getUserPreferences();
      if (!result.success) throw new Error(result.error ?? 'Failed to fetch preferences');
      return result.preferences!.calendar ?? { showScheduleInSidebar: false, showEventsInMyWork: true };
    },
    staleTime: 60 * 1000,
  });
}

export function useUpdateCalendarPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { showScheduleInSidebar?: boolean; showEventsInMyWork?: boolean }) =>
      updateCalendarPreferences(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: calendarKeys.preferences() });
      const prev = queryClient.getQueryData(calendarKeys.preferences());
      queryClient.setQueryData(calendarKeys.preferences(), (old: { showScheduleInSidebar: boolean; showEventsInMyWork: boolean } | undefined) => ({
        showScheduleInSidebar: old?.showScheduleInSidebar ?? false,
        showEventsInMyWork: old?.showEventsInMyWork ?? true,
        ...input,
      }));
      return { prev };
    },
    onError: (_err, _input, context) => {
      if (context?.prev) {
        queryClient.setQueryData(calendarKeys.preferences(), context.prev);
      }
      toast.error('Failed to update preference');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.preferences() });
      queryClient.invalidateQueries({ queryKey: ['userPreferences'] });
    },
  });
}
