import { inngest } from '../client';
import { processSlackNotificationDelivery } from '@/lib/notifications/delivery';
import { shouldDispatchNotificationDeliveryViaInngest } from '@/lib/queues/notification-delivery';

/**
 * Inngest function to send Slack notifications for due date reminder events
 */
export const sendDueDateSlackNotification = inngest.createFunction(
  {
    id: 'send-due-date-slack-notification',
    retries: 3,
  },
  { event: 'notification/due-reminder.scheduled' },
  async ({ event, step }) => {
    if (!shouldDispatchNotificationDeliveryViaInngest()) {
      return { skipped: true, reason: 'Notification delivery mode is queue-only' };
    }

    return step.run('process-due-date-slack', async () => {
      return processSlackNotificationDelivery(
        {
          notificationType: event.data.isOverdue ? 'task_overdue' : 'task_due_soon',
          data: event.data,
        },
        { runnerId: 'inngest' }
      );
    });
  }
);
