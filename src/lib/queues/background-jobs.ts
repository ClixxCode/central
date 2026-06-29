import {
  DuplicateMessageError,
  send,
  type SendOptions,
  type SendResult,
} from '@vercel/queue';
import { enqueueAsyncJob } from '@/lib/async-jobs';
import type { DailyDigestEvent, RecurringTaskCompletedEvent } from '@/lib/inngest/events';

export const BACKGROUND_JOB_QUEUE_TOPIC = 'central-background-jobs';

export const DAILY_DIGEST_SCHEDULE_JOB_KIND = 'daily-digest.schedule';
export const DAILY_DIGEST_DELIVERY_JOB_KIND = 'daily-digest.delivery';
export const DUE_DATE_SCAN_JOB_KIND = 'due-date.scan';
export const AUTO_ARCHIVE_JOB_KIND = 'auto-archive';
export const DUE_NOTIFICATION_CREATION_JOB_KIND = 'due-notification.create';
export const RECURRING_NEXT_TASK_JOB_KIND = 'recurring-next-task.create';

export type BackgroundJobDeliveryMode = 'inngest' | 'shadow' | 'queue';
export type RecurringTaskDeliveryMode = 'inngest' | 'shadow' | 'queue';

export type DailyDigestDeliveryData = DailyDigestEvent['data'] & {
  orgDate: string;
};

export type BackgroundJobQueueMessage =
  | {
      kind: 'background.daily-digest.schedule';
      dedupeKey: string;
      orgDate: string;
      queuedAt: string;
    }
  | {
      kind: 'background.daily-digest.delivery';
      dedupeKey: string;
      orgDate: string;
      data: DailyDigestDeliveryData;
      queuedAt: string;
    }
  | {
      kind: 'background.due-scan';
      dedupeKey: string;
      orgDate: string;
      queuedAt: string;
    }
  | {
      kind: 'background.auto-archive';
      dedupeKey: string;
      orgDate: string;
      queuedAt: string;
    }
  | {
      kind: 'background.recurring-next-task';
      dedupeKey: string;
      data: RecurringTaskCompletedEvent['data'];
      queuedAt: string;
    };

export type BackgroundJobQueueSendResult = SendResult & {
  duplicate?: boolean;
};

export function getBackgroundJobDeliveryMode(): BackgroundJobDeliveryMode {
  const mode = process.env.BACKGROUND_JOB_DELIVERY_MODE?.toLowerCase();

  if (mode === 'inngest' || mode === 'shadow' || mode === 'queue') {
    return mode;
  }

  return 'inngest';
}

export function getRecurringTaskDeliveryMode(): RecurringTaskDeliveryMode {
  const mode = process.env.RECURRING_TASK_DELIVERY_MODE?.toLowerCase();

  if (mode === 'inngest' || mode === 'shadow' || mode === 'queue') {
    return mode;
  }

  return 'inngest';
}

export function shouldDispatchBackgroundJobsViaInngest(): boolean {
  const mode = getBackgroundJobDeliveryMode();
  return mode === 'inngest' || mode === 'shadow';
}

export function shouldDispatchRecurringTasksViaInngest(): boolean {
  const mode = getRecurringTaskDeliveryMode();
  return mode === 'inngest' || mode === 'shadow';
}

export function shouldDispatchRecurringTasksViaQueue(): boolean {
  const mode = getRecurringTaskDeliveryMode();
  return mode === 'shadow' || mode === 'queue';
}

export function shouldDispatchBackgroundJobsViaQueue(): boolean {
  const mode = getBackgroundJobDeliveryMode();
  return mode === 'shadow' || mode === 'queue';
}

export function getDailyDigestScheduleDedupeKey(orgDate: string): string {
  return `daily-digest-schedule:${orgDate}`;
}

export function getDailyDigestDeliveryDedupeKey(userId: string, orgDate: string): string {
  return `daily-digest:${userId}:${orgDate}`;
}

export function getDueDateScanDedupeKey(orgDate: string): string {
  return `due-scan:${orgDate}`;
}

export function getAutoArchiveDedupeKey(orgDate: string): string {
  return `auto-archive:${orgDate}`;
}

