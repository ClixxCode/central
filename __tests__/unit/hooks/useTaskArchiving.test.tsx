import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useArchiveTask, useBulkArchiveDone, useUnarchiveTask } from '@/lib/hooks/useTasks';
import * as taskActions from '@/lib/actions/tasks';

vi.mock('@/lib/actions/tasks', () => ({
  listTasks: vi.fn(),
  listSubtasks: vi.fn(),
  getTask: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  updateTaskPositions: vi.fn(),
  getBoardAssignableUsers: vi.fn(),
  archiveTask: vi.fn(),
  unarchiveTask: vi.fn(),
  bulkArchiveDone: vi.fn(),
  listArchivedTasks: vi.fn(),
  bulkUpdateTasks: vi.fn(),
  bulkDuplicateTasks: vi.fn(),
  bulkDeleteTasks: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('posthog-js', () => ({ default: { capture: vi.fn() } }));

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { invalidateQueries, wrapper };
}

describe('task archive rollup invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(taskActions.archiveTask).mockResolvedValue({ success: true });
    vi.mocked(taskActions.unarchiveTask).mockResolvedValue({ success: true });
    vi.mocked(taskActions.bulkArchiveDone).mockResolvedValue({
      success: true,
      archivedCount: 2,
    });
  });

  it.each([
    ['archive', () => useArchiveTask()],
    ['unarchive', () => useUnarchiveTask()],
  ] as const)('invalidates rollup tasks after %s', async (_name, useMutationHook) => {
    const { invalidateQueries, wrapper } = createHarness();
    const { result } = renderHook(useMutationHook, { wrapper });

    await act(async () => {
      await result.current.mutateAsync('task-1');
    });

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['rollups', 'tasks'],
      });
    });
  });

  it('invalidates rollup tasks after bulk archive', async () => {
    const { invalidateQueries, wrapper } = createHarness();
    const { result } = renderHook(() => useBulkArchiveDone('board-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['rollups', 'tasks'],
      });
    });
  });
});
