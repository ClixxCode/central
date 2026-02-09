'use server';

import { db } from '@/lib/db';
import { taskViews } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/session';

/**
 * Record that the current user has viewed a task
 * Upserts the view timestamp
 */
export async function recordTaskView(taskId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    // Upsert the view record
    await db
      .insert(taskViews)
      .values({
        taskId,
        userId: user.id,
        viewedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [taskViews.taskId, taskViews.userId],
        set: {
          viewedAt: new Date(),
        },
      });

    return { success: true };
  } catch (error) {
    console.error('Failed to record task view:', error);
    return { success: false, error: 'Failed to record task view' };
  }
}

/**
 * Get when a user last viewed a task
 * Returns null if never viewed
 */
export async function getTaskViewTimestamp(
  taskId: string,
  userId?: string
): Promise<{
  success: boolean;
  viewedAt?: Date | null;
  error?: string;
}> {
  try {
    const user = await requireAuth();
    const targetUserId = userId ?? user.id;

    const view = await db.query.taskViews.findFirst({
      where: and(
        eq(taskViews.taskId, taskId),
        eq(taskViews.userId, targetUserId)
      ),
    });

    return { success: true, viewedAt: view?.viewedAt ?? null };
  } catch (error) {
    console.error('Failed to get task view timestamp:', error);
    return { success: false, error: 'Failed to get task view timestamp' };
  }
}

/**
 * Get view timestamps for multiple tasks for the current user
 * Returns a map of taskId -> viewedAt
 */
export async function getTaskViewTimestamps(
  taskIds: string[]
): Promise<{
  success: boolean;
  views?: Map<string, Date>;
  error?: string;
}> {
  try {
    if (taskIds.length === 0) {
      return { success: true, views: new Map() };
    }

    const user = await requireAuth();

    const { inArray } = await import('drizzle-orm');

    const viewRecords = await db
      .select({
        taskId: taskViews.taskId,
        viewedAt: taskViews.viewedAt,
      })
      .from(taskViews)
      .where(
        and(
          inArray(taskViews.taskId, taskIds),
          eq(taskViews.userId, user.id)
        )
      );

    const views = new Map<string, Date>();
    for (const record of viewRecords) {
      views.set(record.taskId, record.viewedAt);
    }

    return { success: true, views };
  } catch (error) {
    console.error('Failed to get task view timestamps:', error);
    return { success: false, error: 'Failed to get task view timestamps' };
  }
}
