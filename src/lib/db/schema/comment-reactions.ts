import { pgTable, uuid, varchar, timestamp, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { comments } from './comments';
import { users } from './users';

export const commentReactions = pgTable(
  'comment_reactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    commentId: uuid('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reaction: varchar('reaction', { length: 32 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('comment_reactions_comment_user_reaction_idx').on(
      table.commentId,
      table.userId,
      table.reaction
    ),
    check(
      'comment_reactions_reaction_check',
      sql`${table.reaction} IN (
        'thumbs_up',
        'thumbs_down',
        'check',
        'hundred',
        'plus_one',
        'handshake',
        'heart',
        'celebrate',
        'fire',
        'clap',
        'star',
        'thanks',
        'rocket',
        'coffee',
        'sparkles',
        'eyes',
        'fixing',
        'notes',
        'idea',
        'question'
      )`
    ),
  ]
);

export const commentReactionsRelations = relations(commentReactions, ({ one }) => ({
  comment: one(comments, {
    fields: [commentReactions.commentId],
    references: [comments.id],
  }),
  user: one(users, {
    fields: [commentReactions.userId],
    references: [users.id],
  }),
}));
