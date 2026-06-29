import { randomBytes } from 'crypto';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  claimAsyncJob,
  completeAsyncJob,
  enqueueAsyncJob,
  failAsyncJob,
  skipAsyncJob,
  type AsyncJob,
  type AsyncJobClaimMissReason,
} from '@/lib/async-jobs';
import { db } from '@/lib/db';
import { boards, taskAssignees, tasks } from '@/lib/db/schema';
import type { RecurringConfig } from '@/lib/db/schema/tasks';
import type { RecurringTaskCompletedEvent } from '@/lib/inngest/events';
import {
  getRecurringNextTaskDedupeKey,
  RECURRING_NEXT_TASK_JOB_KIND,
} from '@/lib/queues/background-jobs';
import {
  calculateNextOccurrence,
  shouldGenerateNextOccurrence,
} from '@/lib/utils/recurring';

export type RecurringTaskRunnerId = 'inngest' | 'vercel-queue' | (string & {});

export type RecurringTaskProcessorOptions = {
  runnerId: RecurringTaskRunnerId;
};

export type RecurringTaskProcessorResult =
  | {
      status: 'completed';
      jobId: string;
      dedupeKey: string;
      newTaskId: string;
      nextDueDate: string;
      recurringGroupId: string;
      clonedSubtaskCount: number;
      duplicatePrevented?: boolean;
    }
  | {
      status: 'skipped';
      jobId?: string;
      dedupeKey: string;
      reason: string;
      claimMissReason?: AsyncJobClaimMissReason;
    };

type SubtaskCloneTemplate = {
  title: string;
  description: TaskDescription;
  section: string | null;
  dueDate: string | null;
  dateFlexibility: 'not_set' | 'flexible' | 'semi_flexible' | 'not_flexible';
  position: number;
  assigneeIds: string[];
};

type TaskDescription = typeof tasks.$inferSelect.description;

export async function processRecurringNextTask(
  data: RecurringTaskCompletedEvent['data'],
  options: RecurringTaskProcessorOptions
): Promise<RecurringTaskProcessorResult> {
  const dedupeKey = getRecurringNextTaskDedupeKey(data.taskId);

  await enqueueAsyncJob({
    dedupeKey,
    kind: RECURRING_NEXT_TASK_JOB_KIND,
    payload: { ...data },
  });

  const claim = await claimAsyncJob({
    dedupeKey,
    runnerId: options.runnerId,
  });

  if (!claim.claimed) {
    return {
      status: 'skipped',
      jobId: claim.job?.id,
      dedupeKey,
      reason: `Async job claim skipped: ${claim.reason}`,
      claimMissReason: claim.reason,
    };
  }

  try {
    return await createClaimedRecurringNextTask(claim.job, data, options.runnerId);
  } catch (error) {
    await failAsyncJob({
      dedupeKey,
      claimedBy: options.runnerId,
      error,
      retryable: false,
    });
    throw error;
  }
}

