import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Chainable Drizzle mock — each method returns an object with all possible next methods.
// orderBy returns a thenable (for listFavorites: `await ...orderBy()`)
// that also exposes .limit() (for addFavorite: `...orderBy().limit(1)`).
const chainMethods = {
  limit: vi.fn(() => Promise.resolve([])),
  orderBy: vi.fn((): any => {
    const promise = Promise.resolve([]);
    return { then: promise.then.bind(promise), catch: promise.catch.bind(promise), limit: chainMethods.limit };
  }),
  where: vi.fn((): any => ({ orderBy: chainMethods.orderBy, limit: chainMethods.limit })),
  leftJoin: vi.fn((): any => ({ leftJoin: chainMethods.leftJoin, where: chainMethods.where })),
};

const insertChain = {
  returning: vi.fn(() => Promise.resolve([{ id: 'fav-new' }])),
};
const deleteChain = {
  where: vi.fn(() => Promise.resolve()),
};
const updateChain = {
  where: vi.fn(() => Promise.resolve()),
};

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      favorites: {
        findFirst: vi.fn(),
      },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        leftJoin: chainMethods.leftJoin,
        where: chainMethods.where,
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: insertChain.returning,
      })),
    })),
    delete: vi.fn(() => ({
      where: deleteChain.where,
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: updateChain.where,
      })),
    })),
  },
}));

vi.mock('@/lib/auth/session', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    id: 'user-123',
    email: 'test@clix.co',
    name: 'Test User',
    role: 'user',
  }),
}));

