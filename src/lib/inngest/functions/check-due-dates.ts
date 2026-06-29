import {
  getCurrentOrgDate,
  processDailyDigestSchedule,
  processDueDateScan,
} from '@/lib/background-jobs';
import { shouldDispatchBackgroundJobsViaInngest } from '@/lib/queues/background-jobs';
import { inngest } from '../client';

/**
 * Inngest cron function to check for tasks that are due soon or overdue.
 * Runs daily at 8 AM.
 */
export const checkDueDates = inngest.createFunction(
  {
    id: 'check-due-dates',
    retries: 3,
  },
  { cron: '0 8 * * *' },
  async ({ step }) => {
    if (!shouldDispatchBackgroundJobsViaInngest()) {
      return { skipped: true, reason: 'Background job delivery mode is queue-only' };
    }

    return step.run('process-due-date-scan', async () => {
      return processDueDateScan(
        { orgDate: await getCurrentOrgDate() },
        { runnerId: 'inngest' }
      );
    });
  }
);

/**
 * Inngest cron function to send daily digest emails.
 * Runs daily at 7 AM before due date checks.
 */
export const scheduleDailyDigests = inngest.createFunction(
  {
    id: 'schedule-daily-digests',
    retries: 3,
  },
  { cron: '0 7 * * *' },
  async ({ step }) => {
    if (!shouldDispatchBackgroundJobsViaInngest()) {
      return { skipped: true, reason: 'Background job delivery mode is queue-only' };
    }

    return step.run('process-daily-digest-schedule', async () => {
      return processDailyDigestSchedule(
        { orgDate: await getCurrentOrgDate() },
        { runnerId: 'inngest' }
      );
    });
  }
);
