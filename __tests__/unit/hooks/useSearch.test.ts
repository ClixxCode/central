import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSearch } from '@/lib/hooks/useSearch';
import * as tasksActions from '@/lib/actions/tasks';
import React from 'react';

// Mock the search action
vi.mock('@/lib/actions/tasks', () => ({
  searchTasks: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useSearch', () => {
  beforeEach(() => {
    vi.mocked(tasksActions.searchTasks).mockReset();
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useSearch(), { wrapper: createWrapper() });

    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isEmpty).toBe(false);
    expect(result.current.shouldShowResults).toBe(false);
  });

  it('should update query on setQuery', () => {
    const { result } = renderHook(() => useSearch(), { wrapper: createWrapper() });

    act(() => {
      result.current.setQuery('test');
    });

    expect(result.current.query).toBe('test');
  });

  it('should not search for queries shorter than minLength', async () => {
    const { result } = renderHook(() => useSearch({ minLength: 2, debounceMs: 10 }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setQuery('t');
    });

    // Wait for debounce
    await new Promise((r) => setTimeout(r, 50));

    expect(tasksActions.searchTasks).not.toHaveBeenCalled();
    expect(result.current.shouldShowResults).toBe(false);
  });

  it('should debounce search queries', async () => {
    vi.mocked(tasksActions.searchTasks).mockResolvedValue({
      success: true,
      results: [],
    });

    const { result } = renderHook(() => useSearch({ debounceMs: 50 }), {
      wrapper: createWrapper(),
    });

    // Type quickly
    act(() => {
      result.current.setQuery('te');
    });

    act(() => {
      result.current.setQuery('tes');
    });

    act(() => {
      result.current.setQuery('test');
    });

    // Before debounce completes, no search should be made
    await new Promise((r) => setTimeout(r, 20));
    expect(tasksActions.searchTasks).not.toHaveBeenCalled();

    // After debounce, search should be made
    await waitFor(
      () => {
        expect(tasksActions.searchTasks).toHaveBeenCalledTimes(1);
      },
      { timeout: 200 }
    );

    expect(tasksActions.searchTasks).toHaveBeenCalledWith('test');
  });

  it('should clear search on clearSearch', async () => {
    const { result } = renderHook(() => useSearch(), { wrapper: createWrapper() });

    act(() => {
      result.current.setQuery('test');
    });

    act(() => {
      result.current.clearSearch();
    });

    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
  });

  it('should return results from successful search', async () => {
    const mockResults = [
      {
        id: '1',
        title: 'Test Task',
        status: 'todo',
        boardId: 'board-1',
        boardName: 'Test Board',
        clientId: 'client-1',
        clientName: 'Test Client',
        clientSlug: 'test-client',
        assignees: [],
        parentTaskId: null,
        parentTaskTitle: null,
        archivedAt: null,
      },
    ];

    vi.mocked(tasksActions.searchTasks).mockResolvedValue({
      success: true,
      results: mockResults,
    });

    const { result } = renderHook(() => useSearch({ debounceMs: 10 }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setQuery('test');
    });

    // Wait for results
    await waitFor(
      () => {
        expect(result.current.results).toEqual(mockResults);
      },
      { timeout: 200 }
    );
  });

  it('should set isEmpty when no results found', async () => {
    vi.mocked(tasksActions.searchTasks).mockResolvedValue({
      success: true,
      results: [],
    });

    const { result } = renderHook(() => useSearch({ debounceMs: 10 }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setQuery('nonexistent');
    });

    // Wait for query to complete
    await waitFor(
      () => {
        expect(result.current.isEmpty).toBe(true);
      },
      { timeout: 200 }
    );
  });
});
