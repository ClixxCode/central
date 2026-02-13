'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listAssignableUsers, listMentionableUsers } from '@/lib/actions/quick-add';
import { createTask, type CreateTaskInput } from '@/lib/actions/tasks';
import { trackEvent } from '@/lib/analytics';
import { taskKeys } from './useTasks';

// Query key factory
export const quickAddKeys = {
  all: ['quickAdd'] as const,
  users: (boardId?: string) => [...quickAddKeys.all, 'users', boardId] as const,
  mentionableUsers: () => [...quickAddKeys.all, 'mentionableUsers'] as const,
};

/**
 * Fetch assignable users, optionally scoped to a board
 */
export function useQuickAddUsers(boardId?: string) {
  return useQuery({
    queryKey: quickAddKeys.users(boardId),
    queryFn: async () => {
      const result = await listAssignableUsers(boardId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch users');
      }
      return result.users!;
    },
  });
}

/**
 * Fetch ALL users for mention suggestions (no contractor/board filtering).
 * Used in comments where anyone can be mentioned.
 */
export function useMentionableUsers() {
  return useQuery({
    queryKey: quickAddKeys.mentionableUsers(),
    queryFn: async () => {
      const result = await listMentionableUsers();
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch users');
      }
      return result.users!;
    },
  });
}

/**
 * Create a task via Quick Add with toast notifications
 */
export function useQuickAddCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const result = await createTask(input);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to create task');
      }
      return result.task!;
    },
    onSuccess: (task) => {
      toast.success(`Task "${task.title}" created`);
      trackEvent('task_created', {
        source: 'quick_add',
        has_due_date: !!task.dueDate,
        has_assignees: (task.assignees?.length ?? 0) > 0,
        is_recurring: !!task.recurringConfig,
      });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create task');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}
