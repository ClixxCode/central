import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { tasks } from './tasks';
import { comments } from './comments';
import { notificationTypeEnum } from './enums';

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum('type').notNull(),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  commentId: uuid('comment_id').references(() => comments.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body'),
  readAt: timestamp('read_at'),
  emailSentAt: timestamp('email_sent_at'),
  slackSentAt: timestamp('slack_sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  task: one(tasks, {
    fields: [notifications.taskId],
    references: [tasks.id],
  }),
  comment: one(comments, {
    fields: [notifications.commentId],
    references: [comments.id],
  }),
}));
