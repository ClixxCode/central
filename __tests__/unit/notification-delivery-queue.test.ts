import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DueReminderEvent,
  MentionNotificationEvent,
} from '@/lib/inngest/events';

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

function mentionData(
  overrides: Partial<MentionNotificationEvent['data']> = {}
): MentionNotificationEvent['data'] {
  return {
    notificationId: 'notification-1',
    recipientId: 'recipient-1',
    recipientEmail: 'recipient@example.com',
    recipientName: 'Recipient',
    mentionerName: 'Mentioner',
    taskId: 'task-1',
    taskShortId: 'T_1',
    taskTitle: 'Mentioned Task',
    taskStatus: 'Ready',
    taskStatusColor: '#c4c4c4',
    taskStatusBackgroundColor: '#f4f4f4',
    taskDueDate: null,
    boardId: 'board-1',
    clientSlug: 'client-slug',
    commentId: 'comment-1',
    commentPreview: 'Please check this',
    ...overrides,
  };
}

function dueData(overrides: Partial<DueReminderEvent['data']> = {}): DueReminderEvent['data'] {
  return {
    notificationId: 'notification-2',
    recipientId: 'recipient-2',
    recipientEmail: 'recipient2@example.com',
    recipientName: 'Recipient Two',
    taskId: 'task-2',
    taskShortId: 'T_2',
    taskTitle: 'Due Task',
    taskStatus: 'Ready',
    taskStatusColor: '#c4c4c4',
    taskStatusBackgroundColor: '#f4f4f4',
    dueDate: '2026-06-18',
    isOverdue: false,
    boardId: 'board-1',
    boardName: 'Main Board',
    clientSlug: 'client-slug',
    clientName: 'Client',
    ...overrides,
  };
}

describe('notification delivery Queue helper', () => {
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
  ] as const)('uses $mode delivery mode for notification dispatch', async ({
    mode,
    viaInngest,
    viaQueue,
  }) => {
    const {
      getNotificationDeliveryMode,
      shouldDispatchNotificationDeliveryViaInngest,
      shouldDispatchNotificationDeliveryViaQueue,
    } = await import('@/lib/queues/notification-delivery');

    vi.stubEnv('NOTIFICATION_DELIVERY_MODE', mode);

    expect(getNotificationDeliveryMode()).toBe(mode);
    expect(shouldDispatchNotificationDeliveryViaInngest()).toBe(viaInngest);
    expect(shouldDispatchNotificationDeliveryViaQueue()).toBe(viaQueue);
  });

  it('defaults notification delivery mode to Inngest', async () => {
    const {
      getNotificationDeliveryMode,
      shouldDispatchNotificationDeliveryViaInngest,
      shouldDispatchNotificationDeliveryViaQueue,
    } = await import('@/lib/queues/notification-delivery');

    expect(getNotificationDeliveryMode()).toBe('inngest');
    expect(shouldDispatchNotificationDeliveryViaInngest()).toBe(true);
    expect(shouldDispatchNotificationDeliveryViaQueue()).toBe(false);
  });

  it('enqueues direct mention email delivery with the async job dedupe key', async () => {
    const {
      MENTION_EMAIL_JOB_KIND,
      NOTIFICATION_DELIVERY_QUEUE_TOPIC,
      enqueueMentionEmailDelivery,
    } = await import('@/lib/queues/notification-delivery');
    const data = mentionData();

    const result = await enqueueMentionEmailDelivery(data);

    expect(result).toEqual({ messageId: 'msg-1' });
    expect(mocks.enqueueAsyncJob).toHaveBeenCalledWith({
      dedupeKey: 'email:mention:notification-1',
      kind: MENTION_EMAIL_JOB_KIND,
      payload: expect.objectContaining({
        notificationId: 'notification-1',
        recipientId: 'recipient-1',
      }),
    });
    expect(mocks.send).toHaveBeenCalledWith(
      NOTIFICATION_DELIVERY_QUEUE_TOPIC,
      expect.objectContaining({
        kind: 'notification-delivery.mention-email',
        dedupeKey: 'email:mention:notification-1',
        data,
      }),
      { idempotencyKey: 'notification-delivery:email:mention:notification-1' }
    );
  });

  it('enqueues Slack delivery with notification-type-specific dedupe keys', async () => {
    const {
      NOTIFICATION_DELIVERY_QUEUE_TOPIC,
      SLACK_NOTIFICATION_JOB_KIND,
      enqueueSlackNotificationDelivery,
    } = await import('@/lib/queues/notification-delivery');
    const data = dueData({ isOverdue: true });

    await enqueueSlackNotificationDelivery({
      notificationType: 'task_overdue',
      data,
    });

    expect(mocks.enqueueAsyncJob).toHaveBeenCalledWith({
      dedupeKey: 'slack:task_overdue:notification-2',
      kind: SLACK_NOTIFICATION_JOB_KIND,
      payload: {
        notificationType: 'task_overdue',
        data,
      },
    });
    expect(mocks.send).toHaveBeenCalledWith(
      NOTIFICATION_DELIVERY_QUEUE_TOPIC,
      expect.objectContaining({
        kind: 'notification-delivery.slack',
        dedupeKey: 'slack:task_overdue:notification-2',
        notificationType: 'task_overdue',
        data,
      }),
      { idempotencyKey: 'notification-delivery:slack:task_overdue:notification-2' }
    );
  });

  it('returns duplicate results when Queue send is deduped', async () => {
    const { DuplicateMessageError } = await import('@vercel/queue');
    const { enqueueMentionEmailDelivery } = await import('@/lib/queues/notification-delivery');

    mocks.send.mockRejectedValueOnce(new DuplicateMessageError('duplicate'));

    await expect(enqueueMentionEmailDelivery(mentionData())).resolves.toEqual({
      messageId: null,
      duplicate: true,
    });
  });

  it('validates notification delivery queue messages', async () => {
    const { isNotificationDeliveryQueueMessage } = await import(
      '@/lib/queues/notification-delivery'
    );

    expect(
      isNotificationDeliveryQueueMessage({
        kind: 'notification-delivery.slack',
        dedupeKey: 'slack:task_due_soon:notification-2',
        notificationType: 'task_due_soon',
        data: dueData({ isOverdue: false }),
        queuedAt: '2026-06-18T12:00:00.000Z',
      })
    ).toBe(true);

    expect(
      isNotificationDeliveryQueueMessage({
        kind: 'notification-delivery.slack',
        dedupeKey: 'slack:task_due_soon:notification-2',
        notificationType: 'task_due_soon',
        data: dueData({ isOverdue: true }),
        queuedAt: '2026-06-18T12:00:00.000Z',
      })
    ).toBe(false);
  });
});
