import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listExtensionTokens,
  createExtensionToken,
  revokeExtensionToken,
} from '@/lib/actions/extension-tokens';

export const extensionTokenKeys = {
  all: ['extension-tokens'] as const,
  list: () => [...extensionTokenKeys.all, 'list'] as const,
};

export function useExtensionTokens() {
  return useQuery({
    queryKey: extensionTokenKeys.list(),
    queryFn: async () => {
      const result = await listExtensionTokens();
      if (!result.success) throw new Error(result.error);
      return result.tokens!;
    },
  });
}

export function useCreateExtensionToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name?: string) => {
      const result = await createExtensionToken(name);
      if (!result.success) throw new Error(result.error);
      return result.token!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: extensionTokenKeys.list() });
    },
  });
}

export function useRevokeExtensionToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tokenId: string) => {
      const result = await revokeExtensionToken(tokenId);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: extensionTokenKeys.list() });
    },
  });
}
