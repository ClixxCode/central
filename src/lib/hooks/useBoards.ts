'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listBoards,
  getBoard,
  createBoard,
  updateBoard,
  deleteBoard,
  addBoardAccess,
  updateBoardAccess,
  removeBoardAccess,
  listUsers,
  listTeams,
  type BoardWithAccess,
  type BoardSummary,
  type BoardAccessEntry,
} from '@/lib/actions/boards';
import type { CreateBoardInput, UpdateBoardInput, AddBoardAccessInput, UpdateBoardAccessInput } from '@/lib/validations/board';
import { clientKeys } from './useClients';

// Query Keys
export const boardKeys = {
  all: ['boards'] as const,
  lists: () => [...boardKeys.all, 'list'] as const,
  list: (clientId?: string) => [...boardKeys.lists(), { clientId }] as const,
  details: () => [...boardKeys.all, 'detail'] as const,
  detail: (boardId: string) => [...boardKeys.details(), boardId] as const,
};

export const userKeys = {
  all: ['users'] as const,
  list: () => [...userKeys.all, 'list'] as const,
};

export const teamKeys = {
  all: ['teams'] as const,
  list: () => [...teamKeys.all, 'list'] as const,
};

/**
 * Fetch boards, optionally filtered by client
 */
export function useBoards(clientId?: string) {
  return useQuery({
    queryKey: boardKeys.list(clientId),
    queryFn: async () => {
      const result = await listBoards(clientId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch boards');
      }
      return result.data ?? [];
    },
  });
}

/**
 * Fetch a single board with its access entries
 */
export function useBoard(boardId: string) {
  return useQuery({
    queryKey: boardKeys.detail(boardId),
    queryFn: async () => {
      const result = await getBoard(boardId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch board');
      }
      return result.data;
    },
    enabled: !!boardId,
  });
}

/**
 * Create a new board
 */
export function useCreateBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateBoardInput) => {
      const result = await createBoard(input);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to create board');
      }
      return result.data!;
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create board');
    },
    onSuccess: (data) => {
      toast.success(`Board "${data.name}" created`);
    },
    onSettled: (_data, _error, variables) => {
      // Invalidate board queries
      queryClient.invalidateQueries({ queryKey: boardKeys.all });
      // Also invalidate client queries since boards are shown in sidebar
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}

/**
 * Update a board with optimistic update
 */
export function useUpdateBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ boardId, input }: { boardId: string; input: UpdateBoardInput }) => {
      const result = await updateBoard(boardId, input);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to update board');
      }
      return result.data!;
    },
    onMutate: async ({ boardId, input }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: boardKeys.detail(boardId) });

      // Snapshot the previous value
      const previous = queryClient.getQueryData<BoardWithAccess>(boardKeys.detail(boardId));

      // Optimistically update
      if (previous) {
        queryClient.setQueryData<BoardWithAccess>(boardKeys.detail(boardId), {
          ...previous,
          ...(input.name !== undefined && { name: input.name }),
          ...(input.statusOptions !== undefined && { statusOptions: input.statusOptions }),
          ...(input.sectionOptions !== undefined && { sectionOptions: input.sectionOptions }),
        });
      }

      return { previous };
    },
    onError: (error, { boardId }, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(boardKeys.detail(boardId), context.previous);
      }
      toast.error(error.message || 'Failed to update board');
    },
    onSuccess: (data) => {
      toast.success(`Board "${data.name}" updated`);
    },
    onSettled: (_data, _error, { boardId }) => {
      queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
      queryClient.invalidateQueries({ queryKey: boardKeys.lists() });
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}

/**
 * Delete a board
 */
export function useDeleteBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (boardId: string) => {
      const result = await deleteBoard(boardId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to delete board');
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete board');
    },
    onSuccess: () => {
      toast.success('Board deleted');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.all });
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}

/**
 * Add access to a board
 */
export function useAddBoardAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddBoardAccessInput) => {
      const result = await addBoardAccess(input);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to add access');
      }
      return result.data!;
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add access');
    },
    onSuccess: (data) => {
      const name = data.user?.name ?? data.user?.email ?? data.team?.name ?? 'Access';
      toast.success(`${name} added to board`);
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: boardKeys.detail(variables.boardId) });
    },
  });
}

/**
 * Update board access level
 */
export function useUpdateBoardAccess(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateBoardAccessInput) => {
      const result = await updateBoardAccess(input);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to update access');
      }
    },
    onMutate: async ({ accessId, accessLevel }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: boardKeys.detail(boardId) });

      // Snapshot the previous value
      const previous = queryClient.getQueryData<BoardWithAccess>(boardKeys.detail(boardId));

      // Optimistically update
      if (previous) {
        queryClient.setQueryData<BoardWithAccess>(boardKeys.detail(boardId), {
          ...previous,
          access: previous.access.map((a) =>
            a.id === accessId ? { ...a, accessLevel } : a
          ),
        });
      }

      return { previous };
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(boardKeys.detail(boardId), context.previous);
      }
      toast.error(error.message || 'Failed to update access');
    },
    onSuccess: () => {
      toast.success('Access level updated');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
    },
  });
}

/**
 * Remove board access
 */
export function useRemoveBoardAccess(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accessId: string) => {
      const result = await removeBoardAccess(accessId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to remove access');
      }
    },
    onMutate: async (accessId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: boardKeys.detail(boardId) });

      // Snapshot the previous value
      const previous = queryClient.getQueryData<BoardWithAccess>(boardKeys.detail(boardId));

      // Optimistically remove
      if (previous) {
        queryClient.setQueryData<BoardWithAccess>(boardKeys.detail(boardId), {
          ...previous,
          access: previous.access.filter((a) => a.id !== accessId),
        });
      }

      return { previous };
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(boardKeys.detail(boardId), context.previous);
      }
      toast.error(error.message || 'Failed to remove access');
    },
    onSuccess: () => {
      toast.success('Access removed');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
    },
  });
}

/**
 * Fetch all users (for access management)
 */
export function useUsers() {
  return useQuery({
    queryKey: userKeys.list(),
    queryFn: async () => {
      const result = await listUsers();
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch users');
      }
      return result.data ?? [];
    },
  });
}

/**
 * Fetch all teams (for access management)
 */
export function useTeams() {
  return useQuery({
    queryKey: teamKeys.list(),
    queryFn: async () => {
      const result = await listTeams();
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch teams');
      }
      return result.data ?? [];
    },
  });
}
