'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { put, del } from '@vercel/blob';

interface UpdateProfileResult {
  success: boolean;
  error?: string;
}

export async function updateProfile(formData: FormData): Promise<UpdateProfileResult> {
  const session = await auth();
  
  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const name = formData.get('name') as string | null;
    const avatarFile = formData.get('avatar') as File | null;

    const updates: { name?: string | null; avatarUrl?: string | null } = {};

    // Update name if provided
    if (name !== null) {
      updates.name = name.trim() || null;
    }

    // Handle avatar upload
    if (avatarFile && avatarFile.size > 0) {
      // Get current user to check for existing avatar
      const currentUser = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        columns: { avatarUrl: true },
      });

      // Delete old avatar if it's a blob URL
      if (currentUser?.avatarUrl?.includes('blob.vercel-storage.com')) {
        try {
          await del(currentUser.avatarUrl);
        } catch {
          // Ignore deletion errors for old avatars
        }
      }

      // Upload new avatar
      const blob = await put(`avatars/${session.user.id}-${Date.now()}`, avatarFile, {
        access: 'public',
        contentType: avatarFile.type,
      });

      updates.avatarUrl = blob.url;
    }

    // Only update if there are changes
    if (Object.keys(updates).length > 0) {
      await db
        .update(users)
        .set(updates)
        .where(eq(users.id, session.user.id));
    }

    revalidatePath('/settings/profile');
    revalidatePath('/', 'layout');

    return { success: true };
  } catch (error) {
    console.error('Failed to update profile:', error);
    return { success: false, error: 'Failed to update profile' };
  }
}

export async function getProfile() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      image: true,
    },
  });

  if (!user) return null;

  // Return avatarUrl (custom upload) first, fall back to image (OAuth provider)
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl || user.image,
  };
}
