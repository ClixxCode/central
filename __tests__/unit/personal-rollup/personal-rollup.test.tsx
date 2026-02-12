import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PersonalRollupView } from '@/components/tasks/PersonalRollupView';
import { PersonalTaskCard } from '@/components/tasks/PersonalTaskCard';
import { ClientSwimlane } from '@/components/tasks/ClientSwimlane';
import { PersonalRollupToolbar } from '@/components/tasks/PersonalRollupToolbar';
import type { MyTasksByClient, MyTaskWithContext } from '@/lib/actions/tasks';

// Mock next/server and next-auth to avoid module resolution errors in jsdom
vi.mock('next/server', () => ({
  NextRequest: class MockNextRequest {},
  NextResponse: {
    json: vi.fn(),
    redirect: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: null,
    status: 'unauthenticated',
  }),
}));

vi.mock('@/lib/auth/session', () => ({
  getCurrentUser: vi.fn().mockResolvedValue(null),
  requireAuth: vi.fn().mockResolvedValue({ id: 'user-1', email: 'test@test.com', name: 'Test', image: null, role: 'user' }),
  getSession: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/auth/config', () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

// Mock the database to avoid connection errors
vi.mock('@/lib/db', () => ({
  db: {},
}));

// Mock server actions that depend on the database
vi.mock('@/lib/actions/comments', () => ({
  listComments: vi.fn(),
  createComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
}));

vi.mock('@/lib/actions/tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/actions/tasks')>();
  return {
    ...actual,
    getMyTasks: vi.fn(),
    updateTask: vi.fn(),
  };
});

// Mock the Zustand store
const mockToggleClient = vi.fn();
const mockIsClientCollapsed = vi.fn().mockReturnValue(false);

const mockSetAllClientsCollapsed = vi.fn();
const mockAreAllClientsCollapsed = vi.fn().mockReturnValue(false);

vi.mock('@/lib/stores/personalRollupStore', () => ({
  usePersonalRollupStore: () => ({
    toggleClient: mockToggleClient,
    isClientCollapsed: mockIsClientCollapsed,
    setAllClientsCollapsed: mockSetAllClientsCollapsed,
    areAllClientsCollapsed: mockAreAllClientsCollapsed,
  }),
}));

// Mock the useMyWorkPreferences hook (DB-backed preferences)
const mockToggleBoard = vi.fn();
const mockIsBoardHidden = vi.fn().mockReturnValue(false);
const mockSetHiddenBoards = vi.fn();
const mockToggleColumn = vi.fn();
const mockIsColumnHidden = vi.fn().mockReturnValue(false);

vi.mock('@/lib/hooks/useMyWorkPreferences', () => ({
  useMyWorkPreferences: () => ({
    hiddenBoards: [],
    isBoardHidden: mockIsBoardHidden,
    toggleBoard: mockToggleBoard,
    setHiddenBoards: mockSetHiddenBoards,
    hiddenColumns: [],
    isColumnHidden: mockIsColumnHidden,
    toggleColumn: mockToggleColumn,
    myWorkFilters: {},
    setMyWorkFilters: vi.fn(),
    personalTaskFilters: {},
    setPersonalTaskFilters: vi.fn(),
    todaysEventsCollapsed: false,
    todaysEventsMinimized: false,
    setTodaysEventsCollapsed: vi.fn(),
    setTodaysEventsMinimized: vi.fn(),
  }),
}));

vi.mock('@/lib/stores', () => ({
  useQuickActionsStore: () => vi.fn(),
}));

// Mock the hooks
vi.mock('@/lib/hooks/useMyTasks', () => ({
  useUpdateMyTask: () => ({
    mutate: vi.fn(),
  }),
}));

vi.mock('@/lib/hooks/useTasks', () => ({
  useDeleteTask: () => ({
    mutate: vi.fn(),
  }),
  taskKeys: {
    all: ['tasks'],
    lists: () => ['tasks', 'list'],
    list: (boardId: string) => ['tasks', 'list', boardId],
    details: () => ['tasks', 'detail'],
    detail: (taskId: string) => ['tasks', 'detail', taskId],
    assignableUsers: (boardId: string) => ['tasks', 'assignableUsers', boardId],
  },
}));

// Sample test data
const createMockTask = (overrides: Partial<MyTaskWithContext> = {}): MyTaskWithContext => ({
  id: 'task-1',
  boardId: 'board-1',
  title: 'Test Task',
  description: null,
  status: 'todo',
  section: null,
  dueDate: null,
  dateFlexibility: 'not_set',
  recurringConfig: null,
  recurringGroupId: null,
  position: 0,
  createdBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  assignees: [],
  commentCount: 0,
  attachmentCount: 0,
  hasNewComments: false,
  parentTaskId: null,
  subtaskCount: 0,
  subtaskCompletedCount: 0,
  archivedAt: null,
  parentTask: null,
  board: {
    id: 'board-1',
    name: 'Test Board',
    statusOptions: [
      { id: 'todo', label: 'To Do', color: '#6B7280', position: 0 },
      { id: 'complete', label: 'Complete', color: '#10B981', position: 1 },
    ],
    sectionOptions: [],
  },
  client: {
    id: 'client-1',
    name: 'Test Client',
    slug: 'test-client',
    color: '#3B82F6',
    icon: null,
  },
  ...overrides,
});

const createMockTasksByClient = (): MyTasksByClient[] => [
  {
    client: {
      id: 'client-1',
      name: 'Acme Corporation',
      slug: 'acme',
      color: '#3B82F6',
      icon: null,
    },
    boards: [
      {
        id: 'board-1',
        name: 'Marketing',
        statusOptions: [
          { id: 'todo', label: 'To Do', color: '#6B7280', position: 0 },
          { id: 'in-progress', label: 'In Progress', color: '#3B82F6', position: 1 },
        ],
        sectionOptions: [],
      },
    ],
    tasks: [
      createMockTask({
        id: 'task-1',
        title: 'Write blog post',
        client: { id: 'client-1', name: 'Acme Corporation', slug: 'acme', color: '#3B82F6', icon: null },
      }),
      createMockTask({
        id: 'task-2',
        title: 'Review campaign',
        client: { id: 'client-1', name: 'Acme Corporation', slug: 'acme', color: '#3B82F6', icon: null },
      }),
    ],
  },
  {
    client: {
      id: 'client-2',
      name: 'Beta Inc',
      slug: 'beta',
      color: '#10B981',
      icon: null,
    },
    boards: [
      {
        id: 'board-2',
        name: 'Development',
        statusOptions: [
          { id: 'todo', label: 'To Do', color: '#6B7280', position: 0 },
        ],
        sectionOptions: [],
      },
    ],
    tasks: [
      createMockTask({
        id: 'task-3',
        title: 'Fix bug',
        boardId: 'board-2',
        client: { id: 'client-2', name: 'Beta Inc', slug: 'beta', color: '#10B981', icon: null },
        board: {
          id: 'board-2',
          name: 'Development',
          statusOptions: [{ id: 'todo', label: 'To Do', color: '#6B7280', position: 0 }],
          sectionOptions: [],
        },
      }),
    ],
  },
];

describe('ClientSwimlane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders client name and task count', () => {
    render(
      <ClientSwimlane
        clientName="Acme Corporation"
        clientColor="#3B82F6"
        taskCount={5}
        isCollapsed={false}
        onToggleCollapse={() => {}}
      >
        <div>Task content</div>
      </ClientSwimlane>
    );

    expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows children when not collapsed', () => {
    render(
      <ClientSwimlane
        clientName="Acme"
        clientColor="#3B82F6"
        taskCount={1}
        isCollapsed={false}
        onToggleCollapse={() => {}}
      >
        <div data-testid="task-content">Task content</div>
      </ClientSwimlane>
    );

    expect(screen.getByTestId('task-content')).toBeInTheDocument();
  });

  it('hides children when collapsed', () => {
    render(
      <ClientSwimlane
        clientName="Acme"
        clientColor="#3B82F6"
        taskCount={1}
        isCollapsed={true}
        onToggleCollapse={() => {}}
      >
        <div data-testid="task-content">Task content</div>
      </ClientSwimlane>
    );

    expect(screen.queryByTestId('task-content')).not.toBeInTheDocument();
  });

  it('calls onToggleCollapse when header is clicked', () => {
    const onToggle = vi.fn();
    render(
      <ClientSwimlane
        clientName="Acme"
        clientColor="#3B82F6"
        taskCount={1}
        isCollapsed={false}
        onToggleCollapse={onToggle}
      >
        <div>Content</div>
      </ClientSwimlane>
    );

    fireEvent.click(screen.getByText('Acme'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows empty state when taskCount is 0', () => {
    render(
      <ClientSwimlane
        clientName="Acme"
        clientColor="#3B82F6"
        taskCount={0}
        isCollapsed={false}
        onToggleCollapse={() => {}}
      >
        <></>
      </ClientSwimlane>
    );

    expect(screen.getByText('No tasks')).toBeInTheDocument();
  });
});

describe('PersonalTaskCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders task title', () => {
    const task = createMockTask({ title: 'My Important Task' });
    render(<PersonalTaskCard task={task} />);

    expect(screen.getByText('My Important Task')).toBeInTheDocument();
  });

  it('renders board name when column is visible', () => {
    const task = createMockTask({
      board: { id: 'board-1', name: 'Marketing Board', statusOptions: [], sectionOptions: [] },
    });
    render(<PersonalTaskCard task={task} />);

    expect(screen.getByText('Marketing Board')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    const task = createMockTask();
    render(<PersonalTaskCard task={task} onClick={onClick} />);

    fireEvent.click(screen.getByText('Test Task'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders status dot with correct color', () => {
    const task = createMockTask({
      status: 'todo',
      board: {
        id: 'board-1',
        name: 'Test',
        statusOptions: [{ id: 'todo', label: 'To Do', color: '#FF0000', position: 0 }],
        sectionOptions: [],
      },
    });
    const { container } = render(<PersonalTaskCard task={task} />);

    const statusDot = container.querySelector('span[style*="background-color"]');
    expect(statusDot).toHaveStyle({ backgroundColor: '#FF0000' });
  });
});

describe('PersonalRollupView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsBoardHidden.mockReturnValue(false);
    mockIsClientCollapsed.mockReturnValue(false);
  });

  it('renders all clients', () => {
    const tasksByClient = createMockTasksByClient();
    render(<PersonalRollupView tasksByClient={tasksByClient} />);

    expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
  });

  it('renders all tasks', () => {
    const tasksByClient = createMockTasksByClient();
    render(<PersonalRollupView tasksByClient={tasksByClient} />);

    expect(screen.getByText('Write blog post')).toBeInTheDocument();
    expect(screen.getByText('Review campaign')).toBeInTheDocument();
    expect(screen.getByText('Fix bug')).toBeInTheDocument();
  });

  it('shows empty state when no tasks', () => {
    render(<PersonalRollupView tasksByClient={[]} />);

    expect(screen.getByText('No tasks assigned to you')).toBeInTheDocument();
  });

  it('filters out hidden boards', () => {
    mockIsBoardHidden.mockImplementation((boardId: string) => boardId === 'board-1');

    const tasksByClient = createMockTasksByClient();
    render(<PersonalRollupView tasksByClient={tasksByClient} />);

    // Acme tasks should be hidden (board-1 is hidden)
    expect(screen.queryByText('Write blog post')).not.toBeInTheDocument();
    expect(screen.queryByText('Review campaign')).not.toBeInTheDocument();

    // Beta tasks should still be visible
    expect(screen.getByText('Fix bug')).toBeInTheDocument();
  });

  it('hides entire client when all their boards are hidden', () => {
    mockIsBoardHidden.mockImplementation((boardId: string) => boardId === 'board-1');

    const tasksByClient = createMockTasksByClient();
    render(<PersonalRollupView tasksByClient={tasksByClient} />);

    // Acme client should not be visible since all boards are hidden
    expect(screen.queryByText('Acme Corporation')).not.toBeInTheDocument();
    // Beta should still be visible
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
  });
});

describe('PersonalRollupToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders columns button', () => {
    const tasksByClient = createMockTasksByClient();
    render(<PersonalRollupToolbar tasksByClient={tasksByClient} />);

    expect(screen.getByText('Columns')).toBeInTheDocument();
  });

  it('renders boards button', () => {
    const tasksByClient = createMockTasksByClient();
    render(<PersonalRollupToolbar tasksByClient={tasksByClient} />);

    expect(screen.getByText('Boards')).toBeInTheDocument();
  });
});
