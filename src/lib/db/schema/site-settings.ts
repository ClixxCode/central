import { pgTable, uuid, jsonb, timestamp } from 'drizzle-orm/pg-core';

export interface SiteSettings {
  autoArchiveDays?: number | null;
  timezone?: string | null;
}

export const DEFAULT_AUTO_ARCHIVE_DAYS = 30;

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  autoArchiveDays: DEFAULT_AUTO_ARCHIVE_DAYS,
};

export function applySiteSettingsDefaults(
  settings: SiteSettings | null | undefined
): SiteSettings {
  return {
    ...DEFAULT_SITE_SETTINGS,
    ...settings,
  };
}

export const siteSettings = pgTable('site_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  settings: jsonb('settings').$type<SiteSettings>().default({}).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
