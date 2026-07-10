import 'server-only';

import { and, asc, eq, isNull } from 'drizzle-orm';
import { createTaskAsUser, updateTaskAsUser } from '@/lib/actions/tasks';
import { getBoardAccessLevel, canAccessTask } from '@/lib/actions/board-access';
import { db } from '@/lib/db';
import { boards, taskAssignees, tasks, users, type TiptapContent, type TiptapNode } from '@/lib/db/schema';

const MAX_TASKS = 100;

type McpUser = { id: string; role: 'admin' | 'user' };

export type McpBoard = {
  id: string;
  name: string;
  description: string | null;
  type: string;
};

export type McpTaskSummary = {
  id: string;
  shortId: string | null;
  boardId: string;
  title: string;
  status: string;
  section: string | null;
  dueDate: string | null;
  parentTaskId: string | null;
};

export type McpTask = McpTaskSummary & {
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * The MCP surface intentionally supports only the portable, low-risk task
 * fields. Other task properties continue to require Central's UI/API.
 */
export type McpCreateTaskInput = {
  boardId: string;
  title: string;
  status: string;
  section?: string;
  dueDate?: string;
};

export type McpUpdateTaskInput = {
  taskId: string;
  title?: string;
  status?: string;
  section?: string | null;
  dueDate?: string | null;
};

export type McpTaskMutation = {
  success: boolean;
  task?: McpTaskSummary;
  error?: string;
};

async function getMcpUser(userId: string): Promise<McpUser | null> {
  const user = await db.query.users.findFirst({
    where: and(eq(users.id, userId), isNull(users.deactivatedAt)),
    columns: { id: true, role: true },
  });
  return user ?? null;
}

function taskSummary(
  task: Pick<
    typeof tasks.$inferSelect,
    'id' | 'shortId' | 'boardId' | 'title' | 'status' | 'section' | 'dueDate' | 'parentTaskId'
  >
): McpTaskSummary {
  return {
    id: task.id,
    shortId: task.shortId,
    boardId: task.boardId,
    title: task.title,
    status: task.status,
    section: task.section,
    dueDate: task.dueDate,
    parentTaskId: task.parentTaskId,
  };
}

function tiptapText(content: TiptapContent | null): string | null {
  if (!content?.content) return null;

  const text: string[] = [];
  const visit = (node: TiptapNode) => {
    if (node.text) text.push(node.text);
    node.content?.forEach(visit);
  };
  content.content.forEach(visit);
  const value = text.join('').replace(/\s+/g, ' ').trim();
  return value || null;
}

/** Lists only boards the OAuth user can currently access in Central. */
export async function listMcpBoards(userId: string): Promise<McpBoard[]> {
  const user = await getMcpUser(userId);
  if (!user) return [];

  const allBoards = await db.query.boards.findMany({
    columns: { id: true, name: true, description: true, type: true },
    orderBy: [asc(boards.name)],
  });
  const access = await Promise.all(
    allBoards.map(async (board) => ({
      board,
      accessLevel: await getBoardAccessLevel(user.id, board.id, user.role === 'admin'),
    }))
  );

  return access.filter((entry) => entry.accessLevel).map((entry) => entry.board);
}

/** Lists a board's active tasks while applying the same assigned-only rule as Central's UI. */
export async function listMcpTasks(
  userId: string,
  boardId: string,
  limit = 50
): Promise<{ access: boolean; tasks: McpTaskSummary[] }> {
  const user = await getMcpUser(userId);
  if (!user) return { access: false, tasks: [] };

  const accessLevel = await getBoardAccessLevel(user.id, boardId, user.role === 'admin');
  if (!accessLevel) return { access: false, tasks: [] };

  const boardTasks = await db.query.tasks.findMany({
    where: and(eq(tasks.boardId, boardId), isNull(tasks.archivedAt)),
    orderBy: [asc(tasks.position), asc(tasks.createdAt)],
  });
  const capped = Math.min(Math.max(limit, 1), MAX_TASKS);

  if (accessLevel === 'full') {
    return { access: true, tasks: boardTasks.slice(0, capped).map(taskSummary) };
  }

  const assigned = await db.query.taskAssignees.findMany({
    where: eq(taskAssignees.userId, user.id),
    columns: { taskId: true },
  });
  const assignedTaskIds = new Set(assigned.map((assignment) => assignment.taskId));
  return {
    access: true,
    tasks: boardTasks.filter((task) => assignedTaskIds.has(task.id)).slice(0, capped).map(taskSummary),
  };
}

/** Returns a task only when the OAuth user retains current board-level access. */
export async function getMcpTask(userId: string, taskId: string): Promise<{ access: boolean; task: McpTask | null }> {
  const user = await getMcpUser(userId);
  if (!user) return { access: false, task: null };

  const result = await canAccessTask(user.id, taskId, user.role === 'admin');
  if (!result.canAccess || !result.task) return { access: false, task: null };

  return {
    access: true,
    task: {
      ...taskSummary(result.task),
      description: tiptapText(result.task.description),
      createdAt: result.task.createdAt.toISOString(),
      updatedAt: result.task.updatedAt.toISOString(),
    },
  };
}

/**
 * Create through the same Central domain action used by the web application.
 * The OAuth identity is resolved to a current Central user before the action
 * applies its board permission checks, activity logging, and invariants.
 */
export async function createMcpTask(userId: string, input: McpCreateTaskInput): Promise<McpTaskMutation> {
  const user = await getMcpUser(userId);
  if (!user) return { success: false, error: 'Central user is no longer active' };

  const result = await createTaskAsUser(user, input);
  if (!result.success || !result.task) return { success: false, error: result.error ?? 'Unable to create task' };
  return { success: true, task: taskSummary(result.task) };
}

/** See createMcpTask; updates stay on Central's shared task domain action. */
export async function updateMcpTask(userId: string, input: McpUpdateTaskInput): Promise<McpTaskMutation> {
  const user = await getMcpUser(userId);
  if (!user) return { success: false, error: 'Central user is no longer active' };

  const result = await updateTaskAsUser(user, {
    id: input.taskId,
    title: input.title,
    status: input.status,
    section: input.section,
    dueDate: input.dueDate,
  });
  if (!result.success || !result.task) return { success: false, error: result.error ?? 'Unable to update task' };
  return { success: true, task: taskSummary(result.task) };
}
