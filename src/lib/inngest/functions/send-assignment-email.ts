import { inngest } from '../client';
import { queueNotificationEmail } from '@/lib/email/notification-batches';

/**
 * Inngest function to queue task assignment notification emails for batching.
 */
export const sendAssignmentEmail = inngest.createFunction(
  {
    id: 'send-assignment-email',
    retries: 3,
  },
  { event: 'notification/assignment.created' },
  async ({ event, step }) => {
    const { data } = event;

    return step.run('queue-email-batch', async () => {
      return queueNotificationEmail({
        notificationId: data.notificationId,
        recipientId: data.recipientId,
        type: 'task_assigned',
      });
    });
  }
);