export function getRecurringNextTaskDedupeKey(completedTaskId: string): string {
  return `recurring-next:${completedTaskId}`;
}

export function getDueNotificationCreationDedupeKey(input: {
  userId: string;
  taskId: string;
  notificationType: 'task_due_soon' | 'task_overdue';
  dueDate: string;
}): string {
  return `due-notification:${input.userId}:${input.taskId}:${input.notificationType}:${input.dueDate}`;
}

export function isBackgroundJobQueueMessage(
  message: unknown
): message is BackgroundJobQueueMessage {
  if (!message || typeof message !== 'object') return false;

  const value = message as Partial<BackgroundJobQueueMessage>;
  if (
    typeof value.dedupeKey !== 'string' ||
    typeof value.queuedAt !== 'string'
  ) {
    return false;
  }

  switch (value.kind) {
    case 'background.daily-digest.schedule':
    case 'background.due-scan':
    case 'background.auto-archive':
      return typeof value.orgDate === 'string' && isOrgDate(value.orgDate);
    case 'background.daily-digest.delivery':
      return (
        typeof value.orgDate === 'string' &&
        isOrgDate(value.orgDate) &&
        isDailyDigestDeliveryData(value.data) &&
        value.data.orgDate === value.orgDate
      );
    case 'background.recurring-next-task':
      return isRecurringTaskCompletedData(value.data);
    default:
      return false;
  }
}

export async function enqueueDailyDigestSchedule(input: {
  orgDate: string;
}): Promise<BackgroundJobQueueSendResult> {
  const dedupeKey = getDailyDigestScheduleDedupeKey(input.orgDate);

  await enqueueAsyncJob({
    dedupeKey,
    kind: DAILY_DIGEST_SCHEDULE_JOB_KIND,
    payload: { orgDate: input.orgDate },
  });

  return sendBackgroundJobQueueMessage({
    kind: 'background.daily-digest.schedule',
    dedupeKey,
    orgDate: input.orgDate,
    queuedAt: new Date().toISOString(),
  });
}

export async function enqueueDailyDigestDelivery(
  data: DailyDigestDeliveryData
): Promise<BackgroundJobQueueSendResult> {
  const dedupeKey = getDailyDigestDeliveryDedupeKey(data.userId, data.orgDate);

  await enqueueAsyncJob({
    dedupeKey,
    kind: DAILY_DIGEST_DELIVERY_JOB_KIND,
    payload: { ...data },
  });

  return sendBackgroundJobQueueMessage({
    kind: 'background.daily-digest.delivery',
    dedupeKey,
    orgDate: data.orgDate,
    data,
    queuedAt: new Date().toISOString(),
  });
}

export async function enqueueDueDateScan(input: {
  orgDate: string;
}): Promise<BackgroundJobQueueSendResult> {
  const dedupeKey = getDueDateScanDedupeKey(input.orgDate);

  await enqueueAsyncJob({
    dedupeKey,
    kind: DUE_DATE_SCAN_JOB_KIND,
    payload: { orgDate: input.orgDate },
  });

  return sendBackgroundJobQueueMessage({
    kind: 'background.due-scan',
    dedupeKey,
    orgDate: input.orgDate,
    queuedAt: new Date().toISOString(),
  });
}

export async function enqueueAutoArchive(input: {
  orgDate: string;
}): Promise<BackgroundJobQueueSendResult> {
  const dedupeKey = getAutoArchiveDedupeKey(input.orgDate);

  await enqueueAsyncJob({
    dedupeKey,
    kind: AUTO_ARCHIVE_JOB_KIND,
    payload: { orgDate: input.orgDate },
  });

  return sendBackgroundJobQueueMessage({
    kind: 'background.auto-archive',
    dedupeKey,
    orgDate: input.orgDate,
    queuedAt: new Date().toISOString(),
  });
}

export async function enqueueRecurringNextTask(
  data: RecurringTaskCompletedEvent['data']
): Promise<BackgroundJobQueueSendResult> {
  const dedupeKey = getRecurringNextTaskDedupeKey(data.taskId);

  await enqueueAsyncJob({
    dedupeKey,
    kind: RECURRING_NEXT_TASK_JOB_KIND,
    payload: { ...data },
  });

  return sendBackgroundJobQueueMessage({
    kind: 'background.recurring-next-task',
    dedupeKey,
    data,
    queuedAt: new Date().toISOString(),
  });
}

