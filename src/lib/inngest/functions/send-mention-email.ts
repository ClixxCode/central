import { inngest } from '../client';
import { getAppUrl } from '@/lib/email/client';
import { sendCentralTemplateEmail } from '@/lib/email/send-template';
import {
  CENTRAL_EMAIL_TEMPLATE_ALIASES,
  formatEmailDate,
  mentionEmailSubject,
} from '@/lib/email/templates';
import { db } from '@/lib/db';
import { notifications, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { UserPreferences } from '@/lib/db/schema/users';

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
    const { data } = event;

    // Check user preferences
    const shouldSend = await step.run('check-preferences', async () => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, data.recipientId),
        columns: { preferences: true },
      });

      if (!user) return false;

      const prefs = user.preferences as UserPreferences | null;
      if (!prefs?.notifications?.email?.enabled) return false;
      if (!prefs?.notifications?.email?.mentions) return false;

      // If digest mode is not instant, don't send immediately
      if (prefs.notifications.email.digest !== 'instant') return false;

      return true;
    });

    if (!shouldSend) {
      return { skipped: true, reason: 'User preferences' };
    }

    // Send the email
    const emailResult = await step.run('send-email', async () => {
      const taskUrl = data.taskShortId
        ? `${getAppUrl()}/t/${data.taskShortId}`
        : `${getAppUrl()}/clients/${data.clientSlug}/boards/${data.boardId}?task=${data.taskId}`;

      const result = await sendCentralTemplateEmail({
        templateAlias: CENTRAL_EMAIL_TEMPLATE_ALIASES.mention,
        to: data.recipientEmail,
        subject: mentionEmailSubject(data.mentionerName, data.taskTitle),
        variables: {
          RECIPIENT_NAME: data.recipientName || 'there',
          MENTIONER_NAME: data.mentionerName,
          TASK_TITLE: data.taskTitle,
          TASK_STATUS: data.taskStatus,
          TASK_STATUS_COLOR: data.taskStatusColor,
          TASK_STATUS_BACKGROUND_COLOR: data.taskStatusBackgroundColor,
          TASK_DUE_DATE: data.taskDueDate ? formatEmailDate(data.taskDueDate) : undefined,
          COMMENT_PREVIEW: data.commentPreview || undefined,
          CTA_URL: taskUrl,
        },
      });

      return result;
    });

    // Update notification record with email sent timestamp
    await step.run('update-notification', async () => {
      await db
        .update(notifications)
        .set({ emailSentAt: new Date() })
        .where(eq(notifications.id, data.notificationId));
    });

    return {
      success: true,
      emailId: emailResult.data?.id,
    };
  }
);
