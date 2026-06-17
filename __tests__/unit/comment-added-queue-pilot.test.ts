import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  commentsFindMany: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  inngestSend: vi.fn(),
  inngestCreateFunction: vi.fn((_config, _trigger, handler) => handler),
  enqueueCommentAddedNotificationEmail: vi.fn(),
  isEmailQueuePilotEnabled: vi.fn(),
  queueNotificationEmail: vi.fn(),
  getPlainText: vi.fn(),
  extractMentionedUserIds: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      users: {
        findFirst: mocks.userFindFirst,
      },
      comments: {
        findMany: mocks.commentsFindMany,
      },
    },
    select: mocks.select,
    insert: mocks.insert,
  },
}));

vi.mock('@/lib/auth/session', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: mocks.inngestSend,
    createFunction: mocks.inngestCreateFunction,
  },
}));

vi.mock('@/lib/editor/mentions', () => ({
  getPlainText: mocks.getPlainText,
  extractMentionedUserIds: mocks.extractMentionedUserIds,
}));

vi.mock('@/lib/queues/email-notifications', () => ({
  enqueueCommentAddedNotificationEmail: mocks.enqueueCommentAddedNotificationEmail,
  isEmailQueuePilotEnabled: mocks.isEmailQueuePilotEnabled,
}));

vi.mock('@/lib/email/notification-batches', () => ({
  queueNotificationEmail: mocks.queueNotificationEmail,
}));

function selectTaskDetailsChain(result: unknown[]) {
  return {
    from: vi.fn(() => ({
      innerJoin: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue(result),
          })),
        })),
      })),
    })),
  };
}

function selectWhereChain(result: unknown[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(result),
    })),
  };
}

function mockNotificationInserts(ids: string[]) {
  const remainingIds = [...ids];
  mocks.insert.mockImplementation(() => ({
    values: vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([{ id: remainingIds.shift() }]),
    })),
  }));
}

describe('comment_added Vercel Queue pilot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFindFirst.mockResolvedValue({
      id: 'commenter-1',
      name: 'AJ Griem',
      email: 'aj@example.com',
    });
    mocks.commentsFindMany.mockResolvedValue([]);
    mocks.getPlainText.mockReturnValue('A queued comment notification');
    mocks.extractMentionedUserIds.mockReturnValue([]);
    mocks.inngestSend.mockResolvedValue({ ids: ['event-1'] });
    mocks.isEmailQueuePilotEnabled.mockReturnValue(true);
  });

  it('does not let a Queue enqueue failure block comment_added notifications', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { createCommentAddedNotification } = await import('@/lib/actions/notifications');

    mocks.select
      .mockReturnValueOnce(
        selectTaskDetailsChain([
          {
            id: 'task-1',
            shortId: 'T_1',
            title: 'Test Task',
            status: 'ready',
            dueDate: null,
            parentTaskId: null,
            boardId: 'board-1',
            boardName: 'Main Board',
            statusOptions: [{ id: 'ready', label: 'Ready', color: '#c4c4c4' }],
            clientSlug: 'client-slug',
            clientName: 'Client',
          },
        ])
      )
      .mockReturnValueOnce(selectWhereChain([{ userId: 'recipient-1' }, { userId: 'recipient-2' }]))
      .mockReturnValueOnce(selectWhereChain([]))
      .mockReturnValueOnce(
        selectWhereChain([
          {
            id: 'recipient-1',
            email: 'one@example.com',
            name: 'One',
            deactivatedAt: null,
          },
          {
            id: 'recipient-2',
            email: 'two@example.com',
            name: 'Two',
            deactivatedAt: null,
          },
        ])
      );
    mockNotificationInserts(['notification-1', 'notification-2']);
    mocks.enqueueCommentAddedNotificationEmail
      .mockRejectedValueOnce(new Error('Queue unavailable'))
      .mockResolvedValueOnce({ messageId: 'msg-2' });

    const result = await createCommentAddedNotification({
      commenterId: 'commenter-1',
      taskId: 'task-1',
      commentId: 'comment-1',
      commentContent: { type: 'doc', content: [] },
    });

    expect(result).toEqual({
      success: true,
      notificationIds: ['notification-1', 'notification-2'],
    });
    expect(mocks.inngestSend).toHaveBeenCalledTimes(2);
    expect(mocks.enqueueCommentAddedNotificationEmail).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to enqueue Vercel Queue comment notification email:',
      expect.objectContaining({
        notificationId: 'notification-1',
        recipientId: 'recipient-1',
        error: expect.any(Error),
      })
    );

    errorSpy.mockRestore();
  });

  it('keeps Inngest as the authoritative comment_added email batcher during the pilot', async () => {
    const { sendCommentAddedEmail } = await import('@/lib/inngest/functions/send-comment-added-email');
    const handler = sendCommentAddedEmail as unknown as (input: {
      event: { data: { notificationId: string; recipientId: string } };
      step: { run: (name: string, callback: () => unknown) => Promise<unknown> };
    }) => Promise<unknown>;

    mocks.queueNotificationEmail.mockResolvedValue({
      queued: true,
      batchId: 'batch-1',
      scheduledFlush: false,
    });

    const step = {
      run: vi.fn(async (_name: string, callback: () => unknown) => callback()),
    };

    const result = await handler({
      event: {
        data: {
          notificationId: 'notification-1',
          recipientId: 'recipient-1',
        },
      },
      step,
    });

    expect(step.run).toHaveBeenCalledWith('queue-email-batch', expect.any(Function));
    expect(mocks.queueNotificationEmail).toHaveBeenCalledWith({
      notificationId: 'notification-1',
      recipientId: 'recipient-1',
      type: 'comment_added',
    });
    expect(result).toEqual({
      queued: true,
      batchId: 'batch-1',
      scheduledFlush: false,
    });
  });
});
