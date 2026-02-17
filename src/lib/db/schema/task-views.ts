import { pgTable, uuid, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tasks } from './tasks';
import { users } from './users';

// Track when users last viewed a task (for "new" badge)
export const taskViews = pgTable(
  'task_views',
  {
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    viewedAt: timestamp('viewed_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.taskId, table.userId] })]
);

export const taskViewsRelations = relations(taskViews, ({ one }) => ({
  task: one(tasks, {
    fields: [taskViews.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskViews.userId],
    references: [users.id],
  }),
}));
