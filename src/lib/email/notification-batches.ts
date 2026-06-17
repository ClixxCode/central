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
};

export type QueueNotificationEmailResult =
  | { queued: true; batchId: string; scheduledFlush: boolean }
  | { queued: false; reason: string };

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
      columns: { id: true, status: true },
    });

    if (batch?.status === 'pending') {
      await scheduleEmailBatchFlush(batch.id);
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
      columns: { id: true },
    });

    let batchId = existingBatch?.id ?? null;
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
          columns: { id: true },
        });
        batchId = racedBatch?.id ?? null;
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

    return { batchId, createdBatch };
  });

  if (queueResult.createdBatch) {
    await scheduleEmailBatchFlush(queueResult.batchId);
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

async function scheduleEmailBatchFlush(batchId: string): Promise<void> {
  await inngest.send({
    name: 'notification/email-batch.flush',
    data: { batchId },
  });
}
