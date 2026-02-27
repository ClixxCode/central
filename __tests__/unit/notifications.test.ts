import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  NotificationWithContext,
  NotificationType,
} from '@/lib/actions/notifications';

// Test data factories
function createMockNotification(
  overrides: Partial<NotificationWithContext> = {}
): NotificationWithContext {
  return {
    id: 'notification-1',
    userId: 'user-1',
    type: 'mention',
    taskId: 'task-1',
    commentId: null,
    title: 'You were mentioned in a task',
    body: 'John mentioned you in "Fix login bug"',
    readAt: null,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    task: {
      id: 'task-1',
      title: 'Fix login bug',
      boardId: 'board-1',
      board: {
        id: 'board-1',
        name: 'Main Board',
        client: {
          id: 'client-1',
          name: 'Acme Corp',
          slug: 'acme',
        },
      },
    },
    ...overrides,
  };
}

describe('Notification Types', () => {
  describe('NotificationWithContext', () => {
    it('allows creating a notification with all required fields', () => {
      const notification = createMockNotification();
      expect(notification.id).toBe('notification-1');
      expect(notification.type).toBe('mention');
      expect(notification.readAt).toBeNull();
    });

    it('allows notifications with read status', () => {
      const readAt = new Date('2024-01-15T12:00:00Z');
      const notification = createMockNotification({ readAt });
      expect(notification.readAt).toEqual(readAt);
    });

    it('allows all notification types', () => {
      const types: NotificationType[] = [
        'mention',
        'task_assigned',
        'task_due_soon',
        'task_overdue',
        'comment_added',
        'reaction_added',
      ];

      for (const type of types) {
        const notification = createMockNotification({ type });
        expect(notification.type).toBe(type);
      }
    });

    it('allows notifications without task context', () => {
      const notification = createMockNotification({
        taskId: null,
        task: null,
      });
      expect(notification.taskId).toBeNull();
      expect(notification.task).toBeNull();
    });

    it('allows notifications with comment reference', () => {
      const notification = createMockNotification({
        type: 'comment_added',
        commentId: 'comment-1',
      });
      expect(notification.commentId).toBe('comment-1');
    });
  });
});

describe('Notification Filtering Logic', () => {
  const notifications = [
    createMockNotification({ id: '1', type: 'mention', readAt: null }),
    createMockNotification({
      id: '2',
      type: 'task_assigned',
      readAt: new Date(),
    }),
    createMockNotification({ id: '3', type: 'mention', readAt: null }),
    createMockNotification({
      id: '4',
      type: 'task_due_soon',
      readAt: new Date(),
    }),
  ];

  function filterNotifications(
    notificationList: NotificationWithContext[],
    options?: { unreadOnly?: boolean; type?: NotificationType }
  ): NotificationWithContext[] {
    return notificationList.filter((n) => {
      if (options?.unreadOnly && n.readAt !== null) return false;
      if (options?.type && n.type !== options.type) return false;
      return true;
    });
  }

  it('filters unread notifications', () => {
    const unread = filterNotifications(notifications, { unreadOnly: true });
    expect(unread).toHaveLength(2);
    expect(unread.every((n) => n.readAt === null)).toBe(true);
  });

  it('filters by notification type', () => {
    const mentions = filterNotifications(notifications, { type: 'mention' });
    expect(mentions).toHaveLength(2);
    expect(mentions.every((n) => n.type === 'mention')).toBe(true);
  });

  it('combines filters correctly', () => {
    const unreadMentions = filterNotifications(notifications, {
      unreadOnly: true,
      type: 'mention',
    });
    expect(unreadMentions).toHaveLength(2);
  });

  it('returns all notifications with no filters', () => {
    const all = filterNotifications(notifications, {});
    expect(all).toHaveLength(4);
  });
});

describe('Notification Count Logic', () => {
  const notifications = [
    createMockNotification({ id: '1', readAt: null }),
    createMockNotification({ id: '2', readAt: new Date() }),
    createMockNotification({ id: '3', readAt: null }),
    createMockNotification({ id: '4', readAt: null }),
  ];

  function countUnread(notificationList: NotificationWithContext[]): number {
    return notificationList.filter((n) => n.readAt === null).length;
  }

  it('counts unread notifications correctly', () => {
    expect(countUnread(notifications)).toBe(3);
  });

  it('returns 0 for empty list', () => {
    expect(countUnread([])).toBe(0);
  });

  it('returns 0 when all are read', () => {
    const allRead = notifications.map((n) => ({
      ...n,
      readAt: new Date(),
    }));
    expect(countUnread(allRead)).toBe(0);
  });
});

describe('Notification Link Generation', () => {
  function getNotificationLink(
    notification: NotificationWithContext
  ): string | null {
    if (!notification.task) return null;
    const { client, id: boardId } = notification.task.board;
    return `/clients/${client.slug}/boards/${boardId}?task=${notification.taskId}`;
  }

  it('generates correct link for notification with task', () => {
    const notification = createMockNotification();
    const link = getNotificationLink(notification);
    expect(link).toBe('/clients/acme/boards/board-1?task=task-1');
  });

  it('returns null for notification without task', () => {
    const notification = createMockNotification({
      taskId: null,
      task: null,
    });
    const link = getNotificationLink(notification);
    expect(link).toBeNull();
  });
});

