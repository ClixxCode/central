'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listTasks,
  listSubtasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  updateTaskPositions,
  getBoardAssignableUsers,
  TaskWithAssignees,
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilters,
  TaskSortOptions,
} from '@/lib/actions/tasks';

// Query key factory
export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (boardId: string, filters?: TaskFilters, sort?: TaskSortOptions) =>
    [...taskKeys.lists(), boardId, { filters, sort }] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (taskId: string) => [...taskKeys.details(), taskId] as const,
  assignableUsers: (boardId: string) =>
    [...taskKeys.all, 'assignableUsers', boardId] as const,
  subtasks: (parentTaskId: string) =>
    [...taskKeys.all, 'subtasks', parentTaskId] as const,
};

/**
 * Hook to fetch tasks for a board with filtering and sorting
 */
export function useTasks(
  boardId: string,
  filters?: TaskFilters,
  sort?: TaskSortOptions,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: taskKeys.list(boardId, filters, sort),
    queryFn: async () => {
      const result = await listTasks(boardId, filters, sort);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch tasks');
      }
      return result.tasks!;
    },
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook to fetch a single task
 */
export function useTask(taskId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: taskKeys.detail(taskId),
    queryFn: async () => {
      const result = await getTask(taskId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch task');
      }
      return result.task!;
    },
    enabled: options?.enabled ?? !!taskId,
  });
}

/**
 * Hook to fetch assignable users for a board
 */
export function useAssignableUsers(boardId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: taskKeys.assignableUsers(boardId),
    queryFn: async () => {
      const result = await getBoardAssignableUsers(boardId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch users');
      }
      return result.users!;
    },
    enabled: options?.enabled ?? !!boardId,
  });
}

/**
 * Hook to create a task with optimistic updates
 */
export function useCreateTask(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<CreateTaskInput, 'boardId'>) => {
      const result = await createTask({ ...input, boardId });
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to create task');
      }
      return result.task!;
    },
    onMutate: async (newTask) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() });

      // Snapshot the previous value
      const previousTasks = queryClient.getQueriesData<TaskWithAssignees[]>({
        queryKey: taskKeys.lists(),
      });

      // Optimistically update all matching task lists
      queryClient.setQueriesData<TaskWithAssignees[]>(
        { queryKey: taskKeys.lists() },
        (old) => {
          if (!old) return old;
          // Only add to lists for this board
          const optimisticTask: TaskWithAssignees = {
            id: `temp-${Date.now()}`,
            boardId,
            title: newTask.title,
            description: newTask.description ?? null,
            status: newTask.status,
            section: newTask.section ?? null,
            dueDate: newTask.dueDate ?? null,
            dateFlexibility: newTask.dateFlexibility ?? 'not_set',
            recurringConfig: newTask.recurringConfig ?? null,
            recurringGroupId: null,
            parentTaskId: newTask.parentTaskId ?? null,
            position: newTask.position ?? old.length,
            createdBy: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            assignees: [],
            commentCount: 0,
            attachmentCount: 0,
            hasNewComments: false,
            subtaskCount: 0,
            subtaskCompletedCount: 0,
          };
          return [...old, optimisticTask];
        }
      );

      return { previousTasks };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        for (const [queryKey, data] of context.previousTasks) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

/**
 * Hook to update a task with optimistic updates
 */
