import type { PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePromoteSubtasks } from '@/lib/hooks/useTasks';

const { mockPromoteSubtasks, toastSuccess, toastError } = vi.hoisted(() => ({
  mockPromoteSubtasks: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/lib/actions/tasks', () => ({
  promoteSubtasks: mockPromoteSubtasks,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn() },
}));

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const invalidateQueries = vi
    .spyOn(queryClient, 'invalidateQueries')
    .mockResolvedValue(undefined);
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return {
    ...renderHook(() => usePromoteSubtasks(), { wrapper }),
    invalidateQueries,
  };
}

describe('usePromoteSubtasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns counts, invalidates dependent views, and shows a mixed-selection toast', async () => {
    mockPromoteSubtasks.mockResolvedValue({
      success: true,
      promotedIds: ['subtask-1', 'subtask-2'],
      promotedCount: 2,
      skippedCount: 1,
      affectedParentIds: ['parent-1'],
    });
    const { result, invalidateQueries } = setup();

    await act(async () => {
      await result.current.mutateAsync(['subtask-1', 'task-1', 'subtask-2']);
    });

    expect(mockPromoteSubtasks).toHaveBeenCalledWith(['subtask-1', 'task-1', 'subtask-2']);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tasks', 'list'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tasks', 'detail'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tasks', 'subtasks'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['myTasks'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['rollups', 'tasks'] });
    expect(toastSuccess).toHaveBeenCalledWith(
      'Promoted 2 subtasks to tasks; 1 selected regular task unchanged'
    );
  });

  it('surfaces an action failure', async () => {
    mockPromoteSubtasks.mockResolvedValue({
      success: false,
      promotedIds: [],
      promotedCount: 0,
      skippedCount: 0,
      affectedParentIds: [],
      error: 'Access denied to one or more tasks',
    });
    const { result } = setup();

    await act(async () => {
      await expect(result.current.mutateAsync(['subtask-1'])).rejects.toThrow(
        'Access denied to one or more tasks'
      );
    });

    expect(toastError).toHaveBeenCalledWith('Access denied to one or more tasks');
  });
});
