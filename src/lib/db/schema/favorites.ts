import { pgTable, uuid, varchar, integer, timestamp, check } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';
import { boards } from './boards';

export const favorites = pgTable(
  'favorites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    entityType: varchar('entity_type', { length: 20 }).notNull(), // 'board' | 'rollup'
    entityId: uuid('entity_id').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    check(
      'valid_entity_type',
      sql`${table.entityType} IN ('board', 'rollup')`
    ),
  ]
);

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, {
    fields: [favorites.userId],
    references: [users.id],
  }),
  board: one(boards, {
    fields: [favorites.entityId],
    references: [boards.id],
  }),
}));

// Type for favorite with board details
export interface FavoriteWithDetails {
  id: string;
  entityType: 'board' | 'rollup';
  entityId: string;
  position: number;
  name: string;
  clientName?: string;
  clientSlug?: string;
  clientColor?: string;
  clientIcon?: string;
}
