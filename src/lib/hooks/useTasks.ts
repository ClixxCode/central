'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listTasks,
  listBoardItems,
  listSubtasks,
  getTask,
  createTask,
  createProject,
  updateTask,
  updateProject,
  deleteTask,
  deleteProject,
  updateTaskPositions,
  updateBoardItemPositions,
  getBoardAssignableUsers,
  archiveTask,
  archiveProject,
  unarchiveTask,
  unarchiveProject,
  bulkArchiveDone,
  listArchivedTasks,
  bulkUpdateTasks,
  bulkDuplicateTasks,
  bulkDeleteTasks,
  TaskWithAssignees,
  BoardItem,
  ProjectBoardItem,
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilters,
  TaskSortOptions,
  MyTasksByClient,
  ArchivedTaskSummary,
  BulkUpdateTasksInput,
} from '@/lib/actions/tasks';
import type {
  CreateBoardProjectInput,
  UpdateBoardProjectInput,
  BoardItemPositionUpdateInput,
} from '@/lib/validations/board-project';
import posthog from 'posthog-js';
import { trackEvent } from '@/lib/analytics';

type RollupTaskCacheItem = {
  id: string;
  status?: string;
  position?: number;
  [key: string]: unknown;
};

// Query key factory
export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (boardId: string, filters?: TaskFilters, sort?: TaskSortOptions) =>
    [...taskKeys.lists(), boardId, { filters, sort }] as const,
  boardItems: (boardId: string, filters?: TaskFilters, sort?: TaskSortOptions) =>
    [...taskKeys.all, 'boardItems', boardId, { filters, sort }] as const,
  boardItemLists: () => [...taskKeys.all, 'boardItems'] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (taskId: string) => [...taskKeys.details(), taskId] as const,
  assignableUsers: (boardId: string) =>
    [...taskKeys.all, 'assignableUsers', boardId] as const,
  subtasks: (parentTaskId: string) =>
    [...taskKeys.all, 'subtasks', parentTaskId] as const,
  archivedTasks: (boardId: string) =>
    [...taskKeys.all, 'archived', boardId] as const,
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
 * Hook to fetch mixed board items for a parent board.
 */
export function useBoardItems(
  boardId: string,
  filters?: TaskFilters,
  sort?: TaskSortOptions,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: taskKeys.boardItems(boardId, filters, sort),
    queryFn: async () => {
      const result = await listBoardItems(boardId, filters, sort);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch board items');
      }
      return result.items!;
    },
    enabled: options?.enabled ?? !!boardId,
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
            shortId: null,
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
            subtasksBreakoutEnabled: false,
            subtasksSequentialEnabled: false,
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
            archivedAt: null,
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
    onSuccess: (task) => {
      trackEvent('task_created', {
        source: 'board',
        has_due_date: !!task.dueDate,
        has_assignees: task.assignees.length > 0,
        is_recurring: !!task.recurringConfig,
      });
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.boardItemLists() });
    },
  });
}

