'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listMyTasks,
  updateTask,
  MyTasksByClient,
  UpdateTaskInput,
} from '@/lib/actions/tasks';
import { taskKeys } from './useTasks';

// Query key factory for my tasks
export const myTasksKeys = {
  all: ['myTasks'] as const,
  list: () => [...myTasksKeys.all, 'list'] as const,
};

/**
 * Hook to fetch all tasks assigned to the current user across all accessible boards
 */
export function useMyTasks(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: myTasksKeys.list(),
    queryFn: async () => {
      const result = await listMyTasks();
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch my tasks');
      }
      return result.tasksByClient!;
    },
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook to update a task from the personal rollup view
 * Includes optimistic updates for both my tasks and board task lists
 */
export function useUpdateMyTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateTaskInput) => {
      const result = await updateTask(input);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to update task');
      }
      return result.task!;
    },
    onMutate: async (updatedTask) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: myTasksKeys.list() });
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() });

      // Snapshot the previous values
      const previousMyTasks = queryClient.getQueryData<MyTasksByClient[]>(
        myTasksKeys.list()
      );
      const previousBoardTasks = queryClient.getQueriesData({
        queryKey: taskKeys.lists(),
      });

      // Optimistically update my tasks
      if (previousMyTasks) {
        queryClient.setQueryData<MyTasksByClient[]>(myTasksKeys.list(), (old) => {
          if (!old) return old;

          return old.map((clientGroup) => ({
            ...clientGroup,
            tasks: clientGroup.tasks.map((task) =>
              task.id === updatedTask.id
                ? { ...task, ...updatedTask, updatedAt: new Date() }
                : task
            ),
          }));
        });
      }

      // Optimistically update board task lists
      queryClient.setQueriesData(
        { queryKey: taskKeys.lists() },
        (old: unknown) => {
          if (!old || !Array.isArray(old)) return old;
          return old.map((task: { id: string }) =>
            task.id === updatedTask.id
              ? { ...task, ...updatedTask, updatedAt: new Date() }
              : task
          );
        }
      );

      return { previousMyTasks, previousBoardTasks };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousMyTasks) {
        queryClient.setQueryData(myTasksKeys.list(), context.previousMyTasks);
      }
      if (context?.previousBoardTasks) {
        for (const [queryKey, data] of context.previousBoardTasks) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: (data, error, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: myTasksKeys.list() });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(variables.id) });
    },
  });
}
