'use server';

import { db } from '@/lib/db';
import { statuses, DEFAULT_STATUSES } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';

// Types
export interface Status {
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
 * List all global statuses
 */
export async function listStatuses(): Promise<ActionResult<Status[]>> {
  try {
    const allStatuses = await db.query.statuses.findMany({
      orderBy: [asc(statuses.position)],
    });

    return {
      success: true,
      data: allStatuses,
    };
  } catch (error) {
    console.error('listStatuses error:', error);
    return { success: false, error: 'Failed to list statuses' };
  }
}

/**
 * Create a new status (admin only)
 */
export async function createStatus(data: {
  label: string;
  color: string;
}): Promise<ActionResult<{ statusId: string }>> {
  try {
    await requireAdmin();

    if (!data.label.trim()) {
      return { success: false, error: 'Status label is required' };
    }

    if (!/^#[0-9A-Fa-f]{6}$/.test(data.color)) {
      return { success: false, error: 'Invalid color format. Use hex color like #3B82F6' };
    }

    // Get max position
    const existing = await db.query.statuses.findMany({
      orderBy: [asc(statuses.position)],
    });
    const maxPosition = existing.length > 0 ? Math.max(...existing.map((s) => s.position)) : -1;

    const [status] = await db
      .insert(statuses)
      .values({
        label: data.label.trim(),
        color: data.color,
        position: maxPosition + 1,
      })
      .returning();

    revalidatePath('/settings/statuses-sections');
    return { success: true, data: { statusId: status.id } };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('createStatus error:', error);
    return { success: false, error: 'Failed to create status' };
  }
}

/**
 * Update a status (admin only)
 */
export async function updateStatus(
  statusId: string,
  data: { label?: string; color?: string; position?: number }
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const existing = await db.query.statuses.findFirst({
      where: eq(statuses.id, statusId),
    });

    if (!existing) {
      return { success: false, error: 'Status not found' };
    }

    const updateData: Partial<typeof statuses.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.label !== undefined) {
      if (!data.label.trim()) {
        return { success: false, error: 'Status label is required' };
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

    await db.update(statuses).set(updateData).where(eq(statuses.id, statusId));

    revalidatePath('/settings/statuses-sections');
    return { success: true };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('updateStatus error:', error);
    return { success: false, error: 'Failed to update status' };
  }
}

/**
 * Delete a status (admin only)
 */
export async function deleteStatus(statusId: string): Promise<ActionResult> {
  try {
    await requireAdmin();

    const existing = await db.query.statuses.findFirst({
      where: eq(statuses.id, statusId),
    });

    if (!existing) {
      return { success: false, error: 'Status not found' };
    }

    await db.delete(statuses).where(eq(statuses.id, statusId));

    revalidatePath('/settings/statuses-sections');
    return { success: true };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('deleteStatus error:', error);
    return { success: false, error: 'Failed to delete status' };
  }
}

/**
 * Reorder statuses (admin only)
 */
export async function reorderStatuses(statusIds: string[]): Promise<ActionResult> {
  try {
    await requireAdmin();

    // Update positions based on array order
    for (let i = 0; i < statusIds.length; i++) {
      await db
        .update(statuses)
        .set({ position: i, updatedAt: new Date() })
        .where(eq(statuses.id, statusIds[i]));
    }

    revalidatePath('/settings/statuses-sections');
    return { success: true };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('reorderStatuses error:', error);
    return { success: false, error: 'Failed to reorder statuses' };
  }
}

/**
 * Seed default statuses if none exist (admin only)
 */
export async function seedDefaultStatuses(): Promise<ActionResult> {
  try {
    await requireAdmin();

    const existing = await db.query.statuses.findMany();
    if (existing.length > 0) {
      return { success: false, error: 'Statuses already exist' };
    }

    await db.insert(statuses).values(
      DEFAULT_STATUSES.map((s) => ({
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
    console.error('seedDefaultStatuses error:', error);
    return { success: false, error: 'Failed to seed default statuses' };
  }
}
