'use server';

import { db } from '@/lib/db';
import { favorites, favoriteFolders, boards, clients } from '@/lib/db/schema';
import type { FavoriteWithDetails, FavoriteFolder, FavoritesData } from '@/lib/db/schema';
import { eq, and, desc, isNull, max } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';

/**
 * List favorites for the current user (folders + favorites)
 */
export async function listFavorites(): Promise<{
  success: boolean;
  data?: FavoritesData;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    const [favoritesList, foldersList] = await Promise.all([
      db
        .select({
          id: favorites.id,
          entityType: favorites.entityType,
          entityId: favorites.entityId,
          position: favorites.position,
          folderId: favorites.folderId,
          boardName: boards.name,
          boardType: boards.type,
          boardColor: boards.color,
          boardIcon: boards.icon,
          clientName: clients.name,
          clientSlug: clients.slug,
          clientColor: clients.color,
          clientIcon: clients.icon,
        })
        .from(favorites)
        .leftJoin(boards, eq(favorites.entityId, boards.id))
        .leftJoin(clients, eq(boards.clientId, clients.id))
        .where(eq(favorites.userId, user.id))
        .orderBy(favorites.position),
      db
        .select({
          id: favoriteFolders.id,
          name: favoriteFolders.name,
          position: favoriteFolders.position,
        })
        .from(favoriteFolders)
        .where(eq(favoriteFolders.userId, user.id))
        .orderBy(favoriteFolders.position),
    ]);

    const favoritesData: FavoriteWithDetails[] = favoritesList.map((f) => ({
      id: f.id,
      entityType: f.entityType as 'board' | 'rollup',
      entityId: f.entityId,
      position: f.position,
      folderId: f.folderId,
      name: f.boardName ?? 'Unknown',
      clientName: f.clientName ?? undefined,
      clientSlug: f.clientSlug ?? undefined,
      clientColor: f.clientColor ?? undefined,
      clientIcon: f.clientIcon ?? undefined,
      boardType: (f.boardType as 'standard' | 'rollup' | 'personal') ?? undefined,
      boardColor: f.boardColor ?? undefined,
      boardIcon: f.boardIcon ?? undefined,
    }));

    const folders: FavoriteFolder[] = foldersList.map((f) => ({
      id: f.id,
      name: f.name,
      position: f.position,
    }));

    return { success: true, data: { folders, favorites: favoritesData } };
  } catch (error) {
    console.error('Failed to list favorites:', error);
    return { success: false, error: 'Failed to load favorites' };
  }
}

/**
 * Add a favorite
 */
export async function addFavorite(input: {
  entityType: 'board' | 'rollup';
  entityId: string;
}): Promise<{
  success: boolean;
  data?: { id: string };
  error?: string;
}> {
  try {
    const user = await requireAuth();

    // Check if already favorited
    const existing = await db.query.favorites.findFirst({
      where: and(
        eq(favorites.userId, user.id),
        eq(favorites.entityId, input.entityId)
      ),
    });

    if (existing) {
      return { success: false, error: 'Already favorited' };
    }

    // Get the max position across top-level favorites and folders
    const [maxFavResult, maxFolderResult] = await Promise.all([
      db
        .select({ maxPos: max(favorites.position) })
        .from(favorites)
        .where(and(eq(favorites.userId, user.id), isNull(favorites.folderId))),
      db
        .select({ maxPos: max(favoriteFolders.position) })
        .from(favoriteFolders)
        .where(eq(favoriteFolders.userId, user.id)),
    ]);

    const maxFavPos = maxFavResult[0]?.maxPos ?? -1;
    const maxFolderPos = maxFolderResult[0]?.maxPos ?? -1;
    const maxPosition = Math.max(maxFavPos, maxFolderPos);

    const [newFavorite] = await db
      .insert(favorites)
      .values({
        userId: user.id,
        entityType: input.entityType,
        entityId: input.entityId,
        position: maxPosition + 1,
      })
      .returning({ id: favorites.id });

    revalidatePath('/');
    return { success: true, data: { id: newFavorite.id } };
  } catch (error) {
    console.error('Failed to add favorite:', error);
    return { success: false, error: 'Failed to add favorite' };
  }
}

/**
 * Remove a favorite
 */
export async function removeFavorite(entityId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    await db
      .delete(favorites)
      .where(
        and(eq(favorites.userId, user.id), eq(favorites.entityId, entityId))
      );

    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Failed to remove favorite:', error);
    return { success: false, error: 'Failed to remove favorite' };
  }
}

/**
 * Reorder top-level favorites and folders.
 * IDs are tagged: "folder:{id}" for folders, plain entityId for favorites.
 */
export async function reorderFavorites(
  orderedIds: string[]
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      if (id.startsWith('folder:')) {
        const folderId = id.slice(7);
        await db
          .update(favoriteFolders)
          .set({ position: i })
          .where(
            and(
              eq(favoriteFolders.userId, user.id),
              eq(favoriteFolders.id, folderId)
            )
          );
      } else {
        await db
          .update(favorites)
          .set({ position: i })
          .where(
            and(
              eq(favorites.userId, user.id),
              eq(favorites.entityId, id)
            )
          );
      }
    }

    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Failed to reorder favorites:', error);
    return { success: false, error: 'Failed to reorder favorites' };
  }
}

