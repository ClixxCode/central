import { and, eq, isNull, inArray, asc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  boards,
  clients,
  notificationEmailBatches,
  notifications,
  tasks,
  users,
} from '@/lib/db/schema';
import type { UserPreferences } from '@/lib/db/schema/users';
import { inngest } from '@/lib/inngest/client';
import { resend, EMAIL_CONFIG } from '@/lib/email/client';
import {
  batchedNotificationsEmailHtml,
  batchedNotificationsEmailSubject,
} from '@/lib/email/templates/batched-notifications';
import { enqueueEmailBatchFlush } from '@/lib/queues/email-notifications';

export const EMAIL_BATCH_WINDOW_MS = 5 * 60 * 1000;
export const EMAIL_BATCH_CHANNEL = 'email';

export type EmailBatchableNotificationType =
  | 'task_assigned'
  | 'comment_added'
  | 'task_due_soon'
  | 'task_overdue';

export type NotificationEmailType =
  | EmailBatchableNotificationType
  | 'mention'
  | 'reaction_added';

type QueueNotificationEmailInput = {
  notificationId: string;
  recipientId: string;
  type: NotificationEmailType;
  flushScheduler?: EmailBatchFlushScheduler;
};

export type QueueNotificationEmailResult =
  | { queued: true; batchId: string; scheduledFlush: boolean }
  | { queued: false; reason: string };

export type EmailBatchFlushScheduler = 'inngest' | 'vercel-queue';

export type FlushNotificationEmailBatchResult =
  | { success: true; emailId: string | undefined; notificationCount: number }
  | { skipped: true; reason: string; retryAt?: Date };

export function isEmailBatchableNotificationType(
  type: NotificationEmailType
): type is EmailBatchableNotificationType {
  return (
    type === 'task_assigned' ||
    type === 'comment_added' ||
    type === 'task_due_soon' ||
    type === 'task_overdue'
  );
}

export function shouldSendEmailForNotificationType(
  prefs: UserPreferences | null,
  type: NotificationEmailType
): boolean {
  const emailPrefs = prefs?.notifications?.email;
  if (!emailPrefs?.enabled) return false;
  if (emailPrefs.digest !== 'instant') return false;

  switch (type) {
    case 'mention':
      return emailPrefs.mentions;
    case 'task_assigned':
      return emailPrefs.assignments;
    case 'comment_added':
      return emailPrefs.newComments;
    case 'task_due_soon':
    case 'task_overdue':
      return emailPrefs.dueDates;
    case 'reaction_added':
      return emailPrefs.reactions === true;
    default:
      return false;
  }
}

