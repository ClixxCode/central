import { inngest } from '../client';
import { processSlackNotificationDelivery } from '@/lib/notifications/delivery';
import { shouldDispatchNotificationDeliveryViaInngest } from '@/lib/queues/notification-delivery';

/**
 * Inngest function to send Slack notifications for comment_added events
 */
export const sendCommentSlackNotification = inngest.createFunction(
  {
    id: 'send-comment-slack-notification',
    retries: 3,
  },
  { event: 'notification/comment.added' },
  async ({ event, step }) => {
    if (!shouldDispatchNotificationDeliveryViaInngest()) {
      return { skipped: true, reason: 'Notification delivery mode is queue-only' };
    }

    return step.run('process-comment-slack', async () => {
      return processSlackNotificationDelivery(
        { notificationType: 'comment_added', data: event.data },
        { runnerId: 'inngest' }
      );
    });
  }
);
