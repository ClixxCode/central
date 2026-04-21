import { inngest } from '../client';
import { db } from '@/lib/db';
import { tasks, boards } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import type { StatusOption } from '@/lib/db/schema/boards';

/**
 * Stub: generate onboarding tasks on a newly-created kanban board.
 *
 * The real implementation will invoke Claude (acting as an expert digital
 * marketing PM) over the services sold and the target website's tech stack.
 * For now we insert a single placeholder task so the board isn't empty when
 * an AM opens it — proving the bridge end-to-end.
 */
export const generateOnboardingTasks = inngest.createFunction(
  {
    id: 'generate-onboarding-tasks',
    retries: 3,
  },
  { event: 'pulse/onboarding.tasks.requested' },
  async ({ event, step }) => {
    const { centralBoardId, accountName, services, targetWebsite } = event.data as {
      centralClientId: string;
      centralBoardId: string;
      pulseAccountId: string;
      accountName: string;
      targetWebsite: string | null;
      services: Array<{
        name: string;
        catalog_id: string | null;
        onboarding_scope: string | null;
        accesses_required: string | null;
      }>;
    };

    const board = await step.run('fetch-board', async () => {
      return db.query.boards.findFirst({
        where: eq(boards.id, centralBoardId),
      });
    });

    if (!board) {
      return { skipped: true, reason: 'Board not found' };
    }

    const statusOptions = (board.statusOptions ?? []) as StatusOption[];
    const firstStatusId = statusOptions[0]?.id ?? 'todo';

    const serviceList = services.map((s) => s.name).join(', ') || 'engagement';
    const title = `Kick off onboarding for ${accountName}`;
    const description = {
      type: 'doc' as const,
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: `Services sold: ${serviceList}.${
                targetWebsite ? ` Target website: ${targetWebsite}.` : ''
              } Replace this placeholder with AI-generated onboarding tasks.`,
            },
          ],
        },
      ],
    };

    const position = await step.run('next-position', async () => {
      const siblings = await db.query.tasks.findMany({
        where: eq(tasks.boardId, centralBoardId),
        orderBy: [asc(tasks.position)],
        limit: 1,
      });
      return siblings.length === 0 ? 0 : (siblings[0].position ?? 0) + 1;
    });

    const [inserted] = await step.run('insert-placeholder-task', async () => {
      return db
        .insert(tasks)
        .values({
          boardId: centralBoardId,
          title,
          description,
          status: firstStatusId,
          position,
        })
        .returning();
    });

    return { insertedTaskId: inserted?.id ?? null };
  },
);
