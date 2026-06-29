import { inngest } from '../client';
import { processSlackNotificationDelivery } from '@/lib/notifications/delivery';
import { shouldDispatchNotificationDeliveryViaInngest } from '@/lib/queues/notification-delivery';

/**
 * Inngest function to send Slack notifications for task assignment events
 */
export const sendAssignmentSlackNotification = inngest.createFunction(
  {
    id: 'send-assignment-slack-notification',
    retries: 3,
  },
  { event: 'notification/assignment.created' },
  async ({ event, step }) => {
    if (!shouldDispatchNotificationDeliveryViaInngest()) {
      return { skipped: true, reason: 'Notification delivery mode is queue-only' };
    }

    return step.run('process-assignment-slack', async () => {
      return processSlackNotificationDelivery(
        { notificationType: 'task_assigned', data: event.data },
        { runnerId: 'inngest' }
      );
    });
  }
);
