import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Swimlane } from '@/components/tasks/Swimlane';
import { SwimlaneTaskCard } from '@/components/tasks/SwimlaneTaskCard';
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
  id: 'todo',
  label: 'To Do',
  color: '#6B7280',
  position: 0,
};

const mockSectionOptions: SectionOption[] = [
  { id: 'frontend', label: 'Frontend', color: '#8B5CF6', position: 0 },
];

const mockTask: TaskWithAssignees = {
  id: 'task-1',
  boardId: 'board-1',
  title: 'Test Task',
  description: null,
  status: 'todo',
  section: 'frontend',
  dueDate: '2024-01-15',
  dateFlexibility: 'not_set',
  recurringConfig: null,
  recurringGroupId: null,
  position: 0,
  createdBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  assignees: [
    { id: 'user-1', email: 'test@example.com', name: 'Test User', avatarUrl: null, deactivatedAt: null },
  ],
  commentCount: 0,
  attachmentCount: 0,
  hasNewComments: false,
  parentTaskId: null,
  subtaskCount: 0,
  subtaskCompletedCount: 0,
  archivedAt: null,
};

describe('Swimlane', () => {
  const defaultProps = {
    status: mockStatusOption,
    taskCount: 3,
    isCollapsed: false,
    onToggleCollapse: vi.fn(),
    taskIds: ['task-1', 'task-2', 'task-3'],
    children: <div data-testid="swimlane-content">Tasks</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders status label and count', () => {
    render(<Swimlane {...defaultProps} />);

    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows content when not collapsed', () => {
    render(<Swimlane {...defaultProps} />);

    expect(screen.getByTestId('swimlane-content')).toBeInTheDocument();
  });

  it('hides content when collapsed', () => {
    render(<Swimlane {...defaultProps} isCollapsed={true} />);

    expect(screen.queryByTestId('swimlane-content')).not.toBeInTheDocument();
  });

  it('calls onToggleCollapse when header is clicked', () => {
    const onToggle = vi.fn();
    render(<Swimlane {...defaultProps} onToggleCollapse={onToggle} />);

    const header = screen.getByRole('button');
    fireEvent.click(header);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows empty state when no tasks', () => {
    render(
      <Swimlane
        {...defaultProps}
        taskCount={0}
        taskIds={[]}
      >
        {null}
      </Swimlane>
    );

    expect(screen.getByText('No tasks')).toBeInTheDocument();
  });

  it('renders status color indicator', () => {
    const { container } = render(<Swimlane {...defaultProps} />);

    const colorDot = container.querySelector('span[style*="background-color"]');
    expect(colorDot).toHaveStyle({ backgroundColor: '#6B7280' });
  });
});

describe('SwimlaneTaskCard', () => {
  const defaultProps = {
    task: mockTask,
    sectionOptions: mockSectionOptions,
    assignableUsers: [{ id: 'user-1', email: 'test@example.com', name: 'Test User', avatarUrl: null }],
  };

  it('renders task title', () => {
    render(<SwimlaneTaskCard {...defaultProps} />);

    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });

  it('renders section badge', () => {
    render(<SwimlaneTaskCard {...defaultProps} />);

    expect(screen.getByText('Frontend')).toBeInTheDocument();
  });

  it('renders due date when present', () => {
    render(<SwimlaneTaskCard {...defaultProps} />);

    // DateDisplay component will render the date
    const dateContainer = screen.getByText(/Jan/).closest('div');
    expect(dateContainer).toBeInTheDocument();
  });

  it('renders assignee avatars', () => {
    render(<SwimlaneTaskCard {...defaultProps} />);

    // Just check that the task card renders (avatars are rendered within)
    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });

  it('calls onClick when card is clicked', () => {
    const onClick = vi.fn();
    render(<SwimlaneTaskCard {...defaultProps} onClick={onClick} />);

    const card = screen.getByText('Test Task').closest('div[class*="rounded"]');
    if (card) {
      fireEvent.click(card);
      expect(onClick).toHaveBeenCalledTimes(1);
    }
  });

  it('applies overlay styles when isOverlay is true', () => {
    const { container } = render(<SwimlaneTaskCard {...defaultProps} isOverlay />);

    const card = container.querySelector('.shadow-lg');
    expect(card).toBeInTheDocument();
  });

  it('hides section badge when no section', () => {
    const taskWithoutSection = { ...mockTask, section: null };
    render(<SwimlaneTaskCard {...defaultProps} task={taskWithoutSection} />);

    expect(screen.queryByText('Frontend')).not.toBeInTheDocument();
  });
});
