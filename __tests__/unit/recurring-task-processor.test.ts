import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecurringTaskCompletedEvent } from '@/lib/inngest/events';

const mocks = vi.hoisted(() => ({
  enqueueAsyncJob: vi.fn(),
  claimAsyncJob: vi.fn(),
  completeAsyncJob: vi.fn(),
  failAsyncJob: vi.fn(),
  skipAsyncJob: vi.fn(),
  select: vi.fn(),
  taskFindFirst: vi.fn(),
  boardFindFirst: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/async-jobs', () => ({
  enqueueAsyncJob: mocks.enqueueAsyncJob,
  claimAsyncJob: mocks.claimAsyncJob,
  completeAsyncJob: mocks.completeAsyncJob,
  failAsyncJob: mocks.failAsyncJob,
  skipAsyncJob: mocks.skipAsyncJob,
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      tasks: {
        findFirst: mocks.taskFindFirst,
      },
      boards: {
        findFirst: mocks.boardFindFirst,
      },
    },
    select: mocks.select,
    transaction: mocks.transaction,
  },
}));

function recurringData(
  overrides: Partial<RecurringTaskCompletedEvent['data']> = {}
): RecurringTaskCompletedEvent['data'] {
  return {
    taskId: 'task-1',
    boardId: 'board-1',
    recurringGroupId: 'group-1',
    recurringConfig: {
      frequency: 'weekly',
      interval: 1,
    },
    completedDueDate: '2026-06-18',
    completedByUserId: 'user-1',
    title: 'Recurring Task',
    description: null,
    section: null,
    dateFlexibility: 'not_set',
    subtasksBreakoutEnabled: false,
    subtasksSequentialEnabled: false,
    assigneeIds: ['user-1'],
    ...overrides,
  };
}

function mockCountExistingOccurrences(count: number) {
  mocks.select.mockReturnValueOnce({
    from: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([{ count }]),
    })),
  });
}

describe('recurring task processor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-18T12:00:00.000Z'));
    vi.clearAllMocks();
    mocks.enqueueAsyncJob.mockResolvedValue({ job: { id: 'job-1' }, created: false });
    mocks.completeAsyncJob.mockResolvedValue({ success: true });
    mocks.failAsyncJob.mockResolvedValue({ success: true });
    mocks.skipAsyncJob.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not clone a recurring task when another runner already claimed the job', async () => {
    const { processRecurringNextTask } = await import('@/lib/recurring-tasks');

    mocks.claimAsyncJob.mockResolvedValue({
      claimed: false,
      job: { id: 'job-1' },
      reason: 'already_running',
    });

    const result = await processRecurringNextTask(recurringData(), {
      runnerId: 'vercel-queue',
    });

    expect(result).toEqual({
      status: 'skipped',
      jobId: 'job-1',
      dedupeKey: 'recurring-next:task-1',
      reason: 'Async job claim skipped: already_running',
      claimMissReason: 'already_running',
    });
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('completes without cloning when the next occurrence already exists', async () => {
    const { processRecurringNextTask } = await import('@/lib/recurring-tasks');

    mocks.claimAsyncJob.mockResolvedValue({
      claimed: true,
      job: {
        id: 'job-1',
        dedupeKey: 'recurring-next:task-1',
      },
    });
    mockCountExistingOccurrences(1);
    mocks.taskFindFirst.mockResolvedValue({ id: 'existing-next-task' });

    const result = await processRecurringNextTask(recurringData(), {
      runnerId: 'inngest',
    });

    expect(mocks.completeAsyncJob).toHaveBeenCalledWith({
      dedupeKey: 'recurring-next:task-1',
      claimedBy: 'inngest',
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 'completed',
      jobId: 'job-1',
      dedupeKey: 'recurring-next:task-1',
      newTaskId: 'existing-next-task',
      nextDueDate: '2026-06-25',
      recurringGroupId: 'group-1',
      clonedSubtaskCount: 0,
      duplicatePrevented: true,
    });
  });
});
