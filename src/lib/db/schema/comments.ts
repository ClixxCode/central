import { pgTable, uuid, timestamp, jsonb, varchar, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { tasks, type TiptapContent } from './tasks';
import { attachments } from './attachments';
import { commentReactions } from './comment-reactions';

export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  shortId: varchar('short_id', { length: 12 }).unique(),
  taskId: uuid('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id')
    .references(() => users.id, { onDelete: 'set null' }),
  parentCommentId: uuid('parent_comment_id').references((): AnyPgColumn => comments.id, { onDelete: 'cascade' }),
  content: jsonb('content').$type<TiptapContent>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const commentsRelations = relations(comments, ({ one, many }) => ({
  task: one(tasks, {
    fields: [comments.taskId],
    references: [tasks.id],
  }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
  parentComment: one(comments, {
    fields: [comments.parentCommentId],
    references: [comments.id],
    relationName: 'commentReplies',
  }),
  replies: many(comments, { relationName: 'commentReplies' }),
  attachments: many(attachments),
  reactions: many(commentReactions),
}));
