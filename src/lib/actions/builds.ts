'use server';

import { db } from '@/lib/db';
import { tasks, taskAssignees, boards, boardAccess, teamMembers, users, clients, buildStageEvents } from '@/lib/db/schema';
import { eq, and, inArray, isNull, asc, sql } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import { createAssignmentNotification } from './notifications';
import { DEFAULT_BUILD_STAGE, isValidBuildStage } from '@/lib/builds/stages';

export interface AgenticBuild {
  id: string;
  shortId: string | null;
  title: string;
  boardId: string;
  boardName: string;
  clientId: string | null;
  clientName: string | null;
  clientSlug: string | null;
  clientColor: string | null;
  clientIcon: string | null;
  podName: string | null;
  buildStage: string;
  status: string;
  dueDate: string | null;
  position: number;
  /** Economics: null until set. */
  buildType: BuildType | null;
  projectValue: number | null;
  commencementDate: string | null;
  completedAt: string | null;
  /** Computed durations (ms). See computeTiming. */
  timing: BuildTiming;
  assignees: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    deactivatedAt: Date | null;
  }[];
}

export type BuildType = 'proactive_no_fee' | 'proactive_with_fee' | 'budgeted_project';

export interface BuildTiming {
  /** commencement → (completed or now); null when commencement isn't set. */
  totalMs: number | null;
  /** time in the current stage (last stage entry → completed or now). */
  currentStageMs: number;
  /** accumulated ms per stage id, across all entries. */
  perStageMs: Record<string, number>;
}

const isFeeType = (t: string | null): boolean =>
  t === 'proactive_with_fee' || t === 'budgeted_project';

/**
 * Compute time-in-stage + total duration from a build's ordered stage events.
 * Each event runs until the next event (or, for the last event, until the build
 * completed / now). Total is commencement → (completed or now).
 */
function computeTiming(
  events: { stage: string; enteredAt: Date }[],
  commencementDate: string | null,
  completedAt: Date | null,
  now: number,
): BuildTiming {
  const end = completedAt ? completedAt.getTime() : now;
  const perStageMs: Record<string, number> = {};
  let currentStageMs = 0;
  const ordered = [...events].sort((a, b) => a.enteredAt.getTime() - b.enteredAt.getTime());
  for (let i = 0; i < ordered.length; i++) {
    const start = ordered[i].enteredAt.getTime();
    const stop = i + 1 < ordered.length ? ordered[i + 1].enteredAt.getTime() : end;
    const span = Math.max(0, stop - start);
    perStageMs[ordered[i].stage] = (perStageMs[ordered[i].stage] ?? 0) + span;
    if (i === ordered.length - 1) currentStageMs = span;
  }
  let totalMs: number | null = null;
  if (commencementDate) {
    const startMs = new Date(`${commencementDate}T00:00:00Z`).getTime();
    if (!Number.isNaN(startMs)) totalMs = Math.max(0, end - startMs);
  }
  return { totalMs, currentStageMs, perStageMs };
}

export interface BuildableClient {
  id: string;
  name: string;
  slug: string;
  boardId: string; // target board a new build attaches to
}

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

/** Contractors must have explicit board access; everyone else sees all boards. */
async function isContractor(userId: string): Promise<boolean> {
  const rows = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, userId),
    with: { team: { columns: { excludeFromPublic: true } } },
  });
  return rows.some((r) => r.team?.excludeFromPublic);
}

/**
 * All agentic-build cards across every board the user may see, flat. The board
 * UI groups them into BUILD_STAGES columns. Builds with a null/unknown stage
 * are coerced to the default stage so they never vanish.
 */
