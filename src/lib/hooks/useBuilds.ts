'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listAgenticBuilds,
  listArchivedAgenticBuilds,
  getBuildableClients,
  createAgenticBuild,
  setBuildStage,
  updateAgenticBuild,
  archiveAgenticBuild,
  unarchiveAgenticBuild,
  deleteAgenticBuild,
  type AgenticBuild,
  type ArchiveBuildInput,
  type CreateBuildInput,
  type UpdateBuildInput,
} from '@/lib/actions/builds';

export const buildKeys = {
  all: ['builds'] as const,
  list: () => [...buildKeys.all, 'list'] as const,
  archived: () => [...buildKeys.all, 'archived'] as const,
  clients: () => [...buildKeys.all, 'clients'] as const,
};

/** Invalidate both the board and the archived drawer — archive, restore and
 *  delete all move a build between the two. */
function invalidateBuilds(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: buildKeys.list() });
  qc.invalidateQueries({ queryKey: buildKeys.archived() });
}

export function useAgenticBuilds() {
  return useQuery({
    queryKey: buildKeys.list(),
    queryFn: async () => {
      const res = await listAgenticBuilds();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
  });
}

/** Archived builds, newest first. Only fetched while the drawer is open. */
export function useArchivedBuilds(enabled = true) {
  return useQuery({
    queryKey: buildKeys.archived(),
    enabled,
    queryFn: async () => {
      const res = await listArchivedAgenticBuilds();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
  });
}

export function useBuildableClients() {
  return useQuery({
    queryKey: buildKeys.clients(),
    queryFn: async () => {
      const res = await getBuildableClients();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
  });
}

export function useCreateBuild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBuildInput) => {
      const res = await createAgenticBuild(input);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: buildKeys.list() });
      toast.success('Build added');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to add build'),
  });
}

export function useUpdateBuild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, input }: { taskId: string; input: UpdateBuildInput }) => {
      const res = await updateAgenticBuild(taskId, input);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: buildKeys.list() });
      toast.success('Build updated');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to update build'),
  });
}

export function useSetBuildStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, buildStage }: { taskId: string; buildStage: string }) => {
      const res = await setBuildStage(taskId, buildStage);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    // Optimistic: move the card immediately, roll back on error.
    onMutate: async ({ taskId, buildStage }) => {
      await qc.cancelQueries({ queryKey: buildKeys.list() });
      const prev = qc.getQueryData<AgenticBuild[]>(buildKeys.list());
      if (prev) {
        qc.setQueryData<AgenticBuild[]>(
          buildKeys.list(),
          prev.map((b) => (b.id === taskId ? { ...b, buildStage } : b))
        );
      }
      return { prev };
    },
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(buildKeys.list(), ctx.prev);
      toast.error(e.message || 'Failed to move build');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: buildKeys.list() });
    },
  });
}

export function useArchiveBuild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, input }: { taskId: string; input: ArchiveBuildInput }) => {
      const res = await archiveAgenticBuild(taskId, input);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    // Optimistic: drop the card off the board immediately, roll back on error.
    onMutate: async ({ taskId }) => {
      await qc.cancelQueries({ queryKey: buildKeys.list() });
      const prev = qc.getQueryData<AgenticBuild[]>(buildKeys.list());
      if (prev) {
        qc.setQueryData<AgenticBuild[]>(
          buildKeys.list(),
          prev.filter((b) => b.id !== taskId)
        );
      }
      return { prev };
    },
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(buildKeys.list(), ctx.prev);
      toast.error(e.message || 'Failed to archive build');
    },
    onSuccess: () => toast.success('Build archived'),
    onSettled: () => invalidateBuilds(qc),
  });
}

export function useUnarchiveBuild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const res = await unarchiveAgenticBuild(taskId);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => toast.success('Build restored to the board'),
    onError: (e: Error) => toast.error(e.message || 'Failed to restore build'),
    onSettled: () => invalidateBuilds(qc),
  });
}

export function useDeleteBuild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const res = await deleteAgenticBuild(taskId);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => toast.success('Build deleted'),
    onError: (e: Error) => toast.error(e.message || 'Failed to delete build'),
    onSettled: () => invalidateBuilds(qc),
  });
}
