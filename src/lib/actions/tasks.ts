'use server';

import { db } from '@/lib/db';
import {
  tasks,
  taskAssignees,
  boards,
  boardAccess,
  teamMembers,
  teams,
  users,
  clients,
  comments,
  attachments,
  taskViews,
  TiptapContent,
  RecurringConfig,
  StatusOption,
  SectionOption,
} from '@/lib/db/schema';
import { eq, and, or, not, inArray, notInArray, desc, asc, sql, isNull, isNotNull, lt } from 'drizzle-orm';
import { getCurrentUser, requireAuth, SessionUser } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import { createAssignmentNotification } from './notifications';
import { logBoardActivity } from './board-activity';
import { inngest } from '@/lib/inngest/client';
import { getSiteSettings } from './site-settings';
import { getOrgToday } from '@/lib/utils/timezone';
import { randomBytes } from 'crypto';

function generateShortId(): string {
  return randomBytes(6).toString('base64url'); // 8 URL-safe chars
}

// Types
export interface TaskWithAssignees {
  id: string;
  shortId: string | null;
  boardId: string;
  title: string;
  description: TiptapContent | null;
  status: string;
  section: string | null;
  dueDate: string | null;
  dateFlexibility: 'not_set' | 'flexible' | 'semi_flexible' | 'not_flexible';
  recurringConfig: RecurringConfig | null;
  recurringGroupId: string | null;
  parentTaskId: string | null;
  position: number;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  assignees: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    deactivatedAt: Date | null;
  }[];
  // Activity indicators
  commentCount: number;
  attachmentCount: number;
  hasNewComments: boolean;
  // Subtask counts (0 for subtasks themselves)
  subtaskCount: number;
  subtaskCompletedCount: number;
  // Archive
  archivedAt: Date | null;
}

export interface CreateTaskInput {
  boardId: string;
  title: string;
  /** Description as JSON string to preserve nested attrs during Server Action serialization */
  descriptionJson?: string;
  /** @deprecated Use descriptionJson instead - this gets stripped by Server Action serialization */
  description?: TiptapContent;
  status: string;
  section?: string;
  dueDate?: string;
  dateFlexibility?: 'not_set' | 'flexible' | 'semi_flexible' | 'not_flexible';
  recurringConfig?: RecurringConfig;
  assigneeIds?: string[];
  position?: number;
  parentTaskId?: string;
}

export interface UpdateTaskInput {
  id: string;
  title?: string;
  /** Description as JSON string to preserve nested attrs during Server Action serialization */
  descriptionJson?: string | null;
  /** @deprecated Use descriptionJson instead - this gets stripped by Server Action serialization */
  description?: TiptapContent | null;
  status?: string;
  section?: string | null;
  dueDate?: string | null;
  dateFlexibility?: 'not_set' | 'flexible' | 'semi_flexible' | 'not_flexible';
  recurringConfig?: RecurringConfig | null;
  assigneeIds?: string[];
  position?: number;
  /** When completing a parent task, also mark all subtasks as complete */
  completeSubtasks?: boolean;
}

export type FilterMode = 'is' | 'is_not';

export interface TaskFilters {
  status?: string | string[];
  statusMode?: FilterMode;
  section?: string | string[];
  sectionMode?: FilterMode;
  assigneeId?: string | string[];
  assigneeMode?: FilterMode;
  overdue?: boolean;
}

export interface TaskSortOptions {
  field: 'position' | 'dueDate' | 'createdAt' | 'title' | 'status';
  direction: 'asc' | 'desc';
}

type AccessLevel = 'full' | 'assigned_only' | null;

/**
 * Check if user is in a contractor team (excludeFromPublic = true)
 * Contractor teams need explicit board_access entries to see boards
 */
async function isUserInContractorTeam(userId: string): Promise<boolean> {
  const userTeamsWithDetails = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, userId),
    with: {
      team: {
        columns: { excludeFromPublic: true },
      },
    },
  });

  return userTeamsWithDetails.some((tm) => tm.team.excludeFromPublic);
}

/**
 * Get user's access level for a board
 * Returns null if no access, or the access level ('full' or 'assigned_only')
 * Boards are PUBLIC by default - non-contractors get 'full' access
 * Contractors need explicit board_access entries
 */
async function getBoardAccessLevel(
  userId: string,
  boardId: string,
  isAdmin: boolean
): Promise<AccessLevel> {
  // Admins have full access to all boards
  if (isAdmin) {
    return 'full';
  }

  // Check if this is a personal board
  const board = await db.query.boards.findFirst({
    where: eq(boards.id, boardId),
    columns: { type: true, createdBy: true },
  });
  if (board?.type === 'personal') {
    return board.createdBy === userId ? 'full' : null;
  }

  // Check if user is in a contractor team
  const isContractor = await isUserInContractorTeam(userId);

  // Non-contractors have full access to all boards (public by default)
  if (!isContractor) {
    return 'full';
  }

  // Contractors need explicit access entries
  // Check direct user access
  const directAccess = await db.query.boardAccess.findFirst({
    where: and(
      eq(boardAccess.boardId, boardId),
      eq(boardAccess.userId, userId)
    ),
  });

  if (directAccess) {
    return directAccess.accessLevel;
  }

  // Check team access
  const userTeams = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, userId),
    columns: { teamId: true },
  });

  if (userTeams.length === 0) {
    return null;
  }

  const teamIds = userTeams.map((t) => t.teamId);

  const teamAccess = await db.query.boardAccess.findFirst({
    where: and(
      eq(boardAccess.boardId, boardId),
      inArray(boardAccess.teamId, teamIds)
    ),
  });

  return teamAccess?.accessLevel ?? null;
}

/**
 * Check if user can access a specific task
 */
async function canAccessTask(
  userId: string,
  taskId: string,
  isAdmin: boolean
): Promise<{ canAccess: boolean; task?: typeof tasks.$inferSelect }> {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });

  if (!task) {
    return { canAccess: false };
  }

  const accessLevel = await getBoardAccessLevel(userId, task.boardId, isAdmin);

  if (!accessLevel) {
    return { canAccess: false };
  }

  if (accessLevel === 'full') {
    return { canAccess: true, task };
  }

  // assigned_only - check if user is assigned to this task
  const assignment = await db.query.taskAssignees.findFirst({
    where: and(
      eq(taskAssignees.taskId, taskId),
      eq(taskAssignees.userId, userId)
    ),
  });

  return { canAccess: !!assignment, task: assignment ? task : undefined };
}

/**
 * List tasks for a board with permission filtering
 */
