import {
  DuplicateMessageError,
  send,
  type SendOptions,
  type SendResult,
} from '@vercel/queue';

export const EMAIL_NOTIFICATION_QUEUE_TOPIC = 'central-email-notifications';

export type EmailNotificationQueueMessage =
  | {
      kind: 'notification-email.queue';
      notificationId: string;
      recipientId: string;
      notificationType: 'comment_added';
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
      value.notificationType === 'comment_added'
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
  return sendEmailNotificationQueueMessage(
    {
      kind: 'notification-email.queue',
      notificationId: input.notificationId,
      recipientId: input.recipientId,
      notificationType: 'comment_added',
      queuedAt: new Date().toISOString(),
    },
    {
      idempotencyKey: `notification-email:comment_added:${input.notificationId}`,
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
  try {
    return await send(EMAIL_NOTIFICATION_QUEUE_TOPIC, message, options);
  } catch (error) {
    if (error instanceof DuplicateMessageError) {
      return { messageId: null, duplicate: true };
    }

    throw error;
  }
}
