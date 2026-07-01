import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AppActions } from './AppActions';

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  favoriteHintHeld: true,
  favoritesData: {
    favorites: [
      {
        id: 'favorite-1',
        entityId: 'board-1',
        entityType: 'board',
        boardType: 'client',
        name: 'Favorite Board',
        clientSlug: 'acme-co',
      },
    ],
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}));

vi.mock('@/hooks/useIsClient', () => ({
  useIsClient: () => true,
}));

vi.mock('@/lib/hooks/useFavorites', () => ({
  useFavorites: () => ({ data: mocks.favoritesData }),
}));

vi.mock('@/lib/hooks/useFavoriteHintKeys', () => ({
  useFavoriteHintKeys: () => mocks.favoriteHintHeld,
}));

vi.mock('@/lib/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock('@/lib/stores', () => ({
  useQuickActionsStore: () => ({
    openQuickAdd: vi.fn(),
    quickAddOpen: false,
    closeQuickAdd: vi.fn(),
  }),
}));

vi.mock('@/components/search', () => ({
  GlobalSearch: () => <div data-testid="global-search" />,
}));

vi.mock('@/components/notifications', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

vi.mock('@/components/shortcuts', () => ({
  KeyboardShortcutsModal: () => null,
}));

vi.mock('@/components/quick-add', () => ({
  QuickAddDialog: () => null,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}));

const user = {
  name: 'AJ Griem',
  email: 'aj@example.com',
  image: null,
};

describe('AppActions', () => {
  beforeEach(() => {
    mocks.routerPush.mockClear();
    mocks.favoriteHintHeld = true;
    mocks.favoritesData = {
      favorites: [
        {
          id: 'favorite-1',
          entityId: 'board-1',
          entityType: 'board',
          boardType: 'client',
          name: 'Favorite Board',
          clientSlug: 'acme-co',
        },
      ],
    };
  });

  it('uses canonical admin settings routes for admin menu items', () => {
    render(<AppActions user={user} isAdmin onSignOut={vi.fn()} />);

    expect(screen.getByRole('link', { name: /manage users/i })).toHaveAttribute(
      'href',
      '/settings/admin/users'
    );
    expect(screen.getByRole('link', { name: /manage teams/i })).toHaveAttribute(
      'href',
      '/settings/admin/teams'
    );
    expect(screen.getByRole('link', { name: /statuses & sections/i })).toHaveAttribute(
      'href',
      '/settings/admin/statuses'
    );
  });

  it('hides admin menu items for non-admin users', () => {
    render(<AppActions user={user} onSignOut={vi.fn()} />);

    expect(screen.queryByRole('link', { name: /manage users/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /manage teams/i })).not.toBeInTheDocument();
  });

  it('navigates to pinned favorites while the favorite hint key is held', () => {
    render(<AppActions user={user} onSignOut={vi.fn()} />);

    fireEvent.keyDown(document, { key: '1' });

    expect(mocks.routerPush).toHaveBeenCalledWith('/clients/acme-co/boards/board-1');
  });

  it('ignores favorite number shortcuts while editing text', () => {
    render(<AppActions user={user} onSignOut={vi.fn()} />);
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(input, { key: '1' });

    expect(mocks.routerPush).not.toHaveBeenCalled();
    input.remove();
  });
});
