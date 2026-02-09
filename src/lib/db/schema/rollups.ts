import { pgTable, uuid, timestamp, boolean, check, pgEnum } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';
import { teams } from './teams';
import { boards } from './boards';

// Enum for rollup invitation status
export const rollupInvitationStatusEnum = pgEnum('rollup_invitation_status', [
  'pending',
  'accepted',
  'declined',
]);

// Rollup owners - tracks ownership of rollup boards
export const rollupOwners = pgTable('rollup_owners', {
  id: uuid('id').primaryKey().defaultRandom(),
  rollupBoardId: uuid('rollup_board_id')
    .notNull()
    .references(() => boards.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const rollupOwnersRelations = relations(rollupOwners, ({ one }) => ({
  rollupBoard: one(boards, {
    fields: [rollupOwners.rollupBoardId],
    references: [boards.id],
  }),
  user: one(users, {
    fields: [rollupOwners.userId],
    references: [users.id],
  }),
}));

// Rollup invitations - invitations to share rollups with users/teams
export const rollupInvitations = pgTable(
  'rollup_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rollupBoardId: uuid('rollup_board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    // Invite a specific user
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    // Or invite a team
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
    // Or invite all users (admin only) - automatically includes future users, excludes contractors
    allUsers: boolean('all_users').notNull().default(false),
    status: rollupInvitationStatusEnum('status').notNull().default('pending'),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id),
    respondedAt: timestamp('responded_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    // Ensure exactly one of userId, teamId, or allUsers is set
    check(
      'invite_target_check',
      sql`(
        (${table.userId} IS NOT NULL AND ${table.teamId} IS NULL AND ${table.allUsers} = false) OR
        (${table.userId} IS NULL AND ${table.teamId} IS NOT NULL AND ${table.allUsers} = false) OR
        (${table.userId} IS NULL AND ${table.teamId} IS NULL AND ${table.allUsers} = true)
      )`
    ),
  ]
);

export const rollupInvitationsRelations = relations(rollupInvitations, ({ one }) => ({
  rollupBoard: one(boards, {
    fields: [rollupInvitations.rollupBoardId],
    references: [boards.id],
  }),
  user: one(users, {
    fields: [rollupInvitations.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [rollupInvitations.teamId],
    references: [teams.id],
  }),
  invitedByUser: one(users, {
    fields: [rollupInvitations.invitedBy],
    references: [users.id],
  }),
}));
