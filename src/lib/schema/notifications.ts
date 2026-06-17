import { pgTable, uuid, varchar, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';
import { tasks } from './tasks';
import { comments } from './comments';
import { notificationTypeEnum } from './enums';

export const notificationEmailBatches = pgTable(
  'notification_email_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channel: varchar('channel', { length: 20 }).notNull().default('email'),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    sendAfter: timestamp('send_after').notNull(),
    sentAt: timestamp('sent_at'),
    skippedAt: timestamp('skipped_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('notification_email_batches_pending_user_channel_idx')
      .on(table.userId, table.channel)
      .where(sql`${table.status} = 'pending'`),
    index('notification_email_batches_pending_send_after_idx').on(table.status, table.sendAfter),
  ]
);

export const notifications = pgTable(
  'notifications',
  {
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
    emailBatchId: uuid('email_batch_id').references(() => notificationEmailBatches.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('notifications_email_batch_id_idx').on(table.emailBatchId),
  ]
);

export const notificationEmailBatchesRelations = relations(notificationEmailBatches, ({ one, many }) => ({
  user: one(users, {
    fields: [notificationEmailBatches.userId],
    references: [users.id],
  }),
  notifications: many(notifications),
}));

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
  emailBatch: one(notificationEmailBatches, {
    fields: [notifications.emailBatchId],
    references: [notificationEmailBatches.id],
  }),
}));
