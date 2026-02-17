import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewToggle, ViewToggleButtons } from '@/components/tasks/ViewToggle';
import { useBoardViewStore } from '@/lib/stores/boardViewStore';

describe('ViewToggle', () => {
  beforeEach(() => {
    useBoardViewStore.setState({
      boardViews: {},
      collapsedSwimlanes: {},
    });
  });

  it('shows current view mode', () => {
    render(<ViewToggle boardId="board-1" />);

    // Default should be swimlane
    expect(screen.getByText('Swimlane')).toBeInTheDocument();
  });

  it('shows kanban when set', () => {
    useBoardViewStore.getState().setBoardView('board-1', 'kanban');

    render(<ViewToggle boardId="board-1" />);

    expect(screen.getByText('Kanban')).toBeInTheDocument();
  });

  it('shows table when set', () => {
    useBoardViewStore.getState().setBoardView('board-1', 'table');

    render(<ViewToggle boardId="board-1" />);

    expect(screen.getByText('Table')).toBeInTheDocument();
  });
});

describe('ViewToggleButtons', () => {
  beforeEach(() => {
    useBoardViewStore.setState({
      boardViews: {},
      collapsedSwimlanes: {},
    });
  });

  it('renders all three view options', () => {
    render(<ViewToggleButtons boardId="board-1" />);

    expect(screen.getByRole('button', { name: /Swimlane/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kanban/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Table/i })).toBeInTheDocument();
  });

  it('highlights the active view', () => {
    useBoardViewStore.getState().setBoardView('board-1', 'kanban');

    render(<ViewToggleButtons boardId="board-1" />);

    const kanbanButton = screen.getByRole('button', { name: /Kanban/i });
    expect(kanbanButton).toHaveClass('bg-background');
  });

  it('changes view when button is clicked', () => {
    render(<ViewToggleButtons boardId="board-1" />);

    const tableButton = screen.getByRole('button', { name: /Table/i });
    fireEvent.click(tableButton);

    expect(useBoardViewStore.getState().getBoardView('board-1')).toBe('table');
  });

  it('updates store when switching between views', () => {
    render(<ViewToggleButtons boardId="board-1" />);

    // Start with default (swimlane)
    expect(useBoardViewStore.getState().getBoardView('board-1')).toBe('swimlane');

    // Click kanban
    fireEvent.click(screen.getByRole('button', { name: /Kanban/i }));
    expect(useBoardViewStore.getState().getBoardView('board-1')).toBe('kanban');

    // Click table
    fireEvent.click(screen.getByRole('button', { name: /Table/i }));
    expect(useBoardViewStore.getState().getBoardView('board-1')).toBe('table');

    // Click swimlane
    fireEvent.click(screen.getByRole('button', { name: /Swimlane/i }));
    expect(useBoardViewStore.getState().getBoardView('board-1')).toBe('swimlane');
  });

  it('maintains separate view state per board', () => {
    const { rerender } = render(<ViewToggleButtons boardId="board-1" />);

    // Set board-1 to kanban
    fireEvent.click(screen.getByRole('button', { name: /Kanban/i }));

    // Render for board-2
    rerender(<ViewToggleButtons boardId="board-2" />);

    // board-2 should still be default (swimlane)
    expect(useBoardViewStore.getState().getBoardView('board-2')).toBe('swimlane');
    expect(useBoardViewStore.getState().getBoardView('board-1')).toBe('kanban');
  });
});
