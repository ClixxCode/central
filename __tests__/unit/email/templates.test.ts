import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  baseEmailTemplate,
  emailButton,
  taskCard,
  formatEmailDate,
  mentionEmailSubject,
  mentionEmailHtml,
  taskAssignedEmailSubject,
  taskAssignedEmailHtml,
  taskDueSoonEmailSubject,
  taskOverdueEmailSubject,
  taskDueEmailHtml,
  dailyDigestEmailSubject,
  dailyDigestEmailHtml,
} from '@/lib/email/templates';

// Mock the getAppUrl function
vi.mock('@/lib/email/client', () => ({
  getAppUrl: () => 'https://app.clix.co',
}));

describe('Email Templates', () => {
  describe('baseEmailTemplate', () => {
    it('wraps content in HTML structure', () => {
      const html = baseEmailTemplate('<p>Test content</p>');

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html>');
      expect(html).toContain('Test content');
      expect(html).toContain('Central');
    });

    it('includes preheader when provided', () => {
      const html = baseEmailTemplate('<p>Content</p>', 'This is a preheader');

      expect(html).toContain('This is a preheader');
    });

    it('includes link to notification preferences', () => {
      const html = baseEmailTemplate('<p>Content</p>');

      expect(html).toContain('/settings/notifications');
    });
  });

  describe('emailButton', () => {
    it('creates a styled button link', () => {
      const button = emailButton('Click Me', 'https://example.com');

      expect(button).toContain('Click Me');
      expect(button).toContain('href="https://example.com"');
      expect(button).toContain('style=');
    });
  });

  describe('taskCard', () => {
    it('renders task title and status', () => {
      const card = taskCard({
        title: 'Test Task',
        status: 'In Progress',
      });

      expect(card).toContain('Test Task');
      expect(card).toContain('In Progress');
    });

    it('includes due date when provided', () => {
      const card = taskCard({
        title: 'Test Task',
        status: 'Active',
        dueDate: 'Jan 15, 2026',
      });

      expect(card).toContain('Due: Jan 15, 2026');
    });

    it('includes client and board names when provided', () => {
      const card = taskCard({
        title: 'Test Task',
        status: 'Active',
        clientName: 'Acme Corp',
        boardName: 'Main Board',
      });

      expect(card).toContain('Acme Corp');
      expect(card).toContain('Main Board');
    });
  });

  describe('formatEmailDate', () => {
    it('formats Date object', () => {
      // Use a date with time to avoid timezone issues
      const date = new Date('2026-01-15T12:00:00');
      const formatted = formatEmailDate(date);

      expect(formatted).toContain('Jan');
      expect(formatted).toContain('2026');
      // Date may vary by timezone, so just check it contains a number
      expect(formatted).toMatch(/\d+/);
    });

    it('formats date string', () => {
      const formatted = formatEmailDate('2026-03-20T12:00:00');

      expect(formatted).toContain('Mar');
      expect(formatted).toContain('2026');
    });
  });

  describe('Mention Email', () => {
    const mentionData = {
      recipientName: 'John',
      mentionerName: 'Alice',
      taskTitle: 'Review PR',
      taskId: 'task-123',
      boardId: 'board-456',
      clientSlug: 'acme',
      taskStatus: 'In Progress',
      taskDueDate: '2026-01-20',
      commentPreview: 'Hey, can you take a look at this?',
    };

    it('generates correct subject', () => {
      const subject = mentionEmailSubject('Alice', 'Review PR');

      expect(subject).toBe('Alice mentioned you in "Review PR"');
    });

    it('generates HTML with all required elements', () => {
      const html = mentionEmailHtml(mentionData);

      expect(html).toContain('Alice');
      expect(html).toContain('Review PR');
      expect(html).toContain('mentioned you');
      expect(html).toContain('Hey, can you take a look at this?');
      expect(html).toContain('/clients/acme/boards/board-456?task=task-123');
    });
  });

  describe('Task Assigned Email', () => {
    const assignedData = {
      recipientName: 'Bob',
      assignerName: 'Alice',
      taskTitle: 'Update docs',
      taskId: 'task-789',
      boardId: 'board-123',
      clientSlug: 'acme',
      clientName: 'Acme Corp',
      boardName: 'Documentation',
      taskStatus: 'Open',
      taskDueDate: '2026-02-01',
    };

    it('generates correct subject', () => {
      const subject = taskAssignedEmailSubject('Update docs');

      expect(subject).toBe('You\'ve been assigned to "Update docs"');
    });

    it('generates HTML with assignment info', () => {
      const html = taskAssignedEmailHtml(assignedData);

      expect(html).toContain('Alice');
      expect(html).toContain('assigned you');
      expect(html).toContain('Update docs');
      expect(html).toContain('Acme Corp');
      expect(html).toContain('/clients/acme/boards/board-123?task=task-789');
    });
  });

  describe('Task Due Email', () => {
    const dueData = {
      recipientName: 'Carol',
      taskTitle: 'Submit report',
      taskId: 'task-456',
      boardId: 'board-789',
      clientSlug: 'widgets',
      clientName: 'Widgets Inc',
      boardName: 'Reports',
      taskStatus: 'In Progress',
      dueDate: '2026-01-25',
      isOverdue: false,
    };

    it('generates due soon subject', () => {
      const subject = taskDueSoonEmailSubject('Submit report');

      expect(subject).toBe('Reminder: "Submit report" is due soon');
    });

    it('generates overdue subject', () => {
      const subject = taskOverdueEmailSubject('Submit report');

      expect(subject).toBe('Overdue: "Submit report" was due');
    });

    it('generates HTML for due soon', () => {
      const html = taskDueEmailHtml(dueData);

      expect(html).toContain('Task Due Soon');
      expect(html).toContain('Submit report');
      expect(html).not.toContain('overdue');
    });

    it('generates HTML for overdue', () => {
      const html = taskDueEmailHtml({ ...dueData, isOverdue: true });

      expect(html).toContain('Task Overdue');
      expect(html).toContain('needs your attention');
    });
  });

  describe('Daily Digest Email', () => {
    const digestData = {
      recipientName: 'Dave',
      date: new Date('2026-01-15'),
      tasksDueToday: [
        {
          id: 'task-1',
          title: 'Task Today',
          status: 'Open',
          dueDate: '2026-01-15',
          clientName: 'Client A',
          boardName: 'Board 1',
          boardId: 'board-1',
          clientSlug: 'client-a',
        },
      ],
      tasksDueTomorrow: [
        {
          id: 'task-2',
          title: 'Task Tomorrow',
          status: 'In Progress',
          dueDate: '2026-01-16',
          clientName: 'Client B',
          boardName: 'Board 2',
          boardId: 'board-2',
          clientSlug: 'client-b',
        },
      ],
      tasksOverdue: [],
      unreadNotifications: [
        {
          type: 'mention' as const,
          actorName: 'Alice',
          taskTitle: 'Review this',
          taskId: 'task-3',
          boardId: 'board-3',
          clientSlug: 'client-c',
          createdAt: new Date('2026-01-14'),
        },
      ],
    };

    it('generates subject with date', () => {
      const subject = dailyDigestEmailSubject(new Date('2026-01-15T12:00:00'));

      expect(subject).toContain('Daily Digest');
      expect(subject).toContain('Jan');
      // Date may vary by timezone, just check it contains a number
      expect(subject).toMatch(/\d+/);
    });

    it('generates HTML with all sections', () => {
      const html = dailyDigestEmailHtml(digestData);

      expect(html).toContain('Dave');
      expect(html).toContain('Due Today');
      expect(html).toContain('Task Today');
      expect(html).toContain('Due Tomorrow');
      expect(html).toContain('Task Tomorrow');
      expect(html).toContain('Unread Notifications');
      expect(html).toContain('Alice');
    });

    it('shows overdue section when tasks are overdue', () => {
      const dataWithOverdue = {
        ...digestData,
        tasksOverdue: [
          {
            id: 'task-old',
            title: 'Old Task',
            status: 'Open',
            dueDate: '2026-01-10',
            clientName: 'Client X',
            boardName: 'Board X',
            boardId: 'board-x',
            clientSlug: 'client-x',
          },
        ],
      };

      const html = dailyDigestEmailHtml(dataWithOverdue);

      expect(html).toContain('Overdue');
      expect(html).toContain('Old Task');
    });

    it('shows empty state when nothing to report', () => {
      const emptyData = {
        recipientName: 'Dave',
        date: new Date('2026-01-15'),
        tasksDueToday: [],
        tasksDueTomorrow: [],
        tasksOverdue: [],
        unreadNotifications: [],
      };

      const html = dailyDigestEmailHtml(emptyData);

      expect(html).toContain('all caught up');
    });
  });
});
