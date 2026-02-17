'use server';

import { db } from '@/lib/db';
import { teams, teamMembers, users } from '@/lib/db/schema';
import { eq, and, asc, desc } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';

// Types
export interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  deactivatedAt: Date | null;
  joinedAt: Date;
}

export interface TeamWithMembers {
  id: string;
  name: string;
  excludeFromPublic: boolean;
  createdAt: Date;
  members: TeamMember[];
}

export interface UserForTeam {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface ActionResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * List all teams with their members (admin only)
 */
export async function listTeamsWithMembers(): Promise<ActionResult<TeamWithMembers[]>> {
  try {
    await requireAdmin();

    const allTeams = await db.query.teams.findMany({
      with: {
        members: {
          with: {
            user: true,
          },
        },
      },
      orderBy: [asc(teams.name)],
    });

    return {
      success: true,
      data: allTeams.map((team) => ({
        id: team.id,
        name: team.name,
        excludeFromPublic: team.excludeFromPublic,
        createdAt: team.createdAt,
        members: team.members.map((m) => ({
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          avatarUrl: m.user.avatarUrl,
          deactivatedAt: m.user.deactivatedAt,
          joinedAt: m.joinedAt,
        })),
      })),
    };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('listTeamsWithMembers error:', error);
    return { success: false, error: 'Failed to list teams' };
  }
}

/**
 * Get a single team by ID (admin only)
 */
export async function getTeam(teamId: string): Promise<ActionResult<TeamWithMembers | null>> {
  try {
    await requireAdmin();

    const team = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
      with: {
        members: {
          with: {
            user: true,
          },
        },
      },
    });

    if (!team) {
      return { success: true, data: null };
    }

    return {
      success: true,
      data: {
        id: team.id,
        name: team.name,
        excludeFromPublic: team.excludeFromPublic,
        createdAt: team.createdAt,
        members: team.members.map((m) => ({
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          avatarUrl: m.user.avatarUrl,
          deactivatedAt: m.user.deactivatedAt,
          joinedAt: m.joinedAt,
        })),
      },
    };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('getTeam error:', error);
    return { success: false, error: 'Failed to get team' };
  }
}

/**
 * Create a new team (admin only)
 */
export async function createTeam(name: string): Promise<ActionResult<{ teamId: string }>> {
  try {
    await requireAdmin();

    if (!name.trim()) {
      return { success: false, error: 'Team name is required' };
    }

    const [team] = await db.insert(teams).values({ name: name.trim() }).returning();

    revalidatePath('/settings/teams');
    return { success: true, data: { teamId: team.id } };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('createTeam error:', error);
    return { success: false, error: 'Failed to create team' };
  }
}

/**
 * Update a team (admin only)
 */
export async function updateTeam(
  teamId: string,
  data: { name?: string; excludeFromPublic?: boolean }
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const existing = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
    });

    if (!existing) {
      return { success: false, error: 'Team not found' };
    }

    const updateData: Partial<typeof teams.$inferInsert> = {};
    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }
    if (data.excludeFromPublic !== undefined) {
      updateData.excludeFromPublic = data.excludeFromPublic;
    }

    await db.update(teams).set(updateData).where(eq(teams.id, teamId));

    revalidatePath('/settings/teams');
    return { success: true };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('updateTeam error:', error);
    return { success: false, error: 'Failed to update team' };
  }
}

/**
 * Delete a team (admin only)
 * Team members will cascade delete via foreign key
 */
export async function deleteTeam(teamId: string): Promise<ActionResult> {
  try {
    await requireAdmin();

    const existing = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
    });

    if (!existing) {
      return { success: false, error: 'Team not found' };
    }

    await db.delete(teams).where(eq(teams.id, teamId));

    revalidatePath('/settings/teams');
    return { success: true };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('deleteTeam error:', error);
    return { success: false, error: 'Failed to delete team' };
  }
}

/**
 * Add a user to a team (admin only)
 */
export async function addUserToTeam(teamId: string, userId: string): Promise<ActionResult> {
  try {
    await requireAdmin();

    // Check if already a member
    const existing = await db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
    });

    if (existing) {
      return { success: false, error: 'User is already a member of this team' };
    }

    await db.insert(teamMembers).values({ teamId, userId });

    revalidatePath('/settings/teams');
    return { success: true };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('addUserToTeam error:', error);
    return { success: false, error: 'Failed to add user to team' };
  }
}

/**
 * Remove a user from a team (admin only)
 */
export async function removeUserFromTeam(teamId: string, userId: string): Promise<ActionResult> {
  try {
    await requireAdmin();

    await db
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));

    revalidatePath('/settings/teams');
    return { success: true };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('removeUserFromTeam error:', error);
    return { success: false, error: 'Failed to remove user from team' };
  }
}

/**
 * Get all users for team management (admin only)
 */
export async function listUsersForTeamManagement(): Promise<ActionResult<UserForTeam[]>> {
  try {
    await requireAdmin();

    const allUsers = await db.query.users.findMany({
      orderBy: [desc(users.createdAt)],
    });

    return {
      success: true,
      data: allUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl,
      })),
    };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('listUsersForTeamManagement error:', error);
    return { success: false, error: 'Failed to list users' };
  }
}
