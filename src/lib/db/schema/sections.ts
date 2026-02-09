import { pgTable, uuid, varchar, timestamp, integer, check } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// Global sections table - shared across all boards
export const sections = pgTable(
  'sections',
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

export const sectionsRelations = relations(sections, ({ }) => ({
  // Sections can be referenced by tasks
}));

// Default sections to seed (agency workflow based)
export const DEFAULT_SECTIONS = [
  { label: 'Strategy', color: '#8B5CF6', position: 0 },
  { label: 'Creative', color: '#EC4899', position: 1 },
  { label: 'Development', color: '#3B82F6', position: 2 },
  { label: 'Review', color: '#F59E0B', position: 3 },
  { label: 'Deployment', color: '#10B981', position: 4 },
] as const;
