'use server';

import { db } from '@/lib/db';
import {
  rollupOwners,
  rollupInvitations,
  boards,
  users,
  teams,
  teamMembers,
} from '@/lib/db/schema';
import { eq, and, or, inArray } from 'drizzle-orm';
import { getCurrentUser, requireAuth, requireAdmin } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';

// Types
export interface RollupOwner {
  id: string;
  rollupBoardId: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  userAvatarUrl: string | null;
  isPrimary: boolean;
  createdAt: Date;
}

export interface RollupInvitation {
  id: string;
  rollupBoardId: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  teamId: string | null;
  teamName: string | null;
  allUsers: boolean;
  status: 'pending' | 'accepted' | 'declined';
  invitedBy: string;
  invitedByName: string | null;
  invitedByEmail: string;
  respondedAt: Date | null;
  createdAt: Date;
}

export interface ActionResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * Check if user is owner of a rollup
 */
async function isRollupOwner(rollupBoardId: string, userId: string): Promise<boolean> {
  const ownership = await db.query.rollupOwners.findFirst({
    where: and(eq(rollupOwners.rollupBoardId, rollupBoardId), eq(rollupOwners.userId, userId)),
  });
  return !!ownership;
}

/**
 * Get rollup owners
 */
export async function getRollupOwners(
  rollupBoardId: string
): Promise<ActionResult<RollupOwner[]>> {
  try {
    await requireAuth();

    const owners = await db.query.rollupOwners.findMany({
      where: eq(rollupOwners.rollupBoardId, rollupBoardId),
      with: {
        user: true,
      },
    });

    return {
      success: true,
      data: owners.map((o) => ({
        id: o.id,
        rollupBoardId: o.rollupBoardId,
        userId: o.userId,
        userName: o.user.name,
        userEmail: o.user.email,
        userAvatarUrl: o.user.avatarUrl,
        isPrimary: o.isPrimary,
        createdAt: o.createdAt,
      })),
    };
  } catch (error) {
    console.error('getRollupOwners error:', error);
    return { success: false, error: 'Failed to get rollup owners' };
  }
}

/**
 * Get rollup invitations
 */
export async function getRollupInvitations(
  rollupBoardId: string
): Promise<ActionResult<RollupInvitation[]>> {
  try {
    await requireAuth();

    const invitations = await db.query.rollupInvitations.findMany({
      where: eq(rollupInvitations.rollupBoardId, rollupBoardId),
      with: {
        user: true,
        team: true,
        invitedByUser: true,
      },
    });

    return {
      success: true,
      data: invitations.map((i) => ({
        id: i.id,
        rollupBoardId: i.rollupBoardId,
        userId: i.userId,
        userName: i.user?.name ?? null,
        userEmail: i.user?.email ?? null,
        teamId: i.teamId,
        teamName: i.team?.name ?? null,
        allUsers: i.allUsers,
        status: i.status,
        invitedBy: i.invitedBy,
        invitedByName: i.invitedByUser.name,
        invitedByEmail: i.invitedByUser.email,
        respondedAt: i.respondedAt,
        createdAt: i.createdAt,
      })),
    };
  } catch (error) {
    console.error('getRollupInvitations error:', error);
    return { success: false, error: 'Failed to get rollup invitations' };
  }
}

/**
 * Invite a user to a rollup (owner or admin)
 */
export async function inviteUserToRollup(
  rollupBoardId: string,
  userId: string
): Promise<ActionResult<{ invitationId: string }>> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'Authentication required' };
    }

    const isOwner = await isRollupOwner(rollupBoardId, currentUser.id);
    const isAdmin = currentUser.role === 'admin';

    if (!isOwner && !isAdmin) {
      return { success: false, error: 'Only owners or admins can invite users' };
    }

    // Check if user exists
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!targetUser) {
      return { success: false, error: 'User not found' };
    }

    // Check if already invited
    const existing = await db.query.rollupInvitations.findFirst({
      where: and(
        eq(rollupInvitations.rollupBoardId, rollupBoardId),
        eq(rollupInvitations.userId, userId)
      ),
    });
    if (existing) {
      return { success: false, error: 'User already invited' };
    }

    // Admin invites are auto-accepted
    const status = isAdmin ? 'accepted' : 'pending';
    const respondedAt = isAdmin ? new Date() : null;

    const [invitation] = await db
      .insert(rollupInvitations)
      .values({
        rollupBoardId,
        userId,
        status,
        invitedBy: currentUser.id,
        respondedAt,
      })
      .returning();

    revalidatePath('/rollups');
    return { success: true, data: { invitationId: invitation.id } };
  } catch (error) {
    console.error('inviteUserToRollup error:', error);
    return { success: false, error: 'Failed to invite user' };
  }
}