export async function listTasks(
  boardId: string,
  filters?: TaskFilters,
  sort?: TaskSortOptions
): Promise<{
  success: boolean;
  tasks?: TaskWithAssignees[];
  error?: string;
}> {
  const user = await requireAuth();
  const isAdmin = user.role === 'admin';

  // Check board access
  const accessLevel = await getBoardAccessLevel(user.id, boardId, isAdmin);

  if (!accessLevel) {
    return { success: false, error: 'Access denied to this board' };
  }

  // Build query conditions - exclude subtasks and archived tasks from board views
  const conditions = [eq(tasks.boardId, boardId), isNull(tasks.parentTaskId), isNull(tasks.archivedAt)];

  // Apply filters
  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    if (filters.statusMode === 'is_not') {
      conditions.push(notInArray(tasks.status, statuses));
    } else {
      conditions.push(inArray(tasks.status, statuses));
    }
  }

  if (filters?.section) {
    const sections = Array.isArray(filters.section) ? filters.section : [filters.section];
    const hasNoSection = sections.includes('__none__');
    const actualSections = sections.filter((s) => s !== '__none__');
    const isNot = filters.sectionMode === 'is_not';

    if (isNot) {
      // "is not" mode: exclude matching tasks
      if (hasNoSection && actualSections.length > 0) {
        // Exclude tasks with no section AND tasks in selected sections
        conditions.push(
          and(
            isNotNull(tasks.section),
            notInArray(tasks.section, actualSections)
          )!
        );
      } else if (hasNoSection) {
        // Exclude tasks with no section → only show tasks that have a section
        conditions.push(isNotNull(tasks.section));
      } else {
        // Exclude specific sections
        conditions.push(
          or(
            isNull(tasks.section),
            notInArray(tasks.section, actualSections)
          )!
        );
      }
    } else {
      if (hasNoSection && actualSections.length > 0) {
        conditions.push(
          or(
            isNull(tasks.section),
            inArray(tasks.section, actualSections)
          )!
        );
      } else if (hasNoSection) {
        conditions.push(isNull(tasks.section));
      } else {
        conditions.push(inArray(tasks.section, actualSections));
      }
    }
  }

  // Get tasks based on access level
  let taskList: typeof tasks.$inferSelect[];

  if (accessLevel === 'assigned_only') {
    // Get only tasks assigned to this user
    const assignedTaskIds = await db
      .select({ taskId: taskAssignees.taskId })
      .from(taskAssignees)
      .innerJoin(tasks, eq(tasks.id, taskAssignees.taskId))
      .where(
        and(
          eq(taskAssignees.userId, user.id),
          eq(tasks.boardId, boardId)
        )
      );

    if (assignedTaskIds.length === 0) {
      return { success: true, tasks: [] };
    }

    conditions.push(inArray(tasks.id, assignedTaskIds.map((t) => t.taskId)));
  }

  // Apply assignee filter if specified
  if (filters?.assigneeId) {
    const assigneeIds = Array.isArray(filters.assigneeId)
      ? filters.assigneeId
      : [filters.assigneeId];

    const tasksWithAssignee = await db
      .select({ taskId: taskAssignees.taskId })
      .from(taskAssignees)
      .where(inArray(taskAssignees.userId, assigneeIds));

    const matchingTaskIds = tasksWithAssignee.map((t) => t.taskId);

    if (filters.assigneeMode === 'is_not') {
      // Exclude tasks that have these assignees
      if (matchingTaskIds.length > 0) {
        conditions.push(notInArray(tasks.id, matchingTaskIds));
      }
      // If no tasks match, nothing to exclude — all tasks pass
    } else {
      if (matchingTaskIds.length === 0) {
        return { success: true, tasks: [] };
      }
      conditions.push(inArray(tasks.id, matchingTaskIds));
    }
  }

  // Apply overdue filter (exclude completed/done tasks)
  if (filters?.overdue) {
    const { data: siteSettingsData } = await getSiteSettings();
    const todayStr = getOrgToday(siteSettingsData?.timezone);
    const boardForOverdue = await db.query.boards.findFirst({
      where: eq(boards.id, boardId),
      columns: { statusOptions: true },
    });
    const doneStatusIds = (boardForOverdue?.statusOptions ?? [])
      .filter(
        (s) =>
          s.id === 'complete' ||
          s.id === 'done' ||
          s.label.toLowerCase().includes('complete') ||
          s.label.toLowerCase().includes('done')
      )
      .map((s) => s.id);
    conditions.push(
      and(
        isNotNull(tasks.dueDate),
        lt(tasks.dueDate, todayStr),
        ...(doneStatusIds.length > 0 ? [notInArray(tasks.status, doneStatusIds)] : [])
      )!
    );
  }

  // Determine sort order
  const sortField = sort?.field ?? 'position';
  const sortDir = sort?.direction ?? 'asc';

  const orderBy = (() => {
    const direction = sortDir === 'asc' ? asc : desc;
    switch (sortField) {
      case 'dueDate':
        return direction(tasks.dueDate);
      case 'createdAt':
        return direction(tasks.createdAt);
      case 'title':
        return direction(tasks.title);
      case 'status':
        return direction(tasks.status);
      case 'position':
      default:
        return direction(tasks.position);
    }
  })();

  taskList = await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(orderBy);

  // Get assignees for all tasks
  const taskIds = taskList.map((t) => t.id);

  const assigneesData =
    taskIds.length > 0
      ? await db
          .select({
            taskId: taskAssignees.taskId,
            userId: taskAssignees.userId,
            email: users.email,
            name: users.name,
            avatarUrl: users.avatarUrl,
            deactivatedAt: users.deactivatedAt,
          })
          .from(taskAssignees)
          .innerJoin(users, eq(users.id, taskAssignees.userId))
          .where(inArray(taskAssignees.taskId, taskIds))
      : [];

  // Group assignees by task
  const assigneesByTask = new Map<
    string,
    { id: string; email: string; name: string | null; avatarUrl: string | null; deactivatedAt: Date | null }[]
  >();

  for (const a of assigneesData) {
    if (!assigneesByTask.has(a.taskId)) {
      assigneesByTask.set(a.taskId, []);
    }
    assigneesByTask.get(a.taskId)!.push({
      id: a.userId,
      email: a.email,
      name: a.name,
      avatarUrl: a.avatarUrl,
      deactivatedAt: a.deactivatedAt,
    });
  }

  // Get comment counts for all tasks
  const commentCountsData =
    taskIds.length > 0
      ? await db
          .select({
            taskId: comments.taskId,
            count: sql<number>`COUNT(*)::int`,
          })
          .from(comments)
          .where(inArray(comments.taskId, taskIds))
          .groupBy(comments.taskId)
      : [];

  const commentCountByTask = new Map<string, number>();
  for (const c of commentCountsData) {
    commentCountByTask.set(c.taskId, c.count);
  }

  // Get attachment counts for all tasks (direct attachments only)
  const attachmentCountsData =
    taskIds.length > 0
      ? await db
          .select({
            taskId: attachments.taskId,
            count: sql<number>`COUNT(*)::int`,
          })
          .from(attachments)
          .where(inArray(attachments.taskId, taskIds))
          .groupBy(attachments.taskId)
      : [];

  const attachmentCountByTask = new Map<string, number>();
  for (const a of attachmentCountsData) {
    if (a.taskId) {
      attachmentCountByTask.set(a.taskId, a.count);
    }
  }

  // Get user's last view timestamps for all tasks
  const viewTimestampsData =
    taskIds.length > 0
      ? await db
          .select({
            taskId: taskViews.taskId,
            viewedAt: taskViews.viewedAt,
          })
          .from(taskViews)
          .where(
            and(
              inArray(taskViews.taskId, taskIds),
              eq(taskViews.userId, user.id)
            )
          )
      : [];

  const viewTimestampByTask = new Map<string, Date>();
  for (const v of viewTimestampsData) {
    viewTimestampByTask.set(v.taskId, v.viewedAt);
  }

  // Get latest comment timestamps for tasks that have comments
  const tasksWithComments = taskIds.filter((id) => (commentCountByTask.get(id) ?? 0) > 0);
  const latestCommentData =
    tasksWithComments.length > 0
      ? await db
          .select({
            taskId: comments.taskId,
            latestAt: sql<Date>`MAX(${comments.createdAt})`,
          })
          .from(comments)
          .where(inArray(comments.taskId, tasksWithComments))
          .groupBy(comments.taskId)
      : [];

  const latestCommentByTask = new Map<string, Date>();
  for (const c of latestCommentData) {
    latestCommentByTask.set(c.taskId, c.latestAt);
  }

  // Get subtask counts for parent tasks
  const subtaskCountsData =
    taskIds.length > 0
      ? await db
          .select({
            parentId: tasks.parentTaskId,
            count: sql<number>`COUNT(*)::int`,
          })
          .from(tasks)
          .where(inArray(tasks.parentTaskId, taskIds))
          .groupBy(tasks.parentTaskId)
      : [];

  const subtaskCountByParent = new Map<string, number>();
  for (const s of subtaskCountsData) {
    if (s.parentId) subtaskCountByParent.set(s.parentId, s.count);
  }

  // Get completed subtask counts using board's complete statuses
  const board = await db.query.boards.findFirst({
    where: eq(boards.id, boardId),
    columns: { statusOptions: true },
  });
  const completeStatusIds = (board?.statusOptions ?? [])
    .filter(
      (s) =>
        s.id === 'complete' ||
        s.id === 'done' ||
        s.label.toLowerCase().includes('complete') ||
        s.label.toLowerCase().includes('done')
    )
    .map((s) => s.id);

  const completedSubtaskCountsData =
    taskIds.length > 0 && completeStatusIds.length > 0
      ? await db
          .select({
            parentId: tasks.parentTaskId,
            count: sql<number>`COUNT(*)::int`,
          })
          .from(tasks)
          .where(
            and(
              inArray(tasks.parentTaskId, taskIds),
              inArray(tasks.status, completeStatusIds)
            )
          )
          .groupBy(tasks.parentTaskId)
      : [];

  const completedSubtaskCountByParent = new Map<string, number>();
  for (const s of completedSubtaskCountsData) {
    if (s.parentId) completedSubtaskCountByParent.set(s.parentId, s.count);
  }

  // Build response
  const tasksWithAssignees: TaskWithAssignees[] = taskList.map((task) => {
    const lastViewedAt = viewTimestampByTask.get(task.id);
    const latestCommentAt = latestCommentByTask.get(task.id);
    const hasNewComments =
      latestCommentAt !== undefined &&
      (lastViewedAt === undefined || latestCommentAt > lastViewedAt);

    return {
      id: task.id,
      shortId: task.shortId,
      boardId: task.boardId,
      title: task.title,
      description: task.description,
      status: task.status,
      section: task.section,
      dueDate: task.dueDate,
      dateFlexibility: task.dateFlexibility,
      recurringConfig: task.recurringConfig,
      recurringGroupId: task.recurringGroupId,
      parentTaskId: task.parentTaskId,
      position: task.position,
      createdBy: task.createdBy,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      archivedAt: task.archivedAt,
      assignees: assigneesByTask.get(task.id) ?? [],
      commentCount: commentCountByTask.get(task.id) ?? 0,
      attachmentCount: attachmentCountByTask.get(task.id) ?? 0,
      hasNewComments,
      subtaskCount: subtaskCountByParent.get(task.id) ?? 0,
      subtaskCompletedCount: completedSubtaskCountByParent.get(task.id) ?? 0,
    };
  });

  return { success: true, tasks: tasksWithAssignees };
}

/**
 * Get a single task by ID
 */
export async function getTask(taskId: string): Promise<{
  success: boolean;
  task?: TaskWithAssignees;
  error?: string;
}> {
  const user = await requireAuth();
  const isAdmin = user.role === 'admin';

  const { canAccess, task } = await canAccessTask(user.id, taskId, isAdmin);

  if (!canAccess || !task) {
    return { success: false, error: 'Task not found or access denied' };
  }

  // Get assignees
  const assigneesData = await db
    .select({
      userId: taskAssignees.userId,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      deactivatedAt: users.deactivatedAt,
    })
    .from(taskAssignees)
    .innerJoin(users, eq(users.id, taskAssignees.userId))
    .where(eq(taskAssignees.taskId, taskId));

  // Get comment count
  const commentCountResult = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(comments)
    .where(eq(comments.taskId, taskId));
  const commentCount = commentCountResult[0]?.count ?? 0;

  // Get attachment count
  const attachmentCountResult = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(attachments)
    .where(eq(attachments.taskId, taskId));
  const attachmentCount = attachmentCountResult[0]?.count ?? 0;

  // Check for new comments
  const userView = await db.query.taskViews.findFirst({
    where: and(
      eq(taskViews.taskId, taskId),
      eq(taskViews.userId, user.id)
    ),
  });

  let hasNewComments = false;
  if (commentCount > 0) {
    const latestCommentResult = await db
      .select({ latestAt: sql<Date>`MAX(${comments.createdAt})` })
      .from(comments)
      .where(eq(comments.taskId, taskId));
    const latestCommentAt = latestCommentResult[0]?.latestAt;
    hasNewComments =
      latestCommentAt !== undefined &&
      (!userView?.viewedAt || latestCommentAt > userView.viewedAt);
  }

  // Get subtask counts
  const subtaskCountResult = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(tasks)
    .where(eq(tasks.parentTaskId, taskId));
  const subtaskCount = subtaskCountResult[0]?.count ?? 0;

  let subtaskCompletedCount = 0;
  if (subtaskCount > 0) {
    const boardForStatuses = await db.query.boards.findFirst({
      where: eq(boards.id, task.boardId),
      columns: { statusOptions: true },
    });
    const completeStatusIds = (boardForStatuses?.statusOptions ?? [])
      .filter(
        (s) =>
          s.id === 'complete' ||
          s.id === 'done' ||
          s.label.toLowerCase().includes('complete') ||
          s.label.toLowerCase().includes('done')
      )
      .map((s) => s.id);

    if (completeStatusIds.length > 0) {
      const completedResult = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(tasks)
        .where(
          and(
            eq(tasks.parentTaskId, taskId),
            inArray(tasks.status, completeStatusIds)
          )
        );
      subtaskCompletedCount = completedResult[0]?.count ?? 0;
    }
  }

  const taskWithAssignees: TaskWithAssignees = {
    id: task.id,
    shortId: task.shortId,
    boardId: task.boardId,
    title: task.title,
    description: task.description,
    status: task.status,
    section: task.section,
    dueDate: task.dueDate,
    dateFlexibility: task.dateFlexibility,
    recurringConfig: task.recurringConfig,
    recurringGroupId: task.recurringGroupId,
    parentTaskId: task.parentTaskId,
    position: task.position,
    createdBy: task.createdBy,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    archivedAt: task.archivedAt,
    assignees: assigneesData.map((a) => ({
      id: a.userId,
      email: a.email,
      name: a.name,
      avatarUrl: a.avatarUrl,
      deactivatedAt: a.deactivatedAt,
    })),
    commentCount,
    attachmentCount,
    hasNewComments,
    subtaskCount,
    subtaskCompletedCount,
  };

  return { success: true, task: taskWithAssignees };
}

/**
 * Create a new task
 */
