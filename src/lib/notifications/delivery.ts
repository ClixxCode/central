import { and, eq, isNull } from 'drizzle-orm';
import {
  claimAsyncJob,
  completeAsyncJob,
  enqueueAsyncJob,
  failAsyncJob,
  skipAsyncJob,
  type AsyncJob,
  type AsyncJobClaimMissReason,
} from '@/lib/async-jobs';
import { db } from '@/lib/db';
import { notifications, users } from '@/lib/db/schema';
import type { UserPreferences } from '@/lib/db/schema/users';
import { getAppUrl } from '@/lib/email/client';
import { sendCentralTemplateEmail } from '@/lib/email/send-template';
import {
  CENTRAL_EMAIL_TEMPLATE_ALIASES,
  formatEmailDate,
  mentionEmailSubject,
} from '@/lib/email/templates';
import type { MentionNotificationEvent } from '@/lib/inngest/events';
import {
  formatCommentAddedNotification,
  formatDueDateReminderNotification,
  formatMentionNotification,
  formatTaskAssignedNotification,
  sendSlackMessageToUser,
} from '@/lib/slack';
import {
  getMentionEmailDeliveryDedupeKey,
  getSlackNotificationDeliveryDedupeKey,
  MENTION_EMAIL_JOB_KIND,
  SLACK_NOTIFICATION_JOB_KIND,
  type SlackNotificationDeliveryPayload,
  type SlackNotificationType,
} from '@/lib/queues/notification-delivery';

export type NotificationDeliveryRunnerId = 'inngest' | 'vercel-queue' | (string & {});

export type NotificationDeliveryOptions = {
  runnerId: NotificationDeliveryRunnerId;
};

export type NotificationDeliveryResult =
  | {
      status: 'sent';
      channel: 'email' | 'slack';
      notificationId: string;
      jobId: string;
      emailId?: string;
    }
  | {
      status: 'skipped';
      channel: 'email' | 'slack';
      notificationId: string;
      reason: string;
      jobId?: string;
      claimMissReason?: AsyncJobClaimMissReason;
    }
  | {
      status: 'failed';
      channel: 'email' | 'slack';
      notificationId: string;
      reason: string;
      permanent: boolean;
      jobId: string;
    };

type ClaimedDeliveryJobInput = {
  dedupeKey: string;
  kind: string;
  payload: Record<string, unknown>;
  runnerId: NotificationDeliveryRunnerId;
  channel: 'email' | 'slack';
  notificationId: string;
};

type NotificationRecord = {
  id: string;
  userId: string;
  type: string;
  emailSentAt: Date | null;
  slackSentAt: Date | null;
};

export async function processMentionEmailDelivery(
  data: MentionNotificationEvent['data'],
  options: NotificationDeliveryOptions
): Promise<NotificationDeliveryResult> {
  const dedupeKey = getMentionEmailDeliveryDedupeKey(data.notificationId);

  return runClaimedDeliveryJob(
    {
      dedupeKey,
      kind: MENTION_EMAIL_JOB_KIND,
      payload: { ...data },
      runnerId: options.runnerId,
      channel: 'email',
      notificationId: data.notificationId,
    },
    async (job) => {
      const notification = await getNotificationRecord(data.notificationId);
      if (!notification) {
        return skipClaimedDeliveryJob(job, options.runnerId, 'email', data.notificationId, 'Notification not found');
      }
      if (notification.userId !== data.recipientId || notification.type !== 'mention') {
        return skipClaimedDeliveryJob(job, options.runnerId, 'email', data.notificationId, 'Notification mismatch');
      }
      if (notification.emailSentAt) {
        return skipClaimedDeliveryJob(job, options.runnerId, 'email', data.notificationId, 'Notification email already sent');
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, data.recipientId),
        columns: { preferences: true },
      });
      const prefs = user?.preferences as UserPreferences | null;
      if (!shouldSendMentionEmail(prefs)) {
        return skipClaimedDeliveryJob(job, options.runnerId, 'email', data.notificationId, 'User preferences');
      }

      const taskUrl = data.taskShortId
        ? `${getAppUrl()}/t/${data.taskShortId}`
        : `${getAppUrl()}/clients/${data.clientSlug}/boards/${data.boardId}?task=${data.taskId}`;

      const emailResult = await sendCentralTemplateEmail({
        templateAlias: CENTRAL_EMAIL_TEMPLATE_ALIASES.mention,
        to: data.recipientEmail,
        subject: mentionEmailSubject(data.mentionerName, data.taskTitle),
        variables: {
          RECIPIENT_NAME: data.recipientName || 'there',
          MENTIONER_NAME: data.mentionerName,
          TASK_TITLE: data.taskTitle,
          TASK_STATUS: data.taskStatus,
          TASK_STATUS_COLOR: data.taskStatusColor,
          TASK_STATUS_BACKGROUND_COLOR: data.taskStatusBackgroundColor,
          TASK_DUE_DATE: data.taskDueDate ? formatEmailDate(data.taskDueDate) : undefined,
          COMMENT_PREVIEW: data.commentPreview || undefined,
          CTA_URL: taskUrl,
        },
      });

      try {
        await markNotificationEmailSent(data.notificationId);
      } catch (error) {
        return failClaimedDeliveryJob(
          job,
          options.runnerId,
          'email',
          data.notificationId,
          `Email provider returned but sent timestamp was not saved: ${normalizeErrorMessage(error)}`,
          true
        );
      }

      await completeAsyncJob({ dedupeKey: job.dedupeKey, claimedBy: options.runnerId });

      return {
        status: 'sent',
        channel: 'email',
        notificationId: data.notificationId,
        jobId: job.id,
        emailId: emailResult.data?.id,
      };
    }
  );
}

