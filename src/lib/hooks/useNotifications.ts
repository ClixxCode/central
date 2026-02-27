'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markNotificationAsUnread,
  markAllNotificationsAsRead,
  markNotificationsByTypeAsRead,
  deleteNotification,
  clearReadNotifications,
  listMentions,
  listReplies,
  NotificationWithContext,
} from '@/lib/actions/notifications';

// Query key factory
export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (options?: { limit?: number; offset?: number; unreadOnly?: boolean }) =>
    [...notificationKeys.lists(), options] as const,
  counts: () => [...notificationKeys.all, 'count'] as const,
  count: () => [...notificationKeys.counts(), 'unread'] as const,
  mentions: () => [...notificationKeys.all, 'mentions'] as const,
  replies: () => [...notificationKeys.all, 'replies'] as const,
};

/**
 * Hook to fetch notifications (freshness handled by RealtimeProvider)
 */
export function useNotifications(
  options?: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  },
  queryOptions?: {
    enabled?: boolean;
    refetchInterval?: number | false;
  }
) {
  return useQuery({
    queryKey: notificationKeys.list(options),
    queryFn: async () => {
      const result = await listNotifications(options);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch notifications');
      }
      return {
        notifications: result.notifications!,
        total: result.total!,
      };
    },
    enabled: queryOptions?.enabled ?? true,
    ...(queryOptions?.refetchInterval !== undefined
      ? { refetchInterval: queryOptions.refetchInterval }
      : {}),
  });
}

/**
 * Hook to fetch unread notification count (freshness handled by RealtimeProvider)
 */
export function useUnreadNotificationCount(
  queryOptions?: {
    enabled?: boolean;
    refetchInterval?: number | false;
  }
) {
  return useQuery({
    queryKey: notificationKeys.count(),
    queryFn: async () => {
      const result = await getUnreadNotificationCount();
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch notification count');
      }
      return result.count!;
    },
    enabled: queryOptions?.enabled ?? true,
    ...(queryOptions?.refetchInterval !== undefined
      ? { refetchInterval: queryOptions.refetchInterval }
      : {}),
  });
}

/**
 * Hook to mark a notification as read with optimistic updates
 */
export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const result = await markNotificationAsRead(notificationId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to mark notification as read');
      }
      return notificationId;
    },
    onMutate: async (notificationId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });

      // Snapshot previous values
      const previousNotifications = queryClient.getQueriesData<{
        notifications: NotificationWithContext[];
        total: number;
      }>({ queryKey: notificationKeys.lists() });

      const previousCount = queryClient.getQueryData<number>(
        notificationKeys.count()
      );

      // Optimistically update notification lists
      queryClient.setQueriesData<{
        notifications: NotificationWithContext[];
        total: number;
      }>({ queryKey: notificationKeys.lists() }, (old) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map((n) =>
            n.id === notificationId ? { ...n, readAt: new Date() } : n
          ),
        };
      });

      // Optimistically decrement count
      if (previousCount !== undefined && previousCount > 0) {
        queryClient.setQueryData<number>(
          notificationKeys.count(),
          previousCount - 1
        );
      }

      return { previousNotifications, previousCount };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        for (const [queryKey, data] of context.previousNotifications) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(notificationKeys.count(), context.previousCount);
      }
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/**
 * Hook to mark a notification as unread with optimistic updates
 */
export function useMarkNotificationAsUnread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const result = await markNotificationAsUnread(notificationId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to mark notification as unread');
      }
      return notificationId;
    },
    onMutate: async (notificationId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });

      // Snapshot previous values
      const previousNotifications = queryClient.getQueriesData<{
        notifications: NotificationWithContext[];
        total: number;
      }>({ queryKey: notificationKeys.lists() });

      const previousCount = queryClient.getQueryData<number>(
        notificationKeys.count()
      );

      // Optimistically update notification lists
      queryClient.setQueriesData<{
        notifications: NotificationWithContext[];
        total: number;
      }>({ queryKey: notificationKeys.lists() }, (old) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map((n) =>
            n.id === notificationId ? { ...n, readAt: null } : n
          ),
        };
      });

      // Optimistically increment count
      if (previousCount !== undefined) {
        queryClient.setQueryData<number>(
          notificationKeys.count(),
          previousCount + 1
        );
      }

      return { previousNotifications, previousCount };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        for (const [queryKey, data] of context.previousNotifications) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(notificationKeys.count(), context.previousCount);
      }
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/**
 * Hook to mark all notifications as read with optimistic updates
 */