/**
 * Invite a team to a rollup (owner or admin)
 */
export async function inviteTeamToRollup(
  rollupBoardId: string,
  teamId: string
): Promise<ActionResult<{ invitationId: string }>> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'Authentication required' };
    }

    const isOwner = await isRollupOwner(rollupBoardId, currentUser.id);
    const isAdmin = currentUser.role === 'admin';

    if (!isOwner && !isAdmin) {
      return { success: false, error: 'Only owners or admins can invite teams' };
    }

    // Check if team exists
    const targetTeam = await db.query.teams.findFirst({
      where: eq(teams.id, teamId),
    });
    if (!targetTeam) {
      return { success: false, error: 'Team not found' };
    }

    // Check if already invited
    const existing = await db.query.rollupInvitations.findFirst({
      where: and(
        eq(rollupInvitations.rollupBoardId, rollupBoardId),
        eq(rollupInvitations.teamId, teamId)
      ),
    });
    if (existing) {
      return { success: false, error: 'Team already invited' };
    }

    // Admin invites are auto-accepted
    const status = isAdmin ? 'accepted' : 'pending';
    const respondedAt = isAdmin ? new Date() : null;

    const [invitation] = await db
      .insert(rollupInvitations)
      .values({
        rollupBoardId,
        teamId,
        status,
        invitedBy: currentUser.id,
        respondedAt,
      })
      .returning();

    revalidatePath('/rollups');
    return { success: true, data: { invitationId: invitation.id } };
  } catch (error) {
    console.error('inviteTeamToRollup error:', error);
    return { success: false, error: 'Failed to invite team' };
  }
}

/**
 * Invite all users to a rollup (admin only)
 * This includes future users and excludes contractors (teams with excludeFromPublic)
 */
export async function inviteAllUsersToRollup(
  rollupBoardId: string
): Promise<ActionResult<{ invitationId: string }>> {
  try {
    const currentUser = await requireAdmin();

    // Check if already has all users invitation
    const existing = await db.query.rollupInvitations.findFirst({
      where: and(
        eq(rollupInvitations.rollupBoardId, rollupBoardId),
        eq(rollupInvitations.allUsers, true)
      ),
    });
    if (existing) {
      return { success: false, error: 'All users already invited' };
    }

    const [invitation] = await db
      .insert(rollupInvitations)
      .values({
        rollupBoardId,
        allUsers: true,
        status: 'accepted', // Admin invites are auto-accepted
        invitedBy: currentUser.id,
        respondedAt: new Date(),
      })
      .returning();

    revalidatePath('/rollups');
    return { success: true, data: { invitationId: invitation.id } };
  } catch (error) {
    if ((error as Error).message === 'Admin access required') {
      return { success: false, error: 'Admin access required' };
    }
    console.error('inviteAllUsersToRollup error:', error);
    return { success: false, error: 'Failed to invite all users' };
  }
}

/**
 * Respond to a rollup invitation
 */
export async function respondToRollupInvitation(
  invitationId: string,
  accept: boolean
): Promise<ActionResult> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'Authentication required' };
    }

    const invitation = await db.query.rollupInvitations.findFirst({
      where: eq(rollupInvitations.id, invitationId),
    });

    if (!invitation) {
      return { success: false, error: 'Invitation not found' };
    }

    // Check if this invitation is for the current user
    if (invitation.userId && invitation.userId !== currentUser.id) {
      return { success: false, error: 'This invitation is not for you' };
    }

    // Check if user is member of invited team
    if (invitation.teamId) {
      const membership = await db.query.teamMembers.findFirst({
        where: and(
          eq(teamMembers.teamId, invitation.teamId),
          eq(teamMembers.userId, currentUser.id)
        ),
      });
      if (!membership) {
        return { success: false, error: 'This invitation is not for you' };
      }
    }

    if (invitation.status !== 'pending') {
      return { success: false, error: 'Invitation already responded to' };
    }

    await db
      .update(rollupInvitations)
      .set({
        status: accept ? 'accepted' : 'declined',
        respondedAt: new Date(),
      })
      .where(eq(rollupInvitations.id, invitationId));

    revalidatePath('/rollups');
    return { success: true };
  } catch (error) {
    console.error('respondToRollupInvitation error:', error);
    return { success: false, error: 'Failed to respond to invitation' };
  }
}

/**
 * Remove a rollup invitation (owner or admin)
 */