export async function createTask(input: CreateTaskInput): Promise<{
  success: boolean;
  task?: TaskWithAssignees;
  error?: string;
}> {
  const user = await requireAuth();
  const isAdmin = user.role === 'admin';

  // If creating a subtask, validate parent and inherit boardId
  if (input.parentTaskId) {
    if (input.recurringConfig) return { success: false, error: 'Subtasks cannot have recurring configuration' };
    const parentTask = await db.query.tasks.findFirst({
      where: eq(tasks.id, input.parentTaskId),
      columns: { id: true, boardId: true, parentTaskId: true },
    });
    if (!parentTask) return { success: false, error: 'Parent task not found' };
    if (parentTask.parentTaskId) return { success: false, error: 'Cannot create subtasks of subtasks' };
    input.boardId = parentTask.boardId;
  }

  // Check board access (any access level can create tasks)
  const accessLevel = await getBoardAccessLevel(user.id, input.boardId, isAdmin);

  if (!accessLevel) {
    return { success: false, error: 'Access denied to this board' };
  }

  // Personal boards: force assignee to board owner
  const board = await db.query.boards.findFirst({
    where: eq(boards.id, input.boardId),
    columns: { type: true },
  });
  if (board?.type === 'personal') {
    input.assigneeIds = [user.id];
  }

  // Get max position - scoped to siblings (same parent or top-level)
  const maxPositionResult = await db
    .select({ maxPos: sql<number>`COALESCE(MAX(${tasks.position}), -1)` })
    .from(tasks)
    .where(
      input.parentTaskId
        ? eq(tasks.parentTaskId, input.parentTaskId)
        : and(eq(tasks.boardId, input.boardId), isNull(tasks.parentTaskId))
    );

  const position = input.position ?? (maxPositionResult[0]?.maxPos ?? -1) + 1;

  // Parse description from JSON string if provided
  const description = input.descriptionJson 
    ? JSON.parse(input.descriptionJson) 
    : input.description;

  // Create task
  const [newTask] = await db
    .insert(tasks)
    .values({
      boardId: input.boardId,
      shortId: generateShortId(),
      title: input.title,
      description,
      status: input.status,
      section: input.section,
      dueDate: input.dueDate,
      dateFlexibility: input.dateFlexibility ?? 'not_set',
      recurringConfig: input.recurringConfig,
      parentTaskId: input.parentTaskId,
      position,
      createdBy: user.id,
    })
    .returning();

  // Add assignees if provided
  if (input.assigneeIds && input.assigneeIds.length > 0) {
    await db.insert(taskAssignees).values(
      input.assigneeIds.map((userId) => ({
        taskId: newTask.id,
        userId,
      }))
    );

    // Send assignment notifications (don't await - fire and forget)
    for (const assigneeId of input.assigneeIds) {
      createAssignmentNotification({
        assigneeUserId: assigneeId,
        assignerUserId: user.id,
        taskId: newTask.id,
      }).catch((err) => console.error('Failed to create assignment notification:', err));
    }
  }

  // Get assignees for response
  const assigneesData =
    input.assigneeIds && input.assigneeIds.length > 0
      ? await db
          .select({
            userId: taskAssignees.userId,
            email: users.email,
            name: users.name,
            avatarUrl: users.avatarUrl,
            deactivatedAt: users.deactivatedAt,
          })
          .from(taskAssignees)
          .innerJoin(users, eq(users.id, taskAssignees.userId))
          .where(eq(taskAssignees.taskId, newTask.id))
      : [];

  const taskWithAssignees: TaskWithAssignees = {
    id: newTask.id,
    shortId: newTask.shortId,
    boardId: newTask.boardId,
    title: newTask.title,
    description: newTask.description,
    status: newTask.status,
    section: newTask.section,
    dueDate: newTask.dueDate,
    dateFlexibility: newTask.dateFlexibility,
    recurringConfig: newTask.recurringConfig,
    recurringGroupId: newTask.recurringGroupId,
    parentTaskId: newTask.parentTaskId,
    position: newTask.position,
    createdBy: newTask.createdBy,
    createdAt: newTask.createdAt,
    updatedAt: newTask.updatedAt,
    archivedAt: newTask.archivedAt,
    assignees: assigneesData.map((a) => ({
      id: a.userId,
      email: a.email,
      name: a.name,
      avatarUrl: a.avatarUrl,
      deactivatedAt: a.deactivatedAt,
    })),
    commentCount: 0,
    attachmentCount: 0,
    hasNewComments: false,
    subtaskCount: 0,
    subtaskCompletedCount: 0,
  };

  // Log board activity (fire-and-forget)
  logBoardActivity({
    boardId: newTask.boardId,
    taskId: newTask.id,
    taskTitle: newTask.title,
    userId: user.id,
    action: input.parentTaskId ? 'subtask_created' : 'task_created',
  }).catch((err) => console.error('Failed to log board activity:', err));

  revalidatePath(`/clients/[clientSlug]/boards/[boardId]`, 'page');

  return { success: true, task: taskWithAssignees };
}

/**
 * Update a task
 */
export async function updateTask(input: UpdateTaskInput): Promise<{
  success: boolean;
  task?: TaskWithAssignees;
  error?: string;
}> {
  const user = await requireAuth();
  const isAdmin = user.role === 'admin';

  // Get existing task and check access
  const { canAccess, task: existingTask } = await canAccessTask(
    user.id,
    input.id,
    isAdmin
  );

  if (!canAccess || !existingTask) {
    return { success: false, error: 'Task not found or access denied' };
  }

  // Reject setting recurringConfig on subtasks
  if (input.recurringConfig && existingTask.parentTaskId) {
    return { success: false, error: 'Subtasks cannot have recurring configuration' };
  }

  // Build update object
  const updateData: Partial<typeof tasks.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.title !== undefined) updateData.title = input.title;
  // Use descriptionJson (string) to preserve nested attrs during Server Action serialization
  if (input.descriptionJson !== undefined) {
    try {
      updateData.description = input.descriptionJson ? JSON.parse(input.descriptionJson) : null;
    } catch (parseError) {
      console.error('[updateTask] Failed to parse descriptionJson:', {
        taskId: input.id,
        userId: user.id,
        payloadSize: input.descriptionJson?.length,
        preview: input.descriptionJson?.slice(0, 200),
        error: parseError instanceof Error ? parseError.message : parseError,
      });
      return { success: false, error: 'Invalid description format' };
    }
  } else if (input.description !== undefined) {
    // Fallback for backward compatibility - but attrs may be stripped
    updateData.description = input.description;
  }
  if (input.status !== undefined) updateData.status = input.status;
  if (input.section !== undefined) updateData.section = input.section;
  if (input.dueDate !== undefined) updateData.dueDate = input.dueDate;
  if (input.dateFlexibility !== undefined) updateData.dateFlexibility = input.dateFlexibility;
  if (input.recurringConfig !== undefined) updateData.recurringConfig = input.recurringConfig;
  if (input.position !== undefined) updateData.position = input.position;

  // Update task
  const [updatedTask] = await db
    .update(tasks)
    .set(updateData)
    .where(eq(tasks.id, input.id))
    .returning();

  // If completing a parent task with completeSubtasks flag, batch-complete all subtasks
  if (input.completeSubtasks && input.status && !existingTask.parentTaskId) {
    await db
      .update(tasks)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(tasks.parentTaskId, input.id));
  }

  // Check if this is a recurring task being completed
  if (
    input.status !== undefined &&
    existingTask.recurringConfig &&
    existingTask.dueDate
  ) {
    // Get the board to check for "complete" status
    const board = await db.query.boards.findFirst({
      where: eq(boards.id, existingTask.boardId),
      columns: { statusOptions: true },
    });

    // Find "complete" statuses (typically last in order or explicitly named)
    const statusOptions = board?.statusOptions ?? [];
    const completeStatuses = statusOptions.filter(
      (s) =>
        s.id === 'complete' ||
        s.id === 'done' ||
        s.label.toLowerCase().includes('complete') ||
        s.label.toLowerCase().includes('done')
    );

    const isCompleting = completeStatuses.some((s) => s.id === input.status);
    const wasNotComplete = !completeStatuses.some((s) => s.id === existingTask.status);

    if (isCompleting && wasNotComplete) {
      // Get current assignees for the new task
      const currentAssignees = await db.query.taskAssignees.findMany({
        where: eq(taskAssignees.taskId, input.id),
        columns: { userId: true },
      });

      // Generate or use existing recurringGroupId
      const recurringGroupId = existingTask.recurringGroupId ?? existingTask.id;

      // If this is the first in series, update with recurringGroupId
      if (!existingTask.recurringGroupId) {
        await db
          .update(tasks)
          .set({ recurringGroupId })
          .where(eq(tasks.id, input.id));
      }

      // Trigger Inngest to create next occurrence
      await inngest.send({
        name: 'task/recurring.completed',
        data: {
          taskId: input.id,
          boardId: existingTask.boardId,
          recurringGroupId,
          recurringConfig: existingTask.recurringConfig,
          completedDueDate: existingTask.dueDate,
          completedByUserId: user.id,
          title: existingTask.title,
          description: existingTask.description,
          section: existingTask.section,
          dateFlexibility: existingTask.dateFlexibility,
          assigneeIds: currentAssignees.map((a) => a.userId),
        },
      });
    }
  }

  // Update assignees if provided (skip for personal boards — always owner-only)
  const taskBoard = await db.query.boards.findFirst({
    where: eq(boards.id, existingTask.boardId),
    columns: { type: true },
  });
  if (input.assigneeIds !== undefined && taskBoard?.type !== 'personal') {
    // Get current assignees with names to detect changes and log activity
    const currentAssigneesWithNames = await db
      .select({ userId: taskAssignees.userId, name: users.name, email: users.email })
      .from(taskAssignees)
      .innerJoin(users, eq(users.id, taskAssignees.userId))
      .where(eq(taskAssignees.taskId, input.id));
    const currentAssigneeIds = new Set(currentAssigneesWithNames.map((a) => a.userId));

    // Remove existing assignees
    await db.delete(taskAssignees).where(eq(taskAssignees.taskId, input.id));

    // Add new assignees
    if (input.assigneeIds.length > 0) {
      await db.insert(taskAssignees).values(
        input.assigneeIds.map((userId) => ({
          taskId: input.id,
          userId,
        }))
      );

      // Send notifications for newly added assignees (not previously assigned)
      const newAssigneeIds = input.assigneeIds.filter((id) => !currentAssigneeIds.has(id));
      for (const assigneeId of newAssigneeIds) {
        createAssignmentNotification({
          assigneeUserId: assigneeId,
          assignerUserId: user.id,
          taskId: input.id,
        }).catch((err) => console.error('Failed to create assignment notification:', err));
      }
    }

    // Log assignee changes (fire-and-forget)
    const newAssigneeIdSet = new Set(input.assigneeIds);
    const addedIds = input.assigneeIds.filter((id) => !currentAssigneeIds.has(id));
    const removedIds = [...currentAssigneeIds].filter((id) => !newAssigneeIdSet.has(id));

    if (addedIds.length > 0 || removedIds.length > 0) {
      // Fetch names for newly added assignees
      const addedUsers = addedIds.length > 0
        ? await db.select({ id: users.id, name: users.name, email: users.email })
            .from(users)
            .where(inArray(users.id, addedIds))
        : [];
      const addedMap = new Map(addedUsers.map((u) => [u.id, u.name ?? u.email]));
      const removedMap = new Map(currentAssigneesWithNames.map((u) => [u.userId, u.name ?? u.email]));

      for (const id of addedIds) {
        logBoardActivity({
          boardId: existingTask.boardId,
          taskId: input.id,
          taskTitle: updatedTask.title,
          userId: user.id,
          action: 'task_assigned',
          metadata: { assigneeName: addedMap.get(id) ?? 'Unknown' },
        }).catch((err) => console.error('Failed to log board activity:', err));
      }
      for (const id of removedIds) {
        logBoardActivity({
          boardId: existingTask.boardId,
          taskId: input.id,
          taskTitle: updatedTask.title,
          userId: user.id,
          action: 'task_unassigned',
          metadata: { assigneeName: removedMap.get(id) ?? 'Unknown' },
        }).catch((err) => console.error('Failed to log board activity:', err));
      }
    }
  }

  // Get assignees for response
  const assigneesData = await db
    .select({
      userId: taskAssignees.userId,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      deactivatedAt: users.deactivatedAt,
    })
    .from(taskAssignees)
    .innerJoin(users, eq(users.id, taskAssignees.userId))
    .where(eq(taskAssignees.taskId, input.id));

  // Get comment count
  const commentCountResult = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(comments)
    .where(eq(comments.taskId, input.id));
  const commentCount = commentCountResult[0]?.count ?? 0;

  // Get attachment count
  const attachmentCountResult = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(attachments)
    .where(eq(attachments.taskId, input.id));
  const attachmentCount = attachmentCountResult[0]?.count ?? 0;

  // Check for new comments
  const userView = await db.query.taskViews.findFirst({
    where: and(
      eq(taskViews.taskId, input.id),
      eq(taskViews.userId, user.id)
    ),
  });

  let hasNewComments = false;
  if (commentCount > 0) {
    const latestCommentResult = await db
      .select({ latestAt: sql<Date>`MAX(${comments.createdAt})` })
      .from(comments)
      .where(eq(comments.taskId, input.id));
    const latestCommentAt = latestCommentResult[0]?.latestAt;
    hasNewComments =
      latestCommentAt !== undefined &&
      (!userView?.viewedAt || latestCommentAt > userView.viewedAt);
  }

  // Get subtask counts for the updated task
  const updatedSubtaskCountResult = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(tasks)
    .where(eq(tasks.parentTaskId, input.id));
  const updatedSubtaskCount = updatedSubtaskCountResult[0]?.count ?? 0;

  let updatedSubtaskCompletedCount = 0;
  if (updatedSubtaskCount > 0) {
    const boardForStatuses = await db.query.boards.findFirst({
      where: eq(boards.id, updatedTask.boardId),
      columns: { statusOptions: true },
    });
    const cStatusIds = (boardForStatuses?.statusOptions ?? [])
      .filter(
        (s) =>
          s.id === 'complete' ||
          s.id === 'done' ||
          s.label.toLowerCase().includes('complete') ||
          s.label.toLowerCase().includes('done')
      )
      .map((s) => s.id);
    if (cStatusIds.length > 0) {
      const completedResult = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(tasks)
        .where(
          and(
            eq(tasks.parentTaskId, input.id),
            inArray(tasks.status, cStatusIds)
          )
        );
      updatedSubtaskCompletedCount = completedResult[0]?.count ?? 0;
    }
  }

  const taskWithAssignees: TaskWithAssignees = {
    id: updatedTask.id,
    shortId: updatedTask.shortId,
    boardId: updatedTask.boardId,
    title: updatedTask.title,
    description: updatedTask.description,
    status: updatedTask.status,
    section: updatedTask.section,
    dueDate: updatedTask.dueDate,
    dateFlexibility: updatedTask.dateFlexibility,
    recurringConfig: updatedTask.recurringConfig,
    recurringGroupId: updatedTask.recurringGroupId,
    parentTaskId: updatedTask.parentTaskId,
    position: updatedTask.position,
    createdBy: updatedTask.createdBy,
    createdAt: updatedTask.createdAt,
    updatedAt: updatedTask.updatedAt,
    archivedAt: updatedTask.archivedAt,
    assignees: assigneesData.map((a) => ({
      id: a.userId,
      email: a.email,
      name: a.name,
      avatarUrl: a.avatarUrl,
      deactivatedAt: a.deactivatedAt,
    })),
    commentCount,
    attachmentCount,
    hasNewComments,
    subtaskCount: updatedSubtaskCount,
    subtaskCompletedCount: updatedSubtaskCompletedCount,
  };

  // Log board activity for tracked field changes (fire-and-forget)
  const logBase = {
    boardId: existingTask.boardId,
    taskId: input.id,
    taskTitle: updatedTask.title,
    userId: user.id,
  };

  if (input.title !== undefined && input.title !== existingTask.title) {
    logBoardActivity({
      ...logBase,
      action: 'task_title_changed',
      metadata: { oldValue: existingTask.title, newValue: input.title },
    }).catch((err) => console.error('Failed to log board activity:', err));
  }

  if (input.status !== undefined && input.status !== existingTask.status) {
    // Resolve status labels from board options
    const boardForLabels = await db.query.boards.findFirst({
      where: eq(boards.id, existingTask.boardId),
      columns: { statusOptions: true, sectionOptions: true },
    });
    const statusOpts = boardForLabels?.statusOptions ?? [];
    const oldLabel = statusOpts.find((s) => s.id === existingTask.status)?.label ?? existingTask.status;
    const newLabel = statusOpts.find((s) => s.id === input.status)?.label ?? input.status;
    logBoardActivity({
      ...logBase,
      action: 'task_status_changed',
      metadata: { oldValue: existingTask.status, newValue: input.status, oldLabel, newLabel },
    }).catch((err) => console.error('Failed to log board activity:', err));
  }

  if (input.section !== undefined && input.section !== existingTask.section) {
    const boardForSections = await db.query.boards.findFirst({
      where: eq(boards.id, existingTask.boardId),
      columns: { sectionOptions: true },
    });
    const sectionOpts = boardForSections?.sectionOptions ?? [];
    const oldSectionLabel = sectionOpts.find((s) => s.id === existingTask.section)?.label ?? existingTask.section ?? 'None';
    const newSectionLabel = sectionOpts.find((s) => s.id === input.section)?.label ?? input.section ?? 'None';
    logBoardActivity({
      ...logBase,
      action: 'task_section_changed',
      metadata: { oldLabel: oldSectionLabel, newLabel: newSectionLabel },
    }).catch((err) => console.error('Failed to log board activity:', err));
  }

  if (input.dueDate !== undefined && input.dueDate !== existingTask.dueDate) {
    logBoardActivity({
      ...logBase,
      action: 'task_due_date_changed',
      metadata: { oldValue: existingTask.dueDate, newValue: input.dueDate },
    }).catch((err) => console.error('Failed to log board activity:', err));
  }

  revalidatePath(`/clients/[clientSlug]/boards/[boardId]`, 'page');

  return { success: true, task: taskWithAssignees };
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await requireAuth();
  const isAdmin = user.role === 'admin';

  // Check access
  const { canAccess } = await canAccessTask(user.id, taskId, isAdmin);

  if (!canAccess) {
    return { success: false, error: 'Task not found or access denied' };
  }

  // Get task details for activity log before deleting
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    columns: { boardId: true, title: true, parentTaskId: true },
  });

  // Log board activity before delete (task row must still exist for FK)
  if (task) {
    await logBoardActivity({
      boardId: task.boardId,
      taskId,
      taskTitle: task.title,
      userId: user.id,
      action: task.parentTaskId ? 'subtask_deleted' : 'task_deleted',
    }).catch((err) => console.error('Failed to log board activity:', err));
  }

  // Delete task (cascades to assignees)
  await db.delete(tasks).where(eq(tasks.id, taskId));

  revalidatePath(`/clients/[clientSlug]/boards/[boardId]`, 'page');

  return { success: true };
}

