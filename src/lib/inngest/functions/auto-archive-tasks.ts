import { inngest } from '../client';
import { db } from '@/lib/db';
import { tasks, boards, siteSettings } from '@/lib/db/schema';
import { eq, and, inArray, isNull, lte } from 'drizzle-orm';
import { getCompleteStatusIds } from '@/lib/utils/status';
import type { SiteSettings } from '@/lib/db/schema/site-settings';
import { getOrgCutoffDate } from '@/lib/utils/timezone';

/**
 * Inngest cron function to auto-archive completed tasks
 * Runs daily at 3 AM
 */
export const autoArchiveTasks = inngest.createFunction(
  {
    id: 'auto-archive-tasks',
    retries: 3,
  },
  { cron: '0 3 * * *' },
  async ({ step }) => {
    // Step 1: Get site settings and check if auto-archive is enabled
    const settings = await step.run('get-settings', async () => {
      const rows = await db.select().from(siteSettings).limit(1);
      if (rows.length === 0) return null;
      return rows[0].settings as SiteSettings;
    });

    if (!settings?.autoArchiveDays) {
      return { skipped: true, reason: 'Auto-archive not configured' };
    }

    const days = settings.autoArchiveDays;
    const cutoffDate = getOrgCutoffDate(settings.timezone, days);

    // Step 2: Get all boards with their status options
    const allBoards = await step.run('get-boards', async () => {
      return await db.query.boards.findMany({
        columns: { id: true, statusOptions: true },
      });
    });

    // Step 3: Archive tasks per board
    let totalArchived = 0;
    await step.run('archive-tasks', async () => {
      const now = new Date();

      for (const board of allBoards) {
        const completeIds = getCompleteStatusIds(board.statusOptions ?? []);
        if (completeIds.length === 0) continue;

        // Find done parent tasks that haven't been updated since cutoff
        const doneTasks = await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(
            and(
              eq(tasks.boardId, board.id),
              inArray(tasks.status, completeIds),
              isNull(tasks.archivedAt),
              isNull(tasks.parentTaskId),
              lte(tasks.updatedAt, cutoffDate)
            )
          );

        if (doneTasks.length === 0) continue;

        const doneTaskIds = doneTasks.map((t) => t.id);

        // Archive parent tasks
        await db
          .update(tasks)
          .set({ archivedAt: now })
          .where(inArray(tasks.id, doneTaskIds));

        // Archive their subtasks
        await db
          .update(tasks)
          .set({ archivedAt: now })
          .where(inArray(tasks.parentTaskId, doneTaskIds));

        totalArchived += doneTaskIds.length;
      }
    });

    return { archived: totalArchived, days };
  }
);
