'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listFavorites,
  addFavorite,
  removeFavorite,
  reorderFavorites,
} from '@/lib/actions/favorites';
import type { FavoriteWithDetails } from '@/lib/db/schema';

// Query Keys
export const favoriteKeys = {
  all: ['favorites'] as const,
  list: () => [...favoriteKeys.all, 'list'] as const,
};

/**
 * Fetch all favorites for the current user
 */
export function useFavorites() {
  return useQuery({
    queryKey: favoriteKeys.list(),
    queryFn: async () => {
      const result = await listFavorites();
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch favorites');
      }
      return result.data ?? [];
    },
  });
}

/**
 * Add a board or rollup to favorites
 */
export function useAddFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { entityType: 'board' | 'rollup'; entityId: string }) => {
      const result = await addFavorite(input);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to add favorite');
      }
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
      toast.success('Added to favorites');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to add favorite');
    },
  });
}

/**
 * Remove a board or rollup from favorites
 */
export function useRemoveFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entityId: string) => {
      const result = await removeFavorite(entityId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to remove favorite');
      }
    },
    onMutate: async (entityId) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: favoriteKeys.list() });
      const previousFavorites = queryClient.getQueryData<FavoriteWithDetails[]>(favoriteKeys.list());
      
      queryClient.setQueryData<FavoriteWithDetails[]>(favoriteKeys.list(), (old) =>
        old?.filter((f) => f.entityId !== entityId) ?? []
      );

      return { previousFavorites };
    },
    onError: (error, _, context) => {
      if (context?.previousFavorites) {
        queryClient.setQueryData(favoriteKeys.list(), context.previousFavorites);
      }
      toast.error(error instanceof Error ? error.message : 'Failed to remove favorite');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
    },
    onSuccess: () => {
      toast.success('Removed from favorites');
    },
  });
}

/**
 * Reorder favorites (for drag and drop)
 */
export function useReorderFavorites() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const result = await reorderFavorites(orderedIds);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to reorder favorites');
      }
    },
    onMutate: async (orderedIds) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: favoriteKeys.list() });
      const previousFavorites = queryClient.getQueryData<FavoriteWithDetails[]>(favoriteKeys.list());
      
      if (previousFavorites) {
        const reordered = orderedIds
          .map((id) => previousFavorites.find((f) => f.entityId === id))
          .filter((f): f is FavoriteWithDetails => f !== undefined)
          .map((f, index) => ({ ...f, position: index }));
        
        queryClient.setQueryData(favoriteKeys.list(), reordered);
      }

      return { previousFavorites };
    },
    onError: (error, _, context) => {
      if (context?.previousFavorites) {
        queryClient.setQueryData(favoriteKeys.list(), context.previousFavorites);
      }
      toast.error(error instanceof Error ? error.message : 'Failed to reorder favorites');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
    },
  });
}

/**
 * Toggle favorite status for an entity
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  const addMutation = useAddFavorite();
  const removeMutation = useRemoveFavorite();

  return {
    toggle: (entityType: 'board' | 'rollup', entityId: string) => {
      const favorites = queryClient.getQueryData<FavoriteWithDetails[]>(favoriteKeys.list());
      const isFavorited = favorites?.some((f) => f.entityId === entityId);

      if (isFavorited) {
        removeMutation.mutate(entityId);
      } else {
        addMutation.mutate({ entityType, entityId });
      }
    },
    isFavorited: (entityId: string) => {
      const favorites = queryClient.getQueryData<FavoriteWithDetails[]>(favoriteKeys.list());
      return favorites?.some((f) => f.entityId === entityId) ?? false;
    },
    isPending: addMutation.isPending || removeMutation.isPending,
  };
}