async function createClaimedRecurringNextTask(
  job: AsyncJob,
  data: RecurringTaskCompletedEvent['data'],
  runnerId: RecurringTaskRunnerId
): Promise<RecurringTaskProcessorResult> {
  const existingCount = await countRecurringOccurrences(data.recurringGroupId);
  const shouldGenerate = shouldGenerateNextOccurrence(
    data.recurringConfig as RecurringConfig,
    existingCount
  );

  if (!shouldGenerate) {
    return skipClaimedRecurringJob(
      job,
      runnerId,
      'Recurring series has ended (occurrence limit reached)'
    );
  }

  const nextDueDate = calculateNextOccurrence(
    data.recurringConfig as RecurringConfig,
    data.completedDueDate,
    new Date()
  );

  if (!nextDueDate) {
    return skipClaimedRecurringJob(job, runnerId, 'No next occurrence (end date passed)');
  }

  const existingNextTask = await db.query.tasks.findFirst({
    where: and(
      eq(tasks.recurringGroupId, data.recurringGroupId),
      eq(tasks.dueDate, nextDueDate),
      isNull(tasks.parentTaskId)
    ),
    columns: { id: true },
  });

  if (existingNextTask) {
    await completeAsyncJob({ dedupeKey: job.dedupeKey, claimedBy: runnerId });
    return {
      status: 'completed',
      jobId: job.id,
      dedupeKey: job.dedupeKey,
      newTaskId: existingNextTask.id,
      nextDueDate,
      recurringGroupId: data.recurringGroupId,
      clonedSubtaskCount: 0,
      duplicatePrevented: true,
    };
  }

  const boardInfo = await db.query.boards.findFirst({
    where: eq(boards.id, data.boardId),
    columns: { statusOptions: true },
  });
  const defaultStatus = boardInfo?.statusOptions?.[0]?.id ?? 'todo';
  const subtasksWithAssignees = await listSubtasksForClone(data.taskId);

  const created = await db.transaction(async (tx) => {
    const maxPositionResult = await tx
      .select({ maxPos: sql<number>`COALESCE(MAX(${tasks.position}), -1)` })
      .from(tasks)
      .where(eq(tasks.boardId, data.boardId));
    const position = (maxPositionResult[0]?.maxPos ?? -1) + 1;
    const [createdTask] = await tx
      .insert(tasks)
      .values({
        boardId: data.boardId,
        shortId: generateShortId(),
        title: data.title,
        description: data.description as TaskDescription,
        status: defaultStatus,
        section: data.section,
        dueDate: nextDueDate,
        dateFlexibility: data.dateFlexibility as
          | 'not_set'
          | 'flexible'
          | 'semi_flexible'
          | 'not_flexible',
        recurringConfig: data.recurringConfig as RecurringConfig,
        recurringGroupId: data.recurringGroupId,
        subtasksBreakoutEnabled: data.subtasksBreakoutEnabled ?? false,
        subtasksSequentialEnabled: data.subtasksSequentialEnabled ?? false,
        position,
        createdBy: data.completedByUserId,
      })
      .returning();

    if (data.assigneeIds && data.assigneeIds.length > 0) {
      await tx.insert(taskAssignees).values(
        data.assigneeIds.map((userId) => ({
          taskId: createdTask.id,
          userId,
        }))
      );
    }

    let clonedSubtaskCount = 0;
    if (subtasksWithAssignees.length > 0) {
      const clonedTasks = await tx
        .insert(tasks)
        .values(
          subtasksWithAssignees.map((subtask) => ({
            boardId: data.boardId,
            shortId: generateShortId(),
            parentTaskId: createdTask.id,
            title: subtask.title,
            description: subtask.description,
            status: defaultStatus,
            section: subtask.section,
            dueDate: calculateShiftedSubtaskDueDate({
              originalSubtaskDueDate: subtask.dueDate,
              completedParentDueDate: data.completedDueDate,
              nextParentDueDate: nextDueDate,
            }),
            dateFlexibility: subtask.dateFlexibility,
            position: subtask.position,
            createdBy: data.completedByUserId,
          }))
        )
        .returning({ id: tasks.id });
      const clonedAssignees = subtasksWithAssignees.flatMap((subtask, index) =>
        subtask.assigneeIds.map((userId) => ({
          taskId: clonedTasks[index].id,
          userId,
        }))
      );

      if (clonedAssignees.length > 0) {
        await tx.insert(taskAssignees).values(clonedAssignees);
      }

      clonedSubtaskCount = clonedTasks.length;
    }

    return {
      newTaskId: createdTask.id,
      clonedSubtaskCount,
    };
  });

  await completeAsyncJob({ dedupeKey: job.dedupeKey, claimedBy: runnerId });

  return {
    status: 'completed',
    jobId: job.id,
    dedupeKey: job.dedupeKey,
    newTaskId: created.newTaskId,
    nextDueDate,
    recurringGroupId: data.recurringGroupId,
    clonedSubtaskCount: created.clonedSubtaskCount,
  };
}

async function countRecurringOccurrences(recurringGroupId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tasks)
    .where(eq(tasks.recurringGroupId, recurringGroupId));

  return result[0]?.count ?? 0;
}

async function listSubtasksForClone(parentTaskId: string): Promise<SubtaskCloneTemplate[]> {
  const subtaskList = await db
    .select()
    .from(tasks)
    .where(eq(tasks.parentTaskId, parentTaskId))
    .orderBy(asc(tasks.position));

  if (subtaskList.length === 0) {
    return [];
  }

  const subtaskIds = subtaskList.map((subtask) => subtask.id);
  const allAssignees = await db
    .select({ taskId: taskAssignees.taskId, userId: taskAssignees.userId })
    .from(taskAssignees)
    .where(inArray(taskAssignees.taskId, subtaskIds));
  const assigneesByTask = new Map<string, string[]>();

  for (const assignee of allAssignees) {
    const list = assigneesByTask.get(assignee.taskId) ?? [];
    list.push(assignee.userId);
    assigneesByTask.set(assignee.taskId, list);
  }

  return subtaskList.map((subtask) => ({
    title: subtask.title,
    description: subtask.description,
    section: subtask.section,
    dueDate: subtask.dueDate,
    dateFlexibility: subtask.dateFlexibility,
    position: subtask.position,
    assigneeIds: assigneesByTask.get(subtask.id) ?? [],
  }));
}

async function skipClaimedRecurringJob(
  job: AsyncJob,
  runnerId: RecurringTaskRunnerId,
  reason: string
): Promise<RecurringTaskProcessorResult> {
  await skipAsyncJob({
    dedupeKey: job.dedupeKey,
    claimedBy: runnerId,
    reason,
  });

  return {
    status: 'skipped',
    jobId: job.id,
    dedupeKey: job.dedupeKey,
    reason,
  };
}

function calculateShiftedSubtaskDueDate(input: {
  originalSubtaskDueDate: string | null;
  completedParentDueDate: string;
  nextParentDueDate: string;
}): string | null {
  if (!input.originalSubtaskDueDate) {
    return null;
  }

  const offsetMs =
    new Date(input.originalSubtaskDueDate).getTime() -
    new Date(input.completedParentDueDate).getTime();
  const newDate = new Date(new Date(input.nextParentDueDate).getTime() + offsetMs);

  return newDate.toISOString().split('T')[0];
}

function generateShortId(): string {
  return randomBytes(6).toString('base64url');
}