export async function listAgenticBuilds(): Promise<ActionResult<AgenticBuild[]>> {
  try {
    const user = await requireAuth();

    const where = [eq(tasks.isAgenticBuild, true), isNull(tasks.archivedAt)];

    // Restrict contractors to boards they have explicit access to.
    if (user.role !== 'admin' && (await isContractor(user.id))) {
      const access = await db.query.boardAccess.findMany({
        where: eq(boardAccess.userId, user.id),
        columns: { boardId: true },
      });
      const ids = access.map((a) => a.boardId);
      if (ids.length === 0) return { success: true, data: [] };
      where.push(inArray(tasks.boardId, ids));
    }

    const rows = await db
      .select({
        id: tasks.id,
        shortId: tasks.shortId,
        title: tasks.title,
        boardId: tasks.boardId,
        boardName: boards.name,
        buildStage: tasks.buildStage,
        status: tasks.status,
        dueDate: tasks.dueDate,
        position: tasks.position,
        clientId: clients.id,
        clientName: clients.name,
        clientSlug: clients.slug,
        clientColor: clients.color,
        clientIcon: clients.icon,
        podName: clients.podName,
        buildType: tasks.buildType,
        projectValue: tasks.projectValue,
        commencementDate: tasks.commencementDate,
        completedAt: tasks.completedAt,
      })
      .from(tasks)
      .innerJoin(boards, eq(boards.id, tasks.boardId))
      .leftJoin(clients, eq(clients.id, boards.clientId))
      .where(and(...where));

    if (rows.length === 0) return { success: true, data: [] };

    // Batch assignees for all builds.
    const taskIds = rows.map((r) => r.id);
    const assigneeRows = await db
      .select({
        taskId: taskAssignees.taskId,
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        deactivatedAt: users.deactivatedAt,
      })
      .from(taskAssignees)
      .innerJoin(users, eq(users.id, taskAssignees.userId))
      .where(inArray(taskAssignees.taskId, taskIds));

    const byTask = new Map<string, AgenticBuild['assignees']>();
    for (const a of assigneeRows) {
      const list = byTask.get(a.taskId) ?? [];
      list.push({ id: a.id, email: a.email, name: a.name, avatarUrl: a.avatarUrl, deactivatedAt: a.deactivatedAt });
      byTask.set(a.taskId, list);
    }

    // Stage events for timing (one query for all builds).
    const eventRows = await db
      .select({ taskId: buildStageEvents.taskId, stage: buildStageEvents.stage, enteredAt: buildStageEvents.enteredAt })
      .from(buildStageEvents)
      .where(inArray(buildStageEvents.taskId, taskIds))
      .orderBy(asc(buildStageEvents.enteredAt));
    const eventsByTask = new Map<string, { stage: string; enteredAt: Date }[]>();
    for (const e of eventRows) {
      const list = eventsByTask.get(e.taskId) ?? [];
      list.push({ stage: e.stage, enteredAt: e.enteredAt });
      eventsByTask.set(e.taskId, list);
    }
    const now = Date.now();

    const data: AgenticBuild[] = rows.map((r) => ({
      id: r.id,
      shortId: r.shortId,
      title: r.title,
      boardId: r.boardId,
      boardName: r.boardName,
      clientId: r.clientId,
      clientName: r.clientName,
      clientSlug: r.clientSlug,
      clientColor: r.clientColor,
      clientIcon: r.clientIcon,
      podName: r.podName,
      buildStage: isValidBuildStage(r.buildStage) ? r.buildStage : DEFAULT_BUILD_STAGE,
      status: r.status,
      dueDate: r.dueDate,
      position: r.position,
      buildType: (r.buildType as BuildType | null) ?? null,
      projectValue: r.projectValue != null ? Number(r.projectValue) : null,
      commencementDate: r.commencementDate,
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      timing: computeTiming(eventsByTask.get(r.id) ?? [], r.commencementDate, r.completedAt, now),
      assignees: byTask.get(r.id) ?? [],
    }));

    return { success: true, data };
  } catch (err) {
    console.error('listAgenticBuilds error:', err);
    return { success: false, error: 'Failed to load builds' };
  }
}

/** Clients a new build can attach to, with the board the build will live on. */
export async function getBuildableClients(): Promise<ActionResult<BuildableClient[]>> {
  try {
    await requireAuth();
    const rows = await db.query.clients.findMany({
      columns: { id: true, name: true, slug: true, defaultBoardId: true },
      with: { boards: { columns: { id: true, type: true }, limit: 1, where: eq(boards.type, 'standard') } },
      orderBy: (c, { asc }) => [asc(c.name)],
    });
    const data: BuildableClient[] = [];
    for (const c of rows) {
      const boardId = c.defaultBoardId ?? c.boards[0]?.id;
      if (boardId) data.push({ id: c.id, name: c.name, slug: c.slug, boardId });
    }
    return { success: true, data };
  } catch (err) {
    console.error('getBuildableClients error:', err);
    return { success: false, error: 'Failed to load clients' };
  }
}

export interface CreateBuildInput {
  boardId: string;
  title: string;
  buildStage?: string;
  assigneeIds?: string[];
  dueDate?: string;
  buildType?: BuildType | null;
  projectValue?: number | null;
  commencementDate?: string | null;
}

