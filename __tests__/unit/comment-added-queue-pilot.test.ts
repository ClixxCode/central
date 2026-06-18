import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  commentsFindMany: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  inngestSend: vi.fn(),
  inngestCreateFunction: vi.fn((_config, _trigger, handler) => handler),
  enqueueNotificationEmail: vi.fn(),
  shouldDispatchEmailBatchViaInngest: vi.fn(),
  shouldDispatchEmailBatchViaQueue: vi.fn(),
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
  enqueueNotificationEmail: mocks.enqueueNotificationEmail,
  shouldDispatchEmailBatchViaInngest: mocks.shouldDispatchEmailBatchViaInngest,
  shouldDispatchEmailBatchViaQueue: mocks.shouldDispatchEmailBatchViaQueue,
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
    mocks.shouldDispatchEmailBatchViaInngest.mockReturnValue(true);
    mocks.shouldDispatchEmailBatchViaQueue.mockReturnValue(true);
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
    mocks.enqueueNotificationEmail
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
    expect(mocks.enqueueNotificationEmail).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to enqueue Vercel Queue comment notification email:',
      expect.objectContaining({
        notificationId: 'notification-1',
        recipientId: 'recipient-1',
        notificationType: 'comment_added',
        error: expect.any(Error),
      })
    );

    errorSpy.mockRestore();
  });

  it('still enqueues the Queue pilot message when Inngest send fails', async () => {
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
      .mockReturnValueOnce(selectWhereChain([{ userId: 'recipient-1' }]))
      .mockReturnValueOnce(
        selectWhereChain([
          {
            id: 'recipient-1',
            email: 'one@example.com',
            name: 'One',
            deactivatedAt: null,
          },
        ])
      );
    mockNotificationInserts(['notification-1']);
    mocks.inngestSend.mockRejectedValueOnce(new Error('Inngest unavailable'));
    mocks.enqueueNotificationEmail.mockResolvedValueOnce({ messageId: 'msg-1' });

    const result = await createCommentAddedNotification({
      commenterId: 'commenter-1',
      taskId: 'task-1',
      commentId: 'comment-1',
      commentContent: { type: 'doc', content: [] },
    });

    expect(result).toEqual({
      success: true,
      notificationIds: ['notification-1'],
    });
    expect(mocks.inngestSend).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueNotificationEmail).toHaveBeenCalledWith({
      notificationId: 'notification-1',
      recipientId: 'recipient-1',
      notificationType: 'comment_added',
    });
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to send Inngest comment notification event:',
      expect.objectContaining({
        notificationId: 'notification-1',
        recipientId: 'recipient-1',
        error: expect.any(Error),
      })
    );

    errorSpy.mockRestore();
  });

  it('shadow enqueues assignment email batching through Queues while keeping Inngest live', async () => {
    const { createAssignmentNotification } = await import('@/lib/actions/notifications');

    mocks.userFindFirst
      .mockResolvedValueOnce({
        name: 'Manager',
        email: 'manager@example.com',
      })
      .mockResolvedValueOnce({
        id: 'assignee-1',
        name: 'Assignee',
        email: 'assignee@example.com',
        deactivatedAt: null,
      });
    mocks.select.mockReturnValueOnce(
      selectTaskDetailsChain([
        {
          id: 'task-1',
          shortId: 'T_1',
          title: 'Assigned Task',
          status: 'ready',
          dueDate: null,
          description: null,
          parentTaskId: null,
          boardId: 'board-1',
          boardName: 'Main Board',
          statusOptions: [{ id: 'ready', label: 'Ready', color: '#c4c4c4' }],
          clientSlug: 'client-slug',
          clientName: 'Client',
        },
      ])
    );
    mockNotificationInserts(['assignment-notification-1']);
    mocks.enqueueNotificationEmail.mockResolvedValueOnce({ messageId: 'msg-assignment' });

    const result = await createAssignmentNotification({
      assigneeUserId: 'assignee-1',
      assignerUserId: 'assigner-1',
      taskId: 'task-1',
    });

    expect(result).toEqual({ success: true, notificationId: 'assignment-notification-1' });
    expect(mocks.inngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'notification/assignment.created',
        data: expect.objectContaining({
          notificationId: 'assignment-notification-1',
          recipientId: 'assignee-1',
        }),
      })
    );
    expect(mocks.enqueueNotificationEmail).toHaveBeenCalledWith({
      notificationId: 'assignment-notification-1',
      recipientId: 'assignee-1',
      notificationType: 'task_assigned',
    });
  });

  it('can make Queues primary for assignment email batching without sending Inngest events', async () => {
    const { createAssignmentNotification } = await import('@/lib/actions/notifications');

    mocks.shouldDispatchEmailBatchViaInngest.mockReturnValue(false);
    mocks.shouldDispatchEmailBatchViaQueue.mockReturnValue(true);
    mocks.userFindFirst
      .mockResolvedValueOnce({
        name: 'Manager',
        email: 'manager@example.com',
      })
      .mockResolvedValueOnce({
        id: 'assignee-1',
        name: 'Assignee',
        email: 'assignee@example.com',
        deactivatedAt: null,
      });
    mocks.select.mockReturnValueOnce(
      selectTaskDetailsChain([
        {
          id: 'task-1',
          shortId: 'T_1',
          title: 'Assigned Task',
          status: 'ready',
          dueDate: null,
          description: null,
          parentTaskId: null,
          boardId: 'board-1',
          boardName: 'Main Board',
          statusOptions: [{ id: 'ready', label: 'Ready', color: '#c4c4c4' }],
          clientSlug: 'client-slug',
          clientName: 'Client',
        },
      ])
    );
    mockNotificationInserts(['assignment-notification-1']);
    mocks.enqueueNotificationEmail.mockResolvedValueOnce({ messageId: 'msg-assignment' });

    const result = await createAssignmentNotification({
      assigneeUserId: 'assignee-1',
      assignerUserId: 'assigner-1',
      taskId: 'task-1',
    });

    expect(result).toEqual({ success: true, notificationId: 'assignment-notification-1' });
    expect(mocks.inngestSend).not.toHaveBeenCalled();
    expect(mocks.enqueueNotificationEmail).toHaveBeenCalledWith({
      notificationId: 'assignment-notification-1',
      recipientId: 'assignee-1',
      notificationType: 'task_assigned',
    });
  });

  it.each([
    { isOverdue: false, notificationType: 'task_due_soon' as const },
    { isOverdue: true, notificationType: 'task_overdue' as const },
  ])(
    'shadow enqueues $notificationType due email batching through Queues while keeping Inngest live',
    async ({ isOverdue, notificationType }) => {
      const { createDueNotification } = await import('@/lib/actions/notifications');

      mocks.userFindFirst.mockResolvedValueOnce({
        id: 'recipient-1',
        name: 'Recipient',
        email: 'recipient@example.com',
        deactivatedAt: null,
      });
      mocks.select.mockReturnValueOnce(
        selectTaskDetailsChain([
          {
            id: 'task-1',
            shortId: 'T_1',
            title: 'Due Task',
            status: 'ready',
            dueDate: '2026-06-18',
            parentTaskId: null,
            boardId: 'board-1',
            boardName: 'Main Board',
            statusOptions: [{ id: 'ready', label: 'Ready', color: '#c4c4c4' }],
            clientSlug: 'client-slug',
            clientName: 'Client',
          },
        ])
      );
      mockNotificationInserts([`due-${notificationType}-notification-1`]);
      mocks.enqueueNotificationEmail.mockResolvedValueOnce({ messageId: `msg-${notificationType}` });

      const result = await createDueNotification({
        userId: 'recipient-1',
        taskId: 'task-1',
        isOverdue,
      });

      expect(result).toEqual({
        success: true,
        notificationId: `due-${notificationType}-notification-1`,
      });
      expect(mocks.inngestSend).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'notification/due-reminder.scheduled',
          data: expect.objectContaining({
            notificationId: `due-${notificationType}-notification-1`,
            recipientId: 'recipient-1',
            isOverdue,
          }),
        })
      );
      expect(mocks.enqueueNotificationEmail).toHaveBeenCalledWith({
        notificationId: `due-${notificationType}-notification-1`,
        recipientId: 'recipient-1',
        notificationType,
      });
    }
  );

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
