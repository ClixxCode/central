import { pgTable, uuid, varchar, text, integer, timestamp, check } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';
import { tasks } from './tasks';
import { comments } from './comments';

export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
    commentId: uuid('comment_id').references(() => comments.id, { onDelete: 'cascade' }),
    filename: varchar('filename', { length: 255 }).notNull(),
    url: text('url').notNull(),
    size: integer('size'), // bytes
    mimeType: varchar('mime_type', { length: 100 }),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    // Ensure either taskId or commentId is set, not both
    check(
      'task_or_comment_check',
      sql`(${table.taskId} IS NOT NULL AND ${table.commentId} IS NULL) OR (${table.taskId} IS NULL AND ${table.commentId} IS NOT NULL)`
    ),
  ]
);

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  task: one(tasks, {
    fields: [attachments.taskId],
    references: [tasks.id],
  }),
  comment: one(comments, {
    fields: [attachments.commentId],
    references: [comments.id],
  }),
  uploadedByUser: one(users, {
    fields: [attachments.uploadedBy],
    references: [users.id],
  }),
}));