export async function processSlackNotificationDelivery(
  input: SlackNotificationDeliveryPayload,
  options: NotificationDeliveryOptions
): Promise<NotificationDeliveryResult> {
  const dedupeKey = getSlackNotificationDeliveryDedupeKey(
    input.notificationType,
    input.data.notificationId
  );

  return runClaimedDeliveryJob(
    {
      dedupeKey,
      kind: SLACK_NOTIFICATION_JOB_KIND,
      payload: {
        notificationType: input.notificationType,
        data: input.data,
      },
      runnerId: options.runnerId,
      channel: 'slack',
      notificationId: input.data.notificationId,
    },
    async (job) => {
      const notification = await getNotificationRecord(input.data.notificationId);
      if (!notification) {
        return skipClaimedDeliveryJob(job, options.runnerId, 'slack', input.data.notificationId, 'Notification not found');
      }
      if (
        notification.userId !== input.data.recipientId ||
        notification.type !== input.notificationType
      ) {
        return skipClaimedDeliveryJob(job, options.runnerId, 'slack', input.data.notificationId, 'Notification mismatch');
      }
      if (notification.slackSentAt) {
        return skipClaimedDeliveryJob(job, options.runnerId, 'slack', input.data.notificationId, 'Slack notification already sent');
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, input.data.recipientId),
        columns: { preferences: true },
      });
      const prefs = user?.preferences as UserPreferences | null;
      const slackUsername = getSlackUsernameForNotificationType(prefs, input.notificationType);

      if (!slackUsername) {
        return skipClaimedDeliveryJob(job, options.runnerId, 'slack', input.data.notificationId, 'Slack notifications disabled or not configured');
      }

      const sendResult = await sendSlackMessageToUser(
        slackUsername,
        formatSlackNotificationMessage(input)
      );

      if (!sendResult.success) {
        const reason = sendResult.error ?? 'Failed to send Slack message';
        if (isPermanentSlackFailure(sendResult.error, sendResult.statusCode)) {
          console.error('Permanent Slack failure:', {
            notificationId: input.data.notificationId,
            username: slackUsername,
            statusCode: sendResult.statusCode,
            error: reason,
          });

          return failClaimedDeliveryJob(
            job,
            options.runnerId,
            'slack',
            input.data.notificationId,
            reason,
            true
          );
        }

        throw new Error(reason);
      }

      try {
        await markNotificationSlackSent(input.data.notificationId);
      } catch (error) {
        return failClaimedDeliveryJob(
          job,
          options.runnerId,
          'slack',
          input.data.notificationId,
          `Slack provider returned but sent timestamp was not saved: ${normalizeErrorMessage(error)}`,
          true
        );
      }

      await completeAsyncJob({ dedupeKey: job.dedupeKey, claimedBy: options.runnerId });

      return {
        status: 'sent',
        channel: 'slack',
        notificationId: input.data.notificationId,
        jobId: job.id,
      };
    }
  );
}

async function runClaimedDeliveryJob(
  input: ClaimedDeliveryJobInput,
  run: (job: AsyncJob) => Promise<NotificationDeliveryResult>
): Promise<NotificationDeliveryResult> {
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
      channel: input.channel,
      notificationId: input.notificationId,
      jobId: claim.job?.id,
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

async function getNotificationRecord(notificationId: string): Promise<NotificationRecord | null> {
  const notification = await db.query.notifications.findFirst({
    where: eq(notifications.id, notificationId),
    columns: {
      id: true,
      userId: true,
      type: true,
      emailSentAt: true,
      slackSentAt: true,
    },
  });

  return notification ?? null;
}

async function markNotificationEmailSent(notificationId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ emailSentAt: new Date() })
    .where(and(eq(notifications.id, notificationId), isNull(notifications.emailSentAt)));
}