/**
 * List subtasks for a parent task
 */
export async function listSubtasks(parentTaskId: string): Promise<{
  success: boolean;
  tasks?: TaskWithAssignees[];
  error?: string;
}> {
  const user = await requireAuth();
  const isAdmin = user.role === 'admin';

  // Verify access to the parent task
  const { canAccess } = await canAccessTask(user.id, parentTaskId, isAdmin);
  if (!canAccess) {
    return { success: false, error: 'Parent task not found or access denied' };
  }

  // Fetch subtasks ordered by position (exclude archived)
  const subtaskList = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.parentTaskId, parentTaskId), isNull(tasks.archivedAt)))
    .orderBy(asc(tasks.position));

  if (subtaskList.length === 0) {
    return { success: true, tasks: [] };
  }

  const subtaskIds = subtaskList.map((t) => t.id);

  // Get assignees for all subtasks
  const assigneesData = await db
    .select({
      taskId: taskAssignees.taskId,
      userId: taskAssignees.userId,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      deactivatedAt: users.deactivatedAt,
    })
    .from(taskAssignees)
    .innerJoin(users, eq(users.id, taskAssignees.userId))
    .where(inArray(taskAssignees.taskId, subtaskIds));

  const assigneesByTask = new Map<
    string,
    { id: string; email: string; name: string | null; avatarUrl: string | null; deactivatedAt: Date | null }[]
  >();
  for (const a of assigneesData) {
    if (!assigneesByTask.has(a.taskId)) {
      assigneesByTask.set(a.taskId, []);
    }
    assigneesByTask.get(a.taskId)!.push({
      id: a.userId,
      email: a.email,
      name: a.name,
      avatarUrl: a.avatarUrl,
      deactivatedAt: a.deactivatedAt,
    });
  }

  // Get comment counts
  const commentCountsData = await db
    .select({
      taskId: comments.taskId,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(comments)
    .where(inArray(comments.taskId, subtaskIds))
    .groupBy(comments.taskId);

  const commentCountByTask = new Map<string, number>();
  for (const c of commentCountsData) {
    commentCountByTask.set(c.taskId, c.count);
  }

  // Get attachment counts
  const attachmentCountsData = await db
    .select({
      taskId: attachments.taskId,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(attachments)
    .where(inArray(attachments.taskId, subtaskIds))
    .groupBy(attachments.taskId);

  const attachmentCountByTask = new Map<string, number>();
  for (const a of attachmentCountsData) {
    if (a.taskId) attachmentCountByTask.set(a.taskId, a.count);
  }

  // Get user's last view timestamps
  const viewTimestampsData = await db
    .select({
      taskId: taskViews.taskId,
      viewedAt: taskViews.viewedAt,
    })
    .from(taskViews)
    .where(
      and(
        inArray(taskViews.taskId, subtaskIds),
        eq(taskViews.userId, user.id)
      )
    );

  const viewTimestampByTask = new Map<string, Date>();
  for (const v of viewTimestampsData) {
    viewTimestampByTask.set(v.taskId, v.viewedAt);
  }

  // Get latest comment timestamps
  const tasksWithComments = subtaskIds.filter((id) => (commentCountByTask.get(id) ?? 0) > 0);
  const latestCommentData =
    tasksWithComments.length > 0
      ? await db
          .select({
            taskId: comments.taskId,
            latestAt: sql<Date>`MAX(${comments.createdAt})`,
          })
          .from(comments)
          .where(inArray(comments.taskId, tasksWithComments))
          .groupBy(comments.taskId)
      : [];

  const latestCommentByTask = new Map<string, Date>();
  for (const c of latestCommentData) {
    latestCommentByTask.set(c.taskId, c.latestAt);
  }

  const subtasksWithAssignees: TaskWithAssignees[] = subtaskList.map((task) => {
    const lastViewedAt = viewTimestampByTask.get(task.id);
    const latestCommentAt = latestCommentByTask.get(task.id);
    const hasNewComments =
      latestCommentAt !== undefined &&
      (lastViewedAt === undefined || latestCommentAt > lastViewedAt);

    return {
      id: task.id,
      shortId: task.shortId,
      boardId: task.boardId,
      title: task.title,
      description: task.description,
      status: task.status,
      section: task.section,
      dueDate: task.dueDate,
      dateFlexibility: task.dateFlexibility,
      recurringConfig: task.recurringConfig,
      recurringGroupId: task.recurringGroupId,
      parentTaskId: task.parentTaskId,
      position: task.position,
      createdBy: task.createdBy,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      archivedAt: task.archivedAt,
      assignees: assigneesByTask.get(task.id) ?? [],
      commentCount: commentCountByTask.get(task.id) ?? 0,
      attachmentCount: attachmentCountByTask.get(task.id) ?? 0,
      hasNewComments,
      subtaskCount: 0,
      subtaskCompletedCount: 0,
    };
  });

  return { success: true, tasks: subtasksWithAssignees };
}

/**
 * Update task positions (for drag-and-drop reordering)
 */
export async function updateTaskPositions(
  updates: { id: string; position: number; status?: string }[]
): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await requireAuth();
  const isAdmin = user.role === 'admin';

  // Verify access to all tasks
  for (const update of updates) {
    const { canAccess } = await canAccessTask(user.id, update.id, isAdmin);
    if (!canAccess) {
      return { success: false, error: 'Access denied to one or more tasks' };
    }
  }

  // For status changes via DnD, fetch old task data to log activity + check recurring
  const statusUpdates = updates.filter((u) => u.status);
  let oldTaskData: Map<string, {
    title: string; status: string; boardId: string;
    recurringConfig: RecurringConfig | null; dueDate: string | null;
    recurringGroupId: string | null; description: TiptapContent | null;
    section: string | null; dateFlexibility: string; parentTaskId: string | null;
  }> = new Map();
  if (statusUpdates.length > 0) {
    const oldTasks = await db
      .select({
        id: tasks.id, title: tasks.title, status: tasks.status, boardId: tasks.boardId,
        recurringConfig: tasks.recurringConfig, dueDate: tasks.dueDate,
        recurringGroupId: tasks.recurringGroupId, description: tasks.description,
        section: tasks.section, dateFlexibility: tasks.dateFlexibility,
        parentTaskId: tasks.parentTaskId,
      })
      .from(tasks)
      .where(inArray(tasks.id, statusUpdates.map((u) => u.id)));
    oldTaskData = new Map(oldTasks.map((t) => [t.id, t]));
  }

  // Update positions
  await Promise.all(
    updates.map((update) =>
      db
        .update(tasks)
        .set({
          position: update.position,
          status: update.status,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, update.id))
    )
  );

  // Log status changes from DnD (fire-and-forget)
  for (const update of statusUpdates) {
    const old = oldTaskData.get(update.id);
    if (old && update.status && update.status !== old.status) {
      // Resolve labels
      const board = await db.query.boards.findFirst({
        where: eq(boards.id, old.boardId),
        columns: { statusOptions: true },
      });
      const opts = board?.statusOptions ?? [];
      const oldLabel = opts.find((s) => s.id === old.status)?.label ?? old.status;
      const newLabel = opts.find((s) => s.id === update.status)?.label ?? update.status;
      logBoardActivity({
        boardId: old.boardId,
        taskId: update.id,
        taskTitle: old.title,
        userId: user.id,
        action: 'task_status_changed',
        metadata: { oldValue: old.status, newValue: update.status, oldLabel, newLabel },
      }).catch((err) => console.error('Failed to log board activity:', err));

      // Check if this is a recurring task being completed via DnD
      if (old.recurringConfig && old.dueDate && !old.parentTaskId) {
        const completeStatuses = opts.filter(
          (s) =>
            s.id === 'complete' ||
            s.id === 'done' ||
            s.label.toLowerCase().includes('complete') ||
            s.label.toLowerCase().includes('done')
        );
        const isCompleting = completeStatuses.some((s) => s.id === update.status);
        const wasNotComplete = !completeStatuses.some((s) => s.id === old.status);

        if (isCompleting && wasNotComplete) {
          const currentAssignees = await db.query.taskAssignees.findMany({
            where: eq(taskAssignees.taskId, update.id),
            columns: { userId: true },
          });

          const recurringGroupId = old.recurringGroupId ?? update.id;

          if (!old.recurringGroupId) {
            await db
              .update(tasks)
              .set({ recurringGroupId })
              .where(eq(tasks.id, update.id));
          }

          inngest.send({
            name: 'task/recurring.completed',
            data: {
              taskId: update.id,
              boardId: old.boardId,
              recurringGroupId,
              recurringConfig: old.recurringConfig,
              completedDueDate: old.dueDate,
              completedByUserId: user.id,
              title: old.title,
              description: old.description,
              section: old.section,
              dateFlexibility: old.dateFlexibility,
              assigneeIds: currentAssignees.map((a) => a.userId),
            },
          }).catch((err) => console.error('Failed to send recurring task event:', err));
        }
      }
    }
  }

  revalidatePath(`/clients/[clientSlug]/boards/[boardId]`, 'page');

  return { success: true };
}

/**
 * Get all users that can be assigned to a board's tasks
 * Returns all non-contractor users (public access) plus contractors with explicit board access
 */
export async function getBoardAssignableUsers(boardId: string): Promise<{
  success: boolean;
  users?: { id: string; email: string; name: string | null; avatarUrl: string | null }[];
  error?: string;
}> {
  const user = await requireAuth();
  const isAdmin = user.role === 'admin';

  // Check board access
  const accessLevel = await getBoardAccessLevel(user.id, boardId, isAdmin);

  if (!accessLevel) {
    return { success: false, error: 'Access denied to this board' };
  }

  // Get all active users with their team memberships
  const allUsersWithTeams = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(isNull(users.deactivatedAt));

  // Get contractor team IDs (teams with excludeFromPublic = true)
  const contractorTeams = await db.query.teams.findMany({
    where: eq(teams.excludeFromPublic, true),
    columns: { id: true },
  });
  const contractorTeamIds = new Set(contractorTeams.map((t) => t.id));

  // Get all team memberships
  const allTeamMemberships = await db.query.teamMembers.findMany({
    columns: { userId: true, teamId: true },
  });

  // Identify contractor users (users in any contractor team)
  const contractorUserIds = new Set(
    allTeamMemberships
      .filter((tm) => contractorTeamIds.has(tm.teamId))
      .map((tm) => tm.userId)
  );

  // Get contractors with explicit board access (direct or via team)
  const contractorsWithAccess = new Set<string>();

  // Direct access
  const directAccess = await db.query.boardAccess.findMany({
    where: eq(boardAccess.boardId, boardId),
    columns: { userId: true, teamId: true },
  });

  for (const access of directAccess) {
    if (access.userId && contractorUserIds.has(access.userId)) {
      contractorsWithAccess.add(access.userId);
    }
    if (access.teamId && contractorTeamIds.has(access.teamId)) {
      // Add all members of this contractor team
      for (const tm of allTeamMemberships) {
        if (tm.teamId === access.teamId) {
          contractorsWithAccess.add(tm.userId);
        }
      }
    }
  }

  // Filter: include non-contractors + contractors with access
  const assignableUsers = allUsersWithTeams.filter(
    (u) => !contractorUserIds.has(u.id) || contractorsWithAccess.has(u.id)
  );

  return { success: true, users: assignableUsers };
}

/**
 * Task with board and client context for personal rollup view
 */
export interface MyTaskWithContext extends TaskWithAssignees {
  board: {
    id: string;
    name: string;
    statusOptions: StatusOption[];
    sectionOptions: SectionOption[];
  };
  client: {
    id: string;
    name: string;
    slug: string;
    color: string | null;
    icon: string | null;
  };
  parentTask?: {
    id: string;
    title: string;
  } | null;
}

/**
 * Grouped tasks by client for personal rollup view
 */
export interface MyTasksByClient {
  client: {
    id: string;
    name: string;
    slug: string;
    color: string | null;
    icon: string | null;
  };
  boards: {
    id: string;
    name: string;
    statusOptions: StatusOption[];
    sectionOptions: SectionOption[];
  }[];
  tasks: MyTaskWithContext[];
}

/**
 * Get all tasks assigned to the current user across all accessible boards
 */
export async function listMyTasks(): Promise<{
  success: boolean;
  tasksByClient?: MyTasksByClient[];
  error?: string;
}> {
  const user = await requireAuth();
  const isAdmin = user.role === 'admin';

  // Get all tasks where the user is assigned
  const userAssignments = await db
    .select({
      taskId: taskAssignees.taskId,
    })
    .from(taskAssignees)
    .where(eq(taskAssignees.userId, user.id));

  if (userAssignments.length === 0) {
    return { success: true, tasksByClient: [] };
  }

  const assignedTaskIds = userAssignments.map((a) => a.taskId);

  // Get all assigned tasks with board and client info
  const tasksWithContext = await db
    .select({
      // Task fields
      taskId: tasks.id,
      taskBoardId: tasks.boardId,
      taskTitle: tasks.title,
      taskDescription: tasks.description,
      taskStatus: tasks.status,
      taskSection: tasks.section,
      taskDueDate: tasks.dueDate,
      taskDateFlexibility: tasks.dateFlexibility,
      taskRecurringConfig: tasks.recurringConfig,
      taskRecurringGroupId: tasks.recurringGroupId,
      taskShortId: tasks.shortId,
      taskParentTaskId: tasks.parentTaskId,
      taskPosition: tasks.position,
      taskCreatedBy: tasks.createdBy,
      taskCreatedAt: tasks.createdAt,
      taskUpdatedAt: tasks.updatedAt,
      // Board fields
      boardId: boards.id,
      boardName: boards.name,
      boardStatusOptions: boards.statusOptions,
      boardSectionOptions: boards.sectionOptions,
      // Client fields
      clientId: clients.id,
      clientName: clients.name,
      clientSlug: clients.slug,
      clientColor: clients.color,
      clientIcon: clients.icon,
    })
    .from(tasks)
    .innerJoin(boards, eq(tasks.boardId, boards.id))
    .innerJoin(clients, eq(boards.clientId, clients.id))
    .where(and(inArray(tasks.id, assignedTaskIds), isNull(tasks.archivedAt)))
    .orderBy(asc(clients.name), asc(boards.name), asc(tasks.position));

  if (tasksWithContext.length === 0) {
    return { success: true, tasksByClient: [] };
  }

  // Filter by accessible boards
  const accessibleTasks: typeof tasksWithContext = [];

  for (const task of tasksWithContext) {
    const accessLevel = await getBoardAccessLevel(user.id, task.boardId, isAdmin);

    // User must have access to the board
    if (accessLevel) {
      accessibleTasks.push(task);
    }
  }

  if (accessibleTasks.length === 0) {
    return { success: true, tasksByClient: [] };
  }

  // Get assignees for all accessible tasks
  const accessibleTaskIds = accessibleTasks.map((t) => t.taskId);
  const assigneesData = await db
    .select({
      taskId: taskAssignees.taskId,
      userId: taskAssignees.userId,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      deactivatedAt: users.deactivatedAt,
    })
    .from(taskAssignees)
    .innerJoin(users, eq(users.id, taskAssignees.userId))
    .where(inArray(taskAssignees.taskId, accessibleTaskIds));

  // Group assignees by task
  const assigneesByTask = new Map<
    string,
    { id: string; email: string; name: string | null; avatarUrl: string | null; deactivatedAt: Date | null }[]
  >();

  for (const a of assigneesData) {
    if (!assigneesByTask.has(a.taskId)) {
      assigneesByTask.set(a.taskId, []);
    }
    assigneesByTask.get(a.taskId)!.push({
      id: a.userId,
      email: a.email,
      name: a.name,
      avatarUrl: a.avatarUrl,
      deactivatedAt: a.deactivatedAt,
    });
  }

  // Get comment counts for all tasks
  const commentCountsData =
    accessibleTaskIds.length > 0
      ? await db
          .select({
            taskId: comments.taskId,
            count: sql<number>`COUNT(*)::int`,
          })
          .from(comments)
          .where(inArray(comments.taskId, accessibleTaskIds))
          .groupBy(comments.taskId)
      : [];

  const commentCountByTask = new Map<string, number>();
  for (const c of commentCountsData) {
    commentCountByTask.set(c.taskId, c.count);
  }

  // Get attachment counts for all tasks
  const attachmentCountsData =
    accessibleTaskIds.length > 0
      ? await db
          .select({
            taskId: attachments.taskId,
            count: sql<number>`COUNT(*)::int`,
          })
          .from(attachments)
          .where(inArray(attachments.taskId, accessibleTaskIds))
          .groupBy(attachments.taskId)
      : [];

  const attachmentCountByTask = new Map<string, number>();
  for (const a of attachmentCountsData) {
    if (a.taskId) {
      attachmentCountByTask.set(a.taskId, a.count);
    }
  }

  // Get user's last view timestamps
  const viewTimestampsData =
    accessibleTaskIds.length > 0
      ? await db
          .select({
            taskId: taskViews.taskId,
            viewedAt: taskViews.viewedAt,
          })
          .from(taskViews)
          .where(
            and(
              inArray(taskViews.taskId, accessibleTaskIds),
              eq(taskViews.userId, user.id)
            )
          )
      : [];

  const viewTimestampByTask = new Map<string, Date>();
  for (const v of viewTimestampsData) {
    viewTimestampByTask.set(v.taskId, v.viewedAt);
  }

  // Get latest comment timestamps
  const tasksWithComments = accessibleTaskIds.filter((id) => (commentCountByTask.get(id) ?? 0) > 0);
  const latestCommentData =
    tasksWithComments.length > 0
      ? await db
          .select({
            taskId: comments.taskId,
            latestAt: sql<Date>`MAX(${comments.createdAt})`,
          })
          .from(comments)
          .where(inArray(comments.taskId, tasksWithComments))
          .groupBy(comments.taskId)
      : [];

  const latestCommentByTask = new Map<string, Date>();
  for (const c of latestCommentData) {
    latestCommentByTask.set(c.taskId, c.latestAt);
  }

  // Get parent task titles for subtasks
  const parentIds = [...new Set(accessibleTasks.filter((t) => t.taskParentTaskId).map((t) => t.taskParentTaskId!))];
  const parentTasksData =
    parentIds.length > 0
      ? await db
          .select({ id: tasks.id, title: tasks.title })
          .from(tasks)
          .where(inArray(tasks.id, parentIds))
      : [];
  const parentTaskMap = new Map(parentTasksData.map((p) => [p.id, p]));

  // Get subtask counts for parent tasks (tasks that are NOT subtasks)
  const topLevelTaskIds = accessibleTasks.filter((t) => !t.taskParentTaskId).map((t) => t.taskId);
  const mySubtaskCountsData =
    topLevelTaskIds.length > 0
      ? await db
          .select({
            parentId: tasks.parentTaskId,
            count: sql<number>`COUNT(*)::int`,
          })
          .from(tasks)
          .where(inArray(tasks.parentTaskId, topLevelTaskIds))
          .groupBy(tasks.parentTaskId)
      : [];

  const mySubtaskCountByParent = new Map<string, number>();
  for (const s of mySubtaskCountsData) {
    if (s.parentId) mySubtaskCountByParent.set(s.parentId, s.count);
  }

  // Group tasks by client
  const clientMap = new Map<string, MyTasksByClient>();
  const boardsInClient = new Map<string, Set<string>>();

  for (const row of accessibleTasks) {
    const clientId = row.clientId;

    if (!clientMap.has(clientId)) {
      clientMap.set(clientId, {
        client: {
          id: row.clientId,
          name: row.clientName,
          slug: row.clientSlug,
          color: row.clientColor,
          icon: row.clientIcon,
        },
        boards: [],
        tasks: [],
      });
      boardsInClient.set(clientId, new Set());
    }

    const clientEntry = clientMap.get(clientId)!;
    const boardIds = boardsInClient.get(clientId)!;

    // Add board if not already added
    if (!boardIds.has(row.boardId)) {
      boardIds.add(row.boardId);
      clientEntry.boards.push({
        id: row.boardId,
        name: row.boardName,
        statusOptions: row.boardStatusOptions,
        sectionOptions: row.boardSectionOptions ?? [],
      });
    }

    // Calculate hasNewComments
    const lastViewedAt = viewTimestampByTask.get(row.taskId);
    const latestCommentAt = latestCommentByTask.get(row.taskId);
    const hasNewComments =
      latestCommentAt !== undefined &&
      (lastViewedAt === undefined || latestCommentAt > lastViewedAt);

    // Add task
    const parentInfo = row.taskParentTaskId ? parentTaskMap.get(row.taskParentTaskId) : null;
    clientEntry.tasks.push({
      id: row.taskId,
      shortId: row.taskShortId,
      boardId: row.boardId,
      title: row.taskTitle,
      description: row.taskDescription,
      status: row.taskStatus,
      section: row.taskSection,
      dueDate: row.taskDueDate,
      dateFlexibility: row.taskDateFlexibility,
      recurringConfig: row.taskRecurringConfig,
      recurringGroupId: row.taskRecurringGroupId,
      parentTaskId: row.taskParentTaskId,
      position: row.taskPosition,
      createdBy: row.taskCreatedBy,
      createdAt: row.taskCreatedAt,
      updatedAt: row.taskUpdatedAt,
      archivedAt: null,
      assignees: assigneesByTask.get(row.taskId) ?? [],
      commentCount: commentCountByTask.get(row.taskId) ?? 0,
      attachmentCount: attachmentCountByTask.get(row.taskId) ?? 0,
      hasNewComments,
      subtaskCount: mySubtaskCountByParent.get(row.taskId) ?? 0,
      subtaskCompletedCount: 0,
      board: {
        id: row.boardId,
        name: row.boardName,
        statusOptions: row.boardStatusOptions,
        sectionOptions: row.boardSectionOptions ?? [],
      },
      client: {
        id: row.clientId,
        name: row.clientName,
        slug: row.clientSlug,
        color: row.clientColor,
        icon: row.clientIcon,
      },
      parentTask: parentInfo ? { id: parentInfo.id, title: parentInfo.title } : null,
    });
  }

  // Sort clients alphabetically and return
  const tasksByClient = Array.from(clientMap.values()).sort((a, b) =>
    a.client.name.localeCompare(b.client.name)
  );

  return { success: true, tasksByClient };
}

/**
 * Update all future tasks in a recurring series
 */
export async function updateRecurringSeries(input: {
  taskId: string;
  updates: Partial<{
    title: string;
    description: TiptapContent | null;
    section: string | null;
    dateFlexibility: 'not_set' | 'flexible' | 'semi_flexible' | 'not_flexible';
    recurringConfig: RecurringConfig | null;
    assigneeIds: string[];
  }>;
}): Promise<{
  success: boolean;
  updatedCount?: number;
  error?: string;
}> {
  const user = await requireAuth();
  const isAdmin = user.role === 'admin';

  // Get the source task
  const { canAccess, task: sourceTask } = await canAccessTask(
    user.id,
    input.taskId,
    isAdmin
  );

  if (!canAccess || !sourceTask) {
    return { success: false, error: 'Task not found or access denied' };
  }

  const recurringGroupId = sourceTask.recurringGroupId ?? sourceTask.id;

  // Get the board to identify complete statuses
  const board = await db.query.boards.findFirst({
    where: eq(boards.id, sourceTask.boardId),
    columns: { statusOptions: true },
  });

  const statusOptions = board?.statusOptions ?? [];
  const completeStatusIds = statusOptions
    .filter(
      (s) =>
        s.id === 'complete' ||
        s.id === 'done' ||
        s.label.toLowerCase().includes('complete') ||
        s.label.toLowerCase().includes('done')
    )
    .map((s) => s.id);

  // Get future tasks (this task and later ones that aren't completed)
  const allGroupTasks = await db
    .select({ id: tasks.id, dueDate: tasks.dueDate, status: tasks.status })
    .from(tasks)
    .where(eq(tasks.recurringGroupId, recurringGroupId));

  // Filter to future/current tasks that aren't completed
  const futureTasks = allGroupTasks.filter((t) => {
    // Not completed
    if (completeStatusIds.includes(t.status)) return false;
    // Has due date >= source task's due date (or is the source task itself)
    if (!sourceTask.dueDate) return t.id === sourceTask.id;
    if (!t.dueDate) return false;
    return t.dueDate >= sourceTask.dueDate;
  });

  if (futureTasks.length === 0) {
    return { success: true, updatedCount: 0 };
  }

  const taskIds = futureTasks.map((t) => t.id);

  // Build update data
  const updateData: Partial<typeof tasks.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.updates.title !== undefined) updateData.title = input.updates.title;
  if (input.updates.description !== undefined)
    updateData.description = input.updates.description;
  if (input.updates.section !== undefined) updateData.section = input.updates.section;
  if (input.updates.dateFlexibility !== undefined)
    updateData.dateFlexibility = input.updates.dateFlexibility;
  if (input.updates.recurringConfig !== undefined)
    updateData.recurringConfig = input.updates.recurringConfig;

  // Update all future tasks
  await db
    .update(tasks)
    .set(updateData)
    .where(inArray(tasks.id, taskIds));

  // Handle assignee updates
  if (input.updates.assigneeIds !== undefined) {
    for (const taskId of taskIds) {
      await db.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));

      if (input.updates.assigneeIds.length > 0) {
        await db.insert(taskAssignees).values(
          input.updates.assigneeIds.map((userId) => ({
            taskId,
            userId,
          }))
        );
      }
    }
  }

  revalidatePath(`/clients/[clientSlug]/boards/[boardId]`, 'page');

  return { success: true, updatedCount: taskIds.length };
}