export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await markAllNotificationsAsRead();
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to mark all notifications as read');
      }
      return result.count!;
    },
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });

      // Snapshot previous values
      const previousNotifications = queryClient.getQueriesData<{
        notifications: NotificationWithContext[];
        total: number;
      }>({ queryKey: notificationKeys.lists() });

      const previousCount = queryClient.getQueryData<number>(
        notificationKeys.count()
      );

      // Optimistically mark all as read
      queryClient.setQueriesData<{
        notifications: NotificationWithContext[];
        total: number;
      }>({ queryKey: notificationKeys.lists() }, (old) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map((n) => ({
            ...n,
            readAt: n.readAt ?? new Date(),
          })),
        };
      });

      // Optimistically set count to 0
      queryClient.setQueryData<number>(notificationKeys.count(), 0);

      return { previousNotifications, previousCount };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        for (const [queryKey, data] of context.previousNotifications) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(notificationKeys.count(), context.previousCount);
      }
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/**
 * Hook to mark all notifications of a specific type as read
 */
export function useMarkNotificationsByTypeAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (type: 'mention' | 'comment_added' | 'reaction_added') => {
      const result = await markNotificationsByTypeAsRead(type);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to mark notifications as read');
      }
      return { type, count: result.count! };
    },
    onMutate: async (type) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });

      // Snapshot previous values
      const previousMentions = queryClient.getQueryData<NotificationWithContext[]>(
        notificationKeys.mentions()
      );
      const previousReplies = queryClient.getQueryData<NotificationWithContext[]>(
        notificationKeys.replies()
      );
      const previousCount = queryClient.getQueryData<number>(
        notificationKeys.count()
      );

      // Calculate how many unread we're marking
      let unreadCount = 0;
      if (type === 'mention' && previousMentions) {
        unreadCount = previousMentions.filter((n) => !n.readAt).length;
        queryClient.setQueryData<NotificationWithContext[]>(
          notificationKeys.mentions(),
          previousMentions.map((n) => ({ ...n, readAt: n.readAt ?? new Date() }))
        );
      } else if (type === 'comment_added' && previousReplies) {
        unreadCount = previousReplies.filter((n) => !n.readAt).length;
        queryClient.setQueryData<NotificationWithContext[]>(
          notificationKeys.replies(),
          previousReplies.map((n) => ({ ...n, readAt: n.readAt ?? new Date() }))
        );
      }

      // Decrement count
      if (previousCount !== undefined && unreadCount > 0) {
        queryClient.setQueryData<number>(
          notificationKeys.count(),
          Math.max(0, previousCount - unreadCount)
        );
      }

      return { previousMentions, previousReplies, previousCount };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousMentions) {
        queryClient.setQueryData(notificationKeys.mentions(), context.previousMentions);
      }
      if (context?.previousReplies) {
        queryClient.setQueryData(notificationKeys.replies(), context.previousReplies);
      }
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(notificationKeys.count(), context.previousCount);
      }
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/**
 * Hook to delete a notification with optimistic updates
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const result = await deleteNotification(notificationId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to delete notification');
      }
      return notificationId;
    },
    onMutate: async (notificationId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });

      // Snapshot previous values
      const previousNotifications = queryClient.getQueriesData<{
        notifications: NotificationWithContext[];
        total: number;
      }>({ queryKey: notificationKeys.lists() });

      const previousCount = queryClient.getQueryData<number>(
        notificationKeys.count()
      );

      // Find if the notification being deleted is unread
      let wasUnread = false;
      for (const [, data] of previousNotifications) {
        const notification = data?.notifications.find((n) => n.id === notificationId);
        if (notification && !notification.readAt) {
          wasUnread = true;
          break;
        }
      }

      // Optimistically remove from lists
      queryClient.setQueriesData<{
        notifications: NotificationWithContext[];
        total: number;
      }>({ queryKey: notificationKeys.lists() }, (old) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.filter((n) => n.id !== notificationId),
          total: old.total - 1,
        };
      });

      // Decrement count if the notification was unread
      if (wasUnread && previousCount !== undefined && previousCount > 0) {
        queryClient.setQueryData<number>(
          notificationKeys.count(),
          previousCount - 1
        );
      }

      return { previousNotifications, previousCount };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        for (const [queryKey, data] of context.previousNotifications) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(notificationKeys.count(), context.previousCount);
      }
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/**
 * Hook to clear all read notifications
 */
