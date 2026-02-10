import { pgTable, uuid, varchar, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { boards } from './boards';
import { tasks } from './tasks';
import { users } from './users';

export const boardActivityLog = pgTable(
  'board_activity_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    taskTitle: varchar('task_title', { length: 500 }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    action: varchar('action', { length: 50 }).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('board_activity_log_board_created_idx').on(table.boardId, table.createdAt)]
);

export const boardActivityLogRelations = relations(boardActivityLog, ({ one }) => ({
  board: one(boards, {
    fields: [boardActivityLog.boardId],
    references: [boards.id],
  }),
  task: one(tasks, {
    fields: [boardActivityLog.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [boardActivityLog.userId],
    references: [users.id],
  }),
}));