/**
 * Delete all tasks in a recurring series
 */
export async function deleteRecurringSeries(taskId: string): Promise<{
  success: boolean;
  deletedCount?: number;
  error?: string;
}> {
  const user = await requireAuth();
  const isAdmin = user.role === 'admin';

  // Get the source task
  const { canAccess, task: sourceTask } = await canAccessTask(
    user.id,
    taskId,
    isAdmin
  );

  if (!canAccess || !sourceTask) {
    return { success: false, error: 'Task not found or access denied' };
  }

  const recurringGroupId = sourceTask.recurringGroupId;

  if (!recurringGroupId) {
    // Not part of a series, just delete this one task
    await db.delete(tasks).where(eq(tasks.id, taskId));
    revalidatePath(`/clients/[clientSlug]/boards/[boardId]`, 'page');
    return { success: true, deletedCount: 1 };
  }

  // Delete all tasks in the series
  const result = await db
    .delete(tasks)
    .where(eq(tasks.recurringGroupId, recurringGroupId))
    .returning({ id: tasks.id });

  revalidatePath(`/clients/[clientSlug]/boards/[boardId]`, 'page');

  return { success: true, deletedCount: result.length };
}

/**
 * Delete this task and all future tasks in a recurring series (keep past completed ones)
 */
export async function deleteFutureRecurringTasks(taskId: string): Promise<{
  success: boolean;
  deletedCount?: number;
  error?: string;
}> {
  const user = await requireAuth();
  const isAdmin = user.role === 'admin';

  const { canAccess, task: sourceTask } = await canAccessTask(
    user.id,
    taskId,
    isAdmin
  );

  if (!canAccess || !sourceTask) {
    return { success: false, error: 'Task not found or access denied' };
  }

  const recurringGroupId = sourceTask.recurringGroupId;

  if (!recurringGroupId) {
    // Not part of a series
    await db.delete(tasks).where(eq(tasks.id, taskId));
    revalidatePath(`/clients/[clientSlug]/boards/[boardId]`, 'page');
    return { success: true, deletedCount: 1 };
  }

  // Get all tasks in the group
  const allGroupTasks = await db
    .select({ id: tasks.id, dueDate: tasks.dueDate })
    .from(tasks)
    .where(eq(tasks.recurringGroupId, recurringGroupId));

  // Filter to tasks with due date >= current task's due date
  const tasksToDelete = allGroupTasks.filter((t) => {
    if (!sourceTask.dueDate) return t.id === sourceTask.id;
    if (!t.dueDate) return t.id === sourceTask.id;
    return t.dueDate >= sourceTask.dueDate;
  });

  const taskIdsToDelete = tasksToDelete.map((t) => t.id);

  if (taskIdsToDelete.length > 0) {
    await db.delete(tasks).where(inArray(tasks.id, taskIdsToDelete));
  }

  // Remove recurringConfig from remaining tasks to prevent future generation
  const remainingTasks = allGroupTasks.filter((t) => !taskIdsToDelete.includes(t.id));
  if (remainingTasks.length > 0) {
    await db
      .update(tasks)
      .set({ recurringConfig: null })
      .where(inArray(tasks.id, remainingTasks.map((t) => t.id)));
  }

  revalidatePath(`/clients/[clientSlug]/boards/[boardId]`, 'page');

  return { success: true, deletedCount: taskIdsToDelete.length };
}

