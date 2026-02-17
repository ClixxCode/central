'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listSections,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
  seedDefaultSections,
  type Section,
} from '@/lib/actions/sections';

// Query Keys
export const sectionKeys = {
  all: ['sections'] as const,
  lists: () => [...sectionKeys.all, 'list'] as const,
};

/**
 * Fetch all global sections
 */
export function useSections() {
  return useQuery({
    queryKey: sectionKeys.lists(),
    queryFn: async () => {
      const result = await listSections();
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch sections');
      }
      return result.data ?? [];
    },
  });
}

/**
 * Create a new section
 */
export function useCreateSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { label: string; color: string }) => {
      const result = await createSection(data);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to create section');
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sectionKeys.all });
      toast.success('Section created');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Update a section
 */
export function useUpdateSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sectionId,
      data,
    }: {
      sectionId: string;
      data: { label?: string; color?: string; position?: number };
    }) => {
      const result = await updateSection(sectionId, data);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to update section');
      }
    },
    onMutate: async ({ sectionId, data }) => {
      await queryClient.cancelQueries({ queryKey: sectionKeys.lists() });
      const previous = queryClient.getQueryData<Section[]>(sectionKeys.lists());

      if (previous) {
        queryClient.setQueryData<Section[]>(sectionKeys.lists(), (old) =>
          old?.map((s) =>
            s.id === sectionId
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
        queryClient.setQueryData(sectionKeys.lists(), context.previous);
      }
      toast.error(error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sectionKeys.all });
    },
  });
}

/**
 * Delete a section
 */
export function useDeleteSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sectionId: string) => {
      const result = await deleteSection(sectionId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to delete section');
      }
    },
    onMutate: async (sectionId) => {
      await queryClient.cancelQueries({ queryKey: sectionKeys.lists() });
      const previous = queryClient.getQueryData<Section[]>(sectionKeys.lists());

      if (previous) {
        queryClient.setQueryData<Section[]>(sectionKeys.lists(), (old) =>
          old?.filter((s) => s.id !== sectionId)
        );
      }

      return { previous };
    },
    onSuccess: () => {
      toast.success('Section deleted');
    },
    onError: (error: Error, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(sectionKeys.lists(), context.previous);
      }
      toast.error(error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sectionKeys.all });
    },
  });
}

/**
 * Reorder sections
 */
export function useReorderSections() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sectionIds: string[]) => {
      const result = await reorderSections(sectionIds);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to reorder sections');
      }
    },
    onMutate: async (sectionIds) => {
      await queryClient.cancelQueries({ queryKey: sectionKeys.lists() });
      const previous = queryClient.getQueryData<Section[]>(sectionKeys.lists());

      if (previous) {
        const reordered = sectionIds
          .map((id, index) => {
            const section = previous.find((s) => s.id === id);
            return section ? { ...section, position: index } : null;
          })
          .filter((s): s is Section => s !== null);

        queryClient.setQueryData<Section[]>(sectionKeys.lists(), reordered);
      }

      return { previous };
    },
    onError: (error: Error, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(sectionKeys.lists(), context.previous);
      }
      toast.error(error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sectionKeys.all });
    },
  });
}

/**
 * Seed default sections
 */
export function useSeedDefaultSections() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await seedDefaultSections();
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to seed default sections');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sectionKeys.all });
      toast.success('Default sections created');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
