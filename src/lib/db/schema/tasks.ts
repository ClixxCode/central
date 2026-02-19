import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  integer,
  jsonb,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { boards } from './boards';
import { comments } from './comments';
import { attachments } from './attachments';
import { dateFlexibilityEnum } from './enums';

// Recurring configuration type
export interface RecurringConfig {
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  interval: number;
  daysOfWeek?: number[]; // For weekly: [0-6] where 0 = Sunday
  dayOfMonth?: number; // For monthly: 1-31
  monthlyPattern?: 'dayOfMonth' | 'dayOfWeek'; // For monthly/quarterly: which pattern to use
  weekOfMonth?: number; // 1-4, -1 (last), or -2 (last full business week) — used with monthlyPattern 'dayOfWeek'
  monthlyDayOfWeek?: number; // 0-6 (Sun-Sat) — used with monthlyPattern 'dayOfWeek'
  endDate?: string; // ISO date string
  endAfterOccurrences?: number;
}

// Tiptap document type for rich text
export interface TiptapContent {
  type: 'doc';
  content: TiptapNode[];
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: TiptapMark[];
}

export interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  shortId: varchar('short_id', { length: 12 }).unique(),
  boardId: uuid('board_id')
    .notNull()
    .references(() => boards.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 500 }).notNull(),
  description: jsonb('description').$type<TiptapContent>(),
  status: varchar('status', { length: 100 }).notNull(),
  section: varchar('section', { length: 100 }),
  dueDate: date('due_date'),
  dateFlexibility: dateFlexibilityEnum('date_flexibility').notNull().default('not_set'),
  recurringConfig: jsonb('recurring_config').$type<RecurringConfig>(),
  recurringGroupId: uuid('recurring_group_id'),
  parentTaskId: uuid('parent_task_id').references((): any => tasks.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  archivedAt: timestamp('archived_at'),
});

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  board: one(boards, {
    fields: [tasks.boardId],
    references: [boards.id],
  }),
  parentTask: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: 'subtasks',
  }),
  subtasks: many(tasks, {
    relationName: 'subtasks',
  }),
  createdByUser: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
  }),
  assignees: many(taskAssignees),
  comments: many(comments),
  attachments: many(attachments),
}));

// Task assignees junction table
export const taskAssignees = pgTable(
  'task_assignees',
  {
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.userId] }),
  ]
);

export const taskAssigneesRelations = relations(taskAssignees, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAssignees.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskAssignees.userId],
    references: [users.id],
  }),
}));
