'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createSavedView,
  deleteSavedView,
  getSavedView,
  getSavedViewInvitations,
  getSavedViewTasks,
  inviteAllUsersToSavedView,
  inviteTeamToSavedView,
  inviteUserToSavedView,
  listPendingSavedViewInvitations,
  listSavedViews,
  previewSavedViewTasks,
  removeSavedViewInvitation,
  respondToSavedViewInvitation,
  updateSavedView,
} from '@/lib/actions/saved-views';
import type { TaskFilters, TaskSortOptions } from '@/lib/actions/tasks';
import type { CreateSavedViewInput, UpdateSavedViewInput } from '@/lib/validations/saved-view';
import { favoriteKeys } from './useFavorites';

export const savedViewKeys = {
  all: ['saved-views'] as const,
  list: () => [...savedViewKeys.all, 'list'] as const,
  detail: (viewId: string) => [...savedViewKeys.all, 'detail', viewId] as const,
  tasks: (viewId: string) => [...savedViewKeys.all, 'tasks', viewId] as const,
  preview: (boardIds: string[], filters: TaskFilters, sort: TaskSortOptions) =>
    [...savedViewKeys.all, 'preview', boardIds, filters, sort] as const,
  sharing: (viewId: string) => [...savedViewKeys.all, 'sharing', viewId] as const,
  pendingInvitations: () => [...savedViewKeys.all, 'pending-invitations'] as const,
};

export function useSavedViews() {
  return useQuery({
    queryKey: savedViewKeys.list(),
    queryFn: async () => {
      const result = await listSavedViews();
      if (!result.success) throw new Error(result.error);
      return result.data ?? [];
    },
  });
}

export function usePendingSavedViewInvitations() {
  return useQuery({
    queryKey: savedViewKeys.pendingInvitations(),
    queryFn: async () => {
      const result = await listPendingSavedViewInvitations();
      if (!result.success) throw new Error(result.error);
      return result.data ?? [];
    },
  });
}

export function useRespondToSavedViewInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ invitationId, accept }: { invitationId: string; accept: boolean }) => {
      const result = await respondToSavedViewInvitation(invitationId, accept);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedViewKeys.all });
      toast.success('Invitation updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSavedView(viewId: string) {
  return useQuery({
    queryKey: savedViewKeys.detail(viewId),
    queryFn: async () => {
      const result = await getSavedView(viewId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: !!viewId,
  });
}

export function useSavedViewTasks(viewId: string) {
  return useQuery({
    queryKey: savedViewKeys.tasks(viewId),
    queryFn: async () => {
      const result = await getSavedViewTasks(viewId);
      if (!result.success || !result.data) throw new Error(result.error);
      return result.data;
    },
    enabled: !!viewId,
  });
}

export function useSavedViewPreview(boardIds: string[], filters: TaskFilters, sort: TaskSortOptions) {
  return useQuery({
    queryKey: savedViewKeys.preview(boardIds, filters, sort),
    queryFn: async () => {
      const result = await previewSavedViewTasks(boardIds, filters, sort);
      if (!result.success || !result.data) throw new Error(result.error);
      return result.data;
    },
    enabled: boardIds.length > 0,
  });
}

export function useCreateSavedView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSavedViewInput) => {
      const result = await createSavedView(input);
      if (!result.success || !result.data) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedViewKeys.all });
      toast.success('View saved');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateSavedView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ viewId, input }: { viewId: string; input: UpdateSavedViewInput }) => {
      const result = await updateSavedView(viewId, input);
      if (!result.success || !result.data) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (view) => {
      queryClient.setQueryData(savedViewKeys.detail(view.id), view);
      queryClient.invalidateQueries({ queryKey: savedViewKeys.tasks(view.id) });
      queryClient.invalidateQueries({ queryKey: savedViewKeys.list() });
      queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
      toast.success('View updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteSavedView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (viewId: string) => {
      const result = await deleteSavedView(viewId);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedViewKeys.all });
      queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
      toast.success('View deleted');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSavedViewSharing(viewId: string) {
  return useQuery({
    queryKey: savedViewKeys.sharing(viewId),
    queryFn: async () => {
      const result = await getSavedViewInvitations(viewId);
      if (!result.success) throw new Error(result.error);
      return result.data ?? [];
    },
    enabled: !!viewId,
  });
}

export function useSavedViewSharingMutations(viewId: string) {
  const queryClient = useQueryClient();
  const settled = () => queryClient.invalidateQueries({ queryKey: savedViewKeys.sharing(viewId) });
  const mutationOptions = {
    onSuccess: () => { settled(); toast.success('Sharing updated'); },
    onError: (error: Error) => toast.error(error.message),
  };
  return {
    inviteUser: useMutation({
      mutationFn: async (userId: string) => {
        const result = await inviteUserToSavedView(viewId, userId);
        if (!result.success) throw new Error(result.error);
      },
      ...mutationOptions,
    }),
    inviteTeam: useMutation({
      mutationFn: async (teamId: string) => {
        const result = await inviteTeamToSavedView(viewId, teamId);
        if (!result.success) throw new Error(result.error);
      },
      ...mutationOptions,
    }),
    inviteAll: useMutation({
      mutationFn: async () => {
        const result = await inviteAllUsersToSavedView(viewId);
        if (!result.success) throw new Error(result.error);
      },
      ...mutationOptions,
    }),
    remove: useMutation({
      mutationFn: async (invitationId: string) => {
        const result = await removeSavedViewInvitation(invitationId);
        if (!result.success) throw new Error(result.error);
      },
      ...mutationOptions,
    }),
  };
}