export function useUpdateTask() {
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
      await queryClient.cancelQueries({ queryKey: taskKeys.detail(updatedTask.id) });
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() });

      // Snapshot the previous values
      const previousTask = queryClient.getQueryData<TaskWithAssignees>(
        taskKeys.detail(updatedTask.id)
      );
      const previousTasks = queryClient.getQueriesData<TaskWithAssignees[]>({
        queryKey: taskKeys.lists(),
      });

      // Optimistically update the single task
      if (previousTask) {
        queryClient.setQueryData<TaskWithAssignees>(
          taskKeys.detail(updatedTask.id),
          (old) => {
            if (!old) return old;
            return {
              ...old,
              ...updatedTask,
              updatedAt: new Date(),
            };
          }
        );
      }

      // Optimistically update task lists
      queryClient.setQueriesData<TaskWithAssignees[]>(
        { queryKey: taskKeys.lists() },
        (old) => {
          if (!old) return old;
          return old.map((task) =>
            task.id === updatedTask.id
              ? { ...task, ...updatedTask, updatedAt: new Date() }
              : task
          );
        }
      );

      // If completing subtasks along with parent, optimistically update subtask caches
      if (updatedTask.completeSubtasks && updatedTask.status) {
        const completionStatus = updatedTask.status;
        queryClient.setQueriesData<TaskWithAssignees[]>(
          { queryKey: [...taskKeys.all, 'subtasks'] },
          (old) => {
            if (!old) return old;
            // Only update subtasks that belong to this parent
            if (old.length > 0 && old[0].parentTaskId === updatedTask.id) {
              return old.map((task) => ({
                ...task,
                status: completionStatus,
                updatedAt: new Date(),
              }));
            }
            return old;
          }
        );
      }

      return { previousTask, previousTasks };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousTask) {
        queryClient.setQueryData(
          taskKeys.detail(variables.id),
          context.previousTask
        );
      }
      if (context?.previousTasks) {
        for (const [queryKey, data] of context.previousTasks) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: (data, error, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      // Invalidate subtask caches (status changes affect completed counts)
      queryClient.invalidateQueries({ queryKey: [...taskKeys.all, 'subtasks'] });
    },
  });
}

/**
 * Hook to delete a task with optimistic updates
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const result = await deleteTask(taskId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to delete task');
      }
      return taskId;
    },
    onMutate: async (taskId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskKeys.detail(taskId) });
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() });

      // Snapshot the previous values
      const previousTask = queryClient.getQueryData<TaskWithAssignees>(
        taskKeys.detail(taskId)
      );
      const previousTasks = queryClient.getQueriesData<TaskWithAssignees[]>({
        queryKey: taskKeys.lists(),
      });

      // Optimistically remove from lists
      queryClient.setQueriesData<TaskWithAssignees[]>(
        { queryKey: taskKeys.lists() },
        (old) => {
          if (!old) return old;
          return old.filter((task) => task.id !== taskId);
        }
      );

      // Remove from detail cache
      queryClient.removeQueries({ queryKey: taskKeys.detail(taskId) });

      return { previousTask, previousTasks };
    },
    onError: (err, taskId, context) => {
      // Rollback on error
      if (context?.previousTask) {
        queryClient.setQueryData(taskKeys.detail(taskId), context.previousTask);
      }
      if (context?.previousTasks) {
        for (const [queryKey, data] of context.previousTasks) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      // Invalidate subtask caches (deleting a subtask affects parent counts)
      queryClient.invalidateQueries({ queryKey: [...taskKeys.all, 'subtasks'] });
    },
  });
}

/**
 * Hook to update task positions (for drag-and-drop)
 */
export function useUpdateTaskPositions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: { id: string; position: number; status?: string }[]) => {
      const result = await updateTaskPositions(updates);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to update positions');
      }
      return updates;
    },
    onMutate: async (updates) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() });

      // Snapshot the previous values
      const previousTasks = queryClient.getQueriesData<TaskWithAssignees[]>({
        queryKey: taskKeys.lists(),
      });

      // Create a map of updates for quick lookup
      const updateMap = new Map(
        updates.map((u) => [u.id, { position: u.position, status: u.status }])
      );

      // Optimistically update task lists
      queryClient.setQueriesData<TaskWithAssignees[]>(
        { queryKey: taskKeys.lists() },
        (old) => {
          if (!old) return old;
          return old.map((task) => {
            const update = updateMap.get(task.id);
            if (update) {
              return {
                ...task,
                position: update.position,
                status: update.status ?? task.status,
                updatedAt: new Date(),
              };
            }
            return task;
          });
        }
      );

      return { previousTasks };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        for (const [queryKey, data] of context.previousTasks) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

/**
 * Hook to fetch subtasks for a parent task
 */
export function useSubtasks(parentTaskId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: taskKeys.subtasks(parentTaskId),
    queryFn: async () => {
      const result = await listSubtasks(parentTaskId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch subtasks');
      }
      return result.tasks!;
    },
    enabled: (options?.enabled ?? true) && !!parentTaskId,
  });
}

/**
 * Hook to create a subtask with cache invalidation
 */
export function useCreateSubtask(parentTaskId: string, boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { title: string; status: string; assigneeIds?: string[]; dueDate?: string; section?: string }) => {
      const result = await createTask({
        ...input,
        boardId,
        parentTaskId,
      });
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to create subtask');
      }
      return result.task!;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.subtasks(parentTaskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(parentTaskId) });
    },
  });
}
