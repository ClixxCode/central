import { inngest } from '../client';
import { db } from '@/lib/db';
import { notifications, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendSlackMessageToUser, formatCommentAddedNotification } from '@/lib/slack';
import type { UserPreferences } from '@/lib/db/schema/users';

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
      if (!prefs?.notifications?.slack?.newComments) return null;
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
      return formatCommentAddedNotification({
        taskId: data.taskId,
        taskTitle: data.taskTitle,
        boardId: data.boardId,
        clientSlug: data.clientSlug,
        actorName: data.commenterName,
        commentPreview: data.commentPreview || undefined,
        commentId: data.commentId,
      });
    });

    // Send the Slack message
    const sendResult = await step.run('send-to-slack', async () => {
      return sendSlackMessageToUser(slackConfig.slackUsername, message);
    });

    if (!sendResult.success) {
      // Log permanent failures but don't retry
      const isPermanent = sendResult.error?.includes('not found') || 
                         sendResult.error?.includes('Invalid') ||
                         sendResult.error?.includes('inactive');
      
      if (isPermanent) {
        console.error('Permanent Slack failure:', {
          notificationId: data.notificationId,
          username: slackConfig.slackUsername,
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
