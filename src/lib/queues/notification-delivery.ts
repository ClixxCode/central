import {
  DuplicateMessageError,
  send,
  type SendOptions,
  type SendResult,
} from '@vercel/queue';
import { enqueueAsyncJob } from '@/lib/async-jobs';
import type {
  AssignmentNotificationEvent,
  CommentAddedNotificationEvent,
  DueReminderEvent,
  MentionNotificationEvent,
} from '@/lib/inngest/events';

export const NOTIFICATION_DELIVERY_QUEUE_TOPIC = 'central-notification-delivery';

export const MENTION_EMAIL_JOB_KIND = 'email.mention';
export const SLACK_NOTIFICATION_JOB_KIND = 'slack.notification';

export type NotificationDeliveryMode = 'inngest' | 'shadow' | 'queue';

export type SlackNotificationType =
  | 'mention'
  | 'task_assigned'
  | 'comment_added'
  | 'task_due_soon'
  | 'task_overdue';

export type SlackNotificationDeliveryPayload =
  | {
      notificationType: 'mention';
      data: MentionNotificationEvent['data'];
    }
  | {
      notificationType: 'task_assigned';
      data: AssignmentNotificationEvent['data'];
    }
  | {
      notificationType: 'comment_added';
      data: CommentAddedNotificationEvent['data'];
    }
  | {
      notificationType: 'task_due_soon' | 'task_overdue';
      data: DueReminderEvent['data'];
    };

export type NotificationDeliveryQueueMessage =
  | {
      kind: 'notification-delivery.mention-email';
      dedupeKey: string;
      data: MentionNotificationEvent['data'];
      queuedAt: string;
    }
  | ({
      kind: 'notification-delivery.slack';
      dedupeKey: string;
      queuedAt: string;
    } & SlackNotificationDeliveryPayload);

export type NotificationDeliveryQueueSendResult = SendResult & {
  duplicate?: boolean;
};

export function getNotificationDeliveryMode(): NotificationDeliveryMode {
  const mode = process.env.NOTIFICATION_DELIVERY_MODE?.toLowerCase();

  if (mode === 'inngest' || mode === 'shadow' || mode === 'queue') {
    return mode;
  }

  return 'inngest';
}

export function shouldDispatchNotificationDeliveryViaInngest(): boolean {
  const mode = getNotificationDeliveryMode();
  return mode === 'inngest' || mode === 'shadow';
}

export function shouldDispatchNotificationDeliveryViaQueue(): boolean {
  const mode = getNotificationDeliveryMode();
  return mode === 'shadow' || mode === 'queue';
}

export function getMentionEmailDeliveryDedupeKey(notificationId: string): string {
  return `email:mention:${notificationId}`;
}

export function getSlackNotificationDeliveryDedupeKey(
  notificationType: SlackNotificationType,
  notificationId: string
): string {
  return `slack:${notificationType}:${notificationId}`;
}

export function isNotificationDeliveryQueueMessage(
  message: unknown
): message is NotificationDeliveryQueueMessage {
  if (!message || typeof message !== 'object') return false;

  const value = message as Partial<NotificationDeliveryQueueMessage>;
  if (
    typeof value.dedupeKey !== 'string' ||
    typeof value.queuedAt !== 'string' ||
    !value.data ||
    typeof value.data !== 'object'
  ) {
    return false;
  }

  if (value.kind === 'notification-delivery.mention-email') {
    return isMentionNotificationData(value.data);
  }

  if (value.kind === 'notification-delivery.slack') {
    return (
      isSlackNotificationType(value.notificationType) &&
      isSlackNotificationData(value.notificationType, value.data)
    );
  }

  return false;
}

export async function enqueueMentionEmailDelivery(
  data: MentionNotificationEvent['data']
): Promise<NotificationDeliveryQueueSendResult> {
  const dedupeKey = getMentionEmailDeliveryDedupeKey(data.notificationId);

  await enqueueAsyncJob({
    dedupeKey,
    kind: MENTION_EMAIL_JOB_KIND,
    payload: { ...data },
  });

  return sendNotificationDeliveryQueueMessage(
    {
      kind: 'notification-delivery.mention-email',
      dedupeKey,
      data,
      queuedAt: new Date().toISOString(),
    },
    { idempotencyKey: `notification-delivery:${dedupeKey}` }
  );
}