/**
 * Search result item with context for display
 */
export interface SearchResult {
  id: string;
  title: string;
  status: string;
  boardId: string;
  boardName: string;
  clientId: string;
  clientName: string;
  clientSlug: string;
  parentTaskId: string | null;
  parentTaskTitle: string | null;
  archivedAt: Date | null;
  assignees: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  }[];
}

/**
 * Search tasks across all accessible boards
 */
export async function searchTasks(query: string): Promise<{
  success: boolean;
  results?: SearchResult[];
  error?: string;
}> {
  if (!query || query.trim().length < 2) {
    return { success: true, results: [] };
  }

  const user = await requireAuth();
  const isAdmin = user.role === 'admin';
  const searchTerm = query.trim().toLowerCase();

  const searchResults = await db
    .select({
      taskId: tasks.id,
      taskTitle: tasks.title,
      taskStatus: tasks.status,
      taskParentTaskId: tasks.parentTaskId,
      taskArchivedAt: tasks.archivedAt,
      boardId: boards.id,
      boardName: boards.name,
      clientId: clients.id,
      clientName: clients.name,
      clientSlug: clients.slug,
    })
    .from(tasks)
    .innerJoin(boards, eq(tasks.boardId, boards.id))
    .innerJoin(clients, eq(boards.clientId, clients.id))
    .where(sql`LOWER(${tasks.title}) LIKE ${'%' + searchTerm + '%'}`)
    .orderBy(asc(tasks.title))
    .limit(20);

  if (searchResults.length === 0) {
    return { success: true, results: [] };
  }

  const accessibleResults: typeof searchResults = [];
  const boardAccessCache = new Map<string, AccessLevel>();

  for (const result of searchResults) {
    let accessLevel = boardAccessCache.get(result.boardId);
    if (accessLevel === undefined) {
      accessLevel = await getBoardAccessLevel(user.id, result.boardId, isAdmin);
      boardAccessCache.set(result.boardId, accessLevel);
    }
    if (accessLevel === 'full' || accessLevel === 'assigned_only') {
      accessibleResults.push(result);
    }
  }

  const accessibleTaskIds = accessibleResults.map((r) => r.taskId);
  const assigneesData = accessibleTaskIds.length > 0
    ? await db
        .select({
          taskId: taskAssignees.taskId,
          userId: taskAssignees.userId,
          name: users.name,
          avatarUrl: users.avatarUrl,
          deactivatedAt: users.deactivatedAt,
        })
        .from(taskAssignees)
        .innerJoin(users, eq(users.id, taskAssignees.userId))
        .where(inArray(taskAssignees.taskId, accessibleTaskIds))
    : [];

  const assigneesByTask = new Map<string, SearchResult['assignees']>();
  for (const a of assigneesData) {
    const existing = assigneesByTask.get(a.taskId) || [];
    existing.push({ id: a.userId, name: a.name, avatarUrl: a.avatarUrl });
    assigneesByTask.set(a.taskId, existing);
  }

  // Get parent task titles for subtask search results
  const searchParentIds = [...new Set(accessibleResults.filter((r) => r.taskParentTaskId).map((r) => r.taskParentTaskId!))];
  const searchParentTitles =
    searchParentIds.length > 0
      ? await db
          .select({ id: tasks.id, title: tasks.title })
          .from(tasks)
          .where(inArray(tasks.id, searchParentIds))
      : [];
  const searchParentMap = new Map(searchParentTitles.map((p) => [p.id, p.title]));

  const results: SearchResult[] = accessibleResults.map((r) => ({
    id: r.taskId,
    title: r.taskTitle,
    status: r.taskStatus,
    boardId: r.boardId,
    boardName: r.boardName,
    clientId: r.clientId,
    clientName: r.clientName,
    clientSlug: r.clientSlug,
    parentTaskId: r.taskParentTaskId,
    parentTaskTitle: r.taskParentTaskId ? searchParentMap.get(r.taskParentTaskId) ?? null : null,
    archivedAt: r.taskArchivedAt,
    assignees: assigneesByTask.get(r.taskId) || [],
  }));

  return { success: true, results };
}