vi.mock('@/lib/db/schema', () => ({
  favorites: { id: 'favorites.id', userId: 'favorites.userId', entityType: 'favorites.entityType', entityId: 'favorites.entityId', position: 'favorites.position', folderId: 'favorites.folderId' },
  favoriteFolders: { id: 'favoriteFolders.id', userId: 'favoriteFolders.userId', name: 'favoriteFolders.name', position: 'favoriteFolders.position' },
  boards: { id: 'boards.id', name: 'boards.name', clientId: 'boards.clientId' },
  clients: { id: 'clients.id', name: 'clients.name', slug: 'clients.slug', color: 'clients.color' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((col: unknown) => col),
  isNull: vi.fn((col: unknown) => ['isNull', col]),
  max: vi.fn((col: unknown) => ['max', col]),
}));

// Helper: create a thenable that also has .limit() for the orderBy mock
function orderByResult(data: unknown[]) {
  const promise = Promise.resolve(data);
  return { then: promise.then.bind(promise), catch: promise.catch.bind(promise), limit: chainMethods.limit };
}

describe('Favorites Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Restore default implementations after clearAllMocks
    chainMethods.orderBy.mockImplementation((): any => orderByResult([]));
    chainMethods.where.mockImplementation((): any => ({ orderBy: chainMethods.orderBy, limit: chainMethods.limit }));
    chainMethods.leftJoin.mockImplementation((): any => ({ leftJoin: chainMethods.leftJoin, where: chainMethods.where }));
    chainMethods.limit.mockImplementation(() => Promise.resolve([]));
  });

  describe('listFavorites', () => {
    it('returns favorites and folders for the current user', async () => {
      const mockFavData = [
        {
          id: 'fav-1',
          entityType: 'board',
          entityId: 'board-123',
          position: 0,
          folderId: null,
          boardName: 'Marketing Board',
          clientName: 'Acme Corp',
          clientSlug: 'acme',
          clientColor: '#3B82F6',
        },
        {
          id: 'fav-2',
          entityType: 'rollup',
          entityId: 'rollup-456',
          position: 1,
          folderId: null,
          boardName: 'All Tasks Rollup',
          clientName: null,
          clientSlug: null,
          clientColor: null,
        },
      ];
      // First orderBy call returns favorites, second returns folders (empty)
      chainMethods.orderBy
        .mockReturnValueOnce(orderByResult(mockFavData))
        .mockReturnValueOnce(orderByResult([]));

      const { listFavorites } = await import('@/lib/actions/favorites');
      const result = await listFavorites();

      expect(result.success).toBe(true);
      expect(result.data!.favorites).toHaveLength(2);
      expect(result.data!.folders).toHaveLength(0);

      // Board favorite has client details
      const boardFav = result.data!.favorites[0];
      expect(boardFav.entityType).toBe('board');
      expect(boardFav.entityId).toBe('board-123');
      expect(boardFav.name).toBe('Marketing Board');
      expect(boardFav.clientName).toBe('Acme Corp');
      expect(boardFav.clientSlug).toBe('acme');
      expect(boardFav.clientColor).toBe('#3B82F6');

      // Rollup favorite has no client details
      const rollupFav = result.data!.favorites[1];
      expect(rollupFav.entityType).toBe('rollup');
      expect(rollupFav.entityId).toBe('rollup-456');
      expect(rollupFav.name).toBe('All Tasks Rollup');
      expect(rollupFav.clientName).toBeUndefined();
      expect(rollupFav.clientSlug).toBeUndefined();
      expect(rollupFav.clientColor).toBeUndefined();
    });

    it('returns empty arrays when user has no favorites', async () => {
      chainMethods.orderBy
        .mockReturnValueOnce(orderByResult([]))
        .mockReturnValueOnce(orderByResult([]));

      const { listFavorites } = await import('@/lib/actions/favorites');
      const result = await listFavorites();

      expect(result.success).toBe(true);
      expect(result.data!.favorites).toEqual([]);
      expect(result.data!.folders).toEqual([]);
    });

    it('shows "Unknown" name when board name is null', async () => {
      chainMethods.orderBy
        .mockReturnValueOnce(orderByResult([
          {
            id: 'fav-1',
            entityType: 'board',
            entityId: 'board-gone',
            position: 0,
            folderId: null,
            boardName: null,
            clientName: null,
            clientSlug: null,
            clientColor: null,
          },
        ]))
        .mockReturnValueOnce(orderByResult([]));

      const { listFavorites } = await import('@/lib/actions/favorites');
      const result = await listFavorites();

      expect(result.success).toBe(true);
      expect(result.data!.favorites[0].name).toBe('Unknown');
    });

    it('handles errors gracefully', async () => {
      chainMethods.orderBy.mockReturnValueOnce({
        then: (_: any, reject: any) => Promise.reject(new Error('DB error')).then(_, reject),
        catch: (fn: any) => Promise.reject(new Error('DB error')).catch(fn),
        limit: chainMethods.limit,
      });

      const { listFavorites } = await import('@/lib/actions/favorites');
      const result = await listFavorites();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to load favorites');
    });
  });

  describe('removeFavorite', () => {
    it('removes a favorite by entityId', async () => {
      deleteChain.where.mockResolvedValueOnce(undefined);

      const { removeFavorite } = await import('@/lib/actions/favorites');
      const result = await removeFavorite('board-123');

      expect(result.success).toBe(true);
    });

    it('removes a rollup favorite', async () => {
      deleteChain.where.mockResolvedValueOnce(undefined);

      const { removeFavorite } = await import('@/lib/actions/favorites');
      const result = await removeFavorite('rollup-456');

      expect(result.success).toBe(true);
    });

    it('handles errors gracefully', async () => {
      deleteChain.where.mockRejectedValueOnce(new Error('DB error'));

      const { removeFavorite } = await import('@/lib/actions/favorites');
      const result = await removeFavorite('board-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to remove favorite');
    });
  });

  describe('reorderFavorites', () => {
    it('updates positions for reordered favorites', async () => {
      updateChain.where.mockResolvedValue(undefined);

      const { reorderFavorites } = await import('@/lib/actions/favorites');
      const result = await reorderFavorites(['board-2', 'rollup-1', 'board-1']);

      expect(result.success).toBe(true);
    });

    it('handles folder IDs in the reorder list', async () => {
      updateChain.where.mockResolvedValue(undefined);

      const { reorderFavorites } = await import('@/lib/actions/favorites');
      const result = await reorderFavorites(['folder:folder-1', 'board-2', 'board-1']);

      expect(result.success).toBe(true);
    });

    it('handles empty array', async () => {
      const { reorderFavorites } = await import('@/lib/actions/favorites');
      const result = await reorderFavorites([]);

      expect(result.success).toBe(true);
    });

    it('handles errors gracefully', async () => {
      updateChain.where.mockRejectedValueOnce(new Error('DB error'));

      const { reorderFavorites } = await import('@/lib/actions/favorites');
      const result = await reorderFavorites(['board-1']);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to reorder favorites');
    });
  });

  describe('isFavorited', () => {
    it('returns true when entity is favorited', async () => {
      const { db } = await import('@/lib/db');
      vi.mocked(db.query.favorites.findFirst).mockResolvedValueOnce({
        id: 'fav-1',
        entityId: 'board-123',
      } as any);

      const { isFavorited } = await import('@/lib/actions/favorites');
      const result = await isFavorited('board-123');

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it('returns false when entity is not favorited', async () => {
      const { db } = await import('@/lib/db');
      vi.mocked(db.query.favorites.findFirst).mockResolvedValueOnce(undefined as any);

      const { isFavorited } = await import('@/lib/actions/favorites');
      const result = await isFavorited('rollup-999');

      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });

    it('works for rollup entity IDs', async () => {
      const { db } = await import('@/lib/db');
      vi.mocked(db.query.favorites.findFirst).mockResolvedValueOnce({
        id: 'fav-2',
        entityId: 'rollup-456',
      } as any);

      const { isFavorited } = await import('@/lib/actions/favorites');
      const result = await isFavorited('rollup-456');

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it('handles errors gracefully', async () => {
      const { db } = await import('@/lib/db');
      vi.mocked(db.query.favorites.findFirst).mockRejectedValueOnce(new Error('DB error'));

      const { isFavorited } = await import('@/lib/actions/favorites');
      const result = await isFavorited('board-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to check favorite status');
    });
  });
});