export function useCreateProject(parentBoardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<CreateBoardProjectInput, 'parentBoardId'>) => {
      const result = await createProject({ ...input, parentBoardId });
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to create project');
      }
      return result.project!;
    },
    onSuccess: () => {
      toast.success('Project created');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.boardItemLists() });
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
      await queryClient.cancelQueries({ queryKey: ['rollups', 'tasks'] });

      // Snapshot the previous values
      const previousTask = queryClient.getQueryData<TaskWithAssignees>(
        taskKeys.detail(updatedTask.id)
      );
      const previousTasks = queryClient.getQueriesData<TaskWithAssignees[]>({
        queryKey: taskKeys.lists(),
      });
      const previousRollupTasks = queryClient.getQueriesData({
        queryKey: ['rollups', 'tasks'],
      });

      // Normalize descriptionJson to description for optimistic cache updates
      const { descriptionJson, ...rest } = updatedTask;
      const optimisticUpdate: Record<string, unknown> = { ...rest };
      if (descriptionJson !== undefined) {
        optimisticUpdate.description = descriptionJson ? JSON.parse(descriptionJson) : null;
      }

      // Optimistically update the single task
      if (previousTask) {
        queryClient.setQueryData<TaskWithAssignees>(
          taskKeys.detail(updatedTask.id),
          (old) => {
            if (!old) return old;
            return {
              ...old,
              ...optimisticUpdate,
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
              ? { ...task, ...optimisticUpdate, updatedAt: new Date() }
              : task
          );
        }
      );

      // Optimistically update rollup task lists
      queryClient.setQueriesData<{ tasks: RollupTaskCacheItem[]; statusOptions: unknown[]; sectionOptions: unknown[] }>(
        { queryKey: ['rollups', 'tasks'] },
        (old) => {
          if (!old?.tasks) return old;
          return {
            ...old,
            tasks: old.tasks.map((task) =>
              task.id === updatedTask.id
                ? { ...task, ...optimisticUpdate }
                : task
            ),
          };
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

      return { previousTask, previousTasks, previousRollupTasks };
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
      if (context?.previousRollupTasks) {
        for (const [queryKey, data] of context.previousRollupTasks) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      // Surface the error so users know the save failed
      const errorContext = {
        error: err.message,
        taskId: variables.id,
        fields: Object.keys(variables).filter((k) => k !== 'id'),
        descriptionSize: variables.descriptionJson?.length,
      };
      console.error('[useUpdateTask] Failed to save task:', errorContext);
      posthog.capture('task_update_failed', errorContext);
      toast.error('Failed to save changes. Please try again.');
    },
    onSettled: (data, error, variables) => {
      // Track task completion
      if (!error && variables.status) {
        const s = variables.status.toLowerCase();
        if (s === 'done' || s === 'complete' || s === 'completed') {
          trackEvent('task_completed');
        }
      }
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.boardItemLists() });
      queryClient.invalidateQueries({ queryKey: ['rollups', 'tasks'] });
      // Invalidate subtask caches (status changes affect completed counts)
      queryClient.invalidateQueries({ queryKey: [...taskKeys.all, 'subtasks'] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateBoardProjectInput) => {
      const result = await updateProject(input);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to update project');
      }
      return result.project!;
    },
    onMutate: async (updatedProject) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.boardItemLists() });
      const previousItems = queryClient.getQueriesData<BoardItem[]>({
        queryKey: taskKeys.boardItemLists(),
      });

      queryClient.setQueriesData<BoardItem[]>(
        { queryKey: taskKeys.boardItemLists() },
        (old) => {
          if (!old) return old;
          return old.map((item) => {
            if (item.kind !== 'project' || item.id !== updatedProject.id) return item;
            const patch: Partial<ProjectBoardItem> = {
              ...(updatedProject.name !== undefined && { title: updatedProject.name }),
              ...(updatedProject.description !== undefined && { description: updatedProject.description }),
              ...(updatedProject.status !== undefined && { status: updatedProject.status }),
              ...(updatedProject.section !== undefined && { section: updatedProject.section }),
              ...(updatedProject.dueDate !== undefined && { dueDate: updatedProject.dueDate }),
              ...(updatedProject.position !== undefined && { position: updatedProject.position }),
              ...(updatedProject.internalStatusOptions !== undefined && {
                internalStatusOptions: updatedProject.internalStatusOptions,
              }),
              ...(updatedProject.internalSectionOptions !== undefined && {
                internalSectionOptions: updatedProject.internalSectionOptions,
              }),
              updatedAt: new Date(),
            };
            return { ...item, ...patch };
          });
        }
      );

      return { previousItems };
    },
    onError: (err, variables, context) => {
      if (context?.previousItems) {
        for (const [queryKey, data] of context.previousItems) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.boardItemLists() });
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
      await queryClient.cancelQueries({ queryKey: taskKeys.boardItemLists() });
      await queryClient.cancelQueries({ queryKey: ['myTasks'] });
      await queryClient.cancelQueries({ queryKey: ['rollups', 'tasks'] });
      await queryClient.cancelQueries({ queryKey: [...taskKeys.all, 'archived'] });

      // Snapshot the previous values
      const previousTask = queryClient.getQueryData<TaskWithAssignees>(
        taskKeys.detail(taskId)
      );
      const previousTasks = queryClient.getQueriesData<TaskWithAssignees[]>({
        queryKey: taskKeys.lists(),
      });
      const previousBoardItems = queryClient.getQueriesData<BoardItem[]>({
        queryKey: taskKeys.boardItemLists(),
      });
      const previousMyTasks = queryClient.getQueriesData({
        queryKey: ['myTasks'],
      });
      const previousRollupTasks = queryClient.getQueriesData({
        queryKey: ['rollups', 'tasks'],
      });

      // Optimistically remove from board lists
      queryClient.setQueriesData<TaskWithAssignees[]>(
        { queryKey: taskKeys.lists() },
        (old) => {
          if (!old) return old;
          return old.filter((task) => task.id !== taskId);
        }
      );

      queryClient.setQueriesData<BoardItem[]>(
        { queryKey: taskKeys.boardItemLists() },
        (old) => {
          if (!old) return old;
          return old.filter((item) => item.kind !== 'task' || item.id !== taskId);
        }
      );

      // Optimistically remove from My Tasks
      queryClient.setQueriesData<MyTasksByClient[]>(
        { queryKey: ['myTasks', 'list'] },
        (old) => {
          if (!old) return old;
          return old.map((clientGroup) => ({
            ...clientGroup,
            tasks: clientGroup.tasks.filter((task) => task.id !== taskId),
          }));
        }
      );

      // Optimistically remove from rollup task lists
      queryClient.setQueriesData(
        { queryKey: ['rollups', 'tasks'] },
        (old: unknown) => {
          if (!old || typeof old !== 'object') return old;
          const data = old as { tasks?: { id: string }[] };
          if (!data.tasks) return old;
          return {
            ...data,
            tasks: data.tasks.filter((task) => task.id !== taskId),
          };
        }
      );

      // Optimistically remove from archived task lists
      queryClient.setQueriesData<ArchivedTaskSummary[]>(
        { queryKey: [...taskKeys.all, 'archived'] },
        (old) => {
          if (!old) return old;
          return old.filter((task) => task.id !== taskId);
        }
      );

      // Remove from detail cache
      queryClient.removeQueries({ queryKey: taskKeys.detail(taskId) });

      return { previousTask, previousTasks, previousBoardItems, previousMyTasks, previousRollupTasks };
    },
    onSuccess: () => {
      toast.success('Task deleted');
      trackEvent('task_deleted');
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
      if (context?.previousBoardItems) {
        for (const [queryKey, data] of context.previousBoardItems) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousMyTasks) {
        for (const [queryKey, data] of context.previousMyTasks) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousRollupTasks) {
        for (const [queryKey, data] of context.previousRollupTasks) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.boardItemLists() });
      // Invalidate subtask caches (deleting a subtask affects parent counts)
      queryClient.invalidateQueries({ queryKey: [...taskKeys.all, 'subtasks'] });
      // Invalidate My Tasks, rollup, and archived caches
      queryClient.invalidateQueries({ queryKey: ['myTasks'] });
      queryClient.invalidateQueries({ queryKey: ['rollups', 'tasks'] });
      queryClient.invalidateQueries({ queryKey: [...taskKeys.all, 'archived'] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const result = await deleteProject(projectId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to delete project');
      }
      return projectId;
    },
    onMutate: async (projectId) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.boardItemLists() });
      const previousItems = queryClient.getQueriesData<BoardItem[]>({
        queryKey: taskKeys.boardItemLists(),
      });
      queryClient.setQueriesData<BoardItem[]>(
        { queryKey: taskKeys.boardItemLists() },
        (old) => old?.filter((item) => item.kind !== 'project' || item.id !== projectId)
      );
      return { previousItems };
    },
    onSuccess: () => {
      toast.success('Project deleted');
    },
    onError: (err, variables, context) => {
      if (context?.previousItems) {
        for (const [queryKey, data] of context.previousItems) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.boardItemLists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

/**
 * Hook to update task positions (for drag-and-drop)
 */
export function useUpdateTaskPositions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: { id: string; position: number; status?: string; section?: string | null }[]) => {
      const result = await updateTaskPositions(updates);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to update positions');
      }
      return updates;
    },
    onMutate: async (updates) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() });
      await queryClient.cancelQueries({ queryKey: taskKeys.boardItemLists() });
      await queryClient.cancelQueries({ queryKey: ['rollups', 'tasks'] });

      // Snapshot the previous values
      const previousTasks = queryClient.getQueriesData<TaskWithAssignees[]>({
        queryKey: taskKeys.lists(),
      });
      const previousBoardItems = queryClient.getQueriesData<BoardItem[]>({
        queryKey: taskKeys.boardItemLists(),
      });
      const previousRollupTasks = queryClient.getQueriesData({
        queryKey: ['rollups', 'tasks'],
      });

      // Create a map of updates for quick lookup
      const updateMap = new Map(
        updates.map((u) => [u.id, { position: u.position, status: u.status, section: u.section }])
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
                section: update.section !== undefined ? update.section : task.section,
                updatedAt: new Date(),
              };
            }
            return task;
          });
        }
      );

      queryClient.setQueriesData<BoardItem[]>(
        { queryKey: taskKeys.boardItemLists() },
        (old) => {
          if (!old) return old;
          return old.map((item) => {
            if (item.kind !== 'task') return item;
            const update = updateMap.get(item.id);
            if (!update) return item;
            return {
              ...item,
              position: update.position,
              status: update.status ?? item.status,
              section: update.section !== undefined ? update.section : item.section,
              updatedAt: new Date(),
            };
          });
        }
      );

      // Optimistically update rollup task lists
      queryClient.setQueriesData<{ tasks: RollupTaskCacheItem[]; statusOptions: unknown[]; sectionOptions: unknown[] }>(
        { queryKey: ['rollups', 'tasks'] },
        (old) => {
          if (!old?.tasks) return old;
          return {
            ...old,
            tasks: old.tasks.map((task) => {
              const update = updateMap.get(task.id);
              if (update) {
                return {
                  ...task,
                  position: update.position,
                  status: update.status ?? task.status,
                  section: update.section !== undefined ? update.section : task.section,
                };
              }
              return task;
            }),
          };
        }
      );

      return { previousTasks, previousBoardItems, previousRollupTasks };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        for (const [queryKey, data] of context.previousTasks) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousRollupTasks) {
        for (const [queryKey, data] of context.previousRollupTasks) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousBoardItems) {
        for (const [queryKey, data] of context.previousBoardItems) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.boardItemLists() });
      queryClient.invalidateQueries({ queryKey: ['rollups', 'tasks'] });
      // Invalidate subtask caches (subtask reordering)
      queryClient.invalidateQueries({ queryKey: [...taskKeys.all, 'subtasks'] });
    },
  });
}

