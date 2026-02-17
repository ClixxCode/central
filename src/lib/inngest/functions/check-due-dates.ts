import { inngest } from '../client';
import { db } from '@/lib/db';
import { tasks, taskAssignees, users, boards, clients, siteSettings } from '@/lib/db/schema';
import { eq, and, inArray, lt, lte, isNull } from 'drizzle-orm';
import type { UserPreferences } from '@/lib/db/schema/users';
import type { SiteSettings } from '@/lib/db/schema/site-settings';
import { createDueNotification } from '@/lib/actions/notifications';
import { getOrgToday, getOrgTomorrow } from '@/lib/utils/timezone';

/**
 * Inngest cron function to check for tasks that are due soon or overdue
 * Runs daily at 8 AM
 */
export const checkDueDates = inngest.createFunction(
  {
    id: 'check-due-dates',
    retries: 3,
  },
  { cron: '0 8 * * *' }, // Every day at 8 AM
  async ({ step }) => {
    // Load org timezone from site settings
    const orgTimezone = await step.run('get-timezone', async () => {
      const rows = await db.select().from(siteSettings).limit(1);
      if (rows.length === 0) return null;
      return (rows[0].settings as SiteSettings).timezone ?? null;
    });

    const todayStr = getOrgToday(orgTimezone);
    const tomorrowStr = getOrgTomorrow(orgTimezone);

    // Get tasks that are due today, tomorrow, or overdue
    const dueTasks = await step.run('get-due-tasks', async () => {
      return await db
        .select({
          taskId: tasks.id,
          taskTitle: tasks.title,
          dueDate: tasks.dueDate,
          status: tasks.status,
          boardId: tasks.boardId,
        })
        .from(tasks)
        .where(
          and(
            lte(tasks.dueDate, tomorrowStr),
            isNull(tasks.archivedAt)
          )
        );
    });

    if (dueTasks.length === 0) {
      return { processed: 0 };
    }

    // Filter out completed tasks
    const incompleteTasks = dueTasks.filter(
      (t) => t.status.toLowerCase() !== 'complete' && t.status.toLowerCase() !== 'done'
    );

    if (incompleteTasks.length === 0) {
      return { processed: 0 };
    }

    // Get assignees for these tasks
    const taskIds = incompleteTasks.map((t) => t.taskId);
    const assignees = await step.run('get-assignees', async () => {
      return await db
        .select({
          taskId: taskAssignees.taskId,
          userId: taskAssignees.userId,
        })
        .from(taskAssignees)
        .where(inArray(taskAssignees.taskId, taskIds));
    });

    // Group assignees by task
    const assigneesByTask = new Map<string, string[]>();
    for (const a of assignees) {
      if (!assigneesByTask.has(a.taskId)) {
        assigneesByTask.set(a.taskId, []);
      }
      assigneesByTask.get(a.taskId)!.push(a.userId);
    }

    // Get users who want due date notifications
    const allUserIds = new Set(assignees.map((a) => a.userId));
    const usersWithPrefs = await step.run('get-user-preferences', async () => {
      return await db.query.users.findMany({
        where: inArray(users.id, Array.from(allUserIds)),
        columns: { id: true, preferences: true },
      });
    });

    // Filter users who want due date notifications
    const usersWantingNotifications = usersWithPrefs.filter((u) => {
      const prefs = u.preferences as UserPreferences | null;
      return prefs?.notifications?.email?.enabled && prefs?.notifications?.email?.dueDates;
    });

    const userIdsWantingNotifications = new Set(usersWantingNotifications.map((u) => u.id));

    // Create notifications for each due/overdue task
    let notificationCount = 0;
    await step.run('create-notifications', async () => {
      for (const task of incompleteTasks) {
        const taskAssigneeIds = assigneesByTask.get(task.taskId) || [];
        const isOverdue = task.dueDate! < todayStr;
        const isDueToday = task.dueDate === todayStr;
        const isDueTomorrow = task.dueDate === tomorrowStr;

        // Only notify for overdue or due today
        if (!isOverdue && !isDueToday) continue;

        for (const userId of taskAssigneeIds) {
          if (!userIdsWantingNotifications.has(userId)) continue;

          await createDueNotification({
            userId,
            taskId: task.taskId,
            isOverdue,
          });
          notificationCount++;
        }
      }
    });

    return {
      processed: notificationCount,
      tasksChecked: incompleteTasks.length,
    };
  }
);

/**
 * Inngest cron function to send daily digest emails
 * Runs daily at 7 AM (before due date check)
 */
export const scheduleDailyDigests = inngest.createFunction(
  {
    id: 'schedule-daily-digests',
    retries: 3,
  },
  { cron: '0 7 * * *' }, // Every day at 7 AM
  async ({ step }) => {
    // Get all users who want daily digest
    const usersWithDigest = await step.run('get-users', async () => {
      const allUsers = await db.query.users.findMany({
        columns: { id: true, email: true, name: true, preferences: true },
      });

      return allUsers.filter((u) => {
        const prefs = u.preferences as UserPreferences | null;
        return prefs?.notifications?.email?.enabled && prefs?.notifications?.email?.digest === 'daily';
      });
    });

    if (usersWithDigest.length === 0) {
      return { sent: 0 };
    }

    // Send digest events for each user
    await step.run('send-digest-events', async () => {
      for (const user of usersWithDigest) {
        await inngest.send({
          name: 'notification/daily-digest.scheduled',
          data: {
            userId: user.id,
            userEmail: user.email,
            userName: user.name,
          },
        });
      }
    });

    return { sent: usersWithDigest.length };
  }
);
