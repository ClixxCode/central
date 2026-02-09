'use server';

import { db } from '@/lib/db';
import { sections, DEFAULT_SECTIONS } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';

// Types
export interface Section {
  id: string;
  label: string;
  color: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActionResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * List all global sections
 */
export async function listSections(): Promise<ActionResult<Section[]>> {
  try {
    const allSections = await db.query.sections.findMany({
      orderBy: [asc(sections.position)],
    });

    return {
      success: true,
      data: allSections,
    };
  } catch (error) {
    console.error('listSections error:', error);
    return { success: false, error: 'Failed to list sections' };
  }
}

/**
 * Create a new section (admin only)
 */
export async function createSection(data: {
  label: string;
  color: string;
}): Promise<ActionResult<{ sectionId: string }>> {
  try {
    await requireAdmin();

    if (!data.label.trim()) {
      return { success: false, error: 'Section label is required' };
    }

    if (!/^#[0-9A-Fa-f]{6}$/.test(data.color)) {
      return { success: false, error: 'Invalid color format. Use hex color like #3B82F6' };
    }

    // Get max position
    const existing = await db.query.sections.findMany({
      orderBy: [asc(sections.position)],
    });
    const maxPosition = existing.length > 0 ? Math.max(...existing.map((s) => s.position)) : -1;

    const [section] = await db
      .insert(sections)
      .values({
        label: data.label.trim(),
        color: data.color,
        position: maxPosition + 1,
      })
      .returning();

    revalidatePath('/settings/statuses-sections');
    return { success: true, data: { sectionId: section.id } };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('createSection error:', error);
    return { success: false, error: 'Failed to create section' };
  }
}

/**
 * Update a section (admin only)
 */
export async function updateSection(
  sectionId: string,
  data: { label?: string; color?: string; position?: number }
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const existing = await db.query.sections.findFirst({
      where: eq(sections.id, sectionId),
    });

    if (!existing) {
      return { success: false, error: 'Section not found' };
    }

    const updateData: Partial<typeof sections.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.label !== undefined) {
      if (!data.label.trim()) {
        return { success: false, error: 'Section label is required' };
      }
      updateData.label = data.label.trim();
    }

    if (data.color !== undefined) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(data.color)) {
        return { success: false, error: 'Invalid color format. Use hex color like #3B82F6' };
      }
      updateData.color = data.color;
    }

    if (data.position !== undefined) {
      updateData.position = data.position;
    }

    await db.update(sections).set(updateData).where(eq(sections.id, sectionId));

    revalidatePath('/settings/statuses-sections');
    return { success: true };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('updateSection error:', error);
    return { success: false, error: 'Failed to update section' };
  }
}

/**
 * Delete a section (admin only)
 */
export async function deleteSection(sectionId: string): Promise<ActionResult> {
  try {
    await requireAdmin();

    const existing = await db.query.sections.findFirst({
      where: eq(sections.id, sectionId),
    });

    if (!existing) {
      return { success: false, error: 'Section not found' };
    }

    await db.delete(sections).where(eq(sections.id, sectionId));

    revalidatePath('/settings/statuses-sections');
    return { success: true };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('deleteSection error:', error);
    return { success: false, error: 'Failed to delete section' };
  }
}

/**
 * Reorder sections (admin only)
 */
export async function reorderSections(sectionIds: string[]): Promise<ActionResult> {
  try {
    await requireAdmin();

    // Update positions based on array order
    for (let i = 0; i < sectionIds.length; i++) {
      await db
        .update(sections)
        .set({ position: i, updatedAt: new Date() })
        .where(eq(sections.id, sectionIds[i]));
    }

    revalidatePath('/settings/statuses-sections');
    return { success: true };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('reorderSections error:', error);
    return { success: false, error: 'Failed to reorder sections' };
  }
}

/**
 * Seed default sections if none exist (admin only)
 */
export async function seedDefaultSections(): Promise<ActionResult> {
  try {
    await requireAdmin();

    const existing = await db.query.sections.findMany();
    if (existing.length > 0) {
      return { success: false, error: 'Sections already exist' };
    }

    await db.insert(sections).values(
      DEFAULT_SECTIONS.map((s) => ({
        label: s.label,
        color: s.color,
        position: s.position,
      }))
    );

    revalidatePath('/settings/statuses-sections');
    return { success: true };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('seedDefaultSections error:', error);
    return { success: false, error: 'Failed to seed default sections' };
  }
}
