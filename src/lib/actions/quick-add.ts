'use server';

import { db } from '@/lib/db';
import { users, teams, teamMembers } from '@/lib/db/schema';
import { eq, isNull } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/session';
import { getBoardAssignableUsers } from './tasks';

/**
 * Get the current authenticated user's info.
 * Used as a reliable fallback when client-side useSession() doesn't resolve.
 */
export async function getCurrentUserAction(): Promise<{
  success: boolean;
  user?: { id: string; email: string; name: string | null; image: string | null; role: 'admin' | 'user' };
  error?: string;
}> {
  try {
    const user = await requireAuth();
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
      },
    };
  } catch {
    return { success: false, error: 'Not authenticated' };
  }
}

/**
 * List users that can be assigned to tasks.
 * Without boardId: returns all non-contractor users (safe for any authenticated user).
 * With boardId: delegates to existing getBoardAssignableUsers(boardId).
 */
export async function listAssignableUsers(boardId?: string, options?: { includeContractors?: boolean }): Promise<{
  success: boolean;
  users?: { id: string; email: string; name: string | null; avatarUrl: string | null }[];
  error?: string;
}> {
  await requireAuth();

  if (boardId) {
    return getBoardAssignableUsers(boardId);
  }

  // Without boardId: return all active users
  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(isNull(users.deactivatedAt));

  if (options?.includeContractors) {
    return { success: true, users: allUsers };
  }

  // Get contractor team IDs
  const contractorTeams = await db.query.teams.findMany({
    where: eq(teams.excludeFromPublic, true),
    columns: { id: true },
  });
  const contractorTeamIds = new Set(contractorTeams.map((t) => t.id));

  // Get all team memberships
  const allTeamMemberships = await db.query.teamMembers.findMany({
    columns: { userId: true, teamId: true },
  });

  // Identify contractor users
  const contractorUserIds = new Set(
    allTeamMemberships
      .filter((tm) => contractorTeamIds.has(tm.teamId))
      .map((tm) => tm.userId)
  );

  // Return non-contractor users
  const assignableUsers = allUsers.filter((u) => !contractorUserIds.has(u.id));

  return { success: true, users: assignableUsers };
}

/**
 * List ALL users for mention suggestions.
 * Anyone can be mentioned in comments — notification filtering
 * handles access control separately.
 */
export async function listMentionableUsers(): Promise<{
  success: boolean;
  users?: { id: string; email: string; name: string | null; avatarUrl: string | null }[];
  error?: string;
}> {
  await requireAuth();

  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(isNull(users.deactivatedAt));

  return { success: true, users: allUsers };
}