export async function removeRollupInvitation(invitationId: string): Promise<ActionResult> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'Authentication required' };
    }

    const invitation = await db.query.rollupInvitations.findFirst({
      where: eq(rollupInvitations.id, invitationId),
    });

    if (!invitation) {
      return { success: false, error: 'Invitation not found' };
    }

    const isOwner = await isRollupOwner(invitation.rollupBoardId, currentUser.id);
    const isAdmin = currentUser.role === 'admin';

    if (!isOwner && !isAdmin) {
      return { success: false, error: 'Only owners or admins can remove invitations' };
    }

    await db.delete(rollupInvitations).where(eq(rollupInvitations.id, invitationId));

    revalidatePath('/rollups');
    return { success: true };
  } catch (error) {
    console.error('removeRollupInvitation error:', error);
    return { success: false, error: 'Failed to remove invitation' };
  }
}

/**
 * Transfer rollup ownership
 */
export async function transferRollupOwnership(
  rollupBoardId: string,
  newOwnerUserId: string
): Promise<ActionResult> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'Authentication required' };
    }

    // Check if current user is primary owner
    const currentOwnership = await db.query.rollupOwners.findFirst({
      where: and(
        eq(rollupOwners.rollupBoardId, rollupBoardId),
        eq(rollupOwners.userId, currentUser.id),
        eq(rollupOwners.isPrimary, true)
      ),
    });

    if (!currentOwnership && currentUser.role !== 'admin') {
      return { success: false, error: 'Only the primary owner or admin can transfer ownership' };
    }

    // Check if new owner exists
    const newOwner = await db.query.users.findFirst({
      where: eq(users.id, newOwnerUserId),
    });
    if (!newOwner) {
      return { success: false, error: 'New owner not found' };
    }

    // Remove current primary ownership
    await db
      .update(rollupOwners)
      .set({ isPrimary: false })
      .where(
        and(eq(rollupOwners.rollupBoardId, rollupBoardId), eq(rollupOwners.isPrimary, true))
      );

    // Check if new owner already has ownership entry
    const existingOwnership = await db.query.rollupOwners.findFirst({
      where: and(
        eq(rollupOwners.rollupBoardId, rollupBoardId),
        eq(rollupOwners.userId, newOwnerUserId)
      ),
    });

    if (existingOwnership) {
      // Update to primary
      await db
        .update(rollupOwners)
        .set({ isPrimary: true })
        .where(eq(rollupOwners.id, existingOwnership.id));
    } else {
      // Create new primary ownership
      await db.insert(rollupOwners).values({
        rollupBoardId,
        userId: newOwnerUserId,
        isPrimary: true,
      });
    }

    revalidatePath('/rollups');
    return { success: true };
  } catch (error) {
    console.error('transferRollupOwnership error:', error);
    return { success: false, error: 'Failed to transfer ownership' };
  }
}

/**
 * Check if user has access to a rollup
 */
export async function checkRollupAccess(rollupBoardId: string): Promise<ActionResult<boolean>> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: true, data: false };
    }

    // Check if user is owner
    const isOwner = await isRollupOwner(rollupBoardId, currentUser.id);
    if (isOwner) {
      return { success: true, data: true };
    }

    // Get user's team IDs
    const userTeamsList = await db.query.teamMembers.findMany({
      where: eq(teamMembers.userId, currentUser.id),
      with: {
        team: true,
      },
    });
    const userTeamIds = userTeamsList.map((t) => t.teamId);
    const isContractor = userTeamsList.some((t) => t.team.excludeFromPublic);

    // Check invitations
    const invitations = await db.query.rollupInvitations.findMany({
      where: and(
        eq(rollupInvitations.rollupBoardId, rollupBoardId),
        eq(rollupInvitations.status, 'accepted')
      ),
    });

    for (const invitation of invitations) {
      // Direct user invitation
      if (invitation.userId === currentUser.id) {
        return { success: true, data: true };
      }

      // Team invitation
      if (invitation.teamId && userTeamIds.includes(invitation.teamId)) {
        return { success: true, data: true };
      }

      // All users invitation (excludes contractors)
      if (invitation.allUsers && !isContractor) {
        return { success: true, data: true };
      }
    }

    return { success: true, data: false };
  } catch (error) {
    console.error('checkRollupAccess error:', error);
    return { success: false, error: 'Failed to check rollup access' };
  }
}

/**
 * Initialize ownership when creating a rollup
 */
export async function initializeRollupOwnership(
  rollupBoardId: string,
  userId: string
): Promise<ActionResult> {
  try {
    await db.insert(rollupOwners).values({
      rollupBoardId,
      userId,
      isPrimary: true,
    });

    return { success: true };
  } catch (error) {
    console.error('initializeRollupOwnership error:', error);
    return { success: false, error: 'Failed to initialize rollup ownership' };
  }
}
