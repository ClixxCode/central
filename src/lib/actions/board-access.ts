'use server';

import { db } from '@/lib/db';
import { boardAccess, boardProjects, boards, taskAssignees, tasks, teamMembers } from '@/lib/db/schema';
import { and, eq, inArray, or } from 'drizzle-orm';

export type BoardAccessLevel = 'full' | 'assigned_only' | null;

export async function isUserInContractorTeam(userId: string): Promise<boolean> {
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

export async function getUserTeamIds(userId: string): Promise<string[]> {
  const userTeams = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, userId),
    columns: { teamId: true },
  });

  return userTeams.map((team) => team.teamId);
}

export async function getExplicitAccessBoardIds(userId: string): Promise<string[]> {
  const teamIds = await getUserTeamIds(userId);
  const conditions = [eq(boardAccess.userId, userId)];

  if (teamIds.length > 0) {
    conditions.push(inArray(boardAccess.teamId, teamIds));
  }

  const accessEntries = await db.query.boardAccess.findMany({
    where: or(...conditions),
    columns: { boardId: true },
  });

  const explicitIds = [...new Set(accessEntries.map((entry) => entry.boardId))];
  if (explicitIds.length === 0) {
    return [];
  }

  const inheritedProjects = await db.query.boardProjects.findMany({
    where: inArray(boardProjects.parentBoardId, explicitIds),
    columns: { projectBoardId: true },
  });

  return [...new Set([...explicitIds, ...inheritedProjects.map((project) => project.projectBoardId)])];
}

export async function getBoardAccessSourceBoardId(boardId: string): Promise<string | null> {
  const board = await db.query.boards.findFirst({
    where: eq(boards.id, boardId),
    columns: { type: true },
  });

  if (!board) {
    return null;
  }

  if (board.type !== 'project') {
    return boardId;
  }

  const projectCard = await db.query.boardProjects.findFirst({
    where: eq(boardProjects.projectBoardId, boardId),
    columns: { parentBoardId: true },
  });

  return projectCard?.parentBoardId ?? null;
}

export async function getBoardAccessLevel(
  userId: string,
  boardId: string,
  isAdmin: boolean,
  visitedBoardIds: Set<string> = new Set()
): Promise<BoardAccessLevel> {
  if (isAdmin) {
    return 'full';
  }

  if (visitedBoardIds.has(boardId)) {
    return null;
  }
  visitedBoardIds.add(boardId);

  const board = await db.query.boards.findFirst({
    where: eq(boards.id, boardId),
    columns: { type: true, createdBy: true },
  });

  if (!board) {
    return null;
  }

  if (board.type === 'personal') {
    return board.createdBy === userId ? 'full' : null;
  }

  if (board.type === 'project') {
    const projectCard = await db.query.boardProjects.findFirst({
      where: eq(boardProjects.projectBoardId, boardId),
      columns: { parentBoardId: true },
    });

    if (!projectCard) {
      return null;
    }

    return getBoardAccessLevel(userId, projectCard.parentBoardId, isAdmin, visitedBoardIds);
  }

  const isContractor = await isUserInContractorTeam(userId);
  if (!isContractor) {
    return 'full';
  }

  const directAccess = await db.query.boardAccess.findFirst({
    where: and(eq(boardAccess.boardId, boardId), eq(boardAccess.userId, userId)),
  });

  if (directAccess) {
    return directAccess.accessLevel;
  }

  const teamIds = await getUserTeamIds(userId);
  if (teamIds.length === 0) {
    return null;
  }

  const teamAccess = await db.query.boardAccess.findFirst({
    where: and(eq(boardAccess.boardId, boardId), inArray(boardAccess.teamId, teamIds)),
  });

  return teamAccess?.accessLevel ?? null;
}

export async function canAccessBoard(
  userId: string,
  boardId: string,
  requiredLevel?: 'full'
): Promise<boolean> {
  const accessLevel = await getBoardAccessLevel(userId, boardId, false);
  if (!accessLevel) {
    return false;
  }

  return !requiredLevel || accessLevel === requiredLevel;
}

export async function canAccessTask(
  userId: string,
  taskId: string,
  isAdmin: boolean
): Promise<{ canAccess: boolean; task?: typeof tasks.$inferSelect; accessLevel: BoardAccessLevel }> {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });

  if (!task) {
    return { canAccess: false, accessLevel: null };
  }

  const accessLevel = await getBoardAccessLevel(userId, task.boardId, isAdmin);

  if (!accessLevel) {
    return { canAccess: false, accessLevel: null };
  }

  if (accessLevel === 'full') {
    return { canAccess: true, task, accessLevel };
  }

  const assignment = await db.query.taskAssignees.findFirst({
    where: and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.userId, userId)),
  });

  return {
    canAccess: !!assignment,
    task: assignment ? task : undefined,
    accessLevel: assignment ? accessLevel : null,
  };
}
