import { QueueClient, type MessageMetadata, type RetryHandler } from '@vercel/queue';
import {
  processMentionEmailDelivery,
  processSlackNotificationDelivery,
  type NotificationDeliveryResult,
} from '@/lib/notifications/delivery';
import {
  isNotificationDeliveryQueueMessage,
  type NotificationDeliveryQueueMessage,
} from '@/lib/queues/notification-delivery';

export const runtime = 'nodejs';

const retry: RetryHandler = (error, metadata) => {
  const shouldAcknowledge = metadata.deliveryCount >= 5;
  const retryAfterSeconds = Math.min(300, 2 ** metadata.deliveryCount * 5);

  console.error('[notification-delivery-queue] handler failed', {
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

const handleNotificationDeliveryQueueCallback =
  queue.handleCallback<NotificationDeliveryQueueMessage>(
    async (message, metadata) => {
      if (!isNotificationDeliveryQueueMessage(message)) {
        console.warn('[notification-delivery-queue] ignoring invalid message', {
          messageId: metadata.messageId,
          deliveryCount: metadata.deliveryCount,
          status: 'invalid',
        });
        return;
      }

      const logContext = getNotificationDeliveryConsumerLogContext(message, metadata);
      console.info('[notification-delivery-queue] consumer received', {
        ...logContext,
        status: 'received',
      });

      const result =
        message.kind === 'notification-delivery.mention-email'
          ? await processMentionEmailDelivery(message.data, { runnerId: 'vercel-queue' })
          : await processSlackNotificationDelivery(message, { runnerId: 'vercel-queue' });

      console.info('[notification-delivery-queue] consumer handled', {
        ...logContext,
        ...getResultLogContext(result),
      });
    },
    {
      visibilityTimeoutSeconds: 600,
      retry,
    }
  );

export async function POST(request: Request): Promise<Response> {
  return handleNotificationDeliveryQueueCallback(request);
}

function getNotificationDeliveryConsumerLogContext(
  message: NotificationDeliveryQueueMessage,
  metadata: MessageMetadata
) {
  const base = {
    messageId: metadata.messageId,
    deliveryCount: metadata.deliveryCount,
    topicName: metadata.topicName,
    consumerGroup: metadata.consumerGroup,
    region: metadata.region,
    kind: message.kind,
    dedupeKey: message.dedupeKey,
    notificationId: message.data.notificationId,
    recipientId: message.data.recipientId,
  };

  if (message.kind === 'notification-delivery.slack') {
    return {
      ...base,
      notificationType: message.notificationType,
    };
  }

  return base;
}

function getResultLogContext(result: NotificationDeliveryResult) {
  if (result.status === 'sent') {
    return {
      status: result.status,
      channel: result.channel,
      jobId: result.jobId,
      emailId: result.emailId,
    };
  }

  if (result.status === 'failed') {
    return {
      status: result.status,
      channel: result.channel,
      jobId: result.jobId,
      permanent: result.permanent,
      reason: result.reason,
    };
  }

  return {
    status: result.status,
    channel: result.channel,
    jobId: result.jobId,
    reason: result.reason,
    claimMissReason: result.claimMissReason,
  };
}