/**
 * Check if an entity is favorited
 */
export async function isFavorited(entityId: string): Promise<{
  success: boolean;
  data?: boolean;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    const existing = await db.query.favorites.findFirst({
      where: and(
        eq(favorites.userId, user.id),
        eq(favorites.entityId, entityId)
      ),
    });

    return { success: true, data: !!existing };
  } catch (error) {
    console.error('Failed to check favorite:', error);
    return { success: false, error: 'Failed to check favorite status' };
  }
}

/**
 * Create a favorite folder
 */
export async function createFavoriteFolder(input: {
  name: string;
}): Promise<{
  success: boolean;
  data?: FavoriteFolder;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    // Get the max position across top-level favorites and folders
    const [maxFavResult, maxFolderResult] = await Promise.all([
      db
        .select({ maxPos: max(favorites.position) })
        .from(favorites)
        .where(and(eq(favorites.userId, user.id), isNull(favorites.folderId))),
      db
        .select({ maxPos: max(favoriteFolders.position) })
        .from(favoriteFolders)
        .where(eq(favoriteFolders.userId, user.id)),
    ]);

    const maxFavPos = maxFavResult[0]?.maxPos ?? -1;
    const maxFolderPos = maxFolderResult[0]?.maxPos ?? -1;
    const maxPosition = Math.max(maxFavPos, maxFolderPos);

    const [folder] = await db
      .insert(favoriteFolders)
      .values({
        userId: user.id,
        name: input.name,
        position: maxPosition + 1,
      })
      .returning({
        id: favoriteFolders.id,
        name: favoriteFolders.name,
        position: favoriteFolders.position,
      });

    revalidatePath('/');
    return { success: true, data: folder };
  } catch (error) {
    console.error('Failed to create favorite folder:', error);
    return { success: false, error: 'Failed to create folder' };
  }
}

/**
 * Rename a favorite folder
 */
export async function renameFavoriteFolder(input: {
  folderId: string;
  name: string;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    await db
      .update(favoriteFolders)
      .set({ name: input.name })
      .where(
        and(
          eq(favoriteFolders.userId, user.id),
          eq(favoriteFolders.id, input.folderId)
        )
      );

    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Failed to rename favorite folder:', error);
    return { success: false, error: 'Failed to rename folder' };
  }
}

/**
 * Delete a favorite folder (contents become top-level via FK set null)
 */
export async function deleteFavoriteFolder(folderId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    await db
      .delete(favoriteFolders)
      .where(
        and(
          eq(favoriteFolders.userId, user.id),
          eq(favoriteFolders.id, folderId)
        )
      );

    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete favorite folder:', error);
    return { success: false, error: 'Failed to delete folder' };
  }
}

/**
 * Move a favorite into or out of a folder
 */
export async function moveFavoriteToFolder(input: {
  entityId: string;
  folderId: string | null;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    // Calculate position at end of target
    let maxPos = -1;
    if (input.folderId) {
      const result = await db
        .select({ maxPos: max(favorites.position) })
        .from(favorites)
        .where(
          and(
            eq(favorites.userId, user.id),
            eq(favorites.folderId, input.folderId)
          )
        );
      maxPos = result[0]?.maxPos ?? -1;
    } else {
      // Moving to top-level: max of top-level favorites and folders
      const [maxFavResult, maxFolderResult] = await Promise.all([
        db
          .select({ maxPos: max(favorites.position) })
          .from(favorites)
          .where(and(eq(favorites.userId, user.id), isNull(favorites.folderId))),
        db
          .select({ maxPos: max(favoriteFolders.position) })
          .from(favoriteFolders)
          .where(eq(favoriteFolders.userId, user.id)),
      ]);
      maxPos = Math.max(maxFavResult[0]?.maxPos ?? -1, maxFolderResult[0]?.maxPos ?? -1);
    }

    await db
      .update(favorites)
      .set({ folderId: input.folderId, position: maxPos + 1 })
      .where(
        and(
          eq(favorites.userId, user.id),
          eq(favorites.entityId, input.entityId)
        )
      );

    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Failed to move favorite to folder:', error);
    return { success: false, error: 'Failed to move favorite' };
  }
}

/**
 * Reorder favorites within a folder
 */
export async function reorderFolderContents(input: {
  folderId: string;
  orderedEntityIds: string[];
}): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    for (let i = 0; i < input.orderedEntityIds.length; i++) {
      await db
        .update(favorites)
        .set({ position: i })
        .where(
          and(
            eq(favorites.userId, user.id),
            eq(favorites.entityId, input.orderedEntityIds[i]),
            eq(favorites.folderId, input.folderId)
          )
        );
    }

    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Failed to reorder folder contents:', error);
    return { success: false, error: 'Failed to reorder folder contents' };
  }
}
