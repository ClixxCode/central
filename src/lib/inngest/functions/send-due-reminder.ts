import { inngest } from '../client';
import { queueNotificationEmail } from '@/lib/email/notification-batches';

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

    return step.run('queue-email-batch', async () => {
      return queueNotificationEmail({
        notificationId: data.notificationId,
        recipientId: data.recipientId,
        type: data.isOverdue ? 'task_overdue' : 'task_due_soon',
      });
    });
  }
);
