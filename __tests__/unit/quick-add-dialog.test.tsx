import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickAddDialog } from '@/components/quick-add/QuickAddDialog';

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/stores', () => ({
  useQuickActionsStore: vi.fn(() => null),
}));

vi.mock('@/lib/hooks/useClients', () => ({
  useClients: () => ({ data: [] }),
}));

vi.mock('@/lib/hooks/useBoards', () => ({
  useBoard: () => ({ data: null }),
  usePersonalBoard: () => ({ data: null }),
}));

vi.mock('@/lib/hooks/useQuickAdd', () => ({
  useQuickAddCreateTask: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useQuickAddUsers: () => ({ data: [] }),
}));

vi.mock('@/lib/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: null }),
}));

vi.mock('@/lib/hooks/useIgnoreWeekends', () => ({
  useIgnoreWeekends: () => false,
}));

vi.mock('@/lib/actions/tasks', () => ({
  createTask: vi.fn(),
}));

vi.mock('@/lib/hooks/useTasks', () => ({
  taskKeys: {
    lists: () => ['tasks'],
  },
}));

vi.mock('@/lib/utils/parse-natural-date', () => ({
  getDateSuggestions: () => [
    { label: 'Tomorrow', date: new Date('2026-04-01T00:00:00.000Z') },
  ],
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: () => <div data-testid="calendar" />,
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AvatarImage: () => null,
  AvatarFallback: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/quick-add/SmartTaskInput', () => ({
  SmartTaskInput: () => <div data-testid="smart-task-input" />,
}));

vi.mock('@/components/quick-add/MultiLinePasteDialog', () => ({
  MultiLinePasteDialog: () => null,
}));

describe('QuickAddDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Due Date" when no date is selected', () => {
    render(<QuickAddDialog open onOpenChange={() => {}} />);

    expect(screen.getByRole('button', { name: /due date/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^date$/i })).not.toBeInTheDocument();
  });

  it('shows the selected date label after choosing a suggestion', async () => {
    const user = userEvent.setup();

    render(<QuickAddDialog open onOpenChange={() => {}} />);

    await user.click(screen.getByRole('button', { name: /due date/i }));
    await user.click(screen.getByRole('button', { name: /tomorrow apr 1/i }));

    expect(screen.getByRole('button', { name: /tomorrow/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /due date/i })).not.toBeInTheDocument();
  });
});