describe('Notification Sorting', () => {
  const notifications = [
    createMockNotification({
      id: '1',
      createdAt: new Date('2024-01-15T10:00:00Z'),
    }),
    createMockNotification({
      id: '2',
      createdAt: new Date('2024-01-15T12:00:00Z'),
    }),
    createMockNotification({
      id: '3',
      createdAt: new Date('2024-01-14T10:00:00Z'),
    }),
  ];

  function sortByCreatedAt(
    notificationList: NotificationWithContext[],
    direction: 'asc' | 'desc' = 'desc'
  ): NotificationWithContext[] {
    return [...notificationList].sort((a, b) => {
      const comparison =
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return direction === 'asc' ? comparison : -comparison;
    });
  }

  it('sorts by createdAt descending (newest first)', () => {
    const sorted = sortByCreatedAt(notifications, 'desc');
    expect(sorted[0].id).toBe('2');
    expect(sorted[1].id).toBe('1');
    expect(sorted[2].id).toBe('3');
  });

  it('sorts by createdAt ascending (oldest first)', () => {
    const sorted = sortByCreatedAt(notifications, 'asc');
    expect(sorted[0].id).toBe('3');
    expect(sorted[1].id).toBe('1');
    expect(sorted[2].id).toBe('2');
  });
});

describe('Mark All Read Logic', () => {
  function markAllAsRead(
    notifications: NotificationWithContext[]
  ): NotificationWithContext[] {
    const now = new Date();
    return notifications.map((n) => ({
      ...n,
      readAt: n.readAt ?? now,
    }));
  }

  it('marks all unread notifications as read', () => {
    const notifications = [
      createMockNotification({ id: '1', readAt: null }),
      createMockNotification({ id: '2', readAt: null }),
    ];

    const updated = markAllAsRead(notifications);
    expect(updated.every((n) => n.readAt !== null)).toBe(true);
  });

  it('preserves existing readAt timestamps', () => {
    const existingReadAt = new Date('2024-01-10T10:00:00Z');
    const notifications = [
      createMockNotification({ id: '1', readAt: existingReadAt }),
      createMockNotification({ id: '2', readAt: null }),
    ];

    const updated = markAllAsRead(notifications);
    expect(updated[0].readAt).toEqual(existingReadAt);
    expect(updated[1].readAt).not.toBeNull();
  });
});

describe('Clear Read Notifications Logic', () => {
  function clearRead(
    notifications: NotificationWithContext[]
  ): NotificationWithContext[] {
    return notifications.filter((n) => n.readAt === null);
  }

  it('removes all read notifications', () => {
    const notifications = [
      createMockNotification({ id: '1', readAt: null }),
      createMockNotification({ id: '2', readAt: new Date() }),
      createMockNotification({ id: '3', readAt: new Date() }),
    ];

    const remaining = clearRead(notifications);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('1');
  });

  it('returns all when none are read', () => {
    const notifications = [
      createMockNotification({ id: '1', readAt: null }),
      createMockNotification({ id: '2', readAt: null }),
    ];

    const remaining = clearRead(notifications);
    expect(remaining).toHaveLength(2);
  });

  it('returns empty when all are read', () => {
    const notifications = [
      createMockNotification({ id: '1', readAt: new Date() }),
      createMockNotification({ id: '2', readAt: new Date() }),
    ];

    const remaining = clearRead(notifications);
    expect(remaining).toHaveLength(0);
  });
});

describe('Notification Type Display', () => {
  const typeLabels: Record<NotificationType, string> = {
    mention: 'Mention',
    task_assigned: 'Task Assigned',
    task_due_soon: 'Due Soon',
    task_overdue: 'Overdue',
    comment_added: 'Comment',
    reaction_added: 'Reaction',
  };

  function getTypeLabel(type: NotificationType): string {
    return typeLabels[type];
  }

  it('returns correct label for each type', () => {
    expect(getTypeLabel('mention')).toBe('Mention');
    expect(getTypeLabel('task_assigned')).toBe('Task Assigned');
    expect(getTypeLabel('task_due_soon')).toBe('Due Soon');
    expect(getTypeLabel('task_overdue')).toBe('Overdue');
    expect(getTypeLabel('comment_added')).toBe('Comment');
    expect(getTypeLabel('reaction_added')).toBe('Reaction');
  });
});

describe('Notification Badge Count Display', () => {
  function formatBadgeCount(count: number): string {
    if (count <= 0) return '';
    if (count > 99) return '99+';
    return String(count);
  }

  it('returns empty string for 0', () => {
    expect(formatBadgeCount(0)).toBe('');
  });

  it('returns empty string for negative numbers', () => {
    expect(formatBadgeCount(-1)).toBe('');
  });

  it('returns exact count for 1-99', () => {
    expect(formatBadgeCount(1)).toBe('1');
    expect(formatBadgeCount(50)).toBe('50');
    expect(formatBadgeCount(99)).toBe('99');
  });

  it('returns 99+ for counts over 99', () => {
    expect(formatBadgeCount(100)).toBe('99+');
    expect(formatBadgeCount(1000)).toBe('99+');
  });
});
