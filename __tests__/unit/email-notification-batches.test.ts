import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserPreferences } from '@/lib/db/schema/users';

const mocks = vi.hoisted(() => ({
  notificationFindFirst: vi.fn(),
  batchFindFirst: vi.fn(),
  userFindFirst: vi.fn(),
  dbTransaction: vi.fn(),
  inngestSend: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      notifications: {
        findFirst: mocks.notificationFindFirst,
      },
      notificationEmailBatches: {
        findFirst: mocks.batchFindFirst,
      },
      users: {
        findFirst: mocks.userFindFirst,
      },
    },
    transaction: mocks.dbTransaction,
  },
}));

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: mocks.inngestSend,
  },
}));

function prefs(overrides: Partial<UserPreferences['notifications']['email']> = {}): UserPreferences {
  return {
    hiddenBoards: [],
    hiddenColumns: [],
    defaultView: 'table',
    notifications: {
      email: {
        enabled: true,
        mentions: true,
        assignments: true,
        dueDates: true,
        newComments: true,
        replies: true,
        reactions: true,
        digest: 'instant',
        ...overrides,
      },
      slack: {
        enabled: false,
        mentions: true,
        assignments: true,
        dueDates: true,
        newComments: true,
        replies: true,
        reactions: true,
      },
      inApp: {
        enabled: true,
        mentions: true,
        assignments: true,
        dueDates: true,
        newComments: true,
        replies: true,
        reactions: true,
      },
    },
  };
}

function createUpdateChain() {
  const where = vi.fn().mockResolvedValue([]);
  const set = vi.fn(() => ({ where }));
  return { set, where };
}

function createTx(options: { existingBatchId?: string; insertedBatchId?: string }) {
  const notificationUpdate = createUpdateChain();
  const batchUpdate = createUpdateChain();
  const insertReturning = vi.fn().mockResolvedValue(
    options.insertedBatchId ? [{ id: options.insertedBatchId }] : []
  );
  const onConflictDoNothing = vi.fn(() => ({ returning: insertReturning }));
  const values = vi.fn(() => ({ onConflictDoNothing }));
  const insert = vi.fn(() => ({ values }));
  const update = vi.fn()
    .mockReturnValueOnce({ set: notificationUpdate.set })
    .mockReturnValueOnce({ set: batchUpdate.set });

  return {
    tx: {
      query: {
        notificationEmailBatches: {
          findFirst: vi.fn().mockResolvedValue(
            options.existingBatchId ? { id: options.existingBatchId } : null
          ),
        },
      },
      insert,
      update,
    },
    insert,
    values,
    onConflictDoNothing,
    insertReturning,
    update,
    notificationUpdate,
    batchUpdate,
  };
}

describe('email notification batches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.inngestSend.mockResolvedValue({ ids: ['event-1'] });
  });

  it('creates a pending batch and schedules a flush for the first batchable notification', async () => {
    const { queueNotificationEmail } = await import('@/lib/email/notification-batches');
    const tx = createTx({ insertedBatchId: 'batch-1' });

    mocks.notificationFindFirst.mockResolvedValue({
      id: 'notification-1',
      userId: 'user-1',
      type: 'task_assigned',
      emailSentAt: null,
      emailBatchId: null,
    });
    mocks.userFindFirst.mockResolvedValue({ preferences: prefs() });
    mocks.dbTransaction.mockImplementation(async (callback: (txArg: typeof tx.tx) => unknown) => callback(tx.tx));

    const result = await queueNotificationEmail({
      notificationId: 'notification-1',
      recipientId: 'user-1',
      type: 'task_assigned',
    });

    expect(result).toEqual({ queued: true, batchId: 'batch-1', scheduledFlush: true });
    expect(tx.insert).toHaveBeenCalledOnce();
    expect(mocks.inngestSend).toHaveBeenCalledWith({
      name: 'notification/email-batch.flush',
      data: { batchId: 'batch-1' },
    });
  });

  it('joins an existing pending batch without scheduling another flush', async () => {
    const { queueNotificationEmail } = await import('@/lib/email/notification-batches');
    const tx = createTx({ existingBatchId: 'batch-1' });

    mocks.notificationFindFirst.mockResolvedValue({
      id: 'notification-2',
      userId: 'user-1',
      type: 'comment_added',
      emailSentAt: null,
      emailBatchId: null,
    });
    mocks.userFindFirst.mockResolvedValue({ preferences: prefs() });
    mocks.dbTransaction.mockImplementation(async (callback: (txArg: typeof tx.tx) => unknown) => callback(tx.tx));

    const result = await queueNotificationEmail({
      notificationId: 'notification-2',
      recipientId: 'user-1',
      type: 'comment_added',
    });

    expect(result).toEqual({ queued: true, batchId: 'batch-1', scheduledFlush: false });
    expect(tx.insert).not.toHaveBeenCalled();
    expect(mocks.inngestSend).not.toHaveBeenCalled();
  });

  it('does not queue when email preferences disable that notification type', async () => {
    const { queueNotificationEmail } = await import('@/lib/email/notification-batches');

    mocks.notificationFindFirst.mockResolvedValue({
      id: 'notification-3',
      userId: 'user-1',
      type: 'task_assigned',
      emailSentAt: null,
      emailBatchId: null,
    });
    mocks.userFindFirst.mockResolvedValue({ preferences: prefs({ assignments: false }) });

    const result = await queueNotificationEmail({
      notificationId: 'notification-3',
      recipientId: 'user-1',
      type: 'task_assigned',
    });

    expect(result).toEqual({ queued: false, reason: 'User preferences' });
    expect(mocks.dbTransaction).not.toHaveBeenCalled();
    expect(mocks.inngestSend).not.toHaveBeenCalled();
  });

  it('leaves mentions out of the batcher', async () => {
    const { queueNotificationEmail } = await import('@/lib/email/notification-batches');

    const result = await queueNotificationEmail({
      notificationId: 'notification-4',
      recipientId: 'user-1',
      type: 'mention',
    });

    expect(result).toEqual({ queued: false, reason: 'Notification type is not batchable' });
    expect(mocks.notificationFindFirst).not.toHaveBeenCalled();
  });
});