export async function createAgenticBuild(input: CreateBuildInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAuth();
    const stage = isValidBuildStage(input.buildStage) ? input.buildStage! : DEFAULT_BUILD_STAGE;

    const board = await db.query.boards.findFirst({
      where: eq(boards.id, input.boardId),
      columns: { id: true, statusOptions: true, clientId: true },
    });
    if (!board) return { success: false, error: 'Target board not found' };

    // Builds ride the board's first status; the meaningful axis is buildStage.
    const firstStatus = board.statusOptions?.[0]?.id ?? 'todo';

    const maxPos = await db
      .select({ maxPos: sql<number>`COALESCE(MAX(${tasks.position}), -1)` })
      .from(tasks)
      .where(and(eq(tasks.boardId, input.boardId), isNull(tasks.parentTaskId)));
    const position = (maxPos[0]?.maxPos ?? -1) + 1;

    // Fee-bearing builds carry a project value; proactive-no-fee never does.
    const feeType = isFeeType(input.buildType ?? null);
    const projectValue =
      feeType && input.projectValue != null && input.projectValue > 0
        ? String(input.projectValue)
        : null;

    const [created] = await db
      .insert(tasks)
      .values({
        boardId: input.boardId,
        title: input.title,
        status: firstStatus,
        isAgenticBuild: true,
        buildStage: stage,
        buildType: input.buildType ?? null,
        projectValue,
        commencementDate: input.commencementDate ?? null,
        completedAt: stage === 'complete' ? new Date() : null,
        dueDate: input.dueDate,
        position,
        createdBy: user.id,
      })
      .returning({ id: tasks.id });

    // Anchor the stage timer.
    await db.insert(buildStageEvents).values({ taskId: created.id, stage, movedBy: user.id });

    if (input.assigneeIds?.length) {
      await db.insert(taskAssignees).values(input.assigneeIds.map((userId) => ({ taskId: created.id, userId })));
      for (const assigneeId of input.assigneeIds) {
        createAssignmentNotification({ assigneeUserId: assigneeId, assignerUserId: user.id, taskId: created.id }).catch(
          (e) => console.error('build assignment notification failed:', e)
        );
      }
    }

    revalidatePath('/agentic-builds');
    return { success: true, data: { id: created.id } };
  } catch (err) {
    console.error('createAgenticBuild error:', err);
    return { success: false, error: 'Failed to create build' };
  }
}

/** Move a build to a different pipeline stage (drag-and-drop on the build board). */
export async function setBuildStage(taskId: string, buildStage: string): Promise<ActionResult<null>> {
  try {
    const user = await requireAuth();
    if (!isValidBuildStage(buildStage)) return { success: false, error: 'Invalid build stage' };

    // Read the current stage so we only log real transitions + manage completedAt.
    const current = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, taskId), eq(tasks.isAgenticBuild, true)),
      columns: { id: true, buildStage: true, completedAt: true },
    });
    if (!current) return { success: false, error: 'Build not found' };
    if (current.buildStage === buildStage) {
      revalidatePath('/agentic-builds');
      return { success: true, data: null };
    }

    // Complete stops the timer; leaving Complete (reopen) restarts it.
    const completedAt =
      buildStage === 'complete' ? current.completedAt ?? new Date() : null;

    await db
      .update(tasks)
      .set({ buildStage, completedAt, updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    // Log the transition for time-in-stage analytics.
    await db.insert(buildStageEvents).values({ taskId, stage: buildStage, movedBy: user.id });

    revalidatePath('/agentic-builds');
    return { success: true, data: null };
  } catch (err) {
    console.error('setBuildStage error:', err);
    return { success: false, error: 'Failed to update build stage' };
  }
}

export interface UpdateBuildInput {
  title?: string;
  buildStage?: string;
  buildType?: BuildType | null;
  projectValue?: number | null;
  commencementDate?: string | null;
  dueDate?: string | null;
  assigneeIds?: string[];
}

/** Edit a build's fields from the board's Edit dialog. Stage changes here go
 *  through the same event-logging path as drag-and-drop. */
export async function updateAgenticBuild(taskId: string, input: UpdateBuildInput): Promise<ActionResult<null>> {
  try {
    const user = await requireAuth();

    const current = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, taskId), eq(tasks.isAgenticBuild, true)),
      columns: { id: true, buildStage: true, completedAt: true, buildType: true },
    });
    if (!current) return { success: false, error: 'Build not found' };

    const set: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };
    if (typeof input.title === 'string' && input.title.trim()) set.title = input.title.trim();
    if ('buildType' in input) set.buildType = input.buildType ?? null;
    if ('commencementDate' in input) set.commencementDate = input.commencementDate ?? null;
    if ('dueDate' in input) set.dueDate = input.dueDate ?? null;

    // Project value follows the (new or existing) build type: only fee types keep it.
    const nextType = ('buildType' in input ? input.buildType : current.buildType) ?? null;
    if ('projectValue' in input || 'buildType' in input) {
      set.projectValue =
        isFeeType(nextType) && input.projectValue != null && input.projectValue > 0
          ? String(input.projectValue)
          : null;
    }

    // Stage change → validate, manage completedAt, log an event.
    let stageChanged = false;
    if (input.buildStage && input.buildStage !== current.buildStage) {
      if (!isValidBuildStage(input.buildStage)) return { success: false, error: 'Invalid build stage' };
      set.buildStage = input.buildStage;
      set.completedAt = input.buildStage === 'complete' ? current.completedAt ?? new Date() : null;
      stageChanged = true;
    }

    await db.update(tasks).set(set).where(eq(tasks.id, taskId));

    if (stageChanged && input.buildStage) {
      await db.insert(buildStageEvents).values({ taskId, stage: input.buildStage, movedBy: user.id });
    }

    if (input.assigneeIds) {
      await db.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));
      if (input.assigneeIds.length) {
        await db.insert(taskAssignees).values(input.assigneeIds.map((userId) => ({ taskId, userId })));
      }
    }

    revalidatePath('/agentic-builds');
    return { success: true, data: null };
  } catch (err) {
    console.error('updateAgenticBuild error:', err);
    return { success: false, error: 'Failed to update build' };
  }
}
