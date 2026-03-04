'use server';

import { db } from '@/lib/db';
import { users, teamMembers, tasks, boards, clients, attachments, comments, invitations, rollupInvitations, taskAssignees } from '@/lib/db/schema';
import { eq, desc, ne, and, inArray, notInArray } from 'drizzle-orm';
import { createAssignmentNotification } from './notifications';
import { requireAdmin, getCurrentUser } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import { del } from '@vercel/blob';

export interface ManagedUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: 'admin' | 'user';
  authProvider: 'google' | 'credentials' | null;
  deactivatedAt: Date | null;
  createdAt: Date;
  teamCount: number;
}

export interface ActionResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * List all users (admin only)
 */
export async function listAllUsers(): Promise<ActionResult<ManagedUser[]>> {
  try {
    await requireAdmin();

    const allUsers = await db.query.users.findMany({
      orderBy: [desc(users.createdAt)],
      with: {
        teamMembers: {
          columns: { teamId: true },
        },
      },
    });

    return {
      success: true,
      data: allUsers.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        avatarUrl: u.avatarUrl,
        role: u.role,
        authProvider: u.authProvider,
        deactivatedAt: u.deactivatedAt,
        createdAt: u.createdAt,
        teamCount: u.teamMembers?.length ?? 0,
      })),
    };
  } catch (error) {
    console.error('listAllUsers error:', error);
    return { success: false, error: 'Failed to list users' };
  }
}

/**
 * Update user role (admin only)
 */
export async function updateUserRole(
  userId: string,
  role: 'admin' | 'user'
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();

    // Prevent self-demotion
    if (admin.id === userId && role !== 'admin') {
      return { success: false, error: 'You cannot change your own admin status' };
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId));

    revalidatePath('/settings/users');
    return { success: true };
  } catch (error) {
    console.error('updateUserRole error:', error);
    return { success: false, error: 'Failed to update user role' };
  }
}

/**
 * Deactivate user (admin only) — soft delete
 */
export async function deactivateUser(userId: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();

    // Prevent self-deactivation
    if (admin.id === userId) {
      return { success: false, error: 'You cannot deactivate your own account' };
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (user.deactivatedAt) {
      return { success: false, error: 'User is already deactivated' };
    }

    await db
      .update(users)
      .set({ deactivatedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));

    revalidatePath('/settings/users');
    return { success: true };
  } catch (error) {
    console.error('deactivateUser error:', error);
    return { success: false, error: 'Failed to deactivate user' };
  }
}

/**
 * Reactivate user (admin only)
 */
export async function reactivateUser(userId: string): Promise<ActionResult> {
  try {
    await requireAdmin();

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (!user.deactivatedAt) {
      return { success: false, error: 'User is not deactivated' };
    }

    await db
      .update(users)
      .set({ deactivatedAt: null, updatedAt: new Date() })
      .where(eq(users.id, userId));

    revalidatePath('/settings/users');
    return { success: true };
  } catch (error) {
    console.error('reactivateUser error:', error);
    return { success: false, error: 'Failed to reactivate user' };
  }
}

/**
 * Permanently delete a user (admin only)
 * User must be deactivated first. Clears FK references that would block deletion,
 * then deletes the user row (cascade handles the rest).
 */
export async function deleteUser(userId: string): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();

    // Prevent self-deletion
    if (admin.id === userId) {
      return { success: false, error: 'You cannot delete your own account' };
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Safety gate: must be deactivated first
    if (!user.deactivatedAt) {
      return { success: false, error: 'User must be deactivated before permanent deletion' };
    }

    // Clear FK references and delete user in a single transaction
    await db.transaction(async (tx) => {
      // Nullify createdBy / authorId / uploadedBy references
      await tx.update(tasks).set({ createdBy: null }).where(eq(tasks.createdBy, userId));
      await tx.update(boards).set({ createdBy: null }).where(eq(boards.createdBy, userId));
      await tx.update(clients).set({ createdBy: null }).where(eq(clients.createdBy, userId));
      await tx.update(attachments).set({ uploadedBy: null }).where(eq(attachments.uploadedBy, userId));
      await tx.update(comments).set({ authorId: null }).where(eq(comments.authorId, userId));

      // Delete invitation records that reference this user as inviter
      await tx.delete(invitations).where(eq(invitations.invitedBy, userId));
      await tx.delete(rollupInvitations).where(eq(rollupInvitations.invitedBy, userId));

      // Delete the user — cascade handles accounts, teamMembers, taskAssignees,
      // notifications, boardAccess, favorites, boardActivityLog, taskViews,
      // emailVerificationTokens, passwordResetTokens, rollupOwners,
      // rollupInvitations.userId
      await tx.delete(users).where(eq(users.id, userId));
    });

    // Delete avatar blob from Vercel Blob (fire-and-forget)
    if (user.avatarUrl?.includes('blob.vercel-storage.com')) {
      del(user.avatarUrl).catch((err) =>
        console.error('Failed to delete avatar blob:', err)
      );
    }

    revalidatePath('/settings/users');
    return { success: true };
  } catch (error) {
    console.error('deleteUser error:', error);
    return { success: false, error: 'Failed to delete user' };
  }
}

/**
 * Reassign all task assignments from one user to another (admin only)
 * Skips tasks where the target user is already assigned.
 */
export async function reassignUserTasks(
  fromUserId: string,
  toUserId: string
): Promise<ActionResult<{ reassignedCount: number }>> {
  try {
    const admin = await requireAdmin();

    if (fromUserId === toUserId) {
      return { success: false, error: 'Cannot reassign tasks to the same user' };
    }

    // Get all task assignments for the source user
    const fromAssignments = await db
      .select({ taskId: taskAssignees.taskId })
      .from(taskAssignees)
      .where(eq(taskAssignees.userId, fromUserId));

    if (fromAssignments.length === 0) {
      return { success: true, data: { reassignedCount: 0 } };
    }

    const taskIds = fromAssignments.map((a) => a.taskId);

    // Find tasks where the target user is already assigned (to skip duplicates)
    const existingAssignments = await db
      .select({ taskId: taskAssignees.taskId })
      .from(taskAssignees)
      .where(
        and(
          eq(taskAssignees.userId, toUserId),
          inArray(taskAssignees.taskId, taskIds)
        )
      );

    const alreadyAssignedTaskIds = new Set(existingAssignments.map((a) => a.taskId));
    const tasksToReassign = taskIds.filter((id) => !alreadyAssignedTaskIds.has(id));

    await db.transaction(async (tx) => {
      // Insert new assignments for the target user (only for tasks they're not already on)
      if (tasksToReassign.length > 0) {
        await tx.insert(taskAssignees).values(
          tasksToReassign.map((taskId) => ({
            taskId,
            userId: toUserId,
          }))
        );
      }

      // Remove all assignments from the source user
      await tx.delete(taskAssignees).where(eq(taskAssignees.userId, fromUserId));
    });

    // Send assignment notifications for newly assigned tasks (fire-and-forget)
    for (const taskId of tasksToReassign) {
      createAssignmentNotification({
        assigneeUserId: toUserId,
        assignerUserId: admin.id,
        taskId,
      }).catch(() => {});
    }

    return { success: true, data: { reassignedCount: tasksToReassign.length } };
  } catch (error) {
    console.error('reassignUserTasks error:', error);
    return { success: false, error: 'Failed to reassign tasks' };
  }
}
