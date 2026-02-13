'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listTeamsWithMembers,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam,
  addUserToTeam,
  removeUserFromTeam,
  listUsersForTeamManagement,
  type TeamWithMembers,
  type UserForTeam,
} from '@/lib/actions/teams';

// Query Keys
export const teamKeys = {
  all: ['teams'] as const,
  lists: () => [...teamKeys.all, 'list'] as const,
  withMembers: () => [...teamKeys.lists(), 'with-members'] as const,
  details: () => [...teamKeys.all, 'detail'] as const,
  detail: (id: string) => [...teamKeys.details(), id] as const,
  users: () => ['users', 'for-teams'] as const,
};

/**
 * Fetch all teams with their members
 */
export function useTeamsWithMembers() {
  return useQuery({
    queryKey: teamKeys.withMembers(),
    queryFn: async () => {
      const result = await listTeamsWithMembers();
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch teams');
      }
      return result.data ?? [];
    },
  });
}

/**
 * Fetch a single team by ID
 */
export function useTeam(teamId: string) {
  return useQuery({
    queryKey: teamKeys.detail(teamId),
    queryFn: async () => {
      const result = await getTeam(teamId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch team');
      }
      return result.data;
    },
    enabled: !!teamId,
  });
}

/**
 * Fetch all users for team management
 */
export function useUsersForTeams() {
  return useQuery({
    queryKey: teamKeys.users(),
    queryFn: async () => {
      const result = await listUsersForTeamManagement();
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch users');
      }
      return result.data ?? [];
    },
  });
}

/**
 * Create a new team
 */
export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const result = await createTeam(name);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to create team');
      }
      return result.data!;
    },
    onMutate: async (name) => {
      await queryClient.cancelQueries({ queryKey: teamKeys.withMembers() });

      const previous = queryClient.getQueryData<TeamWithMembers[]>(teamKeys.withMembers());

      queryClient.setQueryData<TeamWithMembers[]>(teamKeys.withMembers(), (old = []) => [
        {
          id: `temp-${Date.now()}`,
          name,
          excludeFromPublic: false,
          createdAt: new Date(),
          members: [],
        },
        ...old,
      ]);

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(teamKeys.withMembers(), context.previous);
      }
      toast.error(error.message || 'Failed to create team');
    },
    onSuccess: () => {
      toast.success('Team created successfully');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all });
    },
  });
}

/**
 * Update a team
 */
export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      data,
    }: {
      teamId: string;
      data: { name?: string; excludeFromPublic?: boolean };
    }) => {
      const result = await updateTeam(teamId, data);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to update team');
      }
    },
    onMutate: async ({ teamId, data }) => {
      await queryClient.cancelQueries({ queryKey: teamKeys.withMembers() });

      const previous = queryClient.getQueryData<TeamWithMembers[]>(teamKeys.withMembers());

      queryClient.setQueryData<TeamWithMembers[]>(teamKeys.withMembers(), (old = []) =>
        old.map((team) =>
          team.id === teamId
            ? {
                ...team,
                ...(data.name !== undefined && { name: data.name }),
                ...(data.excludeFromPublic !== undefined && { excludeFromPublic: data.excludeFromPublic }),
              }
            : team
        )
      );

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(teamKeys.withMembers(), context.previous);
      }
      toast.error(error.message || 'Failed to update team');
    },
    onSuccess: () => {
      toast.success('Team updated');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all });
    },
  });
}

/**
 * Delete a team
 */
export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (teamId: string) => {
      const result = await deleteTeam(teamId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to delete team');
      }
    },
    onMutate: async (teamId) => {
      await queryClient.cancelQueries({ queryKey: teamKeys.withMembers() });

      const previous = queryClient.getQueryData<TeamWithMembers[]>(teamKeys.withMembers());

      queryClient.setQueryData<TeamWithMembers[]>(teamKeys.withMembers(), (old = []) =>
        old.filter((team) => team.id !== teamId)
      );

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(teamKeys.withMembers(), context.previous);
      }
      toast.error(error.message || 'Failed to delete team');
    },
    onSuccess: () => {
      toast.success('Team deleted');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all });
    },
  });
}

/**
 * Add a user to a team
 */
export function useAddUserToTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      const result = await addUserToTeam(teamId, userId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to add user to team');
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add member');
    },
    onSuccess: () => {
      toast.success('Member added');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all });
      queryClient.invalidateQueries({ queryKey: ['users', 'all'] });
    },
  });
}

/**
 * Remove a user from a team
 */
export function useRemoveUserFromTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      const result = await removeUserFromTeam(teamId, userId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to remove user from team');
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to remove member');
    },
    onSuccess: () => {
      toast.success('Member removed');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all });
      queryClient.invalidateQueries({ queryKey: ['users', 'all'] });
    },
  });
}
