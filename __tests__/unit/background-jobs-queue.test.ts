import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecurringTaskCompletedEvent } from '@/lib/inngest/events';
import type { DailyDigestDeliveryData } from '@/lib/queues/background-jobs';

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  enqueueAsyncJob: vi.fn(),
}));

vi.mock('@vercel/queue', () => {
  class DuplicateMessageError extends Error {}

  return {
    DuplicateMessageError,
    send: mocks.send,
  };
});

vi.mock('@/lib/async-jobs', () => ({
  enqueueAsyncJob: mocks.enqueueAsyncJob,
}));

function digestData(
  overrides: Partial<DailyDigestDeliveryData> = {}
): DailyDigestDeliveryData {
  return {
    userId: 'user-1',
    userEmail: 'user@example.com',
    userName: 'User One',
    orgDate: '2026-06-18',
    ...overrides,
  };
}

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

describe('background job Queue helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.send.mockResolvedValue({ messageId: 'msg-1' });
    mocks.enqueueAsyncJob.mockResolvedValue({ job: { id: 'job-1' }, created: true });
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each([
    { mode: 'inngest', viaInngest: true, viaQueue: false },
    { mode: 'shadow', viaInngest: true, viaQueue: true },
    { mode: 'queue', viaInngest: false, viaQueue: true },
  ] as const)('uses $mode delivery mode for background jobs', async ({
    mode,
    viaInngest,
    viaQueue,
  }) => {
    const {
      getBackgroundJobDeliveryMode,
      shouldDispatchBackgroundJobsViaInngest,
      shouldDispatchBackgroundJobsViaQueue,
    } = await import('@/lib/queues/background-jobs');

    vi.stubEnv('BACKGROUND_JOB_DELIVERY_MODE', mode);

    expect(getBackgroundJobDeliveryMode()).toBe(mode);
    expect(shouldDispatchBackgroundJobsViaInngest()).toBe(viaInngest);
    expect(shouldDispatchBackgroundJobsViaQueue()).toBe(viaQueue);
  });

  it('defaults background job delivery mode to Inngest', async () => {
    const {
      getBackgroundJobDeliveryMode,
      shouldDispatchBackgroundJobsViaInngest,
      shouldDispatchBackgroundJobsViaQueue,
    } = await import('@/lib/queues/background-jobs');

    expect(getBackgroundJobDeliveryMode()).toBe('inngest');
    expect(shouldDispatchBackgroundJobsViaInngest()).toBe(true);
    expect(shouldDispatchBackgroundJobsViaQueue()).toBe(false);
  });

  it.each([
    { mode: 'inngest', viaInngest: true, viaQueue: false },
    { mode: 'shadow', viaInngest: true, viaQueue: true },
    { mode: 'queue', viaInngest: false, viaQueue: true },
  ] as const)('uses $mode delivery mode for recurring tasks', async ({
    mode,
    viaInngest,
    viaQueue,
  }) => {
    const {
      getRecurringTaskDeliveryMode,
      shouldDispatchRecurringTasksViaInngest,
      shouldDispatchRecurringTasksViaQueue,
    } = await import('@/lib/queues/background-jobs');

    vi.stubEnv('RECURRING_TASK_DELIVERY_MODE', mode);

    expect(getRecurringTaskDeliveryMode()).toBe(mode);
    expect(shouldDispatchRecurringTasksViaInngest()).toBe(viaInngest);
    expect(shouldDispatchRecurringTasksViaQueue()).toBe(viaQueue);
  });

  it('enqueues daily digest delivery with user/date dedupe key', async () => {
    const {
      BACKGROUND_JOB_QUEUE_TOPIC,
      DAILY_DIGEST_DELIVERY_JOB_KIND,
      enqueueDailyDigestDelivery,
    } = await import('@/lib/queues/background-jobs');
    const data = digestData();

    const result = await enqueueDailyDigestDelivery(data);

    expect(result).toEqual({ messageId: 'msg-1' });
    expect(mocks.enqueueAsyncJob).toHaveBeenCalledWith({
      dedupeKey: 'daily-digest:user-1:2026-06-18',
      kind: DAILY_DIGEST_DELIVERY_JOB_KIND,
      payload: data,
    });
    expect(mocks.send).toHaveBeenCalledWith(
      BACKGROUND_JOB_QUEUE_TOPIC,
      expect.objectContaining({
        kind: 'background.daily-digest.delivery',
        dedupeKey: 'daily-digest:user-1:2026-06-18',
        orgDate: '2026-06-18',
        data,
      }),
      { idempotencyKey: 'background-job:daily-digest:user-1:2026-06-18' }
    );
  });

  it('enqueues recurring next-task jobs with completed-task dedupe keys', async () => {
    const {
      RECURRING_NEXT_TASK_JOB_KIND,
      enqueueRecurringNextTask,
    } = await import('@/lib/queues/background-jobs');
    const data = recurringData();

    await enqueueRecurringNextTask(data);

    expect(mocks.enqueueAsyncJob).toHaveBeenCalledWith({
      dedupeKey: 'recurring-next:task-1',
      kind: RECURRING_NEXT_TASK_JOB_KIND,
      payload: data,
    });
    expect(mocks.send).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        kind: 'background.recurring-next-task',
        dedupeKey: 'recurring-next:task-1',
        data,
      }),
      { idempotencyKey: 'background-job:recurring-next:task-1' }
    );
  });

  it('enqueues due-date scans with org-date dedupe key', async () => {
    const {
      DUE_DATE_SCAN_JOB_KIND,
      enqueueDueDateScan,
    } = await import('@/lib/queues/background-jobs');

    await enqueueDueDateScan({ orgDate: '2026-06-18' });

    expect(mocks.enqueueAsyncJob).toHaveBeenCalledWith({
      dedupeKey: 'due-scan:2026-06-18',
      kind: DUE_DATE_SCAN_JOB_KIND,
      payload: { orgDate: '2026-06-18' },
    });
    expect(mocks.send).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        kind: 'background.due-scan',
        dedupeKey: 'due-scan:2026-06-18',
      }),
      { idempotencyKey: 'background-job:due-scan:2026-06-18' }
    );
  });

  it('returns duplicate results when Queue send is deduped', async () => {
    const { DuplicateMessageError } = await import('@vercel/queue');
    const { enqueueDailyDigestSchedule } = await import('@/lib/queues/background-jobs');

    mocks.send.mockRejectedValueOnce(new DuplicateMessageError('duplicate'));

    await expect(enqueueDailyDigestSchedule({ orgDate: '2026-06-18' })).resolves.toEqual({
      messageId: null,
      duplicate: true,
    });
  });

  it('validates background queue messages', async () => {
    const { isBackgroundJobQueueMessage } = await import('@/lib/queues/background-jobs');

    expect(
      isBackgroundJobQueueMessage({
        kind: 'background.daily-digest.delivery',
        dedupeKey: 'daily-digest:user-1:2026-06-18',
        orgDate: '2026-06-18',
        data: digestData(),
        queuedAt: '2026-06-18T12:00:00.000Z',
      })
    ).toBe(true);

    expect(
      isBackgroundJobQueueMessage({
        kind: 'background.daily-digest.delivery',
        dedupeKey: 'daily-digest:user-1:2026-06-18',
        orgDate: '2026-06-18',
        data: digestData({ orgDate: '2026-06-19' }),
        queuedAt: '2026-06-18T12:00:00.000Z',
      })
    ).toBe(false);

    expect(
      isBackgroundJobQueueMessage({
        kind: 'background.recurring-next-task',
        dedupeKey: 'recurring-next:task-1',
        data: recurringData(),
        queuedAt: '2026-06-18T12:00:00.000Z',
      })
    ).toBe(true);
  });
});
