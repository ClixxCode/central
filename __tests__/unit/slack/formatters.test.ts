import { describe, it, expect } from 'vitest';
import {
  formatMentionNotification,
  formatTaskAssignedNotification,
  formatDueDateReminderNotification,
  formatCommentAddedNotification,
  type NotificationContext,
} from '@/lib/slack/formatters';

describe('Slack Message Formatters', () => {
  const baseContext: NotificationContext = {
    taskId: 'task-123',
    taskTitle: 'Complete the quarterly report',
    boardId: 'board-456',
    boardName: 'Marketing Tasks',
    clientSlug: 'acme',
    clientName: 'Acme Corp',
    actorName: 'John Doe',
    actorEmail: 'john@example.com',
  };

  describe('formatMentionNotification', () => {
    it('creates a mention notification message', () => {
      const message = formatMentionNotification(baseContext);

      expect(message.text).toContain('John Doe');
      expect(message.text).toContain('mentioned you');
      expect(message.blocks).toBeDefined();
      expect(message.blocks!.length).toBeGreaterThan(0);
    });

    it('includes task title in the message', () => {
      const message = formatMentionNotification(baseContext);
      const blockTexts = message.blocks!.map((b) => JSON.stringify(b));
      const hasTaskTitle = blockTexts.some((t) => t.includes('Complete the quarterly report'));

      expect(hasTaskTitle).toBe(true);
    });

    it('includes comment preview when provided', () => {
      const context: NotificationContext = {
        ...baseContext,
        commentPreview: 'Hey, can you take a look at this?',
      };
      const message = formatMentionNotification(context);
      const blockTexts = message.blocks!.map((b) => JSON.stringify(b));
      const hasPreview = blockTexts.some((t) => t.includes('can you take a look'));

      expect(hasPreview).toBe(true);
    });

    it('falls back to email when actor name is not available', () => {
      const context: NotificationContext = {
        ...baseContext,
        actorName: undefined,
      };
      const message = formatMentionNotification(context);

      // The header block should contain the email
      const blockTexts = message.blocks!.map((b) => JSON.stringify(b));
      const hasEmail = blockTexts.some((t) => t.includes('john@example.com'));
      expect(hasEmail).toBe(true);
    });

    it('includes client and board context', () => {
      const message = formatMentionNotification(baseContext);
      const blockTexts = message.blocks!.map((b) => JSON.stringify(b));
      const hasContext = blockTexts.some(
        (t) => t.includes('Acme Corp') || t.includes('Marketing Tasks')
      );

      expect(hasContext).toBe(true);
    });
  });

  describe('formatTaskAssignedNotification', () => {
    it('creates a task assignment notification message', () => {
      const message = formatTaskAssignedNotification(baseContext);

      expect(message.text).toContain('John Doe');
      expect(message.text).toContain('assigned you');
      expect(message.blocks).toBeDefined();
    });

    it('includes due date when provided', () => {
      const context: NotificationContext = {
        ...baseContext,
        dueDate: '2024-12-31',
      };
      const message = formatTaskAssignedNotification(context);
      const blockTexts = message.blocks!.map((b) => JSON.stringify(b));
      const hasDueDate = blockTexts.some((t) => t.includes('Due'));

      expect(hasDueDate).toBe(true);
    });

    it('includes action button with task URL', () => {
      const message = formatTaskAssignedNotification(baseContext);
      const actionsBlock = message.blocks!.find((b) => b.type === 'actions');

      expect(actionsBlock).toBeDefined();
    });
  });

  describe('formatDueDateReminderNotification', () => {
    it('creates a due soon notification message', () => {
      const context: NotificationContext = {
        ...baseContext,
        dueDate: '2024-12-31',
      };
      const message = formatDueDateReminderNotification(context, 'due_soon');

      expect(message.text).toContain('due soon');
      expect(message.blocks).toBeDefined();
    });

    it('creates an overdue notification message with warning', () => {
      const context: NotificationContext = {
        ...baseContext,
        dueDate: '2024-01-01',
      };
      const message = formatDueDateReminderNotification(context, 'overdue');

      expect(message.text).toContain('overdue');
      const blockTexts = message.blocks!.map((b) => JSON.stringify(b));
      const hasOverdue = blockTexts.some((t) => t.includes('overdue'));

      expect(hasOverdue).toBe(true);
    });

    it('includes due date for due soon', () => {
      const context: NotificationContext = {
        ...baseContext,
        dueDate: '2024-12-31',
      };
      const message = formatDueDateReminderNotification(context, 'due_soon');
      const blockTexts = message.blocks!.map((b) => JSON.stringify(b));
      const hasDue = blockTexts.some((t) => t.includes('Due'));

      expect(hasDue).toBe(true);
    });
  });

  describe('formatCommentAddedNotification', () => {
    it('creates a comment notification message', () => {
      const message = formatCommentAddedNotification(baseContext);

      expect(message.text).toContain('John Doe');
      expect(message.text).toContain('commented');
      expect(message.blocks).toBeDefined();
    });

    it('includes commented on text', () => {
      const message = formatCommentAddedNotification(baseContext);
      const blockTexts = message.blocks!.map((b) => JSON.stringify(b));
      const hasCommented = blockTexts.some((t) => t.includes('commented on'));

      expect(hasCommented).toBe(true);
    });

    it('includes comment preview when provided', () => {
      const context: NotificationContext = {
        ...baseContext,
        commentPreview: 'Great work on this task!',
      };
      const message = formatCommentAddedNotification(context);
      const blockTexts = message.blocks!.map((b) => JSON.stringify(b));
      const hasPreview = blockTexts.some((t) => t.includes('Great work'));

      expect(hasPreview).toBe(true);
    });
  });

  describe('Special character handling', () => {
    it('escapes special characters in task titles', () => {
      const context: NotificationContext = {
        ...baseContext,
        taskTitle: 'Fix <script> & "injection" issue',
      };
      const message = formatMentionNotification(context);
      const blockTexts = message.blocks!.map((b) => JSON.stringify(b));

      // Should escape < > &
      const hasEscaped = blockTexts.some(
        (t) => t.includes('&lt;') || t.includes('&gt;') || t.includes('&amp;')
      );
      expect(hasEscaped).toBe(true);
    });

    it('truncates long comment previews', () => {
      const context: NotificationContext = {
        ...baseContext,
        commentPreview: 'A'.repeat(300), // 300 characters
      };
      const message = formatMentionNotification(context);
      const blockTexts = message.blocks!.map((b) => JSON.stringify(b)).join(' ');

      // Should be truncated with ellipsis
      expect(blockTexts.length).toBeLessThan(1000);
      expect(blockTexts).toContain('...');
    });
  });

  describe('URL generation', () => {
    it('generates valid task URLs when all context is present', () => {
      const message = formatMentionNotification(baseContext);
      const actionsBlock = message.blocks!.find((b) => b.type === 'actions');

      expect(actionsBlock).toBeDefined();
      // The URL should be in the button element
      const hasUrl = message.blocks!.some((b) =>
        JSON.stringify(b).includes('/clients/acme/boards/board-456')
      );
      expect(hasUrl).toBe(true);
    });

    it('does not include action button when context is incomplete', () => {
      const context: NotificationContext = {
        actorName: 'John Doe',
        taskTitle: 'Some task',
        // Missing clientSlug, boardId, taskId
      };
      const message = formatMentionNotification(context);
      const actionsBlock = message.blocks!.find((b) => b.type === 'actions');

      expect(actionsBlock).toBeUndefined();
    });
  });
});
