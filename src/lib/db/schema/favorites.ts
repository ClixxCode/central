import { pgTable, uuid, varchar, integer, timestamp, check } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';
import { boards } from './boards';

export const favoriteFolders = pgTable('favorite_folders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const favoriteFoldersRelations = relations(favoriteFolders, ({ one, many }) => ({
  user: one(users, {
    fields: [favoriteFolders.userId],
    references: [users.id],
  }),
  favorites: many(favorites),
}));

export const favorites = pgTable(
  'favorites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    entityType: varchar('entity_type', { length: 20 }).notNull(), // 'board' | 'rollup'
    entityId: uuid('entity_id').notNull(),
    folderId: uuid('folder_id').references(() => favoriteFolders.id, { onDelete: 'set null' }),
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
  folder: one(favoriteFolders, {
    fields: [favorites.folderId],
    references: [favoriteFolders.id],
  }),
}));

// Type for favorite with board details
export interface FavoriteWithDetails {
  id: string;
  entityType: 'board' | 'rollup';
  entityId: string;
  position: number;
  folderId: string | null;
  name: string;
  clientName?: string;
  clientSlug?: string;
  clientColor?: string;
  clientIcon?: string;
  boardType?: 'standard' | 'rollup' | 'personal';
  boardColor?: string;
  boardIcon?: string;
}

export interface FavoriteFolder {
  id: string;
  name: string;
  position: number;
}

export interface FavoritesData {
  folders: FavoriteFolder[];
  favorites: FavoriteWithDetails[];
}
