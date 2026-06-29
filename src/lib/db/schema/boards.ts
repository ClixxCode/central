import { pgTable, uuid, varchar, timestamp, jsonb, boolean, check, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';
import { clients } from './clients';
import { teams } from './teams';
import { tasks } from './tasks';
import { boardTypeEnum, accessLevelEnum } from './enums';

// Status option type for board configuration
export interface StatusOption {
  id: string;
  label: string;
  color: string;
  position: number;
}

// Section option type for board configuration
export interface SectionOption {
  id: string;
  label: string;
  color: string;
  position: number;
}

// Rule that defines a rollup board's membership. Membership is fully derived
// from Pulse-reflected client attributes (pod / assignment / lifecycle) and
// reconciled automatically — no manual source curation.
export type RollupRule =
  | { type: 'pod'; pod_name: string }
  | { type: 'assignment'; staff_id: string; role?: 'management' | 'delivery' | null }
  | { type: 'lifecycle'; statuses: string[] };

export const boards = pgTable('boards', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: boardTypeEnum('type').notNull().default('standard'),
  statusOptions: jsonb('status_options').$type<StatusOption[]>().notNull().default([
    { id: 'todo', label: 'To Do', color: '#6B7280', position: 0 },
    { id: 'in-progress', label: 'In Progress', color: '#3B82F6', position: 1 },
    { id: 'review', label: 'Review', color: '#F59E0B', position: 2 },
    { id: 'complete', label: 'Complete', color: '#10B981', position: 3 },
  ]),
  sectionOptions: jsonb('section_options').$type<SectionOption[]>().default([]),
  color: varchar('color', { length: 7 }),
  icon: varchar('icon', { length: 100 }),
  reviewModeEnabled: boolean('review_mode_enabled').notNull().default(false),
  // For type='rollup' boards: the auto-membership rule (null = legacy manual).
  rollupRule: jsonb('rollup_rule').$type<RollupRule>(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const boardsRelations = relations(boards, ({ one, many }) => ({
  client: one(clients, {
    fields: [boards.clientId],
    references: [clients.id],
  }),
  createdByUser: one(users, {
    fields: [boards.createdBy],
    references: [users.id],
  }),
  tasks: many(tasks),
  access: many(boardAccess),
  nestedProjects: many(boardProjects, { relationName: 'parentBoard' }),
  projectCard: one(boardProjects, {
    fields: [boards.id],
    references: [boardProjects.projectBoardId],
    relationName: 'projectBoard',
  }),
  rollupSources: many(rollupSources, { relationName: 'rollupBoard' }),
  sourceForRollups: many(rollupSources, { relationName: 'sourceBoard' }),
}));

// Board-nested project cards. The project board stores its own tasks, while this
// row stores how that project appears on the parent board.
export const boardProjects = pgTable(
  'board_projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    parentBoardId: uuid('parent_board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    projectBoardId: uuid('project_board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 100 }).notNull(),
    section: varchar('section', { length: 100 }),
    position: integer('position').notNull().default(0),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    archivedAt: timestamp('archived_at'),
  },
  (table) => [
    uniqueIndex('board_projects_project_board_id_unique').on(table.projectBoardId),
    check('board_projects_distinct_boards_check', sql`${table.parentBoardId} <> ${table.projectBoardId}`),
  ]
);

export const boardProjectsRelations = relations(boardProjects, ({ one }) => ({
  parentBoard: one(boards, {
    fields: [boardProjects.parentBoardId],
    references: [boards.id],
    relationName: 'parentBoard',
  }),
  projectBoard: one(boards, {
    fields: [boardProjects.projectBoardId],
    references: [boards.id],
    relationName: 'projectBoard',
  }),
  createdByUser: one(users, {
    fields: [boardProjects.createdBy],
    references: [users.id],
  }),
}));

// Board access permissions
export const boardAccess = pgTable(
  'board_access',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
    accessLevel: accessLevelEnum('access_level').notNull().default('full'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    // Ensure either userId or teamId is set, not both
    check(
      'user_or_team_check',
      sql`(${table.userId} IS NOT NULL AND ${table.teamId} IS NULL) OR (${table.userId} IS NULL AND ${table.teamId} IS NOT NULL)`
    ),
  ]
);

export const boardAccessRelations = relations(boardAccess, ({ one }) => ({
  board: one(boards, {
    fields: [boardAccess.boardId],
    references: [boards.id],
  }),
  user: one(users, {
    fields: [boardAccess.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [boardAccess.teamId],
    references: [teams.id],
  }),
}));

// Rollup board sources - links rollup boards to their source boards
import { primaryKey } from 'drizzle-orm/pg-core';

export const rollupSources = pgTable(
  'rollup_sources',
  {
    rollupBoardId: uuid('rollup_board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    sourceBoardId: uuid('source_board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.rollupBoardId, table.sourceBoardId] }),
  ]
);

export const rollupSourcesRelations = relations(rollupSources, ({ one }) => ({
  rollupBoard: one(boards, {
    fields: [rollupSources.rollupBoardId],
    references: [boards.id],
    relationName: 'rollupBoard',
  }),
  sourceBoard: one(boards, {
    fields: [rollupSources.sourceBoardId],
    references: [boards.id],
    relationName: 'sourceBoard',
  }),
}));
