import { QueueClient, type MessageMetadata, type RetryHandler } from '@vercel/queue';
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
  const shouldAcknowledge = metadata.deliveryCount >= 5;
  const retryAfterSeconds = Math.min(300, 2 ** metadata.deliveryCount * 5);

  console.error('[email-queue] handler failed', {
    messageId: metadata.messageId,
    deliveryCount: metadata.deliveryCount,
    status: shouldAcknowledge ? 'acknowledged' : 'retrying',
    retryAfterSeconds: shouldAcknowledge ? undefined : retryAfterSeconds,
    error: error instanceof Error ? error.message : String(error),
  });

  if (shouldAcknowledge) {
    return { acknowledge: true };
  }

  return { afterSeconds: retryAfterSeconds };
};

const queue = new QueueClient({ region: process.env.VERCEL_REGION ?? 'iad1' });

const handleEmailNotificationQueueCallback = queue.handleCallback<EmailNotificationQueueMessage>(
  async (message, metadata) => {
    if (!isEmailNotificationQueueMessage(message)) {
      console.warn('[email-queue] ignoring invalid message', {
        messageId: metadata.messageId,
        deliveryCount: metadata.deliveryCount,
        status: 'invalid',
      });
      return;
    }

    const logContext = getEmailQueueConsumerLogContext(message, metadata);
    console.info('[email-queue] consumer received', {
      ...logContext,
      status: 'received',
    });

    try {
      if (message.kind === 'notification-email.queue') {
        const result = await queueNotificationEmail({
          notificationId: message.notificationId,
          recipientId: message.recipientId,
          type: message.notificationType,
          flushScheduler: 'vercel-queue',
        });

        console.info('[email-queue] consumer handled', {
          ...logContext,
          status: result.queued ? 'queued' : 'skipped',
          batchId: result.queued ? result.batchId : undefined,
          scheduledFlush: result.queued ? result.scheduledFlush : undefined,
          reason: result.queued ? undefined : result.reason,
        });
        return;
      }

      const result = await flushNotificationEmailBatch(message.batchId);
      if ('success' in result) {
        console.info('[email-queue] consumer handled', {
          ...logContext,
          status: 'sent',
          emailId: result.emailId,
          notificationCount: result.notificationCount,
        });
        return;
      }

      console.info('[email-queue] consumer handled', {
        ...logContext,
        status: 'skipped',
        reason: result.reason,
        retryAt: result.retryAt?.toISOString(),
      });

      if (result.reason === 'Batch not ready' && result.retryAt) {
        const retryResult = await enqueueEmailBatchFlush({
          batchId: message.batchId,
          sendAfter: result.retryAt,
        });

        console.info('[email-queue] consumer rescheduled', {
          ...logContext,
          status: 'rescheduled',
          retryMessageId: retryResult.messageId,
          duplicate: retryResult.duplicate === true,
          retryAt: result.retryAt.toISOString(),
        });
      }
    } catch (error) {
      console.error('[email-queue] consumer failed', {
        ...logContext,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
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

function getEmailQueueConsumerLogContext(
  message: EmailNotificationQueueMessage,
  metadata: MessageMetadata
) {
  const base = {
    messageId: metadata.messageId,
    deliveryCount: metadata.deliveryCount,
    topicName: metadata.topicName,
    consumerGroup: metadata.consumerGroup,
    region: metadata.region,
    kind: message.kind,
  };

  if (message.kind === 'notification-email.queue') {
    return {
      ...base,
      notificationId: message.notificationId,
      recipientId: message.recipientId,
      notificationType: message.notificationType,
    };
  }

  return {
    ...base,
    batchId: message.batchId,
  };
}
