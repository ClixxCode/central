'use server';

import { db } from '@/lib/db';
import { siteSettings, type SiteSettings } from '@/lib/db/schema';
import { requireAuth } from '@/lib/auth/session';
import { eq } from 'drizzle-orm';

/**
 * Get site settings (creates default row if none exists)
 */
export async function getSiteSettings(): Promise<{
  success: boolean;
  data?: SiteSettings;
  error?: string;
}> {
  await requireAuth();

  const rows = await db.select().from(siteSettings).limit(1);

  if (rows.length === 0) {
    // Create default row
    const [row] = await db.insert(siteSettings).values({ settings: {} }).returning();
    return { success: true, data: row.settings };
  }

  return { success: true, data: rows[0].settings };
}

/**
 * Update site settings (admin only)
 */
export async function updateSiteSettings(input: Partial<SiteSettings>): Promise<{
  success: boolean;
  data?: SiteSettings;
  error?: string;
}> {
  const user = await requireAuth();

  if (user.role !== 'admin') {
    return { success: false, error: 'Admin access required' };
  }

  const rows = await db.select().from(siteSettings).limit(1);

  if (rows.length === 0) {
    // Create with provided settings
    const [row] = await db
      .insert(siteSettings)
      .values({ settings: input })
      .returning();
    return { success: true, data: row.settings };
  }

  // Merge with existing settings
  const current = rows[0];
  const merged: SiteSettings = { ...current.settings, ...input };

  const [updated] = await db
    .update(siteSettings)
    .set({ settings: merged, updatedAt: new Date() })
    .where(eq(siteSettings.id, current.id))
    .returning();

  return { success: true, data: updated.settings };
}