export function useClearReadNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await clearReadNotifications();
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to clear read notifications');
      }
      return result.deletedCount!;
    },
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: notificationKeys.lists() });

      // Snapshot previous values
      const previousNotifications = queryClient.getQueriesData<{
        notifications: NotificationWithContext[];
        total: number;
      }>({ queryKey: notificationKeys.lists() });

      // Optimistically remove read notifications
      queryClient.setQueriesData<{
        notifications: NotificationWithContext[];
        total: number;
      }>({ queryKey: notificationKeys.lists() }, (old) => {
        if (!old) return old;
        const unreadNotifications = old.notifications.filter((n) => !n.readAt);
        return {
          ...old,
          notifications: unreadNotifications,
          total: unreadNotifications.length,
        };
      });

      return { previousNotifications };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousNotifications) {
        for (const [queryKey, data] of context.previousNotifications) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
    },
  });
}

import {
  getUserPreferences,
  updateEmailPreferences,
  updateSlackPreferences,
  updateInAppPreferences,
} from '@/lib/actions/user-preferences';
import type { UserPreferences } from '@/lib/db/schema/users';

/**
 * Hook to fetch notification preferences from the database
 */
export function useNotificationPreferences() {
  return useQuery({
    queryKey: [...notificationKeys.all, 'preferences'],
    queryFn: async (): Promise<{ notifications: UserPreferences['notifications']; isContractor: boolean } | null> => {
      const result = await getUserPreferences();
      if (!result.success || !result.preferences) {
        return null;
      }
      return {
        notifications: result.preferences.notifications,
        isContractor: result.isContractor ?? false,
      };
    },
  });
}

/**
 * Hook to update email notification preferences
 */
export function useUpdateEmailPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateEmailPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...notificationKeys.all, 'preferences'] });
    },
  });
}

/**
 * Hook to update Slack notification preferences
 */
export function useUpdateSlackPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSlackPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...notificationKeys.all, 'preferences'] });
    },
  });
}

/**
 * Hook to update in-app notification preferences
 */
export function useUpdateInAppPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateInAppPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...notificationKeys.all, 'preferences'] });
    },
  });
}

/**
 * Combined hook for backwards compatibility
 * @deprecated Use the specific update hooks instead
 */
export function useUpdateNotificationPreferences() {
  const updateEmail = useUpdateEmailPreferences();
  const updateSlack = useUpdateSlackPreferences();
  const updateInApp = useUpdateInAppPreferences();

  return useMutation({
    mutationFn: async (preferences: {
      email?: Parameters<typeof updateEmailPreferences>[0];
      slack?: Parameters<typeof updateSlackPreferences>[0];
      inApp?: Parameters<typeof updateInAppPreferences>[0];
    }) => {
      const results = [];
      if (preferences.email) {
        results.push(await updateEmailPreferences(preferences.email));
      }
      if (preferences.slack) {
        results.push(await updateSlackPreferences(preferences.slack));
      }
      if (preferences.inApp) {
        results.push(await updateInAppPreferences(preferences.inApp));
      }
      return results;
    },
  });
}

/**
 * Hook to fetch mentions for the current user
 */
export function useMentions(options?: { limit?: number }) {
  return useQuery({
    queryKey: notificationKeys.mentions(),
    queryFn: async () => {
      const result = await listMentions(options);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch mentions');
      }
      return result.notifications ?? [];
    },
  });
}

/**
 * Hook to fetch replies on comments the user created
 */
export function useReplies(options?: { limit?: number }) {
  return useQuery({
    queryKey: notificationKeys.replies(),
    queryFn: async () => {
      const result = await listReplies(options);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch replies');
      }
      return result.notifications ?? [];
    },
  });
}
