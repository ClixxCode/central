import { describe, it, expect } from 'vitest';
import * as schema from '@/lib/db/schema';

describe('Database Schema', () => {
  describe('Users', () => {
    it('exports users table', () => {
      expect(schema.users).toBeDefined();
    });

    it('has correct user role enum values', () => {
      expect(schema.userRoleEnum.enumValues).toEqual(['admin', 'user']);
    });

    it('has correct auth provider enum values', () => {
      expect(schema.authProviderEnum.enumValues).toEqual(['google', 'credentials']);
    });
  });

  describe('Teams', () => {
    it('exports teams table', () => {
      expect(schema.teams).toBeDefined();
    });

    it('exports teamMembers junction table', () => {
      expect(schema.teamMembers).toBeDefined();
    });
  });

  describe('Clients', () => {
    it('exports clients table', () => {
      expect(schema.clients).toBeDefined();
    });
  });

  describe('Boards', () => {
    it('exports boards table', () => {
      expect(schema.boards).toBeDefined();
    });

    it('exports boardAccess table', () => {
      expect(schema.boardAccess).toBeDefined();
    });

    it('exports rollupSources table', () => {
      expect(schema.rollupSources).toBeDefined();
    });

    it('has correct board type enum values', () => {
      expect(schema.boardTypeEnum.enumValues).toEqual(['standard', 'rollup']);
    });

    it('has correct access level enum values', () => {
      expect(schema.accessLevelEnum.enumValues).toEqual(['full', 'assigned_only']);
    });
  });

  describe('Tasks', () => {
    it('exports tasks table', () => {
      expect(schema.tasks).toBeDefined();
    });

    it('exports taskAssignees junction table', () => {
      expect(schema.taskAssignees).toBeDefined();
    });

    it('has correct date flexibility enum values', () => {
      expect(schema.dateFlexibilityEnum.enumValues).toEqual([
        'not_set',
        'flexible',
        'semi_flexible',
        'not_flexible',
      ]);
    });
  });

  describe('Comments', () => {
    it('exports comments table', () => {
      expect(schema.comments).toBeDefined();
    });
  });

  describe('Attachments', () => {
    it('exports attachments table', () => {
      expect(schema.attachments).toBeDefined();
    });
  });

  describe('Notifications', () => {
    it('exports notifications table', () => {
      expect(schema.notifications).toBeDefined();
    });

    it('has correct notification type enum values', () => {
      expect(schema.notificationTypeEnum.enumValues).toEqual([
        'mention',
        'task_assigned',
        'task_due_soon',
        'task_overdue',
        'comment_added',
        'reaction_added',
      ]);
    });
  });

  describe('Invitations', () => {
    it('exports invitations table', () => {
      expect(schema.invitations).toBeDefined();
    });
  });

  describe('Type Exports', () => {
    it('exports UserPreferences type', () => {
      // Type-only check - if this compiles, the type exists
      const prefs: schema.UserPreferences = {
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
            digest: 'instant',
          },
          slack: {
            enabled: false,
            mentions: true,
            assignments: true,
            dueDates: true,
            newComments: true,
            replies: true,
          },
          inApp: {
            enabled: true,
            mentions: true,
            assignments: true,
            dueDates: true,
            newComments: true,
            replies: true,
          },
        },
      };
      expect(prefs).toBeDefined();
    });

    it('exports StatusOption type', () => {
      const status: schema.StatusOption = {
        id: 'test',
        label: 'Test',
        color: '#000000',
        position: 0,
      };
      expect(status).toBeDefined();
    });

    it('exports SectionOption type', () => {
      const section: schema.SectionOption = {
        id: 'test',
        label: 'Test',
        color: '#000000',
        position: 0,
      };
      expect(section).toBeDefined();
    });

    it('exports RecurringConfig type', () => {
      const config: schema.RecurringConfig = {
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [1, 3, 5],
      };
      expect(config).toBeDefined();
    });

    it('exports TiptapContent type', () => {
      const content: schema.TiptapContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello' }],
          },
        ],
      };
      expect(content).toBeDefined();
    });
  });
});
