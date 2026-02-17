'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  type ClientWithBoards,
} from '@/lib/actions/clients';
import type { CreateClientInput, UpdateClientInput } from '@/lib/validations/client';

// Query Keys
export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  list: (filters?: object) => [...clientKeys.lists(), filters] as const,
  details: () => [...clientKeys.all, 'detail'] as const,
  detail: (slug: string) => [...clientKeys.details(), slug] as const,
};

/**
 * Fetch all clients with their boards
 */
export function useClients() {
  return useQuery({
    queryKey: clientKeys.lists(),
    queryFn: async () => {
      const result = await listClients();
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch clients');
      }
      return result.data ?? [];
    },
  });
}

/**
 * Fetch a single client by slug
 */
export function useClient(slug: string) {
  return useQuery({
    queryKey: clientKeys.detail(slug),
    queryFn: async () => {
      const result = await getClient(slug);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch client');
      }
      return result.data;
    },
    enabled: !!slug,
  });
}

/**
 * Create a new client with optimistic update
 */
export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateClientInput) => {
      const result = await createClient(input);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to create client');
      }
      return result.data!;
    },
    onMutate: async (newClient) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: clientKeys.lists() });

      // Snapshot the previous value
      const previous = queryClient.getQueryData<ClientWithBoards[]>(clientKeys.lists());

      // Optimistically add the new client
      queryClient.setQueryData<ClientWithBoards[]>(clientKeys.lists(), (old = []) => [
        ...old,
        {
          id: `temp-${Date.now()}`,
          name: newClient.name,
          slug: newClient.slug,
          color: newClient.color ?? null,
          icon: newClient.icon ?? null,
          leadUserId: newClient.leadUserId ?? null,
          defaultBoardId: newClient.defaultBoardId ?? null,
          metadata: newClient.metadata ?? null,
          createdBy: null,
          createdAt: new Date(),
          boards: [],
        },
      ]);

      return { previous };
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(clientKeys.lists(), context.previous);
      }
      toast.error(error.message || 'Failed to create client');
    },
    onSuccess: (data) => {
      toast.success(`Client "${data.name}" created`);
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}

/**
 * Update a client with optimistic update
 */
export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateClientInput }) => {
      const result = await updateClient(id, input);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to update client');
      }
      return result.data!;
    },
    onMutate: async ({ id, input }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: clientKeys.lists() });

      // Snapshot the previous value
      const previous = queryClient.getQueryData<ClientWithBoards[]>(clientKeys.lists());

      // Optimistically update the client
      queryClient.setQueryData<ClientWithBoards[]>(clientKeys.lists(), (old = []) =>
        old.map((client) =>
          client.id === id
            ? {
                ...client,
                ...(input.name !== undefined && { name: input.name }),
                ...(input.slug !== undefined && { slug: input.slug }),
                ...(input.color !== undefined && { color: input.color ?? null }),
                ...(input.icon !== undefined && { icon: input.icon ?? null }),
                ...(input.defaultBoardId !== undefined && { defaultBoardId: input.defaultBoardId ?? null }),
              }
            : client
        )
      );

      return { previous };
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(clientKeys.lists(), context.previous);
      }
      toast.error(error.message || 'Failed to update client');
    },
    onSuccess: (data) => {
      toast.success(`Client "${data.name}" updated`);
    },
    onSettled: (_data, _error, { id }) => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}

/**
 * Delete a client with optimistic update
 */
export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteClient(id);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to delete client');
      }
    },
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: clientKeys.lists() });

      // Snapshot the previous value
      const previous = queryClient.getQueryData<ClientWithBoards[]>(clientKeys.lists());

      // Optimistically remove the client
      queryClient.setQueryData<ClientWithBoards[]>(clientKeys.lists(), (old = []) =>
        old.filter((client) => client.id !== id)
      );

      return { previous };
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(clientKeys.lists(), context.previous);
      }
      toast.error(error.message || 'Failed to delete client');
    },
    onSuccess: () => {
      toast.success('Client deleted');
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}
