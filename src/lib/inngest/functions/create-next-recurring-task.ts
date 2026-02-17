import { inngest } from '../client';
import { db } from '@/lib/db';
import { tasks, taskAssignees, boards } from '@/lib/db/schema';
import { eq, asc, sql } from 'drizzle-orm';
import {
  calculateNextOccurrence,
  shouldGenerateNextOccurrence,
} from '@/lib/utils/recurring';
import type { RecurringConfig } from '@/lib/db/schema/tasks';
import { randomBytes } from 'crypto';

function generateShortId(): string {
  return randomBytes(6).toString('base64url');
}

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
    const { data } = event;

    // Step 1: Count existing tasks in this recurring group to check limits
    const existingCount = await step.run('count-existing-occurrences', async () => {
      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(eq(tasks.recurringGroupId, data.recurringGroupId));
      return result[0]?.count ?? 0;
    });

    // Step 2: Check if we should generate the next occurrence
    const shouldGenerate = await step.run('check-should-generate', async () => {
      return shouldGenerateNextOccurrence(
        data.recurringConfig as RecurringConfig,
        existingCount
      );
    });

    if (!shouldGenerate) {
      return { skipped: true, reason: 'Recurring series has ended (occurrence limit reached)' };
    }

    // Step 3: Calculate next due date
    const nextDueDate = await step.run('calculate-next-date', async () => {
      return calculateNextOccurrence(
        data.recurringConfig as RecurringConfig,
        data.completedDueDate,
        new Date()
      );
    });

    if (!nextDueDate) {
      return { skipped: true, reason: 'No next occurrence (end date passed)' };
    }

    // Step 4: Get board info for default status
    const boardInfo = await step.run('get-board-info', async () => {
      const board = await db.query.boards.findFirst({
        where: eq(boards.id, data.boardId),
        columns: { statusOptions: true },
      });
      return board;
    });

    // Get the first status option (typically "To Do" or similar)
    const defaultStatus = boardInfo?.statusOptions?.[0]?.id ?? 'todo';

    // Step 5: Create the next task instance
    const newTask = await step.run('create-task', async () => {
      // Get max position for this board
      const maxPositionResult = await db
        .select({ maxPos: sql<number>`COALESCE(MAX(${tasks.position}), -1)` })
        .from(tasks)
        .where(eq(tasks.boardId, data.boardId));

      const position = (maxPositionResult[0]?.maxPos ?? -1) + 1;

      const [createdTask] = await db
        .insert(tasks)
        .values({
          boardId: data.boardId,
          shortId: generateShortId(),
          title: data.title,
          description: data.description,
          status: defaultStatus,
          section: data.section,
          dueDate: nextDueDate,
          dateFlexibility: data.dateFlexibility as 'not_set' | 'flexible' | 'semi_flexible' | 'not_flexible',
          recurringConfig: data.recurringConfig as RecurringConfig,
          recurringGroupId: data.recurringGroupId,
          position,
          createdBy: data.completedByUserId,
        })
        .returning();

      return createdTask;
    });

    // Step 6: Add assignees to the new task
    if (data.assigneeIds && data.assigneeIds.length > 0) {
      await step.run('add-assignees', async () => {
        await db.insert(taskAssignees).values(
          data.assigneeIds.map((userId: string) => ({
            taskId: newTask.id,
            userId,
          }))
        );
      });
    }

    // Step 7: Query subtasks of the completed parent task
    const subtasksWithAssignees = await step.run('query-subtasks', async () => {
      const subtaskList = await db
        .select()
        .from(tasks)
        .where(eq(tasks.parentTaskId, data.taskId))
        .orderBy(asc(tasks.position));

      if (subtaskList.length === 0) return [];

      // Batch-query assignees for all subtasks
      const subtaskIds = subtaskList.map((s) => s.id);
      const allAssignees = await db
        .select({ taskId: taskAssignees.taskId, userId: taskAssignees.userId })
        .from(taskAssignees)
        .where(sql`${taskAssignees.taskId} = ANY(${subtaskIds})`);

      const assigneesByTask = new Map<string, string[]>();
      for (const a of allAssignees) {
        const list = assigneesByTask.get(a.taskId) ?? [];
        list.push(a.userId);
        assigneesByTask.set(a.taskId, list);
      }

      return subtaskList.map((s) => ({
        title: s.title,
        description: s.description,
        section: s.section,
        dueDate: s.dueDate,
        dateFlexibility: s.dateFlexibility,
        position: s.position,
        assigneeIds: assigneesByTask.get(s.id) ?? [],
      }));
    });

    // Step 8: Clone subtasks to the new parent task
    if (subtasksWithAssignees.length > 0) {
      const clonedSubtaskIds = await step.run('clone-subtasks', async () => {
        const parentDueDate = data.completedDueDate;

        const clonedTasks = await db
          .insert(tasks)
          .values(
            subtasksWithAssignees.map((s) => {
              // Calculate relative due date offset from parent
              let newSubtaskDueDate: string | null = null;
              if (s.dueDate && parentDueDate && nextDueDate) {
                const offsetMs =
                  new Date(s.dueDate).getTime() - new Date(parentDueDate).getTime();
                const newDate = new Date(
                  new Date(nextDueDate).getTime() + offsetMs
                );
                newSubtaskDueDate = newDate.toISOString().split('T')[0];
              }

              return {
                boardId: data.boardId,
                shortId: generateShortId(),
                parentTaskId: newTask.id,
                title: s.title,
                description: s.description,
                status: defaultStatus,
                section: s.section,
                dueDate: newSubtaskDueDate,
                dateFlexibility: s.dateFlexibility as 'not_set' | 'flexible' | 'semi_flexible' | 'not_flexible',
                position: s.position,
                createdBy: data.completedByUserId,
              };
            })
          )
          .returning({ id: tasks.id });

        return clonedTasks.map((t) => t.id);
      });

      // Step 9: Clone subtask assignees
      const allSubtaskAssignees = subtasksWithAssignees.flatMap((s, i) =>
        s.assigneeIds.map((userId) => ({
          taskId: clonedSubtaskIds[i],
          userId,
        }))
      );

      if (allSubtaskAssignees.length > 0) {
        await step.run('clone-subtask-assignees', async () => {
          await db.insert(taskAssignees).values(allSubtaskAssignees);
        });
      }
    }

    return {
      success: true,
      newTaskId: newTask.id,
      nextDueDate,
      recurringGroupId: data.recurringGroupId,
      clonedSubtaskCount: subtasksWithAssignees.length,
    };
  }
);
