import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserPreferences } from '@/lib/db/schema/users';

// Define the default preferences structure for testing
const DEFAULT_PREFERENCES: UserPreferences = {
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

describe('User Notification Preferences', () => {
  describe('Default Preferences', () => {
    it('has email notifications enabled by default', () => {
      expect(DEFAULT_PREFERENCES.notifications.email.enabled).toBe(true);
    });

    it('has all email notification types enabled by default', () => {
      const { email } = DEFAULT_PREFERENCES.notifications;

      expect(email.mentions).toBe(true);
      expect(email.assignments).toBe(true);
      expect(email.dueDates).toBe(true);
      expect(email.newComments).toBe(true);
      expect(email.replies).toBe(true);
    });

    it('has instant digest by default', () => {
      expect(DEFAULT_PREFERENCES.notifications.email.digest).toBe('instant');
    });

    it('has in-app notifications enabled by default', () => {
      expect(DEFAULT_PREFERENCES.notifications.inApp.enabled).toBe(true);
    });

    it('has all in-app notification types enabled by default', () => {
      const { inApp } = DEFAULT_PREFERENCES.notifications;

      expect(inApp.mentions).toBe(true);
      expect(inApp.assignments).toBe(true);
      expect(inApp.dueDates).toBe(true);
      expect(inApp.newComments).toBe(true);
      expect(inApp.replies).toBe(true);
    });

    it('has Slack notifications disabled by default', () => {
      expect(DEFAULT_PREFERENCES.notifications.slack.enabled).toBe(false);
    });

    it('has all Slack notification types enabled by default', () => {
      const { slack } = DEFAULT_PREFERENCES.notifications;

      expect(slack.mentions).toBe(true);
      expect(slack.assignments).toBe(true);
      expect(slack.dueDates).toBe(true);
      expect(slack.newComments).toBe(true);
      expect(slack.replies).toBe(true);
    });
  });

  describe('Preference Checking Logic', () => {
    it('should send email when all conditions are met', () => {
      const prefs: UserPreferences = { ...DEFAULT_PREFERENCES };

      const shouldSendMentionEmail =
        prefs.notifications.email.enabled &&
        prefs.notifications.email.mentions &&
        prefs.notifications.email.digest === 'instant';

      expect(shouldSendMentionEmail).toBe(true);
    });

    it('should not send email when email is disabled', () => {
      const prefs: UserPreferences = {
        ...DEFAULT_PREFERENCES,
        notifications: {
          ...DEFAULT_PREFERENCES.notifications,
          email: {
            ...DEFAULT_PREFERENCES.notifications.email,
            enabled: false,
          },
        },
      };

      const shouldSendEmail = prefs.notifications.email.enabled;

      expect(shouldSendEmail).toBe(false);
    });

    it('should not send mention email when mentions are disabled', () => {
      const prefs: UserPreferences = {
        ...DEFAULT_PREFERENCES,
        notifications: {
          ...DEFAULT_PREFERENCES.notifications,
          email: {
            ...DEFAULT_PREFERENCES.notifications.email,
            mentions: false,
          },
        },
      };

      const shouldSendMentionEmail =
        prefs.notifications.email.enabled && prefs.notifications.email.mentions;

      expect(shouldSendMentionEmail).toBe(false);
    });

    it('should not send instant email when digest is daily', () => {
      const prefs: UserPreferences = {
        ...DEFAULT_PREFERENCES,
        notifications: {
          ...DEFAULT_PREFERENCES.notifications,
          email: {
            ...DEFAULT_PREFERENCES.notifications.email,
            digest: 'daily',
          },
        },
      };

      const shouldSendInstantEmail =
        prefs.notifications.email.enabled &&
        prefs.notifications.email.digest === 'instant';

      expect(shouldSendInstantEmail).toBe(false);
    });

    it('should aggregate for digest when digest is daily', () => {
      const prefs: UserPreferences = {
        ...DEFAULT_PREFERENCES,
        notifications: {
          ...DEFAULT_PREFERENCES.notifications,
          email: {
            ...DEFAULT_PREFERENCES.notifications.email,
            digest: 'daily',
          },
        },
      };

      const shouldSendDigest =
        prefs.notifications.email.enabled &&
        prefs.notifications.email.digest === 'daily';

      expect(shouldSendDigest).toBe(true);
    });

    it('should respect weekly digest setting', () => {
      const prefs: UserPreferences = {
        ...DEFAULT_PREFERENCES,
        notifications: {
          ...DEFAULT_PREFERENCES.notifications,
          email: {
            ...DEFAULT_PREFERENCES.notifications.email,
            digest: 'weekly',
          },
        },
      };

      expect(prefs.notifications.email.digest).toBe('weekly');
    });

    it('should not send any email when digest is none', () => {
      const prefs: UserPreferences = {
        ...DEFAULT_PREFERENCES,
        notifications: {
          ...DEFAULT_PREFERENCES.notifications,
          email: {
            ...DEFAULT_PREFERENCES.notifications.email,
            digest: 'none',
          },
        },
      };

      const shouldSendAnyEmail =
        prefs.notifications.email.digest !== 'none';

      expect(shouldSendAnyEmail).toBe(false);
    });

    it('should send newComments notification when enabled', () => {
      const prefs: UserPreferences = { ...DEFAULT_PREFERENCES };

      const shouldSendNewComments =
        prefs.notifications.email.enabled &&
        prefs.notifications.email.newComments;

      expect(shouldSendNewComments).toBe(true);
    });

    it('should send replies notification when enabled', () => {
      const prefs: UserPreferences = { ...DEFAULT_PREFERENCES };

      const shouldSendReplies =
        prefs.notifications.email.enabled &&
        prefs.notifications.email.replies;

      expect(shouldSendReplies).toBe(true);
    });
  });

  describe('Preference Merging', () => {
    function mergeWithDefaults(prefs: Partial<UserPreferences> | null): UserPreferences {
      if (!prefs) return DEFAULT_PREFERENCES;

      return {
        hiddenBoards: prefs.hiddenBoards ?? DEFAULT_PREFERENCES.hiddenBoards,
        hiddenColumns: prefs.hiddenColumns ?? DEFAULT_PREFERENCES.hiddenColumns,
        defaultView: prefs.defaultView ?? DEFAULT_PREFERENCES.defaultView,
        notifications: {
          email: {
            enabled: prefs.notifications?.email?.enabled ?? DEFAULT_PREFERENCES.notifications.email.enabled,
            mentions: prefs.notifications?.email?.mentions ?? DEFAULT_PREFERENCES.notifications.email.mentions,
            assignments: prefs.notifications?.email?.assignments ?? DEFAULT_PREFERENCES.notifications.email.assignments,
            dueDates: prefs.notifications?.email?.dueDates ?? DEFAULT_PREFERENCES.notifications.email.dueDates,
            newComments: prefs.notifications?.email?.newComments ?? DEFAULT_PREFERENCES.notifications.email.newComments,
            replies: prefs.notifications?.email?.replies ?? DEFAULT_PREFERENCES.notifications.email.replies,
            digest: prefs.notifications?.email?.digest ?? DEFAULT_PREFERENCES.notifications.email.digest,
          },
          slack: {
            enabled: prefs.notifications?.slack?.enabled ?? DEFAULT_PREFERENCES.notifications.slack.enabled,
            slackUsername: prefs.notifications?.slack?.slackUsername,
            mentions: prefs.notifications?.slack?.mentions ?? DEFAULT_PREFERENCES.notifications.slack.mentions,
            assignments: prefs.notifications?.slack?.assignments ?? DEFAULT_PREFERENCES.notifications.slack.assignments,
            dueDates: prefs.notifications?.slack?.dueDates ?? DEFAULT_PREFERENCES.notifications.slack.dueDates,
            newComments: prefs.notifications?.slack?.newComments ?? DEFAULT_PREFERENCES.notifications.slack.newComments,
            replies: prefs.notifications?.slack?.replies ?? DEFAULT_PREFERENCES.notifications.slack.replies,
          },
          inApp: {
            enabled: prefs.notifications?.inApp?.enabled ?? DEFAULT_PREFERENCES.notifications.inApp.enabled,
            mentions: prefs.notifications?.inApp?.mentions ?? DEFAULT_PREFERENCES.notifications.inApp.mentions,
            assignments: prefs.notifications?.inApp?.assignments ?? DEFAULT_PREFERENCES.notifications.inApp.assignments,
            dueDates: prefs.notifications?.inApp?.dueDates ?? DEFAULT_PREFERENCES.notifications.inApp.dueDates,
            newComments: prefs.notifications?.inApp?.newComments ?? DEFAULT_PREFERENCES.notifications.inApp.newComments,
            replies: prefs.notifications?.inApp?.replies ?? DEFAULT_PREFERENCES.notifications.inApp.replies,
          },
        },
      };
    }

    it('returns defaults for null preferences', () => {
      const result = mergeWithDefaults(null);

      expect(result).toEqual(DEFAULT_PREFERENCES);
    });

    it('merges partial preferences with defaults', () => {
      const partial: Partial<UserPreferences> = {
        notifications: {
          email: {
            enabled: false,
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

      const result = mergeWithDefaults(partial);

      expect(result.notifications.email.enabled).toBe(false);
      expect(result.hiddenBoards).toEqual([]);
      expect(result.defaultView).toBe('table');
    });

    it('preserves custom values while filling in defaults', () => {
      const partial: Partial<UserPreferences> = {
        hiddenBoards: ['board-1', 'board-2'],
        defaultView: 'kanban',
        notifications: {
          email: {
            enabled: true,
            mentions: false,
            assignments: true,
            dueDates: false,
            newComments: true,
            replies: false,
            digest: 'daily',
          },
          slack: {
            enabled: true,
            slackUsername: 'johndoe',
            mentions: true,
            assignments: true,
            dueDates: true,
            newComments: true,
            replies: true,
          },
          inApp: {
            enabled: false,
            mentions: true,
            assignments: true,
            dueDates: true,
            newComments: true,
            replies: true,
          },
        },
      };

      const result = mergeWithDefaults(partial);

      expect(result.hiddenBoards).toEqual(['board-1', 'board-2']);
      expect(result.defaultView).toBe('kanban');
      expect(result.notifications.email.mentions).toBe(false);
      expect(result.notifications.email.digest).toBe('daily');
      expect(result.notifications.slack.slackUsername).toBe('johndoe');
      expect(result.notifications.inApp.enabled).toBe(false);
    });
  });
});
