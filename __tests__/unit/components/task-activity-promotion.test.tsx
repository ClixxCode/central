import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskActivityLog } from '@/components/tasks/TaskActivityLog';

vi.mock('@/lib/hooks', () => ({
  useTaskActivity: () => ({
    isLoading: false,
    data: [
      {
        id: 'activity-1',
        boardId: 'board-1',
        taskId: 'task-1',
        taskTitle: 'Promoted Task',
        userId: 'user-1',
        action: 'subtask_promoted',
        metadata: {
          formerParentId: 'parent-1',
          formerParentTitle: 'Former Parent',
        },
        createdAt: new Date(),
        user: {
          id: 'user-1',
          name: 'Alex Smith',
          email: 'alex@example.com',
          avatarUrl: null,
        },
      },
    ],
  }),
}));

describe('TaskActivityLog promotion activity', () => {
  it('renders the former parent context', () => {
    render(<TaskActivityLog taskId="task-1" />);

    expect(
      screen.getByText('Alex Smith promoted this subtask to a task from Former Parent')
    ).toBeInTheDocument();
  });
});
