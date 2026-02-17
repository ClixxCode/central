import { NextRequest, NextResponse } from 'next/server';
import { requireTokenAuth } from '@/lib/extension/auth';
import { corsHeaders, handlePreflight } from '@/lib/extension/cors';
import { db } from '@/lib/db';
import {
  tasks,
  taskAssignees,
  boards,
  boardAccess,
  clients,
  users,
  teamMembers,
} from '@/lib/db/schema';
import { eq, and, inArray, asc, isNull, sql } from 'drizzle-orm';

export async function OPTIONS(request: NextRequest) {
  return handlePreflight(request);
}

// --- Access helpers (same as tasks/route.ts) ---

type AccessLevel = 'full' | 'assigned_only' | null;

async function isUserInContractorTeam(userId: string): Promise<boolean> {
  const rows = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, userId),
    with: { team: { columns: { excludeFromPublic: true } } },
  });
  return rows.some((tm) => tm.team.excludeFromPublic);
}

async function getBoardAccessLevel(
  userId: string,
  boardId: string,
  isAdmin: boolean
): Promise<AccessLevel> {
  if (isAdmin) return 'full';

  const board = await db.query.boards.findFirst({
    where: eq(boards.id, boardId),
    columns: { type: true, createdBy: true },
  });
  if (board?.type === 'personal') return board.createdBy === userId ? 'full' : null;

  const isContractor = await isUserInContractorTeam(userId);
  if (!isContractor) return 'full';

  const directAccess = await db.query.boardAccess.findFirst({
    where: and(eq(boardAccess.boardId, boardId), eq(boardAccess.userId, userId)),
  });
  if (directAccess) return directAccess.accessLevel;

  const userTeams = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, userId),
    columns: { teamId: true },
  });
  if (userTeams.length === 0) return null;

  const teamAccess = await db.query.boardAccess.findFirst({
    where: and(
      eq(boardAccess.boardId, boardId),
      inArray(
        boardAccess.teamId,
        userTeams.map((t) => t.teamId)
      )
    ),
  });
  return teamAccess?.accessLevel ?? null;
}

// --- GET: List current user's assigned tasks ---

