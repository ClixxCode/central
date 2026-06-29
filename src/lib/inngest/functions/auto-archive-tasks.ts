import { getCurrentOrgDate, processAutoArchive } from '@/lib/background-jobs';
import { shouldDispatchBackgroundJobsViaInngest } from '@/lib/queues/background-jobs';
import { inngest } from '../client';

/**
 * Inngest cron function to auto-archive completed tasks.
 * Runs daily at 3 AM.
 */
export const autoArchiveTasks = inngest.createFunction(
  {
    id: 'auto-archive-tasks',
    retries: 3,
  },
  { cron: '0 3 * * *' },
  async ({ step }) => {
    if (!shouldDispatchBackgroundJobsViaInngest()) {
      return { skipped: true, reason: 'Background job delivery mode is queue-only' };
    }

    return step.run('process-auto-archive', async () => {
      return processAutoArchive(
        { orgDate: await getCurrentOrgDate() },
        { runnerId: 'inngest' }
      );
    });
  }
);
