import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode, Ref } from 'react';
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
  GlobalSearch: ({ inputRef }: { inputRef?: Ref<HTMLInputElement> }) => (
    <input ref={inputRef} aria-label="Search" data-testid="global-search" />
  ),
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

  it('opens a labelled mobile search popover', () => {
    render(<AppActions user={user} onSignOut={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open search' }));

    expect(screen.getAllByTestId('global-search')).toHaveLength(2);
  });

  it('hides quick add and search controls in contextual headers', () => {
    render(<AppActions user={user} onSignOut={vi.fn()} hidePrimaryActions />);

    expect(screen.queryByTitle('Quick add task (n)')).not.toBeInTheDocument();
    expect(screen.queryByTestId('global-search')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open search' })).not.toBeInTheDocument();
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
  });
});
