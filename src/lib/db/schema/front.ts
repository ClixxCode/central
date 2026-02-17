import { pgTable, uuid, varchar, timestamp, integer, unique } from 'drizzle-orm/pg-core';
import { tasks } from './tasks';
import { users } from './users';

export const frontConversations = pgTable(
  'front_conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    conversationId: varchar('conversation_id', { length: 255 }).notNull(),
    subject: varchar('subject', { length: 500 }),
    status: varchar('status', { length: 50 }),
    lastMessageAt: timestamp('last_message_at', { mode: 'date' }),
    messageCount: integer('message_count'),
    linkedBy: uuid('linked_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [unique('front_conversations_task_conversation').on(table.taskId, table.conversationId)]
);
