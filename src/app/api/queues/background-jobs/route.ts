import { QueueClient, type MessageMetadata, type RetryHandler } from '@vercel/queue';
import {
  processAutoArchive,
  processDailyDigestDelivery,
  processDailyDigestSchedule,
  processDueDateScan,
  type BackgroundJobResult,
} from '@/lib/background-jobs';
import {
  isBackgroundJobQueueMessage,
  type BackgroundJobQueueMessage,
} from '@/lib/queues/background-jobs';
import {
  processRecurringNextTask,
  type RecurringTaskProcessorResult,
} from '@/lib/recurring-tasks';

export const runtime = 'nodejs';
export const maxDuration = 300;

const retry: RetryHandler = (error, metadata) => {
  const shouldAcknowledge = metadata.deliveryCount >= 5;
  const retryAfterSeconds = Math.min(300, 2 ** metadata.deliveryCount * 5);

  console.error('[background-job-queue] handler failed', {
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

const handleBackgroundJobQueueCallback = queue.handleCallback<BackgroundJobQueueMessage>(
  async (message, metadata) => {
    if (!isBackgroundJobQueueMessage(message)) {
      console.warn('[background-job-queue] ignoring invalid message', {
        messageId: metadata.messageId,
        deliveryCount: metadata.deliveryCount,
        status: 'invalid',
      });
      return;
    }

    const logContext = getBackgroundJobConsumerLogContext(message, metadata);
    console.info('[background-job-queue] consumer received', {
      ...logContext,
      status: 'received',
    });

    const result = await processBackgroundJobQueueMessage(message);

    console.info('[background-job-queue] consumer handled', {
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
  return handleBackgroundJobQueueCallback(request);
}

function processBackgroundJobQueueMessage(message: BackgroundJobQueueMessage) {
  switch (message.kind) {
    case 'background.daily-digest.schedule':
      return processDailyDigestSchedule(
        { orgDate: message.orgDate },
        { runnerId: 'vercel-queue' }
      );
    case 'background.daily-digest.delivery':
      return processDailyDigestDelivery(message.data, { runnerId: 'vercel-queue' });
    case 'background.due-scan':
      return processDueDateScan({ orgDate: message.orgDate }, { runnerId: 'vercel-queue' });
    case 'background.auto-archive':
      return processAutoArchive({ orgDate: message.orgDate }, { runnerId: 'vercel-queue' });
    case 'background.recurring-next-task':
      return processRecurringNextTask(message.data, { runnerId: 'vercel-queue' });
    default:
      throw new Error('Unsupported background job message');
  }
}

function getBackgroundJobConsumerLogContext(
  message: BackgroundJobQueueMessage,
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
  };

  if (message.kind === 'background.daily-digest.delivery') {
    return {
      ...base,
      orgDate: message.orgDate,
      userId: message.data.userId,
    };
  }

  if (message.kind === 'background.recurring-next-task') {
    return {
      ...base,
      completedTaskId: message.data.taskId,
      recurringGroupId: message.data.recurringGroupId,
    };
  }

  return {
    ...base,
    orgDate: message.orgDate,
  };
}

function getResultLogContext(result: BackgroundJobResult | RecurringTaskProcessorResult) {
  if (result.status === 'completed') {
    return {
      status: result.status,
      jobId: result.jobId,
      summary: 'summary' in result ? result.summary : {
        newTaskId: result.newTaskId,
        nextDueDate: result.nextDueDate,
        recurringGroupId: result.recurringGroupId,
        clonedSubtaskCount: result.clonedSubtaskCount,
        duplicatePrevented: result.duplicatePrevented,
      },
    };
  }

  return {
    status: result.status,
    jobId: result.jobId,
    reason: result.reason,
    claimMissReason: result.claimMissReason,
  };
}
