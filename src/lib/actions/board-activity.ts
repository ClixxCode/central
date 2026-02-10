'use server';

import { db } from '@/lib/db';
import { boardActivityLog, users } from '@/lib/db/schema';
import { eq, and, desc, gte } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/session';
import { getBoard } from './boards';

// Types
export interface BoardActivityEntry {
  id: string;
  boardId: string;
  taskId: string | null;
  taskTitle: string | null;
  userId: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

export interface LogBoardActivityInput {
  boardId: string;
  taskId: string;
  taskTitle: string;
  userId: string;
  action: string;
  metadata?: Record<string, unknown>;
}

/**
 * Internal helper to log a board activity entry.
 * Callers should fire-and-forget: logBoardActivity(...).catch(console.error)
 */
export async function logBoardActivity(input: LogBoardActivityInput): Promise<void> {
  await db.insert(boardActivityLog).values({
    boardId: input.boardId,
    taskId: input.taskId,
    taskTitle: input.taskTitle,
    userId: input.userId,
    action: input.action,
    metadata: input.metadata ?? null,
  });
}

/**
 * List board activity entries (last 30 days, max 200)
 */
export async function listBoardActivity(boardId: string): Promise<{
  success: boolean;
  entries?: BoardActivityEntry[];
  error?: string;
}> {
  const user = await requireAuth();

  // Access check via getBoard
  const boardResult = await getBoard(boardId);
  if (!boardResult.success || !boardResult.data) {
    return { success: false, error: 'Board not found or access denied' };
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const entries = await db
    .select({
      id: boardActivityLog.id,
      boardId: boardActivityLog.boardId,
      taskId: boardActivityLog.taskId,
      taskTitle: boardActivityLog.taskTitle,
      userId: boardActivityLog.userId,
      action: boardActivityLog.action,
      metadata: boardActivityLog.metadata,
      createdAt: boardActivityLog.createdAt,
      userName: users.name,
      userEmail: users.email,
      userAvatarUrl: users.avatarUrl,
    })
    .from(boardActivityLog)
    .innerJoin(users, eq(users.id, boardActivityLog.userId))
    .where(
      and(
        eq(boardActivityLog.boardId, boardId),
        gte(boardActivityLog.createdAt, thirtyDaysAgo)
      )
    )
    .orderBy(desc(boardActivityLog.createdAt))
    .limit(200);

  return {
    success: true,
    entries: entries.map((e) => ({
      id: e.id,
      boardId: e.boardId,
      taskId: e.taskId,
      taskTitle: e.taskTitle,
      userId: e.userId,
      action: e.action,
      metadata: e.metadata as Record<string, unknown> | null,
      createdAt: e.createdAt,
      user: {
        id: e.userId,
        name: e.userName,
        email: e.userEmail,
        avatarUrl: e.userAvatarUrl,
      },
    })),
  };
}