async function markNotificationSlackSent(notificationId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ slackSentAt: new Date() })
    .where(and(eq(notifications.id, notificationId), isNull(notifications.slackSentAt)));
}

async function skipClaimedDeliveryJob(
  job: AsyncJob,
  runnerId: NotificationDeliveryRunnerId,
  channel: 'email' | 'slack',
  notificationId: string,
  reason: string
): Promise<NotificationDeliveryResult> {
  await skipAsyncJob({
    dedupeKey: job.dedupeKey,
    claimedBy: runnerId,
    reason,
  });

  return {
    status: 'skipped',
    channel,
    notificationId,
    jobId: job.id,
    reason,
  };
}

async function failClaimedDeliveryJob(
  job: AsyncJob,
  runnerId: NotificationDeliveryRunnerId,
  channel: 'email' | 'slack',
  notificationId: string,
  reason: string,
  permanent: boolean
): Promise<NotificationDeliveryResult> {
  await failAsyncJob({
    dedupeKey: job.dedupeKey,
    claimedBy: runnerId,
    error: reason,
    retryable: !permanent,
  });

  return {
    status: 'failed',
    channel,
    notificationId,
    jobId: job.id,
    reason,
    permanent,
  };
}

function shouldSendMentionEmail(prefs: UserPreferences | null): boolean {
  const emailPrefs = prefs?.notifications?.email;
  return Boolean(
    emailPrefs?.enabled &&
      emailPrefs.mentions &&
      emailPrefs.digest === 'instant'
  );
}

function getSlackUsernameForNotificationType(
  prefs: UserPreferences | null,
  notificationType: SlackNotificationType
): string | null {
  const slackPrefs = prefs?.notifications?.slack;
  if (!slackPrefs?.enabled || !slackPrefs.slackUsername) {
    return null;
  }

  switch (notificationType) {
    case 'mention':
      return slackPrefs.mentions ? slackPrefs.slackUsername : null;
    case 'task_assigned':
      return slackPrefs.assignments ? slackPrefs.slackUsername : null;
    case 'comment_added':
      return slackPrefs.newComments ? slackPrefs.slackUsername : null;
    case 'task_due_soon':
    case 'task_overdue':
      return slackPrefs.dueDates ? slackPrefs.slackUsername : null;
    default:
      return null;
  }
}

function formatSlackNotificationMessage(input: SlackNotificationDeliveryPayload) {
  switch (input.notificationType) {
    case 'mention':
      return formatMentionNotification({
        taskId: input.data.taskId,
        taskShortId: input.data.taskShortId || undefined,
        taskTitle: input.data.taskTitle,
        boardId: input.data.boardId,
        clientSlug: input.data.clientSlug,
        actorName: input.data.mentionerName,
        commentPreview: input.data.commentPreview || undefined,
        commentId: input.data.commentId,
      });
    case 'task_assigned':
      return formatTaskAssignedNotification({
        taskId: input.data.taskId,
        taskShortId: input.data.taskShortId || undefined,
        taskTitle: input.data.taskTitle,
        boardId: input.data.boardId,
        clientSlug: input.data.clientSlug,
        clientName: input.data.clientName,
        boardName: input.data.boardName,
        actorName: input.data.assignerName,
        dueDate: input.data.taskDueDate || undefined,
      });
    case 'comment_added':
      return formatCommentAddedNotification({
        taskId: input.data.taskId,
        taskShortId: input.data.taskShortId || undefined,
        taskTitle: input.data.taskTitle,
        boardId: input.data.boardId,
        clientSlug: input.data.clientSlug,
        actorName: input.data.commenterName,
        commentPreview: input.data.commentPreview || undefined,
        commentId: input.data.commentId,
      });
    case 'task_due_soon':
    case 'task_overdue':
      return formatDueDateReminderNotification(
        {
          taskId: input.data.taskId,
          taskShortId: input.data.taskShortId || undefined,
          taskTitle: input.data.taskTitle,
          boardId: input.data.boardId,
          clientSlug: input.data.clientSlug,
          clientName: input.data.clientName,
          boardName: input.data.boardName,
          dueDate: input.data.dueDate,
        },
        input.notificationType === 'task_overdue' ? 'overdue' : 'due_soon'
      );
    default:
      return { text: 'New notification' };
  }
}

function isPermanentSlackFailure(error: string | undefined, statusCode: number | undefined) {
  return (
    error?.includes('not found') === true ||
    error?.includes('Invalid') === true ||
    error?.includes('inactive') === true ||
    statusCode === 403 ||
    statusCode === 404 ||
    statusCode === 410
  );
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
