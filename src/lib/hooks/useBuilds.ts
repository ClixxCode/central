'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listAgenticBuilds,
  getBuildableClients,
  createAgenticBuild,
  setBuildStage,
  type AgenticBuild,
  type CreateBuildInput,
} from '@/lib/actions/builds';

export const buildKeys = {
  all: ['builds'] as const,
  list: () => [...buildKeys.all, 'list'] as const,
  clients: () => [...buildKeys.all, 'clients'] as const,
};

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
