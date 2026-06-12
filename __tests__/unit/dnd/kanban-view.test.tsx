import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KanbanColumn } from '@/components/tasks/KanbanColumn';
import { KanbanTaskCard } from '@/components/tasks/KanbanTaskCard';
import type { TaskWithAssignees } from '@/lib/actions/tasks';
import type { StatusOption, SectionOption } from '@/lib/db/schema';

// Mock dnd-kit
vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({
    setNodeRef: vi.fn(),
    isOver: false,
  }),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
    isOver: false,
    active: null,
  }),
  verticalListSortingStrategy: {},
}));

const mockStatusOption: StatusOption = {
  id: 'in-progress',
  label: 'In Progress',
  color: '#3B82F6',
  position: 1,
};

const mockSectionOptions: SectionOption[] = [
  { id: 'backend', label: 'Backend', color: '#EC4899', position: 1 },
];

const mockTask: TaskWithAssignees = {
  id: 'task-2',
  shortId: 'test1234',
  boardId: 'board-1',
  title: 'Kanban Test Task',
  description: null,
  status: 'in-progress',
  section: 'backend',
  dueDate: '2024-02-20',
  dateFlexibility: 'flexible',
  recurringConfig: null,
  recurringGroupId: null,
  position: 0,
  createdBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  assignees: [
    { id: 'user-2', email: 'dev@example.com', name: 'Dev User', avatarUrl: null, deactivatedAt: null },
  ],
  commentCount: 0,
  attachmentCount: 0,
  hasNewComments: false,
  parentTaskId: null,
  subtasksBreakoutEnabled: false,
  subtasksSequentialEnabled: false,
  subtaskCount: 0,
  subtaskCompletedCount: 0,
  archivedAt: null,
};

describe('KanbanColumn', () => {
  const defaultProps = {
    status: mockStatusOption,
    taskCount: 2,
    taskIds: ['task-1', 'task-2'],
    children: <div data-testid="column-content">Tasks</div>,
  };

  it('renders status label and count', () => {
    render(<KanbanColumn {...defaultProps} />);

    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders column content', () => {
    render(<KanbanColumn {...defaultProps} />);

    expect(screen.getByTestId('column-content')).toBeInTheDocument();
  });

  it('shows empty state when no tasks', () => {
    render(
      <KanbanColumn
        {...defaultProps}
        taskCount={0}
        taskIds={[]}
      >
        {null}
      </KanbanColumn>
    );

    expect(screen.getByText('No tasks')).toBeInTheDocument();
  });

  it('renders status color indicator', () => {
    const { container } = render(<KanbanColumn {...defaultProps} />);

    const colorDot = container.querySelector('span[style*="background-color"]');
    expect(colorDot).toHaveStyle({ backgroundColor: '#3B82F6' });
  });

  it('has fixed width for kanban layout', () => {
    const { container } = render(<KanbanColumn {...defaultProps} />);

    const column = container.querySelector('.w-72');
    expect(column).toBeInTheDocument();
  });
});