export async function enqueueSlackNotificationDelivery(
  input: SlackNotificationDeliveryPayload
): Promise<NotificationDeliveryQueueSendResult> {
  const dedupeKey = getSlackNotificationDeliveryDedupeKey(
    input.notificationType,
    input.data.notificationId
  );

  await enqueueAsyncJob({
    dedupeKey,
    kind: SLACK_NOTIFICATION_JOB_KIND,
    payload: {
      notificationType: input.notificationType,
      data: input.data,
    },
  });

  return sendNotificationDeliveryQueueMessage(
    {
      kind: 'notification-delivery.slack',
      dedupeKey,
      notificationType: input.notificationType,
      data: input.data,
      queuedAt: new Date().toISOString(),
    } as NotificationDeliveryQueueMessage,
    { idempotencyKey: `notification-delivery:${dedupeKey}` }
  );
}

async function sendNotificationDeliveryQueueMessage(
  message: NotificationDeliveryQueueMessage,
  options: SendOptions
): Promise<NotificationDeliveryQueueSendResult> {
  const logContext = {
    ...getNotificationDeliveryQueueMessageLogContext(message),
    idempotencyKey: options.idempotencyKey,
  };

  try {
    const result = await send(NOTIFICATION_DELIVERY_QUEUE_TOPIC, message, options);
    console.info('[notification-delivery-queue] producer sent', {
      ...logContext,
      messageId: result.messageId,
      duplicate: false,
    });
    return result;
  } catch (error) {
    if (error instanceof DuplicateMessageError) {
      console.info('[notification-delivery-queue] producer duplicate', {
        ...logContext,
        messageId: null,
        duplicate: true,
      });
      return { messageId: null, duplicate: true };
    }

    console.error('[notification-delivery-queue] producer failed', {
      ...logContext,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function getNotificationDeliveryQueueMessageLogContext(
  message: NotificationDeliveryQueueMessage
) {
  if (message.kind === 'notification-delivery.mention-email') {
    return {
      topic: NOTIFICATION_DELIVERY_QUEUE_TOPIC,
      kind: message.kind,
      dedupeKey: message.dedupeKey,
      notificationId: message.data.notificationId,
      recipientId: message.data.recipientId,
    };
  }

  return {
    topic: NOTIFICATION_DELIVERY_QUEUE_TOPIC,
    kind: message.kind,
    dedupeKey: message.dedupeKey,
    notificationId: message.data.notificationId,
    recipientId: message.data.recipientId,
    notificationType: message.notificationType,
  };
}

function isSlackNotificationType(value: unknown): value is SlackNotificationType {
  return (
    value === 'mention' ||
    value === 'task_assigned' ||
    value === 'comment_added' ||
    value === 'task_due_soon' ||
    value === 'task_overdue'
  );
}

function isMentionNotificationData(
  data: unknown
): data is MentionNotificationEvent['data'] {
  if (!hasBaseNotificationData(data)) return false;
  const value = data as Partial<MentionNotificationEvent['data']>;

  return (
    typeof value.mentionerName === 'string' &&
    typeof value.commentId === 'string' &&
    (typeof value.commentPreview === 'string' || value.commentPreview === null)
  );
}

function isSlackNotificationData(
  notificationType: SlackNotificationType,
  data: unknown
): data is SlackNotificationDeliveryPayload['data'] {
  if (!hasBaseNotificationData(data)) return false;

  const value = data as Record<string, unknown>;
  switch (notificationType) {
    case 'mention':
      return (
        typeof value.mentionerName === 'string' &&
        typeof value.commentId === 'string'
      );
    case 'task_assigned':
      return (
        typeof value.assignerName === 'string' &&
        typeof value.boardName === 'string' &&
        typeof value.clientName === 'string'
      );
    case 'comment_added':
      return (
        typeof value.commenterName === 'string' &&
        typeof value.commentId === 'string'
      );
    case 'task_due_soon':
    case 'task_overdue':
      return (
        typeof value.dueDate === 'string' &&
        typeof value.isOverdue === 'boolean' &&
        value.isOverdue === (notificationType === 'task_overdue')
      );
    default:
      return false;
  }
}

function hasBaseNotificationData(data: unknown): data is {
  notificationId: string;
  recipientId: string;
  taskId: string;
  taskShortId: string | null;
  taskTitle: string;
  boardId: string;
  clientSlug: string;
} {
  if (!data || typeof data !== 'object') return false;

  const value = data as Record<string, unknown>;
  return (
    typeof value.notificationId === 'string' &&
    typeof value.recipientId === 'string' &&
    typeof value.taskId === 'string' &&
    (typeof value.taskShortId === 'string' || value.taskShortId === null) &&
    typeof value.taskTitle === 'string' &&
    typeof value.boardId === 'string' &&
    typeof value.clientSlug === 'string'
  );
}
