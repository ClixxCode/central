import { inngest } from '../client';
import { queueNotificationEmail } from '@/lib/email/notification-batches';

/**
 * Inngest function to queue comment notification emails for batching.
 */
export const sendCommentAddedEmail = inngest.createFunction(
  {
    id: 'send-comment-added-email',
    retries: 3,
  },
  { event: 'notification/comment.added' },
  async ({ event, step }) => {
    const { data } = event;

    return step.run('queue-email-batch', async () => {
      return queueNotificationEmail({
        notificationId: data.notificationId,
        recipientId: data.recipientId,
        type: 'comment_added',
      });
    });
  }
);