export function useUpdateBoardItemPositions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: BoardItemPositionUpdateInput[]) => {
      const result = await updateBoardItemPositions(updates);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to update positions');
      }
      return updates;
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.boardItemLists() });
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() });
      const previousItems = queryClient.getQueriesData<BoardItem[]>({
        queryKey: taskKeys.boardItemLists(),
      });
      const updateMap = new Map(updates.map((update) => [update.id, update]));

      queryClient.setQueriesData<BoardItem[]>(
        { queryKey: taskKeys.boardItemLists() },
        (old) => {
          if (!old) return old;
          return old.map((item) => {
            const update = updateMap.get(item.id);
            if (!update) return item;
            return {
              ...item,
              position: update.position,
              status: update.status ?? item.status,
              ...(update.section !== undefined && { section: update.section }),
              updatedAt: new Date(),
            };
          });
        }
      );

      return { previousItems };
    },
    onError: (err, variables, context) => {
      if (context?.previousItems) {
        for (const [queryKey, data] of context.previousItems) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.boardItemLists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['rollups', 'tasks'] });
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
    onSuccess: () => {
      trackEvent('subtask_created');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.subtasks(parentTaskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(parentTaskId) });
    },
  });
}

/**
 * Hook to fetch archived tasks for a board
 */
export function useArchivedTasks(boardId: string, search?: string) {
  return useQuery({
    queryKey: [...taskKeys.archivedTasks(boardId), search],
    queryFn: async () => {
      const result = await listArchivedTasks(boardId, search);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch archived tasks');
      }
      return result.tasks!;
    },
    enabled: !!boardId,
  });
}

