import { pgTable, uuid, varchar, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { userRoleEnum, authProviderEnum } from './enums';

// Shared notification settings for all channels
export interface NotificationChannelSettings {
  enabled: boolean;
  mentions: boolean;
  assignments: boolean;
  dueDates: boolean;
  newComments: boolean;
  replies: boolean;
}

// User preferences type
export interface UserPreferences {
  hiddenBoards: string[];
  hiddenColumns: string[];
  defaultView: 'table' | 'kanban';
  notifications: {
    email: NotificationChannelSettings & {
      digest: 'instant' | 'daily' | 'weekly' | 'none';
    };
    slack: NotificationChannelSettings & {
      slackUsername?: string;
      slackLinkType?: 'web' | 'app';
    };
    inApp: NotificationChannelSettings;
  };
}

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  avatarUrl: text('avatar_url'),
  role: userRoleEnum('role').notNull().default('user'),
  authProvider: authProviderEnum('auth_provider'),
  passwordHash: text('password_hash'),
  preferences: jsonb('preferences').$type<UserPreferences>().default({
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
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  teamMembers: many(teamMembers),
  taskAssignees: many(taskAssignees),
  notifications: many(notifications),
}));

// Forward declarations for relations - these are defined in other files
import { teamMembers } from './teams';
import { taskAssignees } from './tasks';
import { notifications } from './notifications';
