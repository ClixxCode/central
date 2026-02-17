import { inngest } from '../client';
import { db } from '@/lib/db';
import { notifications, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  sendSlackMessageToUser,
  formatMentionNotification,
  formatTaskAssignedNotification,
  formatDueDateReminderNotification,
  formatCommentAddedNotification,
  type NotificationContext,
} from '@/lib/slack';

/**
 * Inngest function to send Slack notifications
 *
 * This function is triggered when a notification needs to be sent via Slack.
 * It handles formatting, sending, and error handling with retries.
 */
export const sendSlackNotification = inngest.createFunction(
  {
    id: 'send-slack-notification',
    retries: 3,
    onFailure: async ({ error }) => {
      console.error('Slack notification failed after retries:', {
        error: error.message,
      });
    },
  },
  { event: 'slack/send' },
  async ({ event, step }) => {
    const { notificationId, userId, slackUsername, type, context } = event.data;

    // Step 1: Verify user still wants Slack notifications
    const user = await step.run('verify-user-preferences', async () => {
      const userRecord = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          id: true,
          preferences: true,
        },
      });

      if (!userRecord) {
        throw new Error('User not found');
      }

      return userRecord;
    });

    const prefs = user.preferences?.notifications?.slack;
    if (!prefs?.enabled) {
      return { status: 'skipped', reason: 'Slack notifications disabled' };
    }

    // Verify slackUsername is set
    if (!prefs.slackUsername) {
      return { status: 'skipped', reason: 'Slack username not configured' };
    }

    // Check notification type preferences
    const shouldSend = checkNotificationTypePreference(type, prefs);
    if (!shouldSend) {
      return { status: 'skipped', reason: `${type} notifications disabled` };
    }

    // Step 2: Format the message based on notification type
    const message = await step.run('format-message', async () => {
      const notifContext: NotificationContext = context;

      switch (type) {
        case 'mention':
          return formatMentionNotification(notifContext);
        case 'task_assigned':
          return formatTaskAssignedNotification(notifContext);
        case 'task_due_soon':
          return formatDueDateReminderNotification(notifContext, 'due_soon');
        case 'task_overdue':
          return formatDueDateReminderNotification(notifContext, 'overdue');
        case 'comment_added':
          return formatCommentAddedNotification(notifContext);
        default:
          return { text: `New notification: ${type}` };
      }
    });

    // Step 3: Send the message to Slack
    const sendResult = await step.run('send-to-slack', async () => {
      return sendSlackMessageToUser(prefs.slackUsername!, message);
    });

    // Handle failures
    if (!sendResult.success) {
      // Check for permanent failures (user not found, auth issues)
      const isPermanent = sendResult.error?.includes('not found') ||
                         sendResult.error?.includes('Invalid') ||
                         sendResult.error?.includes('inactive');

      if (isPermanent) {
        console.error('Permanent Slack failure:', {
          notificationId,
          username: prefs.slackUsername,
          error: sendResult.error,
        });
        return {
          status: 'failed',
          reason: sendResult.error,
          permanent: true,
        };
      }

      // Check for permanent webhook failures (invalid webhook)
      if (sendResult.statusCode === 403 || sendResult.statusCode === 404 || sendResult.statusCode === 410) {
        // Don't retry for permanent failures
        console.error('Permanent Slack webhook failure:', {
          notificationId,
          statusCode: sendResult.statusCode,
          error: sendResult.error,
        });
        return {
          status: 'failed',
          reason: sendResult.error,
          permanent: true,
        };
      }

      // Throw to trigger retry for temporary failures
      throw new Error(sendResult.error ?? 'Failed to send Slack message');
    }

    // Step 4: Update notification record
    await step.run('update-notification', async () => {
      await db
        .update(notifications)
        .set({ slackSentAt: new Date() })
        .where(eq(notifications.id, notificationId));
    });

    return { status: 'sent', notificationId };
  }
);

/**
 * Check if user has enabled this notification type for Slack
 */
function checkNotificationTypePreference(
  type: string,
  prefs: { mentions?: boolean; assignments?: boolean; dueDates?: boolean }
): boolean {
  switch (type) {
    case 'mention':
      return prefs.mentions !== false;
    case 'task_assigned':
      return prefs.assignments !== false;
    case 'task_due_soon':
    case 'task_overdue':
      return prefs.dueDates !== false;
    case 'comment_added':
      // Comment notifications go to assignees, tied to mentions preference
      return prefs.mentions !== false;
    default:
      return true;
  }
}