async function sendBackgroundJobQueueMessage(
  message: BackgroundJobQueueMessage
): Promise<BackgroundJobQueueSendResult> {
  const options: SendOptions = {
    idempotencyKey: `background-job:${message.dedupeKey}`,
  };
  const logContext = {
    ...getBackgroundJobQueueMessageLogContext(message),
    idempotencyKey: options.idempotencyKey,
  };

  try {
    const result = await send(BACKGROUND_JOB_QUEUE_TOPIC, message, options);
    console.info('[background-job-queue] producer sent', {
      ...logContext,
      messageId: result.messageId,
      duplicate: false,
    });
    return result;
  } catch (error) {
    if (error instanceof DuplicateMessageError) {
      console.info('[background-job-queue] producer duplicate', {
        ...logContext,
        messageId: null,
        duplicate: true,
      });
      return { messageId: null, duplicate: true };
    }

    console.error('[background-job-queue] producer failed', {
      ...logContext,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function getBackgroundJobQueueMessageLogContext(message: BackgroundJobQueueMessage) {
  if (message.kind === 'background.daily-digest.delivery') {
    return {
      topic: BACKGROUND_JOB_QUEUE_TOPIC,
      kind: message.kind,
      dedupeKey: message.dedupeKey,
      orgDate: message.orgDate,
      userId: message.data.userId,
    };
  }

  if (message.kind === 'background.recurring-next-task') {
    return {
      topic: BACKGROUND_JOB_QUEUE_TOPIC,
      kind: message.kind,
      dedupeKey: message.dedupeKey,
      completedTaskId: message.data.taskId,
      recurringGroupId: message.data.recurringGroupId,
    };
  }

  return {
    topic: BACKGROUND_JOB_QUEUE_TOPIC,
    kind: message.kind,
    dedupeKey: message.dedupeKey,
    orgDate: message.orgDate,
  };
}

function isDailyDigestDeliveryData(data: unknown): data is DailyDigestDeliveryData {
  if (!data || typeof data !== 'object') return false;

  const value = data as Partial<DailyDigestDeliveryData>;
  return (
    typeof value.userId === 'string' &&
    typeof value.userEmail === 'string' &&
    (typeof value.userName === 'string' || value.userName === null) &&
    typeof value.orgDate === 'string' &&
    isOrgDate(value.orgDate)
  );
}

function isOrgDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isRecurringTaskCompletedData(
  data: unknown
): data is RecurringTaskCompletedEvent['data'] {
  if (!data || typeof data !== 'object') return false;

  const value = data as Partial<RecurringTaskCompletedEvent['data']>;
  const recurringConfig = value.recurringConfig as
    | Partial<RecurringTaskCompletedEvent['data']['recurringConfig']>
    | undefined;

  return (
    typeof value.taskId === 'string' &&
    typeof value.boardId === 'string' &&
    typeof value.recurringGroupId === 'string' &&
    typeof recurringConfig === 'object' &&
    recurringConfig !== null &&
    isRecurringFrequency(recurringConfig.frequency) &&
    typeof recurringConfig.interval === 'number' &&
    typeof value.completedDueDate === 'string' &&
    typeof value.completedByUserId === 'string' &&
    typeof value.title === 'string' &&
    (value.description === null || value.description === undefined || typeof value.description === 'object') &&
    (value.section === null || typeof value.section === 'string') &&
    typeof value.dateFlexibility === 'string' &&
    (value.assigneeIds === undefined ||
      (Array.isArray(value.assigneeIds) &&
        value.assigneeIds.every((userId) => typeof userId === 'string')))
  );
}

function isRecurringFrequency(
  value: unknown
): value is RecurringTaskCompletedEvent['data']['recurringConfig']['frequency'] {
  return (
    value === 'daily' ||
    value === 'weekly' ||
    value === 'biweekly' ||
    value === 'monthly' ||
    value === 'quarterly' ||
    value === 'yearly'
  );
}
