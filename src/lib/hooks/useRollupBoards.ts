'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listRollupBoards,
  getRollupBoard,
  createRollupBoard,
  updateRollupBoard,
  updateRollupSources,
  deleteRollupBoard,
  getRollupTasks,
  getAvailableSourceBoards,
  type RollupBoardSummary,
  type RollupBoardWithSources,
  type RollupTaskWithAssignees,
} from '@/lib/actions/rollups';
import type {
  CreateRollupBoardInput,
  UpdateRollupBoardInput,
  UpdateRollupSourcesInput,
} from '@/lib/validations/rollup';
import type { TaskFilters, TaskSortOptions } from '@/lib/actions/tasks';
import type { StatusOption, SectionOption } from '@/lib/db/schema';

// Query Keys
export const rollupKeys = {
  all: ['rollups'] as const,
  lists: () => [...rollupKeys.all, 'list'] as const,
  list: () => [...rollupKeys.lists()] as const,
  details: () => [...rollupKeys.all, 'detail'] as const,
  detail: (rollupId: string) => [...rollupKeys.details(), rollupId] as const,
  tasks: () => [...rollupKeys.all, 'tasks'] as const,
  taskList: (rollupId: string, filters?: TaskFilters, sort?: TaskSortOptions) =>
    [...rollupKeys.tasks(), rollupId, { filters, sort }] as const,
  availableSources: () => [...rollupKeys.all, 'available-sources'] as const,
};

/**
 * Fetch all rollup boards
 */
export function useRollupBoards() {
  return useQuery({
    queryKey: rollupKeys.list(),
    queryFn: async () => {
      const result = await listRollupBoards();
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch rollup boards');
      }
      return result.data ?? [];
    },
  });
}

/**
 * Fetch a single rollup board with its sources
 */
export function useRollupBoard(rollupId: string) {
  return useQuery({
    queryKey: rollupKeys.detail(rollupId),
    queryFn: async () => {
      const result = await getRollupBoard(rollupId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch rollup board');
      }
      return result.data;
    },
    enabled: !!rollupId,
  });
}

/**
 * Fetch tasks for a rollup board
 */
export function useRollupTasks(
  rollupId: string,
  filters?: TaskFilters,
  sort?: TaskSortOptions
) {
  return useQuery({
    queryKey: rollupKeys.taskList(rollupId, filters, sort),
    queryFn: async () => {
      const result = await getRollupTasks(rollupId, filters, sort);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch rollup tasks');
      }
      return result.data!;
    },
    enabled: !!rollupId,
  });
}

/**
 * Fetch available source boards for creating/editing rollups
 */
export function useAvailableSourceBoards() {
  return useQuery({
    queryKey: rollupKeys.availableSources(),
    queryFn: async () => {
      const result = await getAvailableSourceBoards();
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch available boards');
      }
      return result.data ?? [];
    },
  });
}

/**
 * Create a new rollup board
 */
export function useCreateRollupBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRollupBoardInput) => {
      const result = await createRollupBoard(input);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to create rollup board');
      }
      return result.data!;
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create rollup board');
    },
    onSuccess: (data) => {
      toast.success(`Rollup "${data.name}" created`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: rollupKeys.all });
    },
  });
}

/**
 * Update a rollup board with optimistic update
 */
export function useUpdateRollupBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      rollupId,
      input,
    }: {
      rollupId: string;
      input: UpdateRollupBoardInput;
    }) => {
      const result = await updateRollupBoard(rollupId, input);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to update rollup board');
      }
      return result.data!;
    },
    onMutate: async ({ rollupId, input }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: rollupKeys.detail(rollupId) });

      // Snapshot the previous value
      const previous = queryClient.getQueryData<RollupBoardWithSources>(
        rollupKeys.detail(rollupId)
      );

      // Optimistically update
      if (previous) {
        queryClient.setQueryData<RollupBoardWithSources>(
          rollupKeys.detail(rollupId),
          {
            ...previous,
            ...(input.name !== undefined && { name: input.name }),
            ...(input.reviewModeEnabled !== undefined && { reviewModeEnabled: input.reviewModeEnabled }),
          }
        );
      }

      return { previous };
    },
    onError: (error, { rollupId }, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(rollupKeys.detail(rollupId), context.previous);
      }
      toast.error(error.message || 'Failed to update rollup board');
    },
    onSuccess: (data) => {
      toast.success(`Rollup "${data.name}" updated`);
    },
    onSettled: (_data, _error, { rollupId }) => {
      queryClient.invalidateQueries({ queryKey: rollupKeys.detail(rollupId) });
      queryClient.invalidateQueries({ queryKey: rollupKeys.lists() });
    },
  });
}

/**
 * Update rollup sources
 */
export function useUpdateRollupSources() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateRollupSourcesInput) => {
      const result = await updateRollupSources(input);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to update rollup sources');
      }
      return result.data!;
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update rollup sources');
    },
    onSuccess: (data) => {
      toast.success(`Rollup sources updated (${data.sources.length} boards)`);
    },
    onSettled: (_data, _error, { rollupBoardId }) => {
      queryClient.invalidateQueries({
        queryKey: rollupKeys.detail(rollupBoardId),
      });
      queryClient.invalidateQueries({
        queryKey: rollupKeys.taskList(rollupBoardId),
      });
      queryClient.invalidateQueries({ queryKey: rollupKeys.lists() });
    },
  });
}

/**
 * Delete a rollup board
 */
export function useDeleteRollupBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rollupId: string) => {
      const result = await deleteRollupBoard(rollupId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to delete rollup board');
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete rollup board');
    },
    onSuccess: () => {
      toast.success('Rollup board deleted');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: rollupKeys.all });
    },
  });
}
