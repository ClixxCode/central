'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getRollupOwners,
  getRollupInvitations,
  inviteUserToRollup,
  inviteTeamToRollup,
  inviteAllUsersToRollup,
  respondToRollupInvitation,
  removeRollupInvitation,
  transferRollupOwnership,
  checkRollupAccess,
  type RollupOwner,
  type RollupInvitation,
} from '@/lib/actions/rollup-sharing';

// Query Keys
export const rollupSharingKeys = {
  all: ['rollup-sharing'] as const,
  owners: (rollupBoardId: string) => [...rollupSharingKeys.all, 'owners', rollupBoardId] as const,
  invitations: (rollupBoardId: string) =>
    [...rollupSharingKeys.all, 'invitations', rollupBoardId] as const,
  access: (rollupBoardId: string) => [...rollupSharingKeys.all, 'access', rollupBoardId] as const,
};

/**
 * Fetch rollup owners
 */
export function useRollupOwners(rollupBoardId: string) {
  return useQuery({
    queryKey: rollupSharingKeys.owners(rollupBoardId),
    queryFn: async () => {
      const result = await getRollupOwners(rollupBoardId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch rollup owners');
      }
      return result.data ?? [];
    },
    enabled: !!rollupBoardId,
  });
}

/**
 * Fetch rollup invitations
 */
export function useRollupInvitations(rollupBoardId: string) {
  return useQuery({
    queryKey: rollupSharingKeys.invitations(rollupBoardId),
    queryFn: async () => {
      const result = await getRollupInvitations(rollupBoardId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch rollup invitations');
      }
      return result.data ?? [];
    },
    enabled: !!rollupBoardId,
  });
}

/**
 * Check rollup access
 */
export function useRollupAccess(rollupBoardId: string) {
  return useQuery({
    queryKey: rollupSharingKeys.access(rollupBoardId),
    queryFn: async () => {
      const result = await checkRollupAccess(rollupBoardId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to check rollup access');
      }
      return result.data ?? false;
    },
    enabled: !!rollupBoardId,
  });
}

/**
 * Invite a user to a rollup
 */
export function useInviteUserToRollup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      rollupBoardId,
      userId,
    }: {
      rollupBoardId: string;
      userId: string;
    }) => {
      const result = await inviteUserToRollup(rollupBoardId, userId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to invite user');
      }
      return result.data;
    },
    onSuccess: (_, { rollupBoardId }) => {
      queryClient.invalidateQueries({ queryKey: rollupSharingKeys.invitations(rollupBoardId) });
      toast.success('Invitation sent');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Invite a team to a rollup
 */
export function useInviteTeamToRollup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      rollupBoardId,
      teamId,
    }: {
      rollupBoardId: string;
      teamId: string;
    }) => {
      const result = await inviteTeamToRollup(rollupBoardId, teamId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to invite team');
      }
      return result.data;
    },
    onSuccess: (_, { rollupBoardId }) => {
      queryClient.invalidateQueries({ queryKey: rollupSharingKeys.invitations(rollupBoardId) });
      toast.success('Team invited');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Invite all users to a rollup (admin only)
 */
export function useInviteAllUsersToRollup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rollupBoardId: string) => {
      const result = await inviteAllUsersToRollup(rollupBoardId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to invite all users');
      }
      return result.data;
    },
    onSuccess: (_, rollupBoardId) => {
      queryClient.invalidateQueries({ queryKey: rollupSharingKeys.invitations(rollupBoardId) });
      toast.success('All users invited');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Respond to a rollup invitation
 */
export function useRespondToRollupInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invitationId,
      accept,
      rollupBoardId,
    }: {
      invitationId: string;
      accept: boolean;
      rollupBoardId: string;
    }) => {
      const result = await respondToRollupInvitation(invitationId, accept);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to respond to invitation');
      }
    },
    onSuccess: (_, { accept, rollupBoardId }) => {
      queryClient.invalidateQueries({ queryKey: rollupSharingKeys.invitations(rollupBoardId) });
      queryClient.invalidateQueries({ queryKey: rollupSharingKeys.access(rollupBoardId) });
      toast.success(accept ? 'Invitation accepted' : 'Invitation declined');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Remove a rollup invitation
 */
export function useRemoveRollupInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invitationId,
      rollupBoardId,
    }: {
      invitationId: string;
      rollupBoardId: string;
    }) => {
      const result = await removeRollupInvitation(invitationId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to remove invitation');
      }
    },
    onSuccess: (_, { rollupBoardId }) => {
      queryClient.invalidateQueries({ queryKey: rollupSharingKeys.invitations(rollupBoardId) });
      toast.success('Invitation removed');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Transfer rollup ownership
 */
export function useTransferRollupOwnership() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      rollupBoardId,
      newOwnerUserId,
    }: {
      rollupBoardId: string;
      newOwnerUserId: string;
    }) => {
      const result = await transferRollupOwnership(rollupBoardId, newOwnerUserId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to transfer ownership');
      }
    },
    onSuccess: (_, { rollupBoardId }) => {
      queryClient.invalidateQueries({ queryKey: rollupSharingKeys.owners(rollupBoardId) });
      toast.success('Ownership transferred');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
