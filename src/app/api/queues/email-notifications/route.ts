import { QueueClient, type RetryHandler } from '@vercel/queue';
import {
  flushNotificationEmailBatch,
  queueNotificationEmail,
} from '@/lib/email/notification-batches';
import {
  enqueueEmailBatchFlush,
  isEmailNotificationQueueMessage,
  type EmailNotificationQueueMessage,
} from '@/lib/queues/email-notifications';

export const runtime = 'nodejs';

const retry: RetryHandler = (error, metadata) => {
  console.error('[email-queue] handler failed', {
    messageId: metadata.messageId,
    deliveryCount: metadata.deliveryCount,
    error: error instanceof Error ? error.message : String(error),
  });

  if (metadata.deliveryCount >= 5) {
    return { acknowledge: true };
  }

  return { afterSeconds: Math.min(300, 2 ** metadata.deliveryCount * 5) };
};

const queue = new QueueClient({ region: process.env.VERCEL_REGION ?? 'iad1' });

const handleEmailNotificationQueueCallback = queue.handleCallback<EmailNotificationQueueMessage>(
  async (message, metadata) => {
    if (!isEmailNotificationQueueMessage(message)) {
      console.warn('[email-queue] ignoring invalid message', {
        messageId: metadata.messageId,
      });
      return;
    }

    if (message.kind === 'notification-email.queue') {
      await queueNotificationEmail({
        notificationId: message.notificationId,
        recipientId: message.recipientId,
        type: message.notificationType,
        flushScheduler: 'vercel-queue',
      });
      return;
    }

    const result = await flushNotificationEmailBatch(message.batchId);
    if ('skipped' in result && result.reason === 'Batch not ready' && result.retryAt) {
      await enqueueEmailBatchFlush({
        batchId: message.batchId,
        sendAfter: result.retryAt,
      });
    }
  },
  {
    visibilityTimeoutSeconds: 600,
    retry,
  }
);

export async function POST(request: Request): Promise<Response> {
  return handleEmailNotificationQueueCallback(request);
}
