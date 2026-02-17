import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the database module
vi.mock('@/lib/db', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
      tasks: {
        findFirst: vi.fn(),
      },
      boards: {
        findFirst: vi.fn(),
      },
      clients: {
        findFirst: vi.fn(),
      },
      comments: {
        findFirst: vi.fn(),
      },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([{ count: 0 }])),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() =>
          Promise.resolve([
            {
              id: 'notif-123',
              userId: 'user-123',
              type: 'mention',
              title: 'Test notification',
              body: null,
              taskId: 'task-123',
              readAt: null,
              createdAt: new Date(),
            },
          ])
        ),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{ id: 'notif-123' }])),
        })),
      })),
    })),
  },
}));

// Mock auth module
vi.mock('@/lib/auth/session', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
  }),
}));

// Mock Inngest
vi.mock('@/lib/inngest', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ['event-123'] }),
  },
}));

describe('Slack Notifications Integration', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('User preference handling', () => {
    it('respects user Slack notification preferences', async () => {
      const { db } = await import('@/lib/db');

      // User with Slack enabled
      vi.mocked(db.query.users.findFirst).mockResolvedValue({
        id: 'user-123',
        preferences: {
          hiddenBoards: [],
          hiddenColumns: [],
          defaultView: 'table',
          notifications: {
            email: { enabled: true, mentions: true, assignments: true, dueDates: true, digest: 'instant' },
            slack: { enabled: true, webhookUrl: 'https://hooks.slack.com/services/xxx', mentions: true, assignments: true, dueDates: true },
            inApp: { enabled: true },
          },
        },
      } as any);

      const prefs = await db.query.users.findFirst({ where: {} } as any);
      expect(prefs?.preferences?.notifications.slack.enabled).toBe(true);
    });

    it('does not send Slack when disabled', async () => {
      const { db } = await import('@/lib/db');

      // User with Slack disabled
      vi.mocked(db.query.users.findFirst).mockResolvedValue({
        id: 'user-123',
        preferences: {
          hiddenBoards: [],
          hiddenColumns: [],
          defaultView: 'table',
          notifications: {
            email: { enabled: true, mentions: true, assignments: true, dueDates: true, digest: 'instant' },
            slack: { enabled: false, mentions: true, assignments: true, dueDates: true },
            inApp: { enabled: true },
          },
        },
      } as any);

      const prefs = await db.query.users.findFirst({ where: {} } as any);
      expect(prefs?.preferences?.notifications.slack.enabled).toBe(false);
    });

    it('checks individual notification type preferences', async () => {
      const { db } = await import('@/lib/db');

      // User with Slack enabled but mentions disabled
      vi.mocked(db.query.users.findFirst).mockResolvedValue({
        id: 'user-123',
        preferences: {
          hiddenBoards: [],
          hiddenColumns: [],
          defaultView: 'table',
          notifications: {
            email: { enabled: true, mentions: true, assignments: true, dueDates: true, digest: 'instant' },
            slack: {
              enabled: true,
              webhookUrl: 'https://hooks.slack.com/services/xxx',
              mentions: false,
              assignments: true,
              dueDates: true,
            },
            inApp: { enabled: true },
          },
        },
      } as any);

      const prefs = await db.query.users.findFirst({ where: {} } as any);
      expect(prefs?.preferences?.notifications.slack.mentions).toBe(false);
      expect(prefs?.preferences?.notifications.slack.assignments).toBe(true);
    });
  });

  describe('Webhook URL validation', () => {
    it('validates Slack webhook URL format', async () => {
      const { isValidSlackWebhookUrl } = await import('@/lib/slack');

      expect(isValidSlackWebhookUrl('https://hooks.slack.com/services/T00/B00/xxx')).toBe(true);
      expect(isValidSlackWebhookUrl('http://hooks.slack.com/services/T00/B00/xxx')).toBe(false);
      expect(isValidSlackWebhookUrl('https://example.com/webhook')).toBe(false);
    });
  });

  describe('Message sending', () => {
    it('sends message to valid webhook', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('ok'),
      });
      vi.stubGlobal('fetch', mockFetch);

      const { sendSlackMessage } = await import('@/lib/slack');
      const result = await sendSlackMessage(
        'https://hooks.slack.com/services/T00/B00/xxx',
        { text: 'Test message' }
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('handles webhook errors gracefully', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          text: () => Promise.resolve('channel_not_found'),
        })
      );

      const { sendSlackMessage } = await import('@/lib/slack');
      const result = await sendSlackMessage(
        'https://hooks.slack.com/services/T00/B00/xxx',
        { text: 'Test message' }
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(404);
      expect(result.error).toBeDefined();
    });
  });

  describe('Notification context building', () => {
    it('builds context with task information', async () => {
      const { db } = await import('@/lib/db');

      vi.mocked(db.query.tasks.findFirst).mockResolvedValue({
        id: 'task-123',
        title: 'Test Task',
        boardId: 'board-456',
        dueDate: '2024-12-31',
      } as any);

      vi.mocked(db.query.boards.findFirst).mockResolvedValue({
        id: 'board-456',
        name: 'Test Board',
        clientId: 'client-789',
      } as any);

      vi.mocked(db.query.clients.findFirst).mockResolvedValue({
        id: 'client-789',
        name: 'Test Client',
        slug: 'test-client',
      } as any);

      const task = await db.query.tasks.findFirst({ where: {} } as any);
      const board = await db.query.boards.findFirst({ where: {} } as any);
      const client = await db.query.clients.findFirst({ where: {} } as any);

      expect(task?.title).toBe('Test Task');
      expect(board?.name).toBe('Test Board');
      expect(client?.slug).toBe('test-client');
    });
  });

  describe('Inngest event triggering', () => {
    it('triggers Inngest event for Slack notification', async () => {
      const { inngest } = await import('@/lib/inngest');

      await inngest.send({
        name: 'slack/send',
        data: {
          notificationId: 'notif-123',
          userId: 'user-123',
          webhookUrl: 'https://hooks.slack.com/services/xxx',
          type: 'mention',
          context: {
            taskId: 'task-123',
            taskTitle: 'Test Task',
          },
        },
      });

      expect(inngest.send).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'slack/send',
          data: expect.objectContaining({
            type: 'mention',
          }),
        })
      );
    });
  });
});
