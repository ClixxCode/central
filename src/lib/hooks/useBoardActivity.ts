'use client';

import { useQuery } from '@tanstack/react-query';
import { listBoardActivity, listTaskActivity, type BoardActivityEntry } from '@/lib/actions/board-activity';

export const boardActivityKeys = {
  all: ['board-activity'] as const,
  list: (boardId: string) => [...boardActivityKeys.all, boardId] as const,
  task: (taskId: string) => ['task-activity', taskId] as const,
};

export function useBoardActivity(boardId: string) {
  return useQuery({
    queryKey: boardActivityKeys.list(boardId),
    queryFn: async () => {
      const result = await listBoardActivity(boardId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch board activity');
      }
      return result.entries!;
    },
  });
}

export function useTaskActivity(taskId: string | undefined) {
  return useQuery({
    queryKey: boardActivityKeys.task(taskId!),
    queryFn: async () => {
      const result = await listTaskActivity(taskId!);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch task activity');
      }
      return result.entries!;
    },
    enabled: !!taskId,
  });
}