// ─── Archive Actions ────────────────────────────────────────────────────────

export interface ArchivedTaskSummary {
  id: string;
  title: string;
  status: string;
  archivedAt: Date;
  assignees: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  }[];
}

/**
 * Archive a completed task (and its subtasks)
 */
export async function archiveTask(taskId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await requireAuth();
  const isAdmin = user.role === 'admin';

  const { canAccess, task } = await canAccessTask(user.id, taskId, isAdmin);
  if (!canAccess || !task) {
    return { success: false, error: 'Task not found or access denied' };
  }

  // Get board status options to check if task is complete
  const board = await db.query.boards.findFirst({
    where: eq(boards.id, task.boardId),
    columns: { statusOptions: true },
  });

  const { isCompleteStatus } = await import('@/lib/utils/status');
  if (!isCompleteStatus(task.status, board?.statusOptions ?? [])) {
    return { success: false, error: 'Only completed tasks can be archived' };
  }

  const now = new Date();

  // Archive the task + all its subtasks
  await db
    .update(tasks)
    .set({ archivedAt: now })
    .where(eq(tasks.id, taskId));

  await db
    .update(tasks)
    .set({ archivedAt: now })
    .where(eq(tasks.parentTaskId, taskId));

  // Log activity
  logBoardActivity({
    boardId: task.boardId,
    taskId,
    taskTitle: task.title,
    userId: user.id,
    action: 'task_archived',
  }).catch((err) => console.error('Failed to log board activity:', err));

  return { success: true };
}

/**
 * Unarchive a task (and cascade to parent/subtasks)
 */
export async function unarchiveTask(taskId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await requireAuth();
  const isAdmin = user.role === 'admin';

  const { canAccess, task } = await canAccessTask(user.id, taskId, isAdmin);
  if (!canAccess || !task) {
    return { success: false, error: 'Task not found or access denied' };
  }

  const now = new Date();

  // Unarchive the task and reset updatedAt so auto-archive timer resets
  await db
    .update(tasks)
    .set({ archivedAt: null, updatedAt: now })
    .where(eq(tasks.id, taskId));

  if (task.parentTaskId) {
    // If this is a subtask, also unarchive the parent
    await db
      .update(tasks)
      .set({ archivedAt: null, updatedAt: now })
      .where(eq(tasks.id, task.parentTaskId));
  } else {
    // If this is a parent, unarchive all its subtasks
    await db
      .update(tasks)
      .set({ archivedAt: null, updatedAt: now })
      .where(eq(tasks.parentTaskId, taskId));
  }

  // Log activity
  logBoardActivity({
    boardId: task.boardId,
    taskId,
    taskTitle: task.title,
    userId: user.id,
    action: 'task_unarchived',
  }).catch((err) => console.error('Failed to log board activity:', err));

  return { success: true };
}

/**
 * Bulk archive all done tasks on a board
 */
export async function bulkArchiveDone(boardId: string): Promise<{
  success: boolean;
  archivedCount?: number;
  error?: string;
}> {
  const user = await requireAuth();
  const isAdmin = user.role === 'admin';

  const accessLevel = await getBoardAccessLevel(user.id, boardId, isAdmin);
  if (!accessLevel) {
    return { success: false, error: 'Access denied to this board' };
  }

  // Get board's complete status IDs
  const board = await db.query.boards.findFirst({
    where: eq(boards.id, boardId),
    columns: { statusOptions: true },
  });

  const { getCompleteStatusIds } = await import('@/lib/utils/status');
  const completeIds = getCompleteStatusIds(board?.statusOptions ?? []);

  if (completeIds.length === 0) {
    return { success: true, archivedCount: 0 };
  }

  const now = new Date();

  // Find done parent tasks that aren't already archived
  const doneTasks = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.boardId, boardId),
        inArray(tasks.status, completeIds),
        isNull(tasks.archivedAt),
        isNull(tasks.parentTaskId)
      )
    );

  if (doneTasks.length === 0) {
    return { success: true, archivedCount: 0 };
  }

  const doneTaskIds = doneTasks.map((t) => t.id);

  // Archive parent tasks
  await db
    .update(tasks)
    .set({ archivedAt: now })
    .where(inArray(tasks.id, doneTaskIds));

  // Archive their subtasks
  await db
    .update(tasks)
    .set({ archivedAt: now })
    .where(inArray(tasks.parentTaskId, doneTaskIds));

  // Log activity for bulk archive
  logBoardActivity({
    boardId,
    taskId: doneTaskIds[0],
    taskTitle: `${doneTaskIds.length} completed tasks`,
    userId: user.id,
    action: 'tasks_bulk_archived',
    metadata: { count: doneTaskIds.length },
  }).catch((err) => console.error('Failed to log board activity:', err));

  return { success: true, archivedCount: doneTaskIds.length };
}

/**
 * List archived tasks for a board
 */
