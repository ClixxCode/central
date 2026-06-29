import { and, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import {
  claimAsyncJob,
  completeAsyncJob,
  enqueueAsyncJob,
  failAsyncJob,
  skipAsyncJob,
  type AsyncJob,
  type AsyncJobClaimMissReason,
} from '@/lib/async-jobs';
import { createDueNotification } from '@/lib/actions/notifications';
import { db } from '@/lib/db';
import {
  boardAccess,
  boards,
  clients,
  notifications,
  siteSettings,
  taskAssignees,
  tasks,
  teamMembers,
  users,
} from '@/lib/db/schema';
import {
  applySiteSettingsDefaults,
  type SiteSettings,
} from '@/lib/db/schema/site-settings';
import type { UserPreferences } from '@/lib/db/schema/users';
import { getAppUrl } from '@/lib/email/client';
import { sendCentralTemplateEmail } from '@/lib/email/send-template';
import {
  CENTRAL_EMAIL_TEMPLATE_ALIASES,
  dailyDigestEmailSubject,
  formatEmailDate,
  type DigestNotification,
  type DigestTask,
} from '@/lib/email/templates';
import { inngest } from '@/lib/inngest/client';
import {
  AUTO_ARCHIVE_JOB_KIND,
  DAILY_DIGEST_DELIVERY_JOB_KIND,
  DAILY_DIGEST_SCHEDULE_JOB_KIND,
  DUE_DATE_SCAN_JOB_KIND,
  DUE_NOTIFICATION_CREATION_JOB_KIND,
} from '@/lib/queues/background-jobs';
import {
  enqueueDailyDigestDelivery,
  getAutoArchiveDedupeKey,
  getDailyDigestDeliveryDedupeKey,
  getDailyDigestScheduleDedupeKey,
  getDueDateScanDedupeKey,
  getDueNotificationCreationDedupeKey,
  shouldDispatchBackgroundJobsViaInngest,
  shouldDispatchBackgroundJobsViaQueue,
  type DailyDigestDeliveryData,
} from '@/lib/queues/background-jobs';
import { getCompleteStatusIds } from '@/lib/utils/status';
import { getOrgCutoffDate, getOrgToday } from '@/lib/utils/timezone';

export type BackgroundJobRunnerId = 'inngest' | 'vercel-queue' | (string & {});

export type BackgroundJobProcessorOptions = {
  runnerId: BackgroundJobRunnerId;
};

export type BackgroundJobResult =
  | {
      status: 'completed';
      jobId: string;
      dedupeKey: string;
      summary: Record<string, unknown>;
    }
  | {
      status: 'skipped';
      jobId?: string;
      dedupeKey: string;
      reason: string;
      claimMissReason?: AsyncJobClaimMissReason;
    };

type ClaimedBackgroundJobInput = {
  dedupeKey: string;
  kind: string;
  payload: Record<string, unknown>;
  runnerId: BackgroundJobRunnerId;
};

type DueNotificationCreationInput = {
  userId: string;
  taskId: string;
  notificationType: 'task_due_soon' | 'task_overdue';
  dueDate: string;
};

export async function getCurrentOrgDate(): Promise<string> {
  return getOrgToday(await getOrgTimezone());
}

export async function processDailyDigestSchedule(
  input: { orgDate: string },
  options: BackgroundJobProcessorOptions
): Promise<BackgroundJobResult> {
  const dedupeKey = getDailyDigestScheduleDedupeKey(input.orgDate);

  return runClaimedBackgroundJob(
    {
      dedupeKey,
      kind: DAILY_DIGEST_SCHEDULE_JOB_KIND,
      payload: { orgDate: input.orgDate },
      runnerId: options.runnerId,
    },
    async (job) => {
      const allUsers = await db.query.users.findMany({
        columns: { id: true, email: true, name: true, preferences: true },
      });
      const usersWithDigest = allUsers.filter((user) => {
        const prefs = user.preferences as UserPreferences | null;
        return (
          prefs?.notifications?.email?.enabled &&
          prefs.notifications.email.digest === 'daily'
        );
      });

      let inngestEvents = 0;
      let queueMessages = 0;

      for (const user of usersWithDigest) {
        const data: DailyDigestDeliveryData = {
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          orgDate: input.orgDate,
        };

        if (shouldDispatchBackgroundJobsViaInngest()) {
          await inngest.send({
            name: 'notification/daily-digest.scheduled',
            data,
          });
          inngestEvents++;
        }

        if (shouldDispatchBackgroundJobsViaQueue()) {
          await enqueueDailyDigestDelivery(data);
          queueMessages++;
        }
      }

      await completeAsyncJob({ dedupeKey: job.dedupeKey, claimedBy: options.runnerId });

      return {
        status: 'completed',
        jobId: job.id,
        dedupeKey,
        summary: {
          users: usersWithDigest.length,
          inngestEvents,
          queueMessages,
        },
      };
    }
  );
}

export async function processDailyDigestDelivery(
  data: DailyDigestDeliveryData,
  options: BackgroundJobProcessorOptions
): Promise<BackgroundJobResult> {
  const dedupeKey = getDailyDigestDeliveryDedupeKey(data.userId, data.orgDate);

  return runClaimedBackgroundJob(
    {
      dedupeKey,
      kind: DAILY_DIGEST_DELIVERY_JOB_KIND,
      payload: { ...data },
      runnerId: options.runnerId,
    },
    async (job) => {
      const userPrefs = await getDailyDigestPreferences(data.userId);
      if (!userPrefs) {
        return skipClaimedBackgroundJob(job, options.runnerId, 'User preferences');
      }

      const digestData = await gatherDailyDigestData({
        userId: data.userId,
        orgDate: data.orgDate,
      });
      const stats = {
        tasksDueToday: digestData.tasksDueToday.length,
        tasksDueTomorrow: digestData.tasksDueTomorrow.length,
        tasksOverdue: digestData.tasksOverdue.length,
        unreadNotifications: digestData.unreadNotifications.length,
      };
      const hasContent = Object.values(stats).some((count) => count > 0);

      if (!hasContent) {
        return skipClaimedBackgroundJob(job, options.runnerId, 'No content for digest');
      }

      const digestDate = new Date(`${data.orgDate}T00:00:00Z`);
      const emailResult = await sendCentralTemplateEmail({
        templateAlias: CENTRAL_EMAIL_TEMPLATE_ALIASES.dailyDigest,
        to: data.userEmail,
        subject: dailyDigestEmailSubject(digestDate),
        variables: {
          RECIPIENT_NAME: data.userName || 'there',
          DIGEST_DATE: formatEmailDate(digestDate),
          SUMMARY_TEXT: buildDigestSummary(stats),
          TASKS_OVERDUE_COUNT: stats.tasksOverdue,
          TASKS_DUE_TODAY_COUNT: stats.tasksDueToday,
          TASKS_DUE_TOMORROW_COUNT: stats.tasksDueTomorrow,
          UNREAD_NOTIFICATIONS_COUNT: stats.unreadNotifications,
          CTA_URL: `${getAppUrl()}/my-tasks`,
        },
      });

      await completeAsyncJob({ dedupeKey: job.dedupeKey, claimedBy: options.runnerId });

      return {
        status: 'completed',
        jobId: job.id,
        dedupeKey,
        summary: {
          emailId: emailResult.data?.id,
          ...stats,
        },
      };
    }
  );
}

export async function processDueDateScan(
  input: { orgDate: string },
  options: BackgroundJobProcessorOptions
): Promise<BackgroundJobResult> {
  const dedupeKey = getDueDateScanDedupeKey(input.orgDate);

  return runClaimedBackgroundJob(
    {
      dedupeKey,
      kind: DUE_DATE_SCAN_JOB_KIND,
      payload: { orgDate: input.orgDate },
      runnerId: options.runnerId,
    },
    async (job) => {
      const tomorrowStr = addOrgDateDays(input.orgDate, 1);
      const dueTasks = await db
        .select({
          taskId: tasks.id,
          dueDate: tasks.dueDate,
          status: tasks.status,
        })
        .from(tasks)
        .where(and(lte(tasks.dueDate, tomorrowStr), isNull(tasks.archivedAt)));

      const incompleteTasks = dueTasks.filter((task) => {
        const status = task.status.toLowerCase();
        return status !== 'complete' && status !== 'done';
      });

      if (incompleteTasks.length === 0) {
        await completeAsyncJob({ dedupeKey: job.dedupeKey, claimedBy: options.runnerId });
        return {
          status: 'completed',
          jobId: job.id,
          dedupeKey,
          summary: { processed: 0, tasksChecked: 0 },
        };
      }

      const taskIds = incompleteTasks.map((task) => task.taskId);
      const assignees = await db
        .select({
          taskId: taskAssignees.taskId,
          userId: taskAssignees.userId,
        })
        .from(taskAssignees)
        .where(inArray(taskAssignees.taskId, taskIds));
      const assigneesByTask = new Map<string, string[]>();

      for (const assignee of assignees) {
        const taskAssigneesForTask = assigneesByTask.get(assignee.taskId) ?? [];
        taskAssigneesForTask.push(assignee.userId);
        assigneesByTask.set(assignee.taskId, taskAssigneesForTask);
      }

      const allUserIds = [...new Set(assignees.map((assignee) => assignee.userId))];
      const usersWithPrefs =
        allUserIds.length > 0
          ? await db.query.users.findMany({
              where: inArray(users.id, allUserIds),
              columns: { id: true, preferences: true },
            })
          : [];
      const userIdsWantingNotifications = new Set(
        usersWithPrefs
          .filter((user) => {
            const prefs = user.preferences as UserPreferences | null;
            return (
              prefs?.notifications?.email?.enabled &&
              prefs.notifications.email.dueDates
            );
          })
          .map((user) => user.id)
      );

      let notificationCount = 0;
      for (const task of incompleteTasks) {
        if (!task.dueDate) continue;

        const isOverdue = task.dueDate < input.orgDate;
        const isDueToday = task.dueDate === input.orgDate;
        if (!isOverdue && !isDueToday) continue;

        const notificationType = isOverdue ? 'task_overdue' : 'task_due_soon';
        for (const userId of assigneesByTask.get(task.taskId) ?? []) {
          if (!userIdsWantingNotifications.has(userId)) continue;

          const result = await processDueNotificationCreation(
            {
              userId,
              taskId: task.taskId,
              notificationType,
              dueDate: task.dueDate,
            },
            options
          );

          if (result.status === 'completed' && result.summary.created === true) {
            notificationCount++;
          }
        }
      }

      await completeAsyncJob({ dedupeKey: job.dedupeKey, claimedBy: options.runnerId });

      return {
        status: 'completed',
        jobId: job.id,
        dedupeKey,
        summary: {
          processed: notificationCount,
          tasksChecked: incompleteTasks.length,
        },
      };
    }
  );
}

export async function processAutoArchive(
  input: { orgDate: string },
  options: BackgroundJobProcessorOptions
): Promise<BackgroundJobResult> {
  const dedupeKey = getAutoArchiveDedupeKey(input.orgDate);

  return runClaimedBackgroundJob(
    {
      dedupeKey,
      kind: AUTO_ARCHIVE_JOB_KIND,
      payload: { orgDate: input.orgDate },
      runnerId: options.runnerId,
    },
    async (job) => {
      const settings = await getSiteSettings();
      const days = settings.autoArchiveDays;
      if (days === null || days === undefined || days <= 0) {
        return skipClaimedBackgroundJob(job, options.runnerId, 'Auto-archive disabled');
      }

      const cutoffDate = getOrgCutoffDate(settings.timezone, days);
      const allBoards = await db.query.boards.findMany({
        columns: { id: true, statusOptions: true },
      });
      const now = new Date();
      let totalArchived = 0;

      for (const board of allBoards) {
        const completeIds = getCompleteStatusIds(board.statusOptions ?? []);
        if (completeIds.length === 0) continue;

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

        const doneTaskIds = doneTasks.map((task) => task.id);

        await db
          .update(tasks)
          .set({ archivedAt: now })
          .where(inArray(tasks.id, doneTaskIds));
        await db
          .update(tasks)
          .set({ archivedAt: now })
          .where(inArray(tasks.parentTaskId, doneTaskIds));

        totalArchived += doneTaskIds.length;
      }

      await completeAsyncJob({ dedupeKey: job.dedupeKey, claimedBy: options.runnerId });

      return {
        status: 'completed',
        jobId: job.id,
        dedupeKey,
        summary: { archived: totalArchived, days },
      };
    }
  );
}

async function processDueNotificationCreation(
  input: DueNotificationCreationInput,
  options: BackgroundJobProcessorOptions
): Promise<BackgroundJobResult> {
  const dedupeKey = getDueNotificationCreationDedupeKey(input);

  return runClaimedBackgroundJob(
    {
      dedupeKey,
      kind: DUE_NOTIFICATION_CREATION_JOB_KIND,
      payload: { ...input },
      runnerId: options.runnerId,
    },
    async (job) => {
      const result = await createDueNotification({
        userId: input.userId,
        taskId: input.taskId,
        isOverdue: input.notificationType === 'task_overdue',
      });

      if (!result.success) {
        return skipClaimedBackgroundJob(job, options.runnerId, 'Due notification not created');
      }

      await completeAsyncJob({ dedupeKey: job.dedupeKey, claimedBy: options.runnerId });

      return {
        status: 'completed',
        jobId: job.id,
        dedupeKey,
        summary: { created: Boolean(result.notificationId), notificationId: result.notificationId },
      };
    }
  );
}

async function runClaimedBackgroundJob(
  input: ClaimedBackgroundJobInput,
  run: (job: AsyncJob) => Promise<BackgroundJobResult>
): Promise<BackgroundJobResult> {
  await enqueueAsyncJob({
    dedupeKey: input.dedupeKey,
    kind: input.kind,
    payload: input.payload,
  });

  const claim = await claimAsyncJob({
    dedupeKey: input.dedupeKey,
    runnerId: input.runnerId,
  });

  if (!claim.claimed) {
    return {
      status: 'skipped',
      jobId: claim.job?.id,
      dedupeKey: input.dedupeKey,
      reason: `Async job claim skipped: ${claim.reason}`,
      claimMissReason: claim.reason,
    };
  }

  try {
    return await run(claim.job);
  } catch (error) {
    await failAsyncJob({
      dedupeKey: input.dedupeKey,
      claimedBy: input.runnerId,
      error,
      retryable: true,
    });
    throw error;
  }
}

async function skipClaimedBackgroundJob(
  job: AsyncJob,
  runnerId: BackgroundJobRunnerId,
  reason: string
): Promise<BackgroundJobResult> {
  await skipAsyncJob({
    dedupeKey: job.dedupeKey,
    claimedBy: runnerId,
    reason,
  });

  return {
    status: 'skipped',
    jobId: job.id,
    dedupeKey: job.dedupeKey,
    reason,
  };
}

async function getDailyDigestPreferences(userId: string): Promise<UserPreferences | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { preferences: true },
  });
  const prefs = user?.preferences as UserPreferences | null;

  if (!prefs?.notifications?.email?.enabled) return null;
  if (prefs.notifications.email.digest !== 'daily') return null;

  return prefs;
}

