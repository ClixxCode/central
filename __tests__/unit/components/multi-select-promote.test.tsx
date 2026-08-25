import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { MultiSelectFloatingBar } from '@/components/tasks/MultiSelectFloatingBar';

vi.mock('@/lib/hooks/useClients', () => ({
  useClients: () => ({ data: [] }),
}));

vi.mock('@/lib/hooks/useIgnoreWeekends', () => ({
  useIgnoreWeekends: () => false,
}));

function renderBar(overrides: Partial<ComponentProps<typeof MultiSelectFloatingBar>> = {}) {
  const props: ComponentProps<typeof MultiSelectFloatingBar> = {
    selectedCount: 3,
    selectedSubtaskCount: 2,
    statusOptions: [],
    sectionOptions: [],
    assignableUsers: [],
    currentBoardId: 'board-1',
    onApply: vi.fn(),
    onDuplicate: vi.fn(),
    onPromote: vi.fn(),
    onDelete: vi.fn(),
    onRemoveAllAssignees: vi.fn(),
    onCancel: vi.fn(),
    isPending: false,
    isDuplicating: false,
    isPromoting: false,
    isDeleting: false,
    selectedTasksHaveAssignees: false,
    ...overrides,
  };

  const view = render(<MultiSelectFloatingBar {...props} />);
  return { props, ...view };
}

describe('MultiSelectFloatingBar promotion', () => {
  it('only shows Promote when at least one selected item is a subtask', () => {
    const { unmount } = renderBar({ selectedSubtaskCount: 0 });
    expect(screen.queryByRole('button', { name: 'Promote' })).not.toBeInTheDocument();

    unmount();
    renderBar({ selectedCount: 1, selectedSubtaskCount: 1 });
    expect(screen.getByRole('button', { name: 'Promote' })).toBeInTheDocument();
  });

  it('confirms promoted and unchanged counts before calling promotion', async () => {
    const onPromote = vi.fn();
    const user = userEvent.setup();
    renderBar({ onPromote });

    await user.click(screen.getByRole('button', { name: 'Promote' }));

    expect(screen.getByText('Promote 2 subtasks to tasks?')).toBeInTheDocument();
    expect(screen.getByText(/2 selected subtasks will be detached/i)).toBeInTheDocument();
    expect(screen.getByText(/1 selected regular task will remain unchanged/i)).toBeInTheDocument();

    const promoteButtons = screen.getAllByRole('button', { name: 'Promote' });
    await user.click(promoteButtons.at(-1)!);
    expect(onPromote).toHaveBeenCalledTimes(1);
  });

  it('disables Promote while pending', () => {
    renderBar({ selectedCount: 1, selectedSubtaskCount: 1, isPromoting: true });
    expect(screen.getByRole('button', { name: 'Promoting...' })).toBeDisabled();
  });
});
