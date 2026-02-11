import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import * as tasksActions from '@/lib/actions/tasks';
import React from 'react';

// Mock the router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

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

describe('GlobalSearch', () => {
  beforeEach(() => {
    vi.mocked(tasksActions.searchTasks).mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render search input', () => {
    render(<GlobalSearch />, { wrapper: createWrapper() });

    expect(screen.getByPlaceholderText('Search tasks...')).toBeInTheDocument();
  });

  it('should have proper accessibility attributes', () => {
    render(<GlobalSearch />, { wrapper: createWrapper() });

    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-label', 'Search tasks');
    expect(input).toHaveAttribute('aria-haspopup', 'listbox');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
  });

  it('should show dropdown on focus with valid query', async () => {
    vi.mocked(tasksActions.searchTasks).mockResolvedValue({
      success: true,
      results: [],
    });

    render(<GlobalSearch />, { wrapper: createWrapper() });

    const input = screen.getByPlaceholderText('Search tasks...');

    // Type a search query
    await userEvent.type(input, 'test');

    // Advance timers for debounce
    vi.advanceTimersByTime(500);

    // Wait for the dropdown
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
  });

  it('should show no results message when empty', async () => {
    vi.mocked(tasksActions.searchTasks).mockResolvedValue({
      success: true,
      results: [],
    });

    render(<GlobalSearch />, { wrapper: createWrapper() });

    const input = screen.getByPlaceholderText('Search tasks...');

    await userEvent.type(input, 'nonexistent');

    // Advance timers for debounce
    vi.advanceTimersByTime(500);

    await waitFor(() => {
      expect(screen.getByText(/No tasks found/)).toBeInTheDocument();
    });
  });

  it('should display search results', async () => {
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

    render(<GlobalSearch />, { wrapper: createWrapper() });

    const input = screen.getByPlaceholderText('Search tasks...');

    await userEvent.type(input, 'test');

    // Advance timers for debounce
    vi.advanceTimersByTime(500);

    await waitFor(() => {
      expect(screen.getByText('Test Task')).toBeInTheDocument();
      expect(screen.getByText('Test Client / Test Board')).toBeInTheDocument();
    });
  });

  it('should support keyboard navigation', async () => {
    const mockResults = [
      {
        id: '1',
        title: 'First Task',
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
      {
        id: '2',
        title: 'Second Task',
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

    render(<GlobalSearch />, { wrapper: createWrapper() });

    const input = screen.getByPlaceholderText('Search tasks...');

    await userEvent.type(input, 'task');

    // Advance timers for debounce
    vi.advanceTimersByTime(500);

    await waitFor(() => {
      expect(screen.getByText('First Task')).toBeInTheDocument();
    });

    // Press arrow down to select first item
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    // Check that first item is selected (has aria-selected)
    await waitFor(() => {
      const firstOption = screen.getByText('First Task').closest('[role="option"]');
      expect(firstOption).toHaveAttribute('aria-selected', 'true');
    });
  });
});
