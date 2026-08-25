import type { PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAddTasksAsSubtasks, useParentTaskCandidates } from '@/lib/hooks/useTasks';

const { mockAddTasksAsSubtasks, mockListParentTaskCandidates, toastSuccess, toastError } = vi.hoisted(() => ({
  mockAddTasksAsSubtasks: vi.fn(),
  mockListParentTaskCandidates: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/lib/actions/tasks', () => ({
  addTasksAsSubtasks: mockAddTasksAsSubtasks,
  listParentTaskCandidates: mockListParentTaskCandidates,
}));

vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError },
}));

vi.mock('posthog-js', () => ({ default: { capture: vi.fn() } }));

function setup<T>(hook: () => T) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { ...renderHook(hook, { wrapper }), invalidateQueries };
}

describe('add tasks as subtasks hooks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads eligible parent candidates', async () => {
    mockListParentTaskCandidates.mockResolvedValue({
      success: true,
      candidates: [{ id: 'parent-1', boardId: 'board-1', title: 'Parent', status: 'todo', section: null }],
    });
    const { result } = setup(() => useParentTaskCandidates(['task-1'], 'par'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockListParentTaskCandidates).toHaveBeenCalledWith(['task-1'], 'par');
    expect(result.current.data?.[0].title).toBe('Parent');
  });

  it('adds tasks, refreshes every hierarchy consumer, and reports success', async () => {
    mockAddTasksAsSubtasks.mockResolvedValue({
      success: true,
      addedIds: ['task-1', 'task-2'],
      addedCount: 2,
      parentTaskId: 'parent-1',
    });
    const { result, invalidateQueries } = setup(() => useAddTasksAsSubtasks());

    await act(async () => {
      await result.current.mutateAsync({ taskIds: ['task-1', 'task-2'], parentTaskId: 'parent-1' });
    });

    expect(mockAddTasksAsSubtasks).toHaveBeenCalledWith(['task-1', 'task-2'], 'parent-1');
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tasks', 'list'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tasks', 'detail'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tasks', 'subtasks'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['rollups', 'tasks'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['saved-views'] });
    expect(toastSuccess).toHaveBeenCalledWith('Added 2 tasks as subtasks');
  });

  it('surfaces an atomic validation failure', async () => {
    mockAddTasksAsSubtasks.mockResolvedValue({
      success: false,
      addedIds: [],
      addedCount: 0,
      error: 'Tasks with subtasks cannot be added as subtasks',
    });
    const { result } = setup(() => useAddTasksAsSubtasks());

    await act(async () => {
      await expect(
        result.current.mutateAsync({ taskIds: ['task-1'], parentTaskId: 'parent-1' })
      ).rejects.toThrow('Tasks with subtasks cannot be added as subtasks');
    });
    expect(toastError).toHaveBeenCalledWith('Tasks with subtasks cannot be added as subtasks');
  });
});
