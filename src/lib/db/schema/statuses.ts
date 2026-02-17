import { pgTable, uuid, varchar, timestamp, integer, check } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// Global statuses table - shared across all boards
export const statuses = pgTable(
  'statuses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    label: varchar('label', { length: 100 }).notNull(),
    color: varchar('color', { length: 7 }).notNull(), // Hex color like #3B82F6
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    check('color_format_check', sql`${table.color} ~ '^#[0-9A-Fa-f]{6}$'`),
  ]
);

export const statusesRelations = relations(statuses, ({ }) => ({
  // Statuses can be referenced by tasks
}));

// Default statuses to seed
export const DEFAULT_STATUSES = [
  { label: 'Not Started', color: '#6B7280', position: 0 },
  { label: 'In Progress', color: '#3B82F6', position: 1 },
  { label: 'Blocked', color: '#EF4444', position: 2 },
  { label: 'In Review', color: '#F59E0B', position: 3 },
  { label: 'Complete', color: '#10B981', position: 4 },
] as const;
