import { inngest } from '../client';
import { processMentionEmailDelivery } from '@/lib/notifications/delivery';
import { shouldDispatchNotificationDeliveryViaInngest } from '@/lib/queues/notification-delivery';

/**
 * Inngest function to send mention notification emails
 */
export const sendMentionEmail = inngest.createFunction(
  {
    id: 'send-mention-email',
    retries: 3,
  },
  { event: 'notification/mention.created' },
  async ({ event, step }) => {
    if (!shouldDispatchNotificationDeliveryViaInngest()) {
      return { skipped: true, reason: 'Notification delivery mode is queue-only' };
    }

    return step.run('process-mention-email', async () => {
      return processMentionEmailDelivery(event.data, { runnerId: 'inngest' });
    });
  }
);