export async function listArchivedTasks(
  boardId: string,
  search?: string
): Promise<{
  success: boolean;
  tasks?: ArchivedTaskSummary[];
  error?: string;
}> {
  const user = await requireAuth();
  const isAdmin = user.role === 'admin';

  const accessLevel = await getBoardAccessLevel(user.id, boardId, isAdmin);
  if (!accessLevel) {
    return { success: false, error: 'Access denied to this board' };
  }

  const conditions = [
    eq(tasks.boardId, boardId),
    isNotNull(tasks.archivedAt),
    isNull(tasks.parentTaskId),
  ];

  if (search && search.trim().length >= 2) {
    conditions.push(sql`LOWER(${tasks.title}) LIKE ${'%' + search.trim().toLowerCase() + '%'}`);
  }

  const archivedTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      archivedAt: tasks.archivedAt,
    })
    .from(tasks)
    .where(and(...conditions))
    .orderBy(desc(tasks.archivedAt))
    .limit(100);

  if (archivedTasks.length === 0) {
    return { success: true, tasks: [] };
  }

  // Get assignees
  const taskIds = archivedTasks.map((t) => t.id);
  const assigneesData = await db
    .select({
      taskId: taskAssignees.taskId,
      userId: taskAssignees.userId,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(taskAssignees)
    .innerJoin(users, eq(users.id, taskAssignees.userId))
    .where(inArray(taskAssignees.taskId, taskIds));

  const assigneesByTask = new Map<string, ArchivedTaskSummary['assignees']>();
  for (const a of assigneesData) {
    const existing = assigneesByTask.get(a.taskId) || [];
    existing.push({ id: a.userId, name: a.name, avatarUrl: a.avatarUrl });
    assigneesByTask.set(a.taskId, existing);
  }

  const result: ArchivedTaskSummary[] = archivedTasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    archivedAt: t.archivedAt!,
    assignees: assigneesByTask.get(t.id) || [],
  }));

  return { success: true, tasks: result };
}

// ──────────────────────────────────────
// Bulk Update Tasks
// ──────────────────────────────────────

export interface BulkUpdateTasksInput {
  taskIds: string[];
  status?: string;
  section?: string | null;
  dueDate?: string | null;
  addAssigneeIds?: string[];
  removeAllAssignees?: boolean;
  boardId?: string; // move to a different board
}

export async function bulkUpdateTasks(input: BulkUpdateTasksInput): Promise<{
  success: boolean;
  updatedCount?: number;
  error?: string;
}> {
  const user = await requireAuth();
  const isAdmin = user.role === 'admin';

  if (!input.taskIds.length) {
    return { success: false, error: 'No tasks specified' };
  }

  // Verify access to all tasks in one query
  const taskList = await db
    .select({ id: tasks.id, boardId: tasks.boardId })
    .from(tasks)
    .where(inArray(tasks.id, input.taskIds));

  if (taskList.length !== input.taskIds.length) {
    return { success: false, error: 'Some tasks not found' };
  }

  // Verify board access for all unique source boards
  const uniqueBoardIds = [...new Set(taskList.map((t) => t.boardId))];
  for (const boardId of uniqueBoardIds) {
    const accessLevel = await getBoardAccessLevel(user.id, boardId, isAdmin);
    if (accessLevel !== 'full') {
      return { success: false, error: 'Access denied to one or more boards' };
    }
  }

  // Build update data
  const updateData: Partial<typeof tasks.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.boardId) {
    // Moving to a different board — verify access to target board
    const targetAccess = await getBoardAccessLevel(user.id, input.boardId, isAdmin);
    if (targetAccess !== 'full') {
      return { success: false, error: 'Access denied to target board' };
    }

    // Get target board's first status as default
    const targetBoard = await db.query.boards.findFirst({
      where: eq(boards.id, input.boardId),
      columns: { statusOptions: true },
    });
    const targetStatuses = (targetBoard?.statusOptions ?? []).sort(
      (a, b) => a.position - b.position
    );
    const defaultStatus = targetStatuses[0]?.id ?? 'todo';

    updateData.boardId = input.boardId;
    updateData.status = defaultStatus;
    updateData.section = null;
  }

  if (input.status !== undefined && !input.boardId) updateData.status = input.status;
  if (input.section !== undefined) updateData.section = input.section;
  if (input.dueDate !== undefined) updateData.dueDate = input.dueDate;

  // Apply update
  await db
    .update(tasks)
    .set(updateData)
    .where(inArray(tasks.id, input.taskIds));

  // Add assignees (additive, not replacement)
  if (input.addAssigneeIds && input.addAssigneeIds.length > 0) {
    // Get existing assignees for all tasks
    const existingAssignees = await db
      .select({ taskId: taskAssignees.taskId, userId: taskAssignees.userId })
      .from(taskAssignees)
      .where(inArray(taskAssignees.taskId, input.taskIds));

    const existingSet = new Set(
      existingAssignees.map((a) => `${a.taskId}:${a.userId}`)
    );

    // Build new assignments (skip duplicates)
    const newAssignments: { taskId: string; userId: string }[] = [];
    for (const taskId of input.taskIds) {
      for (const userId of input.addAssigneeIds) {
        if (!existingSet.has(`${taskId}:${userId}`)) {
          newAssignments.push({ taskId, userId });
        }
      }
    }

    if (newAssignments.length > 0) {
      await db.insert(taskAssignees).values(newAssignments);

      // Send assignment notifications (fire-and-forget)
      for (const assignment of newAssignments) {
        createAssignmentNotification({
          assigneeUserId: assignment.userId,
          assignerUserId: user.id,
          taskId: assignment.taskId,
        }).catch((err) =>
          console.error('Failed to create assignment notification:', err)
        );
      }
    }
  }

  // Remove all assignees
  if (input.removeAllAssignees) {
    await db
      .delete(taskAssignees)
      .where(inArray(taskAssignees.taskId, input.taskIds));
  }

  // Log activity for each task (fire-and-forget)
  for (const taskId of input.taskIds) {
    logBoardActivity({
      boardId: input.boardId ?? taskList.find((t) => t.id === taskId)!.boardId,
      taskId,
      taskTitle: '',
      userId: user.id,
      action: 'task_updated',
    }).catch((err) => console.error('Failed to log board activity:', err));
  }

  revalidatePath(`/clients/[clientSlug]/boards/[boardId]`, 'page');

  return { success: true, updatedCount: input.taskIds.length };
}

/**
 * Duplicate multiple tasks (including their subtasks and assignees)
 */
export async function bulkDuplicateTasks(taskIds: string[]): Promise<{
  success: boolean;
  duplicatedCount?: number;
  error?: string;
}> {
  const user = await requireAuth();
  const isAdmin = user.role === 'admin';

  if (!taskIds.length) {
    return { success: false, error: 'No tasks specified' };
  }

  // Fetch all source tasks
  const sourceTasks = await db
    .select()
    .from(tasks)
    .where(inArray(tasks.id, taskIds));

  if (sourceTasks.length !== taskIds.length) {
    return { success: false, error: 'Some tasks not found' };
  }

  // Verify board access for all unique boards
  const uniqueBoardIds = [...new Set(sourceTasks.map((t) => t.boardId))];
  for (const boardId of uniqueBoardIds) {
    const accessLevel = await getBoardAccessLevel(user.id, boardId, isAdmin);
    if (!accessLevel) {
      return { success: false, error: 'Access denied to one or more boards' };
    }
  }

  // Fetch assignees for all source tasks
  const sourceAssignees = await db
    .select({ taskId: taskAssignees.taskId, userId: taskAssignees.userId })
    .from(taskAssignees)
    .where(inArray(taskAssignees.taskId, taskIds));

  const assigneesByTask = new Map<string, string[]>();
  for (const a of sourceAssignees) {
    const list = assigneesByTask.get(a.taskId) ?? [];
    list.push(a.userId);
    assigneesByTask.set(a.taskId, list);
  }

  // Fetch subtasks for all source tasks
  const sourceSubtasks = await db
    .select()
    .from(tasks)
    .where(inArray(tasks.parentTaskId, taskIds));

  const subtasksByParent = new Map<string, (typeof sourceSubtasks)[number][]>();
  for (const st of sourceSubtasks) {
    const list = subtasksByParent.get(st.parentTaskId!) ?? [];
    list.push(st);
    subtasksByParent.set(st.parentTaskId!, list);
  }

  // Fetch assignees for all subtasks
  const subtaskIds = sourceSubtasks.map((st) => st.id);
  const subtaskAssignees = subtaskIds.length > 0
    ? await db
        .select({ taskId: taskAssignees.taskId, userId: taskAssignees.userId })
        .from(taskAssignees)
        .where(inArray(taskAssignees.taskId, subtaskIds))
    : [];

  const subtaskAssigneesByTask = new Map<string, string[]>();
  for (const a of subtaskAssignees) {
    const list = subtaskAssigneesByTask.get(a.taskId) ?? [];
    list.push(a.userId);
    subtaskAssigneesByTask.set(a.taskId, list);
  }

  // Duplicate each task
  let duplicatedCount = 0;

  for (const source of sourceTasks) {
    // Get max position for the board (scoped to top-level tasks)
    const maxPosResult = await db
      .select({ maxPos: sql<number>`COALESCE(MAX(${tasks.position}), -1)` })
      .from(tasks)
      .where(and(eq(tasks.boardId, source.boardId), isNull(tasks.parentTaskId)));

    const newPosition = (maxPosResult[0]?.maxPos ?? -1) + 1;

    // Create the duplicate task
    const [newTask] = await db
      .insert(tasks)
      .values({
        boardId: source.boardId,
        shortId: generateShortId(),
        title: `${source.title} (copy)`,
        description: source.description,
        status: source.status,
        section: source.section,
        dueDate: source.dueDate,
        dateFlexibility: source.dateFlexibility,
        parentTaskId: null,
        position: newPosition,
        createdBy: user.id,
      })
      .returning();

    // Copy assignees
    const taskAssigneeIds = assigneesByTask.get(source.id) ?? [];
    if (taskAssigneeIds.length > 0) {
      await db.insert(taskAssignees).values(
        taskAssigneeIds.map((userId) => ({ taskId: newTask.id, userId }))
      );
    }

    // Duplicate subtasks
    const subtasks = subtasksByParent.get(source.id) ?? [];
    for (const subtask of subtasks) {
      const [newSubtask] = await db
        .insert(tasks)
        .values({
          boardId: newTask.boardId,
          shortId: generateShortId(),
          title: subtask.title,
          description: subtask.description,
          status: subtask.status,
          section: subtask.section,
          dueDate: subtask.dueDate,
          dateFlexibility: subtask.dateFlexibility,
          parentTaskId: newTask.id,
          position: subtask.position,
          createdBy: user.id,
        })
        .returning();

      // Copy subtask assignees
      const stAssigneeIds = subtaskAssigneesByTask.get(subtask.id) ?? [];
      if (stAssigneeIds.length > 0) {
        await db.insert(taskAssignees).values(
          stAssigneeIds.map((userId) => ({ taskId: newSubtask.id, userId }))
        );
      }
    }

    // Log board activity
    logBoardActivity({
      boardId: newTask.boardId,
      taskId: newTask.id,
      taskTitle: newTask.title,
      userId: user.id,
      action: 'task_created',
    }).catch((err) => console.error('Failed to log board activity:', err));

    duplicatedCount++;
  }

  revalidatePath(`/clients/[clientSlug]/boards/[boardId]`, 'page');

  return { success: true, duplicatedCount };
}