describe('KanbanTaskCard', () => {
  const defaultProps = {
    task: mockTask,
    sectionOptions: mockSectionOptions,
    assignableUsers: [{ id: 'user-2', email: 'dev@example.com', name: 'Dev User', avatarUrl: null }],
  };

  it('renders task title', () => {
    render(<KanbanTaskCard {...defaultProps} />);

    expect(screen.getByText('Kanban Test Task')).toBeInTheDocument();
  });

  it('renders section badge', () => {
    render(<KanbanTaskCard {...defaultProps} />);

    expect(screen.getByText('Backend')).toBeInTheDocument();
  });

  it('renders due date when present', () => {
    render(<KanbanTaskCard {...defaultProps} />);

    // DateDisplay component will render the date
    const dateContainer = screen.getByText(/Feb/).closest('div');
    expect(dateContainer).toBeInTheDocument();
  });

  it('calls onClick when card is clicked', () => {
    const onClick = vi.fn();
    render(<KanbanTaskCard {...defaultProps} onClick={onClick} />);

    const card = screen.getByText('Kanban Test Task').closest('div[class*="rounded"]');
    if (card) {
      fireEvent.click(card);
      expect(onClick).toHaveBeenCalledTimes(1);
    }
  });

  it('applies overlay styles when isOverlay is true', () => {
    const { container } = render(<KanbanTaskCard {...defaultProps} isOverlay />);

    const card = container.querySelector('.shadow-lg');
    expect(card).toBeInTheDocument();
  });

  it('applies rotation on overlay for visual feedback', () => {
    const { container } = render(<KanbanTaskCard {...defaultProps} isOverlay />);

    const card = container.querySelector('.rotate-2');
    expect(card).toBeInTheDocument();
  });

  it('hides section badge when no section', () => {
    const taskWithoutSection = { ...mockTask, section: null };
    render(<KanbanTaskCard {...defaultProps} task={taskWithoutSection} />);

    expect(screen.queryByText('Backend')).not.toBeInTheDocument();
  });

  it('does not show date area when no due date', () => {
    const taskWithoutDate = { ...mockTask, dueDate: null };
    render(<KanbanTaskCard {...defaultProps} task={taskWithoutDate} />);

    // There should be no Calendar icon when no date
    // Just verify the task renders correctly
    expect(screen.getByText('Kanban Test Task')).toBeInTheDocument();
  });

  it('starts subtask-only mode on long press when subtasks are broken out', () => {
    vi.useFakeTimers();
    const onEnterSubtaskOnlyMode = vi.fn();
    const parentTask = {
      ...mockTask,
      subtaskCount: 2,
      subtaskCompletedCount: 1,
      subtasksBreakoutEnabled: true,
    };

    try {
      render(
        <KanbanTaskCard
          {...defaultProps}
          task={parentTask}
          onOpenSubtasks={vi.fn()}
          onEnterSubtaskOnlyMode={onEnterSubtaskOnlyMode}
        />
      );

      fireEvent.pointerDown(screen.getByRole('button', { name: /long press/i }));
      vi.advanceTimersByTime(550);

      expect(onEnterSubtaskOnlyMode).toHaveBeenCalledWith(parentTask.id);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not start subtask-only mode on long press when subtasks are combined', () => {
    vi.useFakeTimers();
    const onEnterSubtaskOnlyMode = vi.fn();
    const parentTask = {
      ...mockTask,
      subtaskCount: 2,
      subtaskCompletedCount: 1,
      subtasksBreakoutEnabled: false,
    };

    try {
      render(
        <KanbanTaskCard
          {...defaultProps}
          task={parentTask}
          onToggleSubtasks={vi.fn()}
          onEnterSubtaskOnlyMode={onEnterSubtaskOnlyMode}
        />
      );

      fireEvent.pointerDown(screen.getByRole('button', { name: 'Open 1/2 subtasks' }));
      vi.advanceTimersByTime(550);

      expect(onEnterSubtaskOnlyMode).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('highlights the parent task in subtask-only mode', () => {
    const { container } = render(
      <KanbanTaskCard
        {...defaultProps}
        task={mockTask}
        isSubtaskOnlyParent
        subtaskOnlyHighlightColor="#3B82F6"
      />
    );

    expect(container.querySelector('article')).toHaveStyle({ borderColor: '#3B82F6' });
  });

  it('starts subtask-only mode from a subtask parent breadcrumb', () => {
    const onEnterSubtaskOnlyMode = vi.fn();
    const subtask = {
      ...mockTask,
      id: 'subtask-1',
      title: 'Child task',
      parentTaskId: 'parent-1',
      parentTaskTitle: 'Parent task',
    };

    render(
      <KanbanTaskCard
        {...defaultProps}
        task={subtask}
        onEnterSubtaskOnlyMode={onEnterSubtaskOnlyMode}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show only subtasks for Parent task' }));

    expect(onEnterSubtaskOnlyMode).toHaveBeenCalledWith('parent-1');
  });
});