export async function GET(request: NextRequest) {
  const headers = corsHeaders(request);

  const user = await requireTokenAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  }

  const isAdmin = user.role === 'admin';

  // Get all tasks where the user is assigned
  const userAssignments = await db
    .select({ taskId: taskAssignees.taskId })
    .from(taskAssignees)
    .where(eq(taskAssignees.userId, user.id));

  if (userAssignments.length === 0) {
    return NextResponse.json([], { headers });
  }

  const assignedTaskIds = userAssignments.map((a) => a.taskId);

  // Get all assigned tasks with board and client info
  const tasksWithContext = await db
    .select({
      taskId: tasks.id,
      taskTitle: tasks.title,
      taskStatus: tasks.status,
      taskSection: tasks.section,
      taskDueDate: tasks.dueDate,
      taskPosition: tasks.position,
      taskParentTaskId: tasks.parentTaskId,
      taskCreatedAt: tasks.createdAt,
      taskUpdatedAt: tasks.updatedAt,
      boardId: boards.id,
      boardName: boards.name,
      boardType: boards.type,
      boardStatusOptions: boards.statusOptions,
      clientId: clients.id,
      clientName: clients.name,
      clientSlug: clients.slug,
      clientColor: clients.color,
    })
    .from(tasks)
    .innerJoin(boards, eq(tasks.boardId, boards.id))
    .innerJoin(clients, eq(boards.clientId, clients.id))
    .where(and(inArray(tasks.id, assignedTaskIds), isNull(tasks.archivedAt)))
    .orderBy(asc(tasks.dueDate), asc(tasks.position));

  // Filter by accessible boards
  const boardAccessCache = new Map<string, AccessLevel>();
  const accessibleTasks: typeof tasksWithContext = [];

  for (const task of tasksWithContext) {
    let level = boardAccessCache.get(task.boardId);
    if (level === undefined) {
      level = await getBoardAccessLevel(user.id, task.boardId, isAdmin);
      boardAccessCache.set(task.boardId, level);
    }
    if (level) {
      accessibleTasks.push(task);
    }
  }

  // Get assignees for all tasks
  const accessibleTaskIds = accessibleTasks.map((t) => t.taskId);
  const assigneesData =
    accessibleTaskIds.length > 0
      ? await db
          .select({
            taskId: taskAssignees.taskId,
            userId: taskAssignees.userId,
            name: users.name,
            avatarUrl: users.avatarUrl,
          })
          .from(taskAssignees)
          .innerJoin(users, eq(users.id, taskAssignees.userId))
          .where(inArray(taskAssignees.taskId, accessibleTaskIds))
      : [];

  const assigneesByTask = new Map<string, { id: string; name: string | null; avatarUrl: string | null }[]>();
  for (const a of assigneesData) {
    if (!assigneesByTask.has(a.taskId)) assigneesByTask.set(a.taskId, []);
    assigneesByTask.get(a.taskId)!.push({ id: a.userId, name: a.name, avatarUrl: a.avatarUrl });
  }

  // Get subtask counts
  const topLevelTaskIds = accessibleTasks.filter((t) => !t.taskParentTaskId).map((t) => t.taskId);
  const subtaskCountsData =
    topLevelTaskIds.length > 0
      ? await db
          .select({
            parentId: tasks.parentTaskId,
            total: sql<number>`COUNT(*)::int`,
            completed: sql<number>`COUNT(*) FILTER (WHERE ${tasks.status} IN ('complete', 'done'))::int`,
          })
          .from(tasks)
          .where(inArray(tasks.parentTaskId, topLevelTaskIds))
          .groupBy(tasks.parentTaskId)
      : [];

  const subtaskCountByParent = new Map<string, { total: number; completed: number }>();
  for (const s of subtaskCountsData) {
    if (s.parentId) subtaskCountByParent.set(s.parentId, { total: s.total, completed: s.completed });
  }

  // Get parent titles for subtasks
  const parentIds = [...new Set(accessibleTasks.filter((t) => t.taskParentTaskId).map((t) => t.taskParentTaskId!))];
  const parentTasksData =
    parentIds.length > 0
      ? await db.select({ id: tasks.id, title: tasks.title }).from(tasks).where(inArray(tasks.id, parentIds))
      : [];
  const parentTaskMap = new Map(parentTasksData.map((p) => [p.id, p]));

  // Get user's priority task IDs from preferences
  const userRecord = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { preferences: true },
  });
  const priorityTaskIds: string[] = (userRecord?.preferences as any)?.priorityTaskIds ?? [];
  const prioritySet = new Set(priorityTaskIds);

  return NextResponse.json(
    accessibleTasks.map((t) => {
      const parentInfo = t.taskParentTaskId ? parentTaskMap.get(t.taskParentTaskId) : null;
      const subtaskInfo = subtaskCountByParent.get(t.taskId);
      return {
        id: t.taskId,
        title: t.taskTitle,
        status: t.taskStatus,
        section: t.taskSection,
        dueDate: t.taskDueDate,
        position: t.taskPosition,
        isPriority: prioritySet.has(t.taskId),
        isSubtask: !!t.taskParentTaskId,
        parentTask: parentInfo ? { id: parentInfo.id, title: parentInfo.title } : null,
        subtaskCount: subtaskInfo?.total ?? 0,
        subtaskCompletedCount: subtaskInfo?.completed ?? 0,
        boardId: t.boardId,
        boardName: t.boardName,
        boardType: t.boardType,
        statusOptions: t.boardStatusOptions,
        clientName: t.clientName,
        clientSlug: t.clientSlug,
        clientColor: t.clientColor,
        assignees: assigneesByTask.get(t.taskId) ?? [],
        createdAt: t.taskCreatedAt,
        updatedAt: t.taskUpdatedAt,
      };
    }),
    { headers }
  );
}
