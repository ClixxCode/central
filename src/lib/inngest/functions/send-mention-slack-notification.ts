import { inngest } from '../client';
import { processSlackNotificationDelivery } from '@/lib/notifications/delivery';
import { shouldDispatchNotificationDeliveryViaInngest } from '@/lib/queues/notification-delivery';

/**
 * Inngest function to send Slack notifications for mention events
 */
export const sendMentionSlackNotification = inngest.createFunction(
  {
    id: 'send-mention-slack-notification',
    retries: 3,
  },
  { event: 'notification/mention.created' },
  async ({ event, step }) => {
    if (!shouldDispatchNotificationDeliveryViaInngest()) {
      return { skipped: true, reason: 'Notification delivery mode is queue-only' };
    }

    return step.run('process-mention-slack', async () => {
      return processSlackNotificationDelivery(
        { notificationType: 'mention', data: event.data },
        { runnerId: 'inngest' }
      );
    });
  }
);