async function getOrgTimezone(): Promise<string | null> {
  const rows = await db.select().from(siteSettings).limit(1);
  if (rows.length === 0) return null;
  return (rows[0].settings as SiteSettings).timezone ?? null;
}

async function getSiteSettings(): Promise<SiteSettings> {
  const rows = await db.select().from(siteSettings).limit(1);
  if (rows.length === 0) return applySiteSettingsDefaults(null);
  return applySiteSettingsDefaults(rows[0].settings as SiteSettings);
}

async function gatherDailyDigestData(input: { userId: string; orgDate: string }): Promise<{
  tasksDueToday: DigestTask[];
  tasksDueTomorrow: DigestTask[];
  tasksOverdue: DigestTask[];
  unreadNotifications: DigestNotification[];
}> {
  const todayStr = input.orgDate;
  const tomorrowStr = addOrgDateDays(input.orgDate, 1);
  const accessibleBoardIds = await getAccessibleBoardIds(input.userId);

  if (accessibleBoardIds.length === 0) {
    return emptyDigestData();
  }

  const userAssignments = await db.query.taskAssignees.findMany({
    where: eq(taskAssignees.userId, input.userId),
    columns: { taskId: true },
  });
  const assignedTaskIds = userAssignments.map((assignment) => assignment.taskId);

  if (assignedTaskIds.length === 0) {
    return emptyDigestData();
  }

  const allTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      dueDate: tasks.dueDate,
      boardId: tasks.boardId,
      boardName: boards.name,
      statusOptions: boards.statusOptions,
      clientName: clients.name,
      clientSlug: clients.slug,
    })
    .from(tasks)
    .innerJoin(boards, eq(boards.id, tasks.boardId))
    .innerJoin(clients, eq(clients.id, boards.clientId))
    .where(and(inArray(tasks.id, assignedTaskIds), inArray(tasks.boardId, accessibleBoardIds)));
  const tasksDueToday: DigestTask[] = [];
  const tasksDueTomorrow: DigestTask[] = [];
  const tasksOverdue: DigestTask[] = [];

  for (const task of allTasks) {
    if (!task.dueDate) continue;

    const statusOption = task.statusOptions?.find((option) => option.id === task.status);
    const statusLabel = statusOption?.label ?? task.status;
    const normalizedStatus = statusLabel.toLowerCase();
    if (normalizedStatus === 'complete' || normalizedStatus === 'done') {
      continue;
    }

    const digestTask: DigestTask = {
      id: task.id,
      title: task.title,
      status: statusLabel,
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
        eq(notifications.userId, input.userId),
        isNull(notifications.readAt),
        gte(notifications.createdAt, yesterday)
      )
    );
  const notificationTaskIds = recentNotifications
    .map((notification) => notification.taskId)
    .filter((taskId): taskId is string => taskId !== null);
  const notificationTasks =
    notificationTaskIds.length > 0
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
  const taskMap = new Map(notificationTasks.map((task) => [task.id, task]));
  const unreadNotifications: DigestNotification[] = recentNotifications
    .filter(
      (notification) =>
        notification.type === 'mention' ||
        notification.type === 'task_assigned' ||
        notification.type === 'comment_added'
    )
    .map((notification) => {
      const task = notification.taskId ? taskMap.get(notification.taskId) : null;
      const actorMatch = notification.title.match(/^(.+?) (mentioned|assigned|commented)/);

      return {
        type: notification.type as 'mention' | 'task_assigned' | 'comment_added',
        actorName: actorMatch?.[1] || 'Someone',
        taskTitle: task?.title || 'Unknown task',
        taskId: notification.taskId || '',
        boardId: task?.boardId || '',
        clientSlug: task?.clientSlug || '',
        createdAt: notification.createdAt,
      };
    });

  return {
    tasksDueToday,
    tasksDueTomorrow,
    tasksOverdue,
    unreadNotifications,
  };
}

