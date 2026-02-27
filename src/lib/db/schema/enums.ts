import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['admin', 'user']);

export const authProviderEnum = pgEnum('auth_provider', ['google', 'credentials']);

export const boardTypeEnum = pgEnum('board_type', ['standard', 'rollup', 'personal']);

export const accessLevelEnum = pgEnum('access_level', ['full', 'assigned_only']);

export const dateFlexibilityEnum = pgEnum('date_flexibility', [
  'not_set',
  'flexible',
  'semi_flexible',
  'not_flexible',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'mention',
  'task_assigned',
  'task_due_soon',
  'task_overdue',
  'comment_added',
  'reaction_added',
]);