/**
 * Hook to archive a task
 */
export function useArchiveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const result = await archiveTask(taskId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to archive task');
      }
    },
    onSuccess: () => {
      toast.success('Task archived');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.boardItemLists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.details() });
      queryClient.invalidateQueries({ queryKey: [...taskKeys.all, 'archived'] });
      queryClient.invalidateQueries({ queryKey: ['myTasks'] });
    },
  });
}

export function useArchiveProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const result = await archiveProject(projectId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to archive project');
      }
    },
    onSuccess: () => {
      toast.success('Project archived');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.boardItemLists() });
    },
  });
}

/**
 * Hook to unarchive a task
 */
export function useUnarchiveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const result = await unarchiveTask(taskId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to unarchive task');
      }
    },
    onSuccess: () => {
      toast.success('Task unarchived');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.boardItemLists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.details() });
      queryClient.invalidateQueries({ queryKey: [...taskKeys.all, 'archived'] });
      queryClient.invalidateQueries({ queryKey: ['myTasks'] });
    },
  });
}

export function useUnarchiveProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const result = await unarchiveProject(projectId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to unarchive project');
      }
    },
    onSuccess: () => {
      toast.success('Project unarchived');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.boardItemLists() });
    },
  });
}

/**
 * Hook to bulk update multiple tasks at once
 */
