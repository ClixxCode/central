'use server';

import { db } from '@/lib/db';
import { tasks, taskAssignees, boards, boardAccess, teamMembers, users, clients } from '@/lib/db/schema';
import { eq, and, inArray, isNull, sql } from 'drizzle-orm';
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
  buildStage: string;
  status: string;
  dueDate: string | null;
  position: number;
  assignees: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    deactivatedAt: Date | null;
  }[];
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
      buildStage: isValidBuildStage(r.buildStage) ? r.buildStage : DEFAULT_BUILD_STAGE,
      status: r.status,
      dueDate: r.dueDate,
      position: r.position,
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

    const [created] = await db
      .insert(tasks)
      .values({
        boardId: input.boardId,
        title: input.title,
        status: firstStatus,
        isAgenticBuild: true,
        buildStage: stage,
        dueDate: input.dueDate,
        position,
        createdBy: user.id,
      })
      .returning({ id: tasks.id });

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
    await requireAuth();
    if (!isValidBuildStage(buildStage)) return { success: false, error: 'Invalid build stage' };

    const updated = await db
      .update(tasks)
      .set({ buildStage, updatedAt: new Date() })
      .where(and(eq(tasks.id, taskId), eq(tasks.isAgenticBuild, true)))
      .returning({ id: tasks.id });

    if (updated.length === 0) return { success: false, error: 'Build not found' };

    revalidatePath('/agentic-builds');
    return { success: true, data: null };
  } catch (err) {
    console.error('setBuildStage error:', err);
    return { success: false, error: 'Failed to update build stage' };
  }
}
