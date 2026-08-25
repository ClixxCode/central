import {
  boolean,
  check,
  jsonb,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';
import { teams } from './teams';
import { boards } from './boards';

export type SavedViewFilterMode = 'is' | 'is_not';

/** Statuses and sections are persisted by label so equivalent board options survive ID changes. */
export interface SavedViewFilters {
  statusLabels?: string[];
  statusMode?: SavedViewFilterMode;
  sectionLabels?: string[];
  includeNoSection?: boolean;
  sectionMode?: SavedViewFilterMode;
  assigneeIds?: string[];
  assigneeMode?: SavedViewFilterMode;
  overdue?: boolean;
}

export interface SavedViewPresentation {
  layout: 'swimlane' | 'kanban' | 'table';
  sort: {
    field: 'position' | 'dueDate' | 'title' | 'status' | 'client';
    direction: 'asc' | 'desc';
  };
  tableColumns: {
    title: boolean;
    status: boolean;
    section: boolean;
    assignees: boolean;
    dueDate: boolean;
    source: boolean;
  };
  cardFields: {
    section: boolean;
    dueDate: boolean;
    assignees: boolean;
  };
}

export const defaultSavedViewPresentation: SavedViewPresentation = {
  layout: 'swimlane',
  sort: { field: 'position', direction: 'asc' },
  tableColumns: {
    title: true,
    status: true,
    section: true,
    assignees: true,
    dueDate: true,
    source: true,
  },
  cardFields: { section: true, dueDate: true, assignees: true },
};

export const savedViewInvitationStatusEnum = pgEnum('saved_view_invitation_status', [
  'pending',
  'accepted',
  'declined',
]);

export const savedViews = pgTable('saved_views', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  filters: jsonb('filters').$type<SavedViewFilters>().notNull().default({}),
  presentation: jsonb('presentation')
    .$type<SavedViewPresentation>()
    .notNull()
    .default(defaultSavedViewPresentation),
  reviewModeEnabled: boolean('review_mode_enabled').notNull().default(false),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [index('saved_views_created_by_idx').on(table.createdBy)]);

export const savedViewSources = pgTable(
  'saved_view_sources',
  {
    viewId: uuid('view_id')
      .notNull()
      .references(() => savedViews.id, { onDelete: 'cascade' }),
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.viewId, table.boardId] }),
    index('saved_view_sources_board_idx').on(table.boardId),
  ]
);

export const savedViewOwners = pgTable('saved_view_owners', {
  id: uuid('id').primaryKey().defaultRandom(),
  viewId: uuid('view_id')
    .notNull()
    .references(() => savedViews.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('saved_view_owners_view_user_idx').on(table.viewId, table.userId),
  index('saved_view_owners_user_idx').on(table.userId),
]);

export const savedViewInvitations = pgTable(
  'saved_view_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    viewId: uuid('view_id')
      .notNull()
      .references(() => savedViews.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
    allUsers: boolean('all_users').notNull().default(false),
    status: savedViewInvitationStatusEnum('status').notNull().default('pending'),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id),
    respondedAt: timestamp('responded_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    check(
      'saved_view_invite_target_check',
      sql`(
        (${table.userId} IS NOT NULL AND ${table.teamId} IS NULL AND ${table.allUsers} = false) OR
        (${table.userId} IS NULL AND ${table.teamId} IS NOT NULL AND ${table.allUsers} = false) OR
        (${table.userId} IS NULL AND ${table.teamId} IS NULL AND ${table.allUsers} = true)
      )`
    ),
    index('saved_view_invitations_view_idx').on(table.viewId),
    index('saved_view_invitations_user_idx').on(table.userId),
    index('saved_view_invitations_team_idx').on(table.teamId),
  ]
);

export const savedViewsRelations = relations(savedViews, ({ one, many }) => ({
  creator: one(users, { fields: [savedViews.createdBy], references: [users.id] }),
  sources: many(savedViewSources),
  owners: many(savedViewOwners),
  invitations: many(savedViewInvitations),
}));

export const savedViewSourcesRelations = relations(savedViewSources, ({ one }) => ({
  view: one(savedViews, { fields: [savedViewSources.viewId], references: [savedViews.id] }),
  board: one(boards, { fields: [savedViewSources.boardId], references: [boards.id] }),
}));

export const savedViewOwnersRelations = relations(savedViewOwners, ({ one }) => ({
  view: one(savedViews, { fields: [savedViewOwners.viewId], references: [savedViews.id] }),
  user: one(users, { fields: [savedViewOwners.userId], references: [users.id] }),
}));

export const savedViewInvitationsRelations = relations(savedViewInvitations, ({ one }) => ({
  view: one(savedViews, { fields: [savedViewInvitations.viewId], references: [savedViews.id] }),
  user: one(users, { fields: [savedViewInvitations.userId], references: [users.id] }),
  team: one(teams, { fields: [savedViewInvitations.teamId], references: [teams.id] }),
  invitedByUser: one(users, {
    fields: [savedViewInvitations.invitedBy],
    references: [users.id],
  }),
}));
