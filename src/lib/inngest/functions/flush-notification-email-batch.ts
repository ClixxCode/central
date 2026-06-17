import { and, eq } from 'drizzle-orm';
import { inngest } from '../client';
import { resend, EMAIL_CONFIG } from '@/lib/email/client';
import {
  batchedNotificationsEmailHtml,
  batchedNotificationsEmailSubject,
} from '@/lib/email/templates';
import {
  listSendableBatchNotifications,
  markBatchSent,
  markBatchSkipped,
} from '@/lib/email/notification-batches';
import { db } from '@/lib/db';
import { notificationEmailBatches, users } from '@/lib/db/schema';
import type { UserPreferences } from '@/lib/db/schema/users';

/**
 * Inngest function to flush a pending notification email batch after its window closes.
 */
export const flushNotificationEmailBatch = inngest.createFunction(
  {
    id: 'flush-notification-email-batch',
    retries: 3,
  },
  { event: 'notification/email-batch.flush' },
  async ({ event, step }) => {
    const { batchId } = event.data;

    const batchWindow = await step.run('load-batch-window', async () => {
      return db.query.notificationEmailBatches.findFirst({
        where: eq(notificationEmailBatches.id, batchId),
        columns: { id: true, status: true, sendAfter: true },
      });
    });

    if (!batchWindow) {
      return { skipped: true, reason: 'Batch not found' };
    }
    if (batchWindow.status !== 'pending') {
      return { skipped: true, reason: `Batch already ${batchWindow.status}` };
    }

    const sendAfter = new Date(batchWindow.sendAfter);
    if (sendAfter > new Date()) {
      await step.sleepUntil('wait-for-batch-window', sendAfter);
    }

    const claimedBatch = await step.run('claim-batch', async () => {
      const [claimed] = await db
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

      return claimed ?? null;
    });

    if (!claimedBatch) {
      return { skipped: true, reason: 'Batch already claimed' };
    }

    const recipient = await step.run('load-recipient-preferences', async () => {
      return db.query.users.findFirst({
        where: eq(users.id, claimedBatch.userId),
        columns: { email: true, name: true, preferences: true },
      });
    });

    const prefs = recipient?.preferences as UserPreferences | null;
    if (!recipient || !prefs?.notifications?.email?.enabled || prefs.notifications.email.digest !== 'instant') {
      await step.run('mark-skipped', async () => {
        await markBatchSkipped(batchId);
      });
      return { skipped: true, reason: 'User preferences' };
    }

    const batchNotifications = await step.run('load-sendable-notifications', async () => {
      return listSendableBatchNotifications(batchId, prefs);
    });

    if (batchNotifications.length === 0) {
      await step.run('mark-skipped-empty', async () => {
        await markBatchSkipped(batchId);
      });
      return { skipped: true, reason: 'No sendable notifications' };
    }

    const emailResult = await step.run('send-email', async () => {
      return resend.emails.send({
        from: EMAIL_CONFIG.from,
        to: recipient.email,
        subject: batchedNotificationsEmailSubject(batchNotifications.length),
        html: await batchedNotificationsEmailHtml({
          recipientName: recipient.name || 'there',
          notifications: batchNotifications,
        }),
      });
    });

    await step.run('mark-sent', async () => {
      await markBatchSent(batchId, batchNotifications.map((notification) => notification.id));
    });

    return {
      success: true,
      emailId: emailResult.data?.id,
      notificationCount: batchNotifications.length,
    };
  }
);
