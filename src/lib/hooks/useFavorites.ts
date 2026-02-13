'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listFavorites,
  addFavorite,
  removeFavorite,
  reorderFavorites,
  createFavoriteFolder,
  renameFavoriteFolder,
  deleteFavoriteFolder,
  moveFavoriteToFolder,
  reorderFolderContents,
} from '@/lib/actions/favorites';
import type { FavoritesData } from '@/lib/db/schema';
import { trackEvent } from '@/lib/analytics';

// Query Keys
export const favoriteKeys = {
  all: ['favorites'] as const,
  list: () => [...favoriteKeys.all, 'list'] as const,
};

/**
 * Fetch all favorites for the current user (folders + favorites)
 */
export function useFavorites() {
  return useQuery({
    queryKey: favoriteKeys.list(),
    queryFn: async () => {
      const result = await listFavorites();
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch favorites');
      }
      return result.data ?? { folders: [], favorites: [] };
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
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
      toast.success('Added to favorites');
      trackEvent('favorite_toggled', { action: 'add', entity_type: variables.entityType });
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
      await queryClient.cancelQueries({ queryKey: favoriteKeys.list() });
      const previous = queryClient.getQueryData<FavoritesData>(favoriteKeys.list());

      queryClient.setQueryData<FavoritesData>(favoriteKeys.list(), (old) => {
        if (!old) return { folders: [], favorites: [] };
        return {
          ...old,
          favorites: old.favorites.filter((f) => f.entityId !== entityId),
        };
      });

      return { previous };
    },
    onError: (error, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(favoriteKeys.list(), context.previous);
      }
      toast.error(error instanceof Error ? error.message : 'Failed to remove favorite');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
    },
    onSuccess: () => {
      toast.success('Removed from favorites');
      trackEvent('favorite_toggled', { action: 'remove', entity_type: 'unknown' });
    },
  });
}

/**
 * Reorder top-level favorites and folders (for drag and drop)
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
      await queryClient.cancelQueries({ queryKey: favoriteKeys.list() });
      const previous = queryClient.getQueryData<FavoritesData>(favoriteKeys.list());

      if (previous) {
        const newFolders = [...previous.folders];
        const newFavorites = [...previous.favorites];

        orderedIds.forEach((id, index) => {
          if (id.startsWith('folder:')) {
            const folderId = id.slice(7);
            const folder = newFolders.find((f) => f.id === folderId);
            if (folder) folder.position = index;
          } else {
            const fav = newFavorites.find((f) => f.entityId === id);
            if (fav) fav.position = index;
          }
        });

        queryClient.setQueryData<FavoritesData>(favoriteKeys.list(), {
          folders: newFolders,
          favorites: newFavorites,
        });
      }

      return { previous };
    },
    onError: (error, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(favoriteKeys.list(), context.previous);
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
      const data = queryClient.getQueryData<FavoritesData>(favoriteKeys.list());
      const isFav = data?.favorites?.some((f) => f.entityId === entityId);

      if (isFav) {
        removeMutation.mutate(entityId);
      } else {
        addMutation.mutate({ entityType, entityId });
      }
    },
    isFavorited: (entityId: string) => {
      const data = queryClient.getQueryData<FavoritesData>(favoriteKeys.list());
      return data?.favorites?.some((f) => f.entityId === entityId) ?? false;
    },
    isPending: addMutation.isPending || removeMutation.isPending,
  };
}

/**
 * Create a favorite folder
 */
export function useCreateFavoriteFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string }) => {
      const result = await createFavoriteFolder(input);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to create folder');
      }
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create folder');
    },
  });
}

/**
 * Rename a favorite folder
 */
export function useRenameFavoriteFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { folderId: string; name: string }) => {
      const result = await renameFavoriteFolder(input);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to rename folder');
      }
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: favoriteKeys.list() });
      const previous = queryClient.getQueryData<FavoritesData>(favoriteKeys.list());

      queryClient.setQueryData<FavoritesData>(favoriteKeys.list(), (old) => {
        if (!old) return { folders: [], favorites: [] };
        return {
          ...old,
          folders: old.folders.map((f) =>
            f.id === input.folderId ? { ...f, name: input.name } : f
          ),
        };
      });

      return { previous };
    },
    onError: (error, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(favoriteKeys.list(), context.previous);
      }
      toast.error(error instanceof Error ? error.message : 'Failed to rename folder');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
    },
  });
}

/**
 * Delete a favorite folder (contents become top-level)
 */
export function useDeleteFavoriteFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (folderId: string) => {
      const result = await deleteFavoriteFolder(folderId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to delete folder');
      }
    },
    onMutate: async (folderId) => {
      await queryClient.cancelQueries({ queryKey: favoriteKeys.list() });
      const previous = queryClient.getQueryData<FavoritesData>(favoriteKeys.list());

      queryClient.setQueryData<FavoritesData>(favoriteKeys.list(), (old) => {
        if (!old) return { folders: [], favorites: [] };
        return {
          folders: old.folders.filter((f) => f.id !== folderId),
          favorites: old.favorites.map((f) =>
            f.folderId === folderId ? { ...f, folderId: null } : f
          ),
        };
      });

      return { previous };
    },
    onError: (error, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(favoriteKeys.list(), context.previous);
      }
      toast.error(error instanceof Error ? error.message : 'Failed to delete folder');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
    },
  });
}

/**
 * Move a favorite into or out of a folder
 */
export function useMoveFavoriteToFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { entityId: string; folderId: string | null }) => {
      const result = await moveFavoriteToFolder(input);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to move favorite');
      }
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: favoriteKeys.list() });
      const previous = queryClient.getQueryData<FavoritesData>(favoriteKeys.list());

      queryClient.setQueryData<FavoritesData>(favoriteKeys.list(), (old) => {
        if (!old) return { folders: [], favorites: [] };
        return {
          ...old,
          favorites: old.favorites.map((f) =>
            f.entityId === input.entityId ? { ...f, folderId: input.folderId } : f
          ),
        };
      });

      return { previous };
    },
    onError: (error, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(favoriteKeys.list(), context.previous);
      }
      toast.error(error instanceof Error ? error.message : 'Failed to move favorite');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
    },
  });
}

/**
 * Reorder favorites within a folder
 */
export function useReorderFolderContents() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { folderId: string; orderedEntityIds: string[] }) => {
      const result = await reorderFolderContents(input);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to reorder folder contents');
      }
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: favoriteKeys.list() });
      const previous = queryClient.getQueryData<FavoritesData>(favoriteKeys.list());

      if (previous) {
        const newFavorites = [...previous.favorites];
        input.orderedEntityIds.forEach((entityId, index) => {
          const fav = newFavorites.find((f) => f.entityId === entityId);
          if (fav) fav.position = index;
        });

        queryClient.setQueryData<FavoritesData>(favoriteKeys.list(), {
          ...previous,
          favorites: newFavorites,
        });
      }

      return { previous };
    },
    onError: (error, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(favoriteKeys.list(), context.previous);
      }
      toast.error(error instanceof Error ? error.message : 'Failed to reorder folder contents');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
    },
  });
}
