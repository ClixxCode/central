import { pgTable, uuid, varchar, timestamp, jsonb } from 'drizzle-orm/pg-core';
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
  links?: Array<{ name: string; url: string }>;
}

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  color: varchar('color', { length: 7 }), // Hex color #RRGGBB
  leadUserId: uuid('lead_user_id').references(() => users.id, { onDelete: 'set null' }),
  metadata: jsonb('metadata').$type<ClientMetadata>().default({}),
  createdBy: uuid('created_by').references(() => users.id),
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
  boards: many(boards),
}));