export async function queueNotificationEmail(
  input: QueueNotificationEmailInput
): Promise<QueueNotificationEmailResult> {
  if (!isEmailBatchableNotificationType(input.type)) {
    return { queued: false, reason: 'Notification type is not batchable' };
  }

  const notification = await db.query.notifications.findFirst({
    where: eq(notifications.id, input.notificationId),
    columns: {
      id: true,
      userId: true,
      type: true,
      emailSentAt: true,
      emailBatchId: true,
    },
  });

  if (!notification) {
    return { queued: false, reason: 'Notification not found' };
  }
  if (notification.userId !== input.recipientId) {
    return { queued: false, reason: 'Recipient mismatch' };
  }
  if (notification.type !== input.type) {
    return { queued: false, reason: 'Notification type mismatch' };
  }
  if (notification.emailSentAt) {
    return { queued: false, reason: 'Notification email already sent' };
  }

  if (notification.emailBatchId) {
    const batch = await db.query.notificationEmailBatches.findFirst({
      where: eq(notificationEmailBatches.id, notification.emailBatchId),
      columns: { id: true, status: true, sendAfter: true },
    });

    if (batch?.status === 'pending') {
      await scheduleEmailBatchFlush(batch.id, batch.sendAfter, input.flushScheduler);
      return { queued: true, batchId: batch.id, scheduledFlush: true };
    }

    return { queued: false, reason: 'Notification already belongs to a closed batch' };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, input.recipientId),
    columns: { preferences: true },
  });
  const prefs = user?.preferences as UserPreferences | null;
  if (!shouldSendEmailForNotificationType(prefs, input.type)) {
    return { queued: false, reason: 'User preferences' };
  }

  const sendAfter = new Date(Date.now() + EMAIL_BATCH_WINDOW_MS);

  const queueResult = await db.transaction(async (tx) => {
    const existingBatch = await tx.query.notificationEmailBatches.findFirst({
      where: and(
        eq(notificationEmailBatches.userId, input.recipientId),
        eq(notificationEmailBatches.channel, EMAIL_BATCH_CHANNEL),
        eq(notificationEmailBatches.status, 'pending')
      ),
      columns: { id: true, sendAfter: true },
    });

    let batchId = existingBatch?.id ?? null;
    let batchSendAfter = existingBatch?.sendAfter ?? sendAfter;
    let createdBatch = false;

    if (!batchId) {
      const [insertedBatch] = await tx
        .insert(notificationEmailBatches)
        .values({
          userId: input.recipientId,
          channel: EMAIL_BATCH_CHANNEL,
          status: 'pending',
          sendAfter,
        })
        .onConflictDoNothing({
          target: [notificationEmailBatches.userId, notificationEmailBatches.channel],
          where: sql`${notificationEmailBatches.status} = 'pending'`,
        })
        .returning({ id: notificationEmailBatches.id });

      if (insertedBatch) {
        batchId = insertedBatch.id;
        createdBatch = true;
      } else {
        const racedBatch = await tx.query.notificationEmailBatches.findFirst({
          where: and(
            eq(notificationEmailBatches.userId, input.recipientId),
            eq(notificationEmailBatches.channel, EMAIL_BATCH_CHANNEL),
            eq(notificationEmailBatches.status, 'pending')
          ),
          columns: { id: true, sendAfter: true },
        });
        batchId = racedBatch?.id ?? null;
        batchSendAfter = racedBatch?.sendAfter ?? sendAfter;
      }
    }

    if (!batchId) {
      throw new Error('Failed to create or find pending notification email batch');
    }

    await tx
      .update(notifications)
      .set({ emailBatchId: batchId })
      .where(and(eq(notifications.id, input.notificationId), isNull(notifications.emailBatchId)));

    if (!createdBatch) {
      await tx
        .update(notificationEmailBatches)
        .set({ updatedAt: new Date() })
        .where(eq(notificationEmailBatches.id, batchId));
    }

    return { batchId, createdBatch, sendAfter: batchSendAfter };
  });

  if (queueResult.createdBatch) {
    await scheduleEmailBatchFlush(
      queueResult.batchId,
      queueResult.sendAfter,
      input.flushScheduler
    );
  }

  return {
    queued: true,
    batchId: queueResult.batchId,
    scheduledFlush: queueResult.createdBatch,
  };
}

export type NotificationEmailBatchItem = {
  id: string;
  type: EmailBatchableNotificationType;
  title: string;
  body: string | null;
  createdAt: Date;
  taskId: string | null;
  commentId: string | null;
  taskTitle: string | null;
  taskShortId: string | null;
  taskStatus: string | null;
  taskDueDate: string | null;
  boardId: string | null;
  boardName: string | null;
  clientName: string | null;
  clientSlug: string | null;
};

export async function listSendableBatchNotifications(
  batchId: string,
  prefs: UserPreferences
): Promise<NotificationEmailBatchItem[]> {
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      createdAt: notifications.createdAt,
      taskId: notifications.taskId,
      commentId: notifications.commentId,
      taskTitle: tasks.title,
      taskShortId: tasks.shortId,
      taskStatus: tasks.status,
      taskDueDate: tasks.dueDate,
      boardId: boards.id,
      boardName: boards.name,
      clientName: clients.name,
      clientSlug: clients.slug,
    })
    .from(notifications)
    .leftJoin(tasks, eq(tasks.id, notifications.taskId))
    .leftJoin(boards, eq(boards.id, tasks.boardId))
    .leftJoin(clients, eq(clients.id, boards.clientId))
    .where(and(eq(notifications.emailBatchId, batchId), isNull(notifications.emailSentAt)))
    .orderBy(asc(notifications.createdAt));

  return rows.filter((row): row is NotificationEmailBatchItem => {
    return (
      isEmailBatchableNotificationType(row.type) &&
      shouldSendEmailForNotificationType(prefs, row.type)
    );
  });
}

