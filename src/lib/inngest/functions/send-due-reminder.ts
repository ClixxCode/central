import { inngest } from '../client';
import { queueNotificationEmail } from '@/lib/email/notification-batches';
import { shouldDispatchEmailBatchViaInngest } from '@/lib/queues/email-notifications';

/**
 * Inngest function to queue due date reminder emails for batching.
 */
export const sendDueReminder = inngest.createFunction(
  {
    id: 'send-due-reminder',
    retries: 3,
  },
  { event: 'notification/due-reminder.scheduled' },
  async ({ event, step }) => {
    const { data } = event;

    if (!shouldDispatchEmailBatchViaInngest()) {
      return { skipped: true, reason: 'Email batch delivery mode is queue-only' };
    }

    return step.run('queue-email-batch', async () => {
      return queueNotificationEmail({
        notificationId: data.notificationId,
        recipientId: data.recipientId,
        type: data.isOverdue ? 'task_overdue' : 'task_due_soon',
      });
    });
  }
);
