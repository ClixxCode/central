import { describe, it, expect, vi } from 'vitest';
import {
  CENTRAL_EMAIL_TEMPLATE_ALIASES,
  CENTRAL_EMAIL_TEMPLATE_LIST,
  RESERVED_RESEND_TEMPLATE_VARIABLE_KEYS,
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

    it('generates HTML with all required elements', async () => {
      const html = await mentionEmailHtml(mentionData);

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

    it('generates HTML with assignment info', async () => {
      const html = await taskAssignedEmailHtml(assignedData);

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

    it('generates HTML for due soon', async () => {
      const html = await taskDueEmailHtml(dueData);

      expect(html).toContain('Task Due Soon');
      expect(html).toContain('Submit report');
    });

    it('generates HTML for overdue', async () => {
      const html = await taskDueEmailHtml({ ...dueData, isOverdue: true });

      expect(html).toContain('Task Overdue');
      expect(html).toContain('needs your attention');
    });
  });

  describe('Daily Digest Email', () => {
    const digestData = {
      recipientName: 'Dave',
      date: new Date('2026-01-15'),
      tasksDueTodayCount: 1,
      tasksDueTomorrowCount: 1,
      tasksOverdueCount: 0,
      unreadNotificationsCount: 1,
      summaryText: 'You have 3 Central updates to review today.',
    };

    it('generates subject with date', () => {
      const subject = dailyDigestEmailSubject(new Date('2026-01-15T12:00:00'));

      expect(subject).toContain('Daily Digest');
      expect(subject).toContain('Jan');
      // Date may vary by timezone, just check it contains a number
      expect(subject).toMatch(/\d+/);
    });

    it('generates HTML with all sections', async () => {
      const html = await dailyDigestEmailHtml(digestData);

      expect(html).toContain('Dave');
      expect(html).toContain('Today at a glance');
      expect(html).toContain('Due today');
      expect(html).toContain('Due tomorrow');
      expect(html).toContain('Unread notifications');
      expect(html).toContain('You have 3 Central updates to review today.');
    });

    it('shows overdue count when tasks are overdue', async () => {
      const dataWithOverdue = {
        ...digestData,
        tasksOverdueCount: 2,
      };

      const html = await dailyDigestEmailHtml(dataWithOverdue);

      expect(html).toContain('Overdue');
      expect(html).toContain('2');
    });

    it('shows zero counts when nothing to report', async () => {
      const emptyData = {
        recipientName: 'Dave',
        date: new Date('2026-01-15'),
        tasksDueTodayCount: 0,
        tasksDueTomorrowCount: 0,
        tasksOverdueCount: 0,
        unreadNotificationsCount: 0,
      };

      const html = await dailyDigestEmailHtml(emptyData);

      expect(html).toContain('Today at a glance');
      expect(html).toContain('0');
    });
  });

  describe('Central Resend Template Registry', () => {
    it('contains the expected central_ aliases', () => {
      const aliases = CENTRAL_EMAIL_TEMPLATE_LIST.map((template) => template.alias).sort();

      expect(aliases).toEqual(Object.values(CENTRAL_EMAIL_TEMPLATE_ALIASES).sort());
      expect(aliases).toHaveLength(10);
      expect(aliases.every((alias) => alias.startsWith('central_'))).toBe(true);
    });

    it('uses uppercase, non-reserved variable keys', () => {
      for (const template of CENTRAL_EMAIL_TEMPLATE_LIST) {
        for (const variable of template.variables) {
          expect(variable.key).toMatch(/^[A-Z0-9_]+$/);
          expect(RESERVED_RESEND_TEMPLATE_VARIABLE_KEYS.has(variable.key)).toBe(false);
        }
      }
    });

    it('renders every hosted template with branding and CTA variables', async () => {
      for (const template of CENTRAL_EMAIL_TEMPLATE_LIST) {
        const html = await template.renderHtml();
        const urlVariable = template.variables.find((variable) => variable.key.endsWith('_URL'));

        expect(html).toContain('Central');
        expect(html).toContain('clix_logo_black.png');
        expect(html).toContain('#F5303D');
        if (urlVariable) {
          expect(html).toContain(`{{{${urlVariable.key}}}}`);
          expect(template.text).toContain(`{{{${urlVariable.key}}}}`);
        }
        if (template.variables.some((variable) => variable.key === 'TASK_STATUS_COLOR')) {
          expect(html).toContain('{{{TASK_STATUS_COLOR}}}');
          expect(html).toContain('{{{TASK_STATUS_BACKGROUND_COLOR}}}');
        }
      }
    });
  });
});
