'use server';

import { db } from '@/lib/db';
import { users, teamMembers } from '@/lib/db/schema';
import { eq, desc, ne } from 'drizzle-orm';
import { requireAdmin, getCurrentUser } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';

export interface ManagedUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: 'admin' | 'user';
  authProvider: 'google' | 'credentials' | null;
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
 * Delete user (admin only)
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

    // Delete user (cascades will handle team memberships, etc.)
    await db.delete(users).where(eq(users.id, userId));

    revalidatePath('/settings/users');
    return { success: true };
  } catch (error) {
    console.error('deleteUser error:', error);
    return { success: false, error: 'Failed to delete user' };
  }
}
