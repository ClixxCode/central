import { processRecurringNextTask } from '@/lib/recurring-tasks';
import { shouldDispatchRecurringTasksViaInngest } from '@/lib/queues/background-jobs';
import { inngest } from '../client';

/**
 * Inngest function to create the next recurring task instance.
 * Triggered when a recurring task is marked as complete.
 */
export const createNextRecurringTask = inngest.createFunction(
  {
    id: 'create-next-recurring-task',
    retries: 3,
  },
  { event: 'task/recurring.completed' },
  async ({ event, step }) => {
    if (!shouldDispatchRecurringTasksViaInngest()) {
      return { skipped: true, reason: 'Recurring task delivery mode is queue-only' };
    }

    return step.run('process-recurring-next-task', async () => {
      return processRecurringNextTask(event.data, { runnerId: 'inngest' });
    });
  }
);
