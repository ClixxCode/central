import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock('@vercel/queue', () => {
  class DuplicateMessageError extends Error {}

  return {
    DuplicateMessageError,
    send: mocks.send,
  };
});

describe('email notification Queue helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.send.mockResolvedValue({ messageId: 'msg-1' });
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    'task_assigned',
    'comment_added',
    'task_due_soon',
    'task_overdue',
  ] as const)('validates %s notification email messages', async (notificationType) => {
    const { isEmailNotificationQueueMessage } = await import(
      '@/lib/queues/email-notifications'
    );

    expect(
      isEmailNotificationQueueMessage({
        kind: 'notification-email.queue',
        notificationId: 'notification-1',
        recipientId: 'recipient-1',
        notificationType,
        queuedAt: '2026-06-17T00:00:00.000Z',
      })
    ).toBe(true);
  });

  it('rejects non-batchable notification email message types', async () => {
    const { isEmailNotificationQueueMessage } = await import(
      '@/lib/queues/email-notifications'
    );

    expect(
      isEmailNotificationQueueMessage({
        kind: 'notification-email.queue',
        notificationId: 'notification-1',
        recipientId: 'recipient-1',
        notificationType: 'mention',
        queuedAt: '2026-06-17T00:00:00.000Z',
      })
    ).toBe(false);
  });

  it('sends generic notification email messages with type-specific idempotency keys', async () => {
    const { EMAIL_NOTIFICATION_QUEUE_TOPIC, enqueueNotificationEmail } = await import(
      '@/lib/queues/email-notifications'
    );

    const result = await enqueueNotificationEmail({
      notificationId: 'notification-1',
      recipientId: 'recipient-1',
      notificationType: 'task_overdue',
    });

    expect(result).toEqual({ messageId: 'msg-1' });
    expect(mocks.send).toHaveBeenCalledWith(
      EMAIL_NOTIFICATION_QUEUE_TOPIC,
      expect.objectContaining({
        kind: 'notification-email.queue',
        notificationId: 'notification-1',
        recipientId: 'recipient-1',
        notificationType: 'task_overdue',
      }),
      {
        idempotencyKey: 'notification-email:task_overdue:notification-1',
      }
    );
  });

  it('keeps the comment-added wrapper backward compatible', async () => {
    const { EMAIL_NOTIFICATION_QUEUE_TOPIC, enqueueCommentAddedNotificationEmail } =
      await import('@/lib/queues/email-notifications');

    await enqueueCommentAddedNotificationEmail({
      notificationId: 'notification-2',
      recipientId: 'recipient-2',
    });

    expect(mocks.send).toHaveBeenCalledWith(
      EMAIL_NOTIFICATION_QUEUE_TOPIC,
      expect.objectContaining({
        kind: 'notification-email.queue',
        notificationId: 'notification-2',
        recipientId: 'recipient-2',
        notificationType: 'comment_added',
      }),
      {
        idempotencyKey: 'notification-email:comment_added:notification-2',
      }
    );
  });

  it('returns duplicate results when the Queue send is deduped', async () => {
    const { DuplicateMessageError } = await import('@vercel/queue');
    const { enqueueNotificationEmail } = await import('@/lib/queues/email-notifications');

    mocks.send.mockRejectedValueOnce(new DuplicateMessageError('duplicate'));

    await expect(
      enqueueNotificationEmail({
        notificationId: 'notification-3',
        recipientId: 'recipient-3',
        notificationType: 'task_assigned',
      })
    ).resolves.toEqual({ messageId: null, duplicate: true });
  });

  it.each([
    {
      mode: 'inngest',
      viaInngest: true,
      viaQueue: false,
    },
    {
      mode: 'shadow',
      viaInngest: true,
      viaQueue: true,
    },
    {
      mode: 'queue',
      viaInngest: false,
      viaQueue: true,
    },
  ] as const)('uses $mode delivery mode for batch email dispatch', async ({
    mode,
    viaInngest,
    viaQueue,
  }) => {
    const {
      getEmailBatchDeliveryMode,
      shouldDispatchEmailBatchViaInngest,
      shouldDispatchEmailBatchViaQueue,
    } = await import('@/lib/queues/email-notifications');

    vi.stubEnv('EMAIL_BATCH_DELIVERY_MODE', mode);

    expect(getEmailBatchDeliveryMode()).toBe(mode);
    expect(shouldDispatchEmailBatchViaInngest()).toBe(viaInngest);
    expect(shouldDispatchEmailBatchViaQueue()).toBe(viaQueue);
  });

  it('keeps the legacy pilot flag as a shadow-mode fallback', async () => {
    const {
      getEmailBatchDeliveryMode,
      shouldDispatchEmailBatchViaInngest,
      shouldDispatchEmailBatchViaQueue,
    } = await import('@/lib/queues/email-notifications');

    vi.stubEnv('EMAIL_QUEUE_PILOT_ENABLED', 'true');

    expect(getEmailBatchDeliveryMode()).toBe('shadow');
    expect(shouldDispatchEmailBatchViaInngest()).toBe(true);
    expect(shouldDispatchEmailBatchViaQueue()).toBe(true);
  });
});
