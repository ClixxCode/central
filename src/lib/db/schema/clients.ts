import { pgTable, uuid, varchar, text, timestamp, jsonb, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { boards } from './boards';

// A reflected Pulse account-team member (Pulse is the system of record).
// Carries everything needed to render a thumbnail without resolving a Central
// user — name + avatar come straight from the Pulse snapshot.
export interface AccountTeamMember {
  staff_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  position: string | null;
  is_primary: boolean;
  group: 'management' | 'delivery';
}

// Client metadata type for flexible additional information
export interface ClientMetadata {
  industry?: string;
  website?: string;
  phone?: string;
  address?: string;
  notes?: string;
  tags?: string[];
  customFields?: Record<string, string | number | boolean>;
  leads?: Array<{ role: string; userId: string }>;
  links?: Array<{ name: string; url: string; showOnCard?: boolean }>;
  slackChannelUrl?: string;
}

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  color: varchar('color', { length: 7 }), // Hex color #RRGGBB
  icon: varchar('icon', { length: 100 }), // Material Symbols icon name
  leadUserId: uuid('lead_user_id').references(() => users.id, { onDelete: 'set null' }),
  defaultBoardId: uuid('default_board_id').references((): AnyPgColumn => boards.id, { onDelete: 'set null' }),
  metadata: jsonb('metadata').$type<ClientMetadata>().default({}),
  // Reflected Pulse account state (Pulse → Central, one-way). Kept in sync by
  // /api/webhooks/pulse/account-updated.
  pulseAccountId: uuid('pulse_account_id'),
  accountStatus: varchar('account_status', { length: 32 }),
  accountType: varchar('account_type', { length: 32 }),
  podName: varchar('pod_name', { length: 64 }),
  podSubContext: text('pod_sub_context'),
  accountTeam: jsonb('account_team').$type<AccountTeamMember[]>().notNull().default([]),
  // Reflected active service names from Pulse (consolidated reference only;
  // full service detail lives in Pulse). Distinct active service_name values.
  accountServices: jsonb('account_services').$type<string[]>().notNull().default([]),
  pulseSyncedAt: timestamp('pulse_synced_at'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const clientsRelations = relations(clients, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [clients.createdBy],
    references: [users.id],
  }),
  leadUser: one(users, {
    fields: [clients.leadUserId],
    references: [users.id],
  }),
  defaultBoard: one(boards, {
    fields: [clients.defaultBoardId],
    references: [boards.id],
    relationName: 'defaultBoard',
  }),
  boards: many(boards),
}));
