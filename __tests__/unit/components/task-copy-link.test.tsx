import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskModal } from '@/components/tasks/TaskModal';
import type { TaskWithAssignees } from '@/lib/actions/tasks';
import type { StatusOption, SectionOption } from '@/lib/db/schema';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/clients/test-client/boards/board-1',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
}));
import { toast } from 'sonner';

// Mock current user hook
vi.mock('@/lib/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'user-1', name: 'Test User', email: 'test@example.com', image: null },
    isAdmin: false,
  }),
}));

// Mock mentionable users hook
vi.mock('@/lib/hooks/useQuickAdd', () => ({
  useMentionableUsers: () => ({ data: [] }),
}));

// Mock attachments actions
vi.mock('@/lib/actions/attachments', () => ({
  getTaskAttachments: vi.fn().mockResolvedValue([]),
  createTaskAttachment: vi.fn(),
  deleteTaskAttachment: vi.fn(),
}));

// Mock task views
vi.mock('@/lib/actions/task-views', () => ({
  recordTaskView: vi.fn().mockResolvedValue(undefined),
}));

// Mock the editor to avoid heavy deps
vi.mock('@/components/editor/TaskEditor', () => ({
  TaskEditor: vi.fn(() => <div data-testid="task-editor" />),
}));

vi.mock('@/components/editor/EditorToolbar', () => ({
  EditorToolbar: vi.fn(() => null),
}));

// Mock comments section
vi.mock('@/components/comments', () => ({
  CommentsSection: vi.fn(() => <div data-testid="comments-section" />),
}));

// Mock file upload
vi.mock('@/components/attachments/FileUpload', () => ({
  FileUpload: vi.fn(() => <div data-testid="file-upload" />),
}));

vi.mock('@/components/attachments/AttachmentList', () => ({
  AttachmentList: vi.fn(() => <div data-testid="attachment-list" />),
}));

// Mock Radix portal to render inline
vi.mock('radix-ui', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('radix-ui');
  return {
    ...actual,
    Dialog: {
      ...(actual.Dialog as Record<string, unknown>),
      Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    },
  };
});

const mockStatusOptions: StatusOption[] = [
  { id: 'todo', label: 'To Do', color: '#6B7280', position: 0 },
  { id: 'in-progress', label: 'In Progress', color: '#3B82F6', position: 1 },
];

const mockSectionOptions: SectionOption[] = [];

const mockTask: TaskWithAssignees = {
  id: 'task-123',
  shortId: 'xK9mP2qR',
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
};

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  statusOptions: mockStatusOptions,
  sectionOptions: mockSectionOptions,
  assignableUsers: [],
  onUpdate: vi.fn(),
  onDelete: vi.fn(),
  mode: 'view' as const,
};

// Mock clipboard API
const mockWriteText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: mockWriteText },
  writable: true,
  configurable: true,
});

describe('TaskModal - Copy Link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows Copy link button for existing tasks with taskBasePath', () => {
    render(
      <TaskModal
        {...defaultProps}
        task={mockTask}
        taskBasePath="/clients/test-client/boards/board-1"
      />
    );

    expect(screen.getByText('Copy link')).toBeInTheDocument();
  });

  it('does not show Copy link button when taskBasePath is not provided', () => {
    render(
      <TaskModal
        {...defaultProps}
        task={mockTask}
      />
    );

    expect(screen.queryByText('Copy link')).not.toBeInTheDocument();
  });

  it('does not show Copy link button in create mode', () => {
    render(
      <TaskModal
        {...defaultProps}
        mode="create"
        onCreate={vi.fn()}
        taskBasePath="/clients/test-client/boards/board-1"
      />
    );

    expect(screen.queryByText('Copy link')).not.toBeInTheDocument();
  });

  it('copies the correct board URL to clipboard on click', async () => {
    render(
      <TaskModal
        {...defaultProps}
        task={mockTask}
        taskBasePath="/clients/test-client/boards/board-1"
      />
    );

    const copyButton = screen.getByRole('button', { name: /Copy link/i });
    fireEvent.click(copyButton);

    expect(mockWriteText).toHaveBeenCalledWith(
      `${window.location.origin}/clients/test-client/boards/board-1?task=task-123`
    );
    expect(toast.success).toHaveBeenCalledWith('Link copied to clipboard');
  });

  it('always links to the board page even when opened from a rollup', async () => {
    render(
      <TaskModal
        {...defaultProps}
        task={mockTask}
        taskBasePath="/clients/acme-corp/boards/board-1"
      />
    );

    const copyButton = screen.getByRole('button', { name: /Copy link/i });
    fireEvent.click(copyButton);

    // Should use taskBasePath (board URL), not the current page path
    expect(mockWriteText).toHaveBeenCalledWith(
      expect.stringContaining('/clients/acme-corp/boards/board-1?task=task-123')
    );
  });
});
