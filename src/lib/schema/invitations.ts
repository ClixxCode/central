import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { teams } from './teams';
import { userRoleEnum } from './enums';

export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull(),
  invitedBy: uuid('invited_by')
    .notNull()
    .references(() => users.id),
  role: userRoleEnum('role').notNull().default('user'),
  teamId: uuid('team_id').references(() => teams.id),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const invitationsRelations = relations(invitations, ({ one }) => ({
  invitedByUser: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [invitations.teamId],
    references: [teams.id],
  }),
}));
