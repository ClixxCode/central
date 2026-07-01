import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';
import { useUIStore } from '@/lib/stores';
import type { TopShellContext } from './shell-context';

interface SidebarPreferenceMock {
  hiddenNavItems: string[];
  navOrder: string[];
}

const mocks = vi.hoisted(() => ({
  pathname: '/clients/acme-co/boards/board-1',
  searchParams: new URLSearchParams(),
  favoritesData: {
    folders: [],
    favorites: [
      {
        id: 'favorite-1',
        entityId: 'board-1',
        entityType: 'board',
        boardType: 'client',
        name: 'Favorite Board',
        clientSlug: 'acme-co',
        clientName: 'Acme Co',
        clientColor: '#2563eb',
        clientIcon: null,
        boardColor: null,
        boardIcon: null,
        folderId: null,
        position: 0,
      },
    ],
  },
  calendarPreferences: { showScheduleInSidebar: true },
  sidebarPreferences: { hiddenNavItems: [], navOrder: [] } as SidebarPreferenceMock,
  favoriteHintHeld: false,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => mocks.searchParams,
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('@/hooks/useIsClient', () => ({
  useIsClient: () => true,
}));

vi.mock('@/lib/hooks/useFavoriteHintKeys', () => ({
  useFavoriteHintKeys: () => mocks.favoriteHintHeld,
}));

vi.mock('@/lib/hooks/useFavorites', () => ({
  useFavorites: () => ({ data: mocks.favoritesData }),
  useReorderFavorites: () => ({ mutate: vi.fn() }),
  useRemoveFavorite: () => ({ mutate: vi.fn() }),
  useCreateFavoriteFolder: () => ({ mutate: vi.fn() }),
  useRenameFavoriteFolder: () => ({ mutate: vi.fn() }),
  useDeleteFavoriteFolder: () => ({ mutate: vi.fn() }),
  useMoveFavoriteToFolder: () => ({ mutate: vi.fn() }),
  useReorderFolderContents: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/lib/hooks', () => ({
  useCalendarPreferences: () => ({ data: mocks.calendarPreferences }),
  useSidebarPreferences: () => ({ data: mocks.sidebarPreferences }),
  useUpdateSidebarPreferences: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/components/search', () => ({
  GlobalSearch: () => <div data-testid="global-search" />,
}));

vi.mock('./AppActions', () => ({
  AppActions: () => <div data-testid="sidebar-app-actions" />,
}));

const shellContext: TopShellContext = {
  section: 'board',
  activeNavItem: 'clients',
  title: 'Launch Board',
  crumbs: [],
  breadcrumbs: [],
  actionsSlot: 'board',
  route: {
    pathname: '/clients/acme-co/boards/board-1',
    segments: ['clients', 'acme-co', 'boards', 'board-1'],
    clientSlug: 'acme-co',
    boardId: 'board-1',
  },
  isAdminRoute: false,
};

const user = {
  name: 'AJ Griem',
  email: 'aj@example.com',
  image: null,
};

describe('Sidebar', () => {
  beforeEach(() => {
    mocks.pathname = '/clients/acme-co/boards/board-1';
    mocks.searchParams = new URLSearchParams();
    mocks.sidebarPreferences = { hiddenNavItems: [], navOrder: [] };
    useUIStore.setState({
      sidebarOpen: false,
      sidebarCollapsed: false,
      expandedClients: [],
      collapsedSections: [],
    });
  });

  it('keeps legacy hidden client preferences effective in expanded navigation', () => {
    mocks.sidebarPreferences = {
      hiddenNavItems: ['ClientList'],
      navOrder: [],
    };

    render(
      <Sidebar
        user={user}
        isAdmin
        shellContext={shellContext}
        onSignOut={vi.fn()}
      />
    );

    expect(screen.queryByRole('link', { name: 'Clients' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My Work' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Schedule' })).toBeInTheDocument();
  });

  it('gives collapsed icon links accessible names and current state', () => {
    useUIStore.setState({ sidebarCollapsed: true });

    render(
      <Sidebar
        user={user}
        isAdmin
        shellContext={shellContext}
        onSignOut={vi.fn()}
      />
    );

    expect(screen.getByRole('link', { name: 'Clients' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Favorite Board' })).toHaveAttribute(
      'href',
      '/clients/acme-co/boards/board-1'
    );
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    expect(screen.getByTestId('sidebar-app-actions')).toBeInTheDocument();
  });

  it('switches sidebar styling with the app shell visual refresh variant', () => {
    const { container, rerender } = render(
      <Sidebar
        user={user}
        isAdmin
        shellContext={shellContext}
        onSignOut={vi.fn()}
        visualRefreshEnabled={false}
      />
    );

    const legacySidebar = container.querySelector('[data-app-sidebar]');
    expect(legacySidebar).toHaveAttribute('data-shell-visual-refresh', 'off');
    expect(legacySidebar).toHaveClass('border-r', 'bg-muted/50');

    rerender(
      <Sidebar
        user={user}
        isAdmin
        shellContext={shellContext}
        onSignOut={vi.fn()}
        visualRefreshEnabled
      />
    );

    const refreshedSidebar = container.querySelector('[data-app-sidebar]');
    expect(refreshedSidebar).toHaveAttribute('data-shell-visual-refresh', 'on');
    expect(refreshedSidebar).toHaveClass('bg-sidebar', 'text-sidebar-foreground');
  });
});
