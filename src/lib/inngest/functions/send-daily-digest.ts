import { getCurrentOrgDate, processDailyDigestDelivery } from '@/lib/background-jobs';
import { shouldDispatchBackgroundJobsViaInngest } from '@/lib/queues/background-jobs';
import { inngest } from '../client';

/**
 * Inngest function to send daily digest emails.
 */
export const sendDailyDigest = inngest.createFunction(
  {
    id: 'send-daily-digest',
    retries: 3,
  },
  { event: 'notification/daily-digest.scheduled' },
  async ({ event, step }) => {
    if (!shouldDispatchBackgroundJobsViaInngest()) {
      return { skipped: true, reason: 'Background job delivery mode is queue-only' };
    }

    return step.run('process-daily-digest-delivery', async () => {
      return processDailyDigestDelivery(
        {
          ...event.data,
          orgDate: event.data.orgDate ?? (await getCurrentOrgDate()),
        },
        { runnerId: 'inngest' }
      );
    });
  }
);
