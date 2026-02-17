import { inngest } from '../client';
import { resend, EMAIL_CONFIG } from '@/lib/email/client';
import {
  taskDueSoonEmailSubject,
  taskOverdueEmailSubject,
  taskDueEmailHtml,
} from '@/lib/email/templates';
import { db } from '@/lib/db';
import { notifications, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { UserPreferences } from '@/lib/db/schema/users';

/**
 * Inngest function to send due date reminder emails
 */
export const sendDueReminder = inngest.createFunction(
  {
    id: 'send-due-reminder',
    retries: 3,
  },
  { event: 'notification/due-reminder.scheduled' },
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
      if (!prefs?.notifications?.email?.dueDates) return false;

      // If digest mode is not instant, don't send immediately
      if (prefs.notifications.email.digest !== 'instant') return false;

      return true;
    });

    if (!shouldSend) {
      return { skipped: true, reason: 'User preferences' };
    }

    // Send the email
    const emailResult = await step.run('send-email', async () => {
      const subject = data.isOverdue
        ? taskOverdueEmailSubject(data.taskTitle)
        : taskDueSoonEmailSubject(data.taskTitle);

      const result = await resend.emails.send({
        from: EMAIL_CONFIG.from,
        to: data.recipientEmail,
        subject,
        html: await taskDueEmailHtml({
          recipientName: data.recipientName || 'there',
          taskTitle: data.taskTitle,
          taskId: data.taskId,
          taskShortId: data.taskShortId || undefined,
          boardId: data.boardId,
          clientSlug: data.clientSlug,
          clientName: data.clientName,
          boardName: data.boardName,
          taskStatus: data.taskStatus,
          dueDate: data.dueDate,
          isOverdue: data.isOverdue,
        }),
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