export function useBulkUpdateTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BulkUpdateTasksInput) => {
      const result = await bulkUpdateTasks(input);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to update tasks');
      }
      return result.updatedCount!;
    },
    onSuccess: (count) => {
      toast.success(`Updated ${count} task${count === 1 ? '' : 's'}`);
      trackEvent('bulk_operation', { action: 'update', count });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.details() });
      queryClient.invalidateQueries({ queryKey: ['myTasks'] });
    },
  });
}

/**
 * Hook to bulk archive all done tasks on a board
 */
export function useBulkArchiveDone(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await bulkArchiveDone(boardId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to archive tasks');
      }
      return result.archivedCount!;
    },
    onSuccess: (count) => {
      toast.success(`Archived ${count} task${count === 1 ? '' : 's'}`);
      trackEvent('bulk_operation', { action: 'archive', count });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.archivedTasks(boardId) });
      queryClient.invalidateQueries({ queryKey: ['myTasks'] });
    },
  });
}

/**
 * Hook to duplicate multiple tasks (including subtasks and assignees)
 */
export function useBulkDuplicateTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskIds: string[]) => {
      const result = await bulkDuplicateTasks(taskIds);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to duplicate tasks');
      }
      return result.duplicatedCount!;
    },
    onSuccess: (count) => {
      toast.success(`Duplicated ${count} task${count === 1 ? '' : 's'}`);
      trackEvent('bulk_operation', { action: 'duplicate', count });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.details() });
      queryClient.invalidateQueries({ queryKey: ['myTasks'] });
    },
  });
}

export function useBulkDeleteTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskIds: string[]) => {
      const result = await bulkDeleteTasks(taskIds);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to delete tasks');
      }
      return result.deletedCount!;
    },
    onSuccess: (count) => {
      toast.success(`Deleted ${count} task${count === 1 ? '' : 's'}`);
      trackEvent('bulk_operation', { action: 'delete', count });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.details() });
      queryClient.invalidateQueries({ queryKey: ['myTasks'] });
    },
  });
}
