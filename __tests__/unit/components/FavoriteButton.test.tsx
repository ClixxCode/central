import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FavoriteButton } from '@/components/shared/FavoriteButton';
import type { FavoriteWithDetails, FavoritesData } from '@/lib/db/schema';

// Mock the hooks
const mockToggle = vi.fn();
const mockFavorites: FavoriteWithDetails[] = [];

vi.mock('@/lib/hooks/useFavorites', () => ({
  useFavorites: vi.fn(() => ({
    data: { folders: [], favorites: mockFavorites } as FavoritesData,
  })),
  useToggleFavorite: vi.fn(() => ({
    toggle: mockToggle,
    isPending: false,
  })),
}));

// Mock tooltip to render inline (avoids portal issues in tests)
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span data-testid="tooltip">{children}</span>,
}));

function createFavorite(overrides: Partial<FavoriteWithDetails> = {}): FavoriteWithDetails {
  return {
    id: 'fav-1',
    entityType: 'board',
    entityId: 'board-123',
    position: 0,
    folderId: null,
    name: 'Test Board',
    clientName: 'Test Client',
    clientSlug: 'test-client',
    clientColor: '#3B82F6',
    ...overrides,
  };
}

describe('FavoriteButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFavorites.length = 0;
  });

  it('renders a star button', () => {
    render(<FavoriteButton entityType="board" entityId="board-123" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows "Add to favorites" tooltip when not favorited', () => {
    render(<FavoriteButton entityType="board" entityId="board-123" />);
    expect(screen.getByText('Add to favorites')).toBeInTheDocument();
  });

  it('shows "Remove from favorites" tooltip when favorited', () => {
    mockFavorites.push(createFavorite({ entityId: 'board-123' }));

    render(<FavoriteButton entityType="board" entityId="board-123" />);
    expect(screen.getByText('Remove from favorites')).toBeInTheDocument();
  });

  it('calls toggle with board entityType on click', () => {
    render(<FavoriteButton entityType="board" entityId="board-123" />);
    fireEvent.click(screen.getByRole('button'));

    expect(mockToggle).toHaveBeenCalledWith('board', 'board-123');
  });

  it('calls toggle with rollup entityType on click', () => {
    render(<FavoriteButton entityType="rollup" entityId="rollup-456" />);
    fireEvent.click(screen.getByRole('button'));

    expect(mockToggle).toHaveBeenCalledWith('rollup', 'rollup-456');
  });

  it('detects favorited state for rollups', () => {
    mockFavorites.push(
      createFavorite({
        entityType: 'rollup',
        entityId: 'rollup-456',
        name: 'My Rollup',
        clientName: undefined,
        clientSlug: undefined,
        clientColor: undefined,
      })
    );

    render(<FavoriteButton entityType="rollup" entityId="rollup-456" />);
    expect(screen.getByText('Remove from favorites')).toBeInTheDocument();
  });

  it('does not match different entity IDs as favorited', () => {
    mockFavorites.push(createFavorite({ entityId: 'board-999' }));

    render(<FavoriteButton entityType="board" entityId="board-123" />);
    expect(screen.getByText('Add to favorites')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<FavoriteButton entityType="board" entityId="board-123" className="custom-class" />);
    expect(screen.getByRole('button')).toHaveClass('custom-class');
  });

  it('is disabled when toggle is pending', async () => {
    const { useToggleFavorite } = await import('@/lib/hooks/useFavorites');
    vi.mocked(useToggleFavorite).mockReturnValueOnce({
      toggle: mockToggle,
      isPending: true,
      isFavorited: () => false,
    });

    render(<FavoriteButton entityType="rollup" entityId="rollup-456" />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
