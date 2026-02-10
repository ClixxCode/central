'use server';

import { db } from '@/lib/db';
import { favorites, boards, clients } from '@/lib/db/schema';
import type { FavoriteWithDetails } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';

/**
 * List favorites for the current user
 */
export async function listFavorites(): Promise<{
  success: boolean;
  data?: FavoriteWithDetails[];
  error?: string;
}> {
  try {
    const user = await requireAuth();

    const favoritesList = await db
      .select({
        id: favorites.id,
        entityType: favorites.entityType,
        entityId: favorites.entityId,
        position: favorites.position,
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
      .orderBy(favorites.position);

    const data: FavoriteWithDetails[] = favoritesList.map((f) => ({
      id: f.id,
      entityType: f.entityType as 'board' | 'rollup',
      entityId: f.entityId,
      position: f.position,
      name: f.boardName ?? 'Unknown',
      clientName: f.clientName ?? undefined,
      clientSlug: f.clientSlug ?? undefined,
      clientColor: f.clientColor ?? undefined,
      clientIcon: f.clientIcon ?? undefined,
      boardType: (f.boardType as 'standard' | 'rollup' | 'personal') ?? undefined,
      boardColor: f.boardColor ?? undefined,
      boardIcon: f.boardIcon ?? undefined,
    }));

    return { success: true, data };
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

    // Get the max position
    const maxResult = await db
      .select({ maxPos: favorites.position })
      .from(favorites)
      .where(eq(favorites.userId, user.id))
      .orderBy(desc(favorites.position))
      .limit(1);

    const maxPosition = maxResult[0]?.maxPos ?? -1;

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
 * Reorder favorites
 */
export async function reorderFavorites(
  orderedIds: string[]
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    // Update positions in a transaction-like manner
    for (let i = 0; i < orderedIds.length; i++) {
      await db
        .update(favorites)
        .set({ position: i })
        .where(
          and(
            eq(favorites.userId, user.id),
            eq(favorites.entityId, orderedIds[i])
          )
        );
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
