import { pgTable, uuid, varchar, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import type { StatusOption, SectionOption } from './boards';
import type { TiptapContent, RecurringConfig } from './tasks';

export const boardTemplates = pgTable('board_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 20 }).notNull().default('board_template'),
  icon: varchar('icon', { length: 100 }),
  color: varchar('color', { length: 7 }),
  statusOptions: jsonb('status_options').$type<StatusOption[]>().notNull().default([]),
  sectionOptions: jsonb('section_options').$type<SectionOption[]>().notNull().default([]),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const boardTemplatesRelations = relations(boardTemplates, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [boardTemplates.createdBy],
    references: [users.id],
  }),
  tasks: many(templateTasks),
}));

export const templateTasks = pgTable('template_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id')
    .notNull()
    .references(() => boardTemplates.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 500 }).notNull(),
  description: jsonb('description').$type<TiptapContent>(),
  status: varchar('status', { length: 100 }),
  section: varchar('section', { length: 100 }),
  relativeDueDays: integer('relative_due_days'),
  position: integer('position').notNull().default(0),
  recurringConfig: jsonb('recurring_config').$type<RecurringConfig>(),
  parentTemplateTaskId: uuid('parent_template_task_id').references((): any => templateTasks.id, {
    onDelete: 'cascade',
  }),
});

export const templateTasksRelations = relations(templateTasks, ({ one, many }) => ({
  template: one(boardTemplates, {
    fields: [templateTasks.templateId],
    references: [boardTemplates.id],
  }),
  parentTask: one(templateTasks, {
    fields: [templateTasks.parentTemplateTaskId],
    references: [templateTasks.id],
    relationName: 'subtasks',
  }),
  subtasks: many(templateTasks, {
    relationName: 'subtasks',
  }),
}));
