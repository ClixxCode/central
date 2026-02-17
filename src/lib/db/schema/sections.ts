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
  { label: 'SEO', color: '#3B82F6', position: 0 },
  { label: 'Automation', color: '#A855F7', position: 1 },
  { label: 'Web Dev/Designer', color: '#14B8A6', position: 2 },
  { label: 'PPC / Paid Media', color: '#EF4444', position: 3 },
  { label: 'Organic Social Media', color: '#EAB308', position: 4 },
  { label: 'Media', color: '#22C55E', position: 5 },
  { label: 'Client Onboarding', color: '#6366F1', position: 6 },
  { label: 'SEO Onboarding', color: '#D946EF', position: 7 },
  { label: 'Initial Local Optimizations', color: '#8B5CF6', position: 8 },
  { label: 'Technical Onboarding', color: '#6B7FBF', position: 9 },
  { label: 'Admin', color: '#6B7280', position: 10 },
] as const;
