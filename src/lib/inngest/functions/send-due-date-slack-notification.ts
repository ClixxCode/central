import { inngest } from '../client';
import { db } from '@/lib/db';
import { notifications, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendSlackMessageToUser, formatDueDateReminderNotification } from '@/lib/slack';
import type { UserPreferences } from '@/lib/db/schema/users';

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
    const { data } = event;

    // Check user preferences and get Slack username
    const slackConfig = await step.run('check-slack-preferences', async () => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, data.recipientId),
        columns: { preferences: true },
      });

      if (!user) return null;

      const prefs = user.preferences as UserPreferences | null;
      if (!prefs?.notifications?.slack?.enabled) return null;
      if (!prefs?.notifications?.slack?.dueDates) return null;
      if (!prefs?.notifications?.slack?.slackUsername) return null;

      return {
        slackUsername: prefs.notifications.slack.slackUsername,
      };
    });

    if (!slackConfig) {
      return { skipped: true, reason: 'Slack notifications disabled or not configured' };
    }

    // Format the Slack message
    const message = await step.run('format-message', async () => {
      const reminderType = data.isOverdue ? 'overdue' as const : 'due_soon' as const;
      return formatDueDateReminderNotification(
        {
          taskId: data.taskId,
          taskTitle: data.taskTitle,
          boardId: data.boardId,
          clientSlug: data.clientSlug,
          clientName: data.clientName,
          boardName: data.boardName,
          dueDate: data.dueDate,
        },
        reminderType
      );
    });

    // Send the Slack message
    const sendResult = await step.run('send-to-slack', async () => {
      return sendSlackMessageToUser(slackConfig.slackUsername, message);
    });

    if (!sendResult.success) {
      const isPermanent = sendResult.error?.includes('not found') ||
                         sendResult.error?.includes('Invalid') ||
                         sendResult.error?.includes('inactive');

      if (isPermanent) {
        console.error('Permanent Slack failure:', {
          notificationId: data.notificationId,
          username: slackConfig.slackUsername,
          error: sendResult.error,
        });
        return { status: 'failed', reason: sendResult.error, permanent: true };
      }

      throw new Error(sendResult.error ?? 'Failed to send Slack message');
    }

    // Update notification record with Slack sent timestamp
    await step.run('update-notification', async () => {
      await db
        .update(notifications)
        .set({ slackSentAt: new Date() })
        .where(eq(notifications.id, data.notificationId));
    });

    return { success: true, notificationId: data.notificationId };
  }
);