export async function markBatchSkipped(batchId: string): Promise<void> {
  await db
    .update(notificationEmailBatches)
    .set({ status: 'skipped', skippedAt: new Date(), updatedAt: new Date() })
    .where(eq(notificationEmailBatches.id, batchId));
}

export async function markBatchSent(batchId: string, notificationIds: string[]): Promise<void> {
  const sentAt = new Date();

  await db.transaction(async (tx) => {
    if (notificationIds.length > 0) {
      await tx
        .update(notifications)
        .set({ emailSentAt: sentAt })
        .where(inArray(notifications.id, notificationIds));
    }

    await tx
      .update(notificationEmailBatches)
      .set({ status: 'sent', sentAt, updatedAt: sentAt })
      .where(eq(notificationEmailBatches.id, batchId));
  });
}

export async function flushNotificationEmailBatch(
  batchId: string
): Promise<FlushNotificationEmailBatchResult> {
  const batchWindow = await db.query.notificationEmailBatches.findFirst({
    where: eq(notificationEmailBatches.id, batchId),
    columns: { id: true, status: true, sendAfter: true },
  });

  if (!batchWindow) {
    return { skipped: true, reason: 'Batch not found' };
  }
  if (batchWindow.status !== 'pending') {
    return { skipped: true, reason: `Batch already ${batchWindow.status}` };
  }

  const sendAfter = new Date(batchWindow.sendAfter);
  if (sendAfter > new Date()) {
    return { skipped: true, reason: 'Batch not ready', retryAt: sendAfter };
  }

  const [claimedBatch] = await db
    .update(notificationEmailBatches)
    .set({ status: 'sending', updatedAt: new Date() })
    .where(
      and(
        eq(notificationEmailBatches.id, batchId),
        eq(notificationEmailBatches.status, 'pending')
      )
    )
    .returning({
      id: notificationEmailBatches.id,
      userId: notificationEmailBatches.userId,
    });

  if (!claimedBatch) {
    return { skipped: true, reason: 'Batch already claimed' };
  }

  const recipient = await db.query.users.findFirst({
    where: eq(users.id, claimedBatch.userId),
    columns: { email: true, name: true, preferences: true },
  });

  const prefs = recipient?.preferences as UserPreferences | null;
  if (!recipient || !prefs?.notifications?.email?.enabled || prefs.notifications.email.digest !== 'instant') {
    await markBatchSkipped(batchId);
    return { skipped: true, reason: 'User preferences' };
  }

  const batchNotifications = await listSendableBatchNotifications(batchId, prefs);

  if (batchNotifications.length === 0) {
    await markBatchSkipped(batchId);
    return { skipped: true, reason: 'No sendable notifications' };
  }

  const emailResult = await resend.emails.send({
    from: EMAIL_CONFIG.from,
    to: recipient.email,
    subject: batchedNotificationsEmailSubject(batchNotifications.length),
    html: await batchedNotificationsEmailHtml({
      recipientName: recipient.name || 'there',
      notifications: batchNotifications,
    }),
  });

  await markBatchSent(batchId, batchNotifications.map((notification) => notification.id));

  return {
    success: true,
    emailId: emailResult.data?.id,
    notificationCount: batchNotifications.length,
  };
}

async function scheduleEmailBatchFlush(
  batchId: string,
  sendAfter: Date,
  scheduler: EmailBatchFlushScheduler = 'inngest'
): Promise<void> {
  if (scheduler === 'vercel-queue') {
    await enqueueEmailBatchFlush({ batchId, sendAfter });
    return;
  }

  await inngest.send({
    name: 'notification/email-batch.flush',
    data: { batchId },
  });
}
