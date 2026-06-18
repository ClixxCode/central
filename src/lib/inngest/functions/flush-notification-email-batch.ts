import { eq } from 'drizzle-orm';
import { inngest } from '../client';
import { flushNotificationEmailBatch as flushNotificationEmailBatchNow } from '@/lib/email/notification-batches';
import { db } from '@/lib/db';
import { notificationEmailBatches } from '@/lib/db/schema';

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

    return step.run('flush-batch', async () => {
      return flushNotificationEmailBatchNow(batchId);
    });
  }
);
