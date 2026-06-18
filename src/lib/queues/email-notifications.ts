import {
  DuplicateMessageError,
  send,
  type SendOptions,
  type SendResult,
} from '@vercel/queue';

export const EMAIL_NOTIFICATION_QUEUE_TOPIC = 'central-email-notifications';

export type EmailNotificationQueueType =
  | 'task_assigned'
  | 'comment_added'
  | 'task_due_soon'
  | 'task_overdue';

const EMAIL_NOTIFICATION_QUEUE_TYPES = new Set<EmailNotificationQueueType>([
  'task_assigned',
  'comment_added',
  'task_due_soon',
  'task_overdue',
]);

export type EmailNotificationQueueMessage =
  | {
      kind: 'notification-email.queue';
      notificationId: string;
      recipientId: string;
      notificationType: EmailNotificationQueueType;
      queuedAt: string;
    }
  | {
      kind: 'notification-email.flush-batch';
      batchId: string;
      queuedAt: string;
    };

export type EmailQueueSendResult = SendResult & {
  duplicate?: boolean;
};

export type EmailBatchDeliveryMode = 'inngest' | 'shadow' | 'queue';

export function getEmailBatchDeliveryMode(): EmailBatchDeliveryMode {
  const mode = process.env.EMAIL_BATCH_DELIVERY_MODE?.toLowerCase();

  if (mode === 'inngest' || mode === 'shadow' || mode === 'queue') {
    return mode;
  }

  return isEmailQueuePilotEnabled() ? 'shadow' : 'inngest';
}

export function shouldDispatchEmailBatchViaInngest(): boolean {
  const mode = getEmailBatchDeliveryMode();
  return mode === 'inngest' || mode === 'shadow';
}

export function shouldDispatchEmailBatchViaQueue(): boolean {
  const mode = getEmailBatchDeliveryMode();
  return mode === 'shadow' || mode === 'queue';
}

export function isEmailQueuePilotEnabled(): boolean {
  return process.env.EMAIL_QUEUE_PILOT_ENABLED === 'true';
}

export function isEmailNotificationQueueMessage(
  message: unknown
): message is EmailNotificationQueueMessage {
  if (!message || typeof message !== 'object') return false;

  const value = message as Partial<EmailNotificationQueueMessage>;
  if (value.kind === 'notification-email.queue') {
    return (
      typeof value.notificationId === 'string' &&
      typeof value.recipientId === 'string' &&
      isEmailNotificationQueueType(value.notificationType)
    );
  }

  if (value.kind === 'notification-email.flush-batch') {
    return typeof value.batchId === 'string';
  }

  return false;
}

export async function enqueueCommentAddedNotificationEmail(input: {
  notificationId: string;
  recipientId: string;
}): Promise<EmailQueueSendResult> {
  return enqueueNotificationEmail({
    ...input,
    notificationType: 'comment_added',
  });
}

export async function enqueueNotificationEmail(input: {
  notificationId: string;
  recipientId: string;
  notificationType: EmailNotificationQueueType;
}): Promise<EmailQueueSendResult> {
  return sendEmailNotificationQueueMessage(
    {
      kind: 'notification-email.queue',
      notificationId: input.notificationId,
      recipientId: input.recipientId,
      notificationType: input.notificationType,
      queuedAt: new Date().toISOString(),
    },
    {
      idempotencyKey: `notification-email:${input.notificationType}:${input.notificationId}`,
    }
  );
}

export async function enqueueEmailBatchFlush(input: {
  batchId: string;
  sendAfter: Date;
}): Promise<EmailQueueSendResult> {
  const delaySeconds = Math.max(
    0,
    Math.ceil((input.sendAfter.getTime() - Date.now()) / 1000)
  );

  return sendEmailNotificationQueueMessage(
    {
      kind: 'notification-email.flush-batch',
      batchId: input.batchId,
      queuedAt: new Date().toISOString(),
    },
    {
      delaySeconds,
      idempotencyKey: `notification-email-batch-flush:${input.batchId}`,
      retentionSeconds: Math.max(3600, delaySeconds + 3600),
    }
  );
}

async function sendEmailNotificationQueueMessage(
  message: EmailNotificationQueueMessage,
  options: SendOptions
): Promise<EmailQueueSendResult> {
  const logContext = {
    ...getEmailQueueMessageLogContext(message),
    idempotencyKey: options.idempotencyKey,
  };

  try {
    const result = await send(EMAIL_NOTIFICATION_QUEUE_TOPIC, message, options);
    console.info('[email-queue] producer sent', {
      ...logContext,
      messageId: result.messageId,
      duplicate: false,
    });
    return result;
  } catch (error) {
    if (error instanceof DuplicateMessageError) {
      console.info('[email-queue] producer duplicate', {
        ...logContext,
        messageId: null,
        duplicate: true,
      });
      return { messageId: null, duplicate: true };
    }

    console.error('[email-queue] producer failed', {
      ...logContext,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function getEmailQueueMessageLogContext(message: EmailNotificationQueueMessage) {
  if (message.kind === 'notification-email.queue') {
    return {
      topic: EMAIL_NOTIFICATION_QUEUE_TOPIC,
      kind: message.kind,
      notificationId: message.notificationId,
      recipientId: message.recipientId,
      notificationType: message.notificationType,
    };
  }

  return {
    topic: EMAIL_NOTIFICATION_QUEUE_TOPIC,
    kind: message.kind,
    batchId: message.batchId,
  };
}

function isEmailNotificationQueueType(value: unknown): value is EmailNotificationQueueType {
  return (
    typeof value === 'string' &&
    EMAIL_NOTIFICATION_QUEUE_TYPES.has(value as EmailNotificationQueueType)
  );
}