async function getAccessibleBoardIds(userId: string): Promise<string[]> {
  const directAccess = await db.query.boardAccess.findMany({
    where: eq(boardAccess.userId, userId),
    columns: { boardId: true },
  });
  const userTeams = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, userId),
    columns: { teamId: true },
  });
  const teamIds = userTeams.map((team) => team.teamId);
  const teamAccess =
    teamIds.length > 0
      ? await db.query.boardAccess.findMany({
          where: inArray(boardAccess.teamId, teamIds),
          columns: { boardId: true },
        })
      : [];
  const allBoardIds = new Set([
    ...directAccess.map((access) => access.boardId),
    ...teamAccess.map((access) => access.boardId),
  ]);

  return [...allBoardIds];
}

function emptyDigestData() {
  return {
    tasksDueToday: [],
    tasksDueTomorrow: [],
    tasksOverdue: [],
    unreadNotifications: [],
  };
}

function buildDigestSummary(stats: {
  tasksDueToday: number;
  tasksDueTomorrow: number;
  tasksOverdue: number;
  unreadNotifications: number;
}): string {
  const total =
    stats.tasksDueToday +
    stats.tasksDueTomorrow +
    stats.tasksOverdue +
    stats.unreadNotifications;

  if (stats.tasksOverdue > 0) {
    return `You have ${stats.tasksOverdue} overdue item${stats.tasksOverdue === 1 ? '' : 's'} that need attention.`;
  }

  return `You have ${total} Central update${total === 1 ? '' : 's'} to review today.`;
}

function addOrgDateDays(orgDate: string, days: number): string {
  const date = new Date(`${orgDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
