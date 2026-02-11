import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import {
  sendMentionEmail,
  sendAssignmentEmail,
  sendDueReminder,
  sendDailyDigest,
  checkDueDates,
  scheduleDailyDigests,
  createNextRecurringTask,
  sendCommentAddedEmail,
  autoArchiveTasks,
  sendCommentSlackNotification,
  sendMentionSlackNotification,
  sendAssignmentSlackNotification,
  sendDueDateSlackNotification,
} from '@/lib/inngest/functions';

// Create an API that serves Inngest functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // Email notifications
    sendMentionEmail,
    sendAssignmentEmail,
    sendDueReminder,
    sendDailyDigest,
    sendCommentAddedEmail,
    // Slack notifications
    sendCommentSlackNotification,
    sendMentionSlackNotification,
    sendAssignmentSlackNotification,
    sendDueDateSlackNotification,
    // Scheduled tasks
    checkDueDates,
    scheduleDailyDigests,
    createNextRecurringTask,
    autoArchiveTasks,
  ],
});
