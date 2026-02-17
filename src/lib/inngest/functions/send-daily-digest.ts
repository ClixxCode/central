import { inngest } from '../client';
import { resend, EMAIL_CONFIG } from '@/lib/email/client';
import {
  dailyDigestEmailSubject,
  dailyDigestEmailHtml,
  type DigestTask,
  type DigestNotification,
} from '@/lib/email/templates';
import { db } from '@/lib/db';
import {
  notifications,
  users,
  tasks,
  boards,
  clients,
  taskAssignees,
  boardAccess,
  teamMembers,
  siteSettings,
} from '@/lib/db/schema';
import { eq, and, isNull, lt, lte, gte, inArray, or } from 'drizzle-orm';
import type { UserPreferences } from '@/lib/db/schema/users';
import type { SiteSettings } from '@/lib/db/schema/site-settings';
import { getOrgToday, getOrgTomorrow } from '@/lib/utils/timezone';

/**
 * Inngest function to send daily digest emails
 */
export const sendDailyDigest = inngest.createFunction(
  {
    id: 'send-daily-digest',
    retries: 3,
  },
  { event: 'notification/daily-digest.scheduled' },
  async ({ event, step }) => {
    const { data } = event;

    // Check user preferences
    const userPrefs = await step.run('check-preferences', async () => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, data.userId),
        columns: { preferences: true },
      });

      if (!user) return null;

      const prefs = user.preferences as UserPreferences | null;
      if (!prefs?.notifications?.email?.enabled) return null;

      // Only send if digest is set to daily
      if (prefs.notifications.email.digest !== 'daily') return null;

      return prefs;
    });

    if (!userPrefs) {
      return { skipped: true, reason: 'User preferences' };
    }

    // Load org timezone
    const orgTimezone = await step.run('get-timezone', async () => {
      const rows = await db.select().from(siteSettings).limit(1);
      if (rows.length === 0) return null;
      return (rows[0].settings as SiteSettings).timezone ?? null;
    });

    // Gather digest data
    const digestData = await step.run('gather-digest-data', async () => {
      const todayStr = getOrgToday(orgTimezone);
      const tomorrowStr = getOrgTomorrow(orgTimezone);

      // Get boards user has access to
      const accessibleBoardIds = await getAccessibleBoardIds(data.userId);

      if (accessibleBoardIds.length === 0) {
        return {
          tasksDueToday: [],
          tasksDueTomorrow: [],
          tasksOverdue: [],
          unreadNotifications: [],
        };
      }

      // Get tasks assigned to user
      const userAssignments = await db.query.taskAssignees.findMany({
        where: eq(taskAssignees.userId, data.userId),
        columns: { taskId: true },
      });

      const assignedTaskIds = userAssignments.map((a) => a.taskId);

      if (assignedTaskIds.length === 0) {
        return {
          tasksDueToday: [],
          tasksDueTomorrow: [],
          tasksOverdue: [],
          unreadNotifications: [],
        };
      }

      // Get tasks with board and client info
      const allTasks = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          status: tasks.status,
          dueDate: tasks.dueDate,
          boardId: tasks.boardId,
          boardName: boards.name,
          clientId: boards.clientId,
          clientName: clients.name,
          clientSlug: clients.slug,
        })
        .from(tasks)
        .innerJoin(boards, eq(boards.id, tasks.boardId))
        .innerJoin(clients, eq(clients.id, boards.clientId))
        .where(
          and(
            inArray(tasks.id, assignedTaskIds),
            inArray(tasks.boardId, accessibleBoardIds)
          )
        );

      // Categorize tasks
      const tasksDueToday: DigestTask[] = [];
      const tasksDueTomorrow: DigestTask[] = [];
      const tasksOverdue: DigestTask[] = [];

      for (const task of allTasks) {
        if (!task.dueDate) continue;

        // Skip completed tasks
        if (task.status.toLowerCase() === 'complete' || task.status.toLowerCase() === 'done') {
          continue;
        }

        const digestTask: DigestTask = {
          id: task.id,
          title: task.title,
          status: task.status,
          dueDate: task.dueDate,
          clientName: task.clientName,
          boardName: task.boardName,
          boardId: task.boardId,
          clientSlug: task.clientSlug,
        };

        if (task.dueDate === todayStr) {
          tasksDueToday.push(digestTask);
        } else if (task.dueDate === tomorrowStr) {
          tasksDueTomorrow.push(digestTask);
        } else if (task.dueDate < todayStr) {
          tasksOverdue.push(digestTask);
        }
      }

      // Get unread notifications from the past 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const recentNotifications = await db
        .select({
          id: notifications.id,
          type: notifications.type,
          title: notifications.title,
          taskId: notifications.taskId,
          createdAt: notifications.createdAt,
        })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, data.userId),
            isNull(notifications.readAt),
            gte(notifications.createdAt, yesterday)
          )
        );

      // Get task details for notifications
      const notificationTaskIds = recentNotifications
        .map((n) => n.taskId)
        .filter((id): id is string => id !== null);

      const notificationTasks = notificationTaskIds.length > 0
        ? await db
            .select({
              id: tasks.id,
              title: tasks.title,
              boardId: tasks.boardId,
              clientSlug: clients.slug,
            })
            .from(tasks)
            .innerJoin(boards, eq(boards.id, tasks.boardId))
            .innerJoin(clients, eq(clients.id, boards.clientId))
            .where(inArray(tasks.id, notificationTaskIds))
        : [];

      const taskMap = new Map(notificationTasks.map((t) => [t.id, t]));

      const unreadNotifications: DigestNotification[] = recentNotifications
        .filter((n) => n.type === 'mention' || n.type === 'task_assigned' || n.type === 'comment_added')
        .map((n) => {
          const task = n.taskId ? taskMap.get(n.taskId) : null;
          // Extract actor name from notification title
          const actorMatch = n.title.match(/^(.+?) (mentioned|assigned|commented)/);
          const actorName = actorMatch?.[1] || 'Someone';

          return {
            type: n.type as 'mention' | 'task_assigned' | 'comment_added',
            actorName,
            taskTitle: task?.title || 'Unknown task',
            taskId: n.taskId || '',
            boardId: task?.boardId || '',
            clientSlug: task?.clientSlug || '',
            createdAt: n.createdAt,
          };
        });

      return {
        tasksDueToday,
        tasksDueTomorrow,
        tasksOverdue,
        unreadNotifications,
      };
    });

    // Check if there's anything to send
    const hasContent =
      digestData.tasksDueToday.length > 0 ||
      digestData.tasksDueTomorrow.length > 0 ||
      digestData.tasksOverdue.length > 0 ||
      digestData.unreadNotifications.length > 0;

    if (!hasContent) {
      return { skipped: true, reason: 'No content for digest' };
    }

    // Send the email
    const emailResult = await step.run('send-email', async () => {
      const today = new Date();

      const result = await resend.emails.send({
        from: EMAIL_CONFIG.from,
        to: data.userEmail,
        subject: dailyDigestEmailSubject(today),
        html: await dailyDigestEmailHtml({
          recipientName: data.userName || 'there',
          date: today,
          tasksDueToday: digestData.tasksDueToday,
          tasksDueTomorrow: digestData.tasksDueTomorrow,
          tasksOverdue: digestData.tasksOverdue,
          unreadNotifications: digestData.unreadNotifications,
        }),
      });

      return result;
    });

    return {
      success: true,
      emailId: emailResult.data?.id,
      stats: {
        tasksDueToday: digestData.tasksDueToday.length,
        tasksDueTomorrow: digestData.tasksDueTomorrow.length,
        tasksOverdue: digestData.tasksOverdue.length,
        unreadNotifications: digestData.unreadNotifications.length,
      },
    };
  }
);

/**
 * Helper to get all board IDs a user has access to
 */
async function getAccessibleBoardIds(userId: string): Promise<string[]> {
  // Get direct board access
  const directAccess = await db.query.boardAccess.findMany({
    where: eq(boardAccess.userId, userId),
    columns: { boardId: true },
  });

  // Get team-based access
  const userTeams = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, userId),
    columns: { teamId: true },
  });

  const teamIds = userTeams.map((t) => t.teamId);
  const teamAccess = teamIds.length > 0
    ? await db.query.boardAccess.findMany({
        where: inArray(boardAccess.teamId, teamIds),
        columns: { boardId: true },
      })
    : [];

  const allBoardIds = new Set([
    ...directAccess.map((a) => a.boardId),
    ...teamAccess.map((a) => a.boardId),
  ]);

  return Array.from(allBoardIds);
}
