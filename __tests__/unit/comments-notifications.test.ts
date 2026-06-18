import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  taskFindFirst: vi.fn(),
  commentFindFirst: vi.fn(),
  userFindFirst: vi.fn(),
  insert: vi.fn(),
  requireAuth: vi.fn(),
  revalidatePath: vi.fn(),
  logBoardActivity: vi.fn(),
  extractMentionedUserIds: vi.fn(),
  createMentionNotification: vi.fn(),
  createCommentAddedNotification: vi.fn(),
  createReactionNotification: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      tasks: {
        findFirst: mocks.taskFindFirst,
      },
      comments: {
        findFirst: mocks.commentFindFirst,
      },
      users: {
        findFirst: mocks.userFindFirst,
      },
    },
    insert: mocks.insert,
  },
}));

vi.mock('@/lib/auth/session', () => ({
  requireAuth: mocks.requireAuth,
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('@/lib/editor/mentions', () => ({
  extractMentionedUserIds: mocks.extractMentionedUserIds,
}));

vi.mock('@/lib/actions/board-activity', () => ({
  logBoardActivity: mocks.logBoardActivity,
}));

vi.mock('@/lib/actions/notifications', () => ({
  createMentionNotification: mocks.createMentionNotification,
  createCommentAddedNotification: mocks.createCommentAddedNotification,
  createReactionNotification: mocks.createReactionNotification,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('createComment notification side effects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({
      id: 'author-1',
      email: 'author@example.com',
      name: 'Author',
      role: 'admin',
    });
    mocks.taskFindFirst.mockResolvedValue({
      id: 'task-1',
      boardId: 'board-1',
      title: 'Task',
    });
    mocks.userFindFirst.mockResolvedValue({
      id: 'author-1',
      email: 'author@example.com',
      name: 'Author',
      avatarUrl: null,
      deactivatedAt: null,
    });
    mocks.logBoardActivity.mockResolvedValue({ success: true });
    mocks.extractMentionedUserIds.mockReturnValue(['mentioned-1']);
    mocks.insert.mockReturnValue({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([
          {
            id: 'comment-1',
            shortId: 'abc123',
            taskId: 'task-1',
            authorId: 'author-1',
            parentCommentId: null,
            content: { type: 'doc', content: [] },
            createdAt: new Date('2026-06-17T12:00:00Z'),
            updatedAt: null,
          },
        ]),
      })),
    });
  });

  it('waits for mention and comment_added notification jobs before returning', async () => {
    const mentionJob = deferred<{ success: boolean }>();
    const commentAddedJob = deferred<{ success: boolean; notificationIds: string[] }>();
    mocks.createMentionNotification.mockReturnValue(mentionJob.promise);
    mocks.createCommentAddedNotification.mockReturnValue(commentAddedJob.promise);

    const { createComment } = await import('@/lib/actions/comments');
    const resultPromise = createComment({
      taskId: 'task-1',
      contentJson: JSON.stringify({ type: 'doc', content: [] }),
    });

    await vi.waitFor(() => {
      expect(mocks.createMentionNotification).toHaveBeenCalled();
      expect(mocks.createCommentAddedNotification).toHaveBeenCalled();
    });

    let settled = false;
    resultPromise.then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    mentionJob.resolve({ success: true });
    await Promise.resolve();
    expect(settled).toBe(false);

    commentAddedJob.resolve({ success: true, notificationIds: ['notification-1'] });
    const result = await resultPromise;

    expect(result.success).toBe(true);
    expect(mocks.createCommentAddedNotification).toHaveBeenCalledWith({
      commenterId: 'author-1',
      taskId: 'task-1',
      commentId: 'comment-1',
      commentContent: { type: 'doc', content: [] },
      excludeUserIds: ['mentioned-1'],
      parentCommentAuthorId: undefined,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/clients/[clientSlug]/boards/[boardId]', 'page');
  });
});
