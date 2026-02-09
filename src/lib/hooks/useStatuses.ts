'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listStatuses,
  createStatus,
  updateStatus,
  deleteStatus,
  reorderStatuses,
  seedDefaultStatuses,
  type Status,
} from '@/lib/actions/statuses';

// Query Keys
export const statusKeys = {
  all: ['statuses'] as const,
  lists: () => [...statusKeys.all, 'list'] as const,
};

/**
 * Fetch all global statuses
 */
export function useStatuses() {
  return useQuery({
    queryKey: statusKeys.lists(),
    queryFn: async () => {
      const result = await listStatuses();
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch statuses');
      }
      return result.data ?? [];
    },
  });
}

/**
 * Create a new status
 */
export function useCreateStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { label: string; color: string }) => {
      const result = await createStatus(data);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to create status');
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: statusKeys.all });
      toast.success('Status created');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Update a status
 */
export function useUpdateStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      statusId,
      data,
    }: {
      statusId: string;
      data: { label?: string; color?: string; position?: number };
    }) => {
      const result = await updateStatus(statusId, data);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to update status');
      }
    },
    onMutate: async ({ statusId, data }) => {
      await queryClient.cancelQueries({ queryKey: statusKeys.lists() });
      const previous = queryClient.getQueryData<Status[]>(statusKeys.lists());

      if (previous) {
        queryClient.setQueryData<Status[]>(statusKeys.lists(), (old) =>
          old?.map((s) =>
            s.id === statusId
              ? {
                  ...s,
                  ...(data.label && { label: data.label }),
                  ...(data.color && { color: data.color }),
                  ...(data.position !== undefined && { position: data.position }),
                }
              : s
          )
        );
      }

      return { previous };
    },
    onError: (error: Error, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(statusKeys.lists(), context.previous);
      }
      toast.error(error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: statusKeys.all });
    },
  });
}

/**
 * Delete a status
 */
export function useDeleteStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (statusId: string) => {
      const result = await deleteStatus(statusId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to delete status');
      }
    },
    onMutate: async (statusId) => {
      await queryClient.cancelQueries({ queryKey: statusKeys.lists() });
      const previous = queryClient.getQueryData<Status[]>(statusKeys.lists());

      if (previous) {
        queryClient.setQueryData<Status[]>(statusKeys.lists(), (old) =>
          old?.filter((s) => s.id !== statusId)
        );
      }

      return { previous };
    },
    onSuccess: () => {
      toast.success('Status deleted');
    },
    onError: (error: Error, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(statusKeys.lists(), context.previous);
      }
      toast.error(error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: statusKeys.all });
    },
  });
}

/**
 * Reorder statuses
 */
export function useReorderStatuses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (statusIds: string[]) => {
      const result = await reorderStatuses(statusIds);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to reorder statuses');
      }
    },
    onMutate: async (statusIds) => {
      await queryClient.cancelQueries({ queryKey: statusKeys.lists() });
      const previous = queryClient.getQueryData<Status[]>(statusKeys.lists());

      if (previous) {
        const reordered = statusIds
          .map((id, index) => {
            const status = previous.find((s) => s.id === id);
            return status ? { ...status, position: index } : null;
          })
          .filter((s): s is Status => s !== null);

        queryClient.setQueryData<Status[]>(statusKeys.lists(), reordered);
      }

      return { previous };
    },
    onError: (error: Error, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(statusKeys.lists(), context.previous);
      }
      toast.error(error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: statusKeys.all });
    },
  });
}

/**
 * Seed default statuses
 */
export function useSeedDefaultStatuses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await seedDefaultStatuses();
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to seed default statuses');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: statusKeys.all });
      toast.success('Default statuses created');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
