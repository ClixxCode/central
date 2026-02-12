import { pgTable, uuid, jsonb, timestamp } from 'drizzle-orm/pg-core';

export interface SiteSettings {
  autoArchiveDays?: number | null;
  timezone?: string | null;
}

export const siteSettings = pgTable('site_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  settings: jsonb('settings').$type<SiteSettings>().default({}).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
