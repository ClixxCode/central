import { pgTable, uuid, varchar, timestamp, jsonb, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { boards } from './boards';

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
