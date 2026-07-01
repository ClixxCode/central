import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileNav } from './MobileNav';
import { useUIStore } from '@/lib/stores';
import type { TopShellContext } from './shell-context';

const mocks = vi.hoisted(() => ({
  pathname: '/clients/acme-co/boards/board-1',
  searchParams: new URLSearchParams(),
  favoritesData: {
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
      },
    ],
  },
  calendarPreferences: { showScheduleInSidebar: true },
  sidebarPreferences: { hiddenNavItems: [], navOrder: [] },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => mocks.searchParams,
}));

vi.mock('@/hooks/useIsClient', () => ({
  useIsClient: () => true,
}));

vi.mock('@/lib/hooks/useFavorites', () => ({
  useFavorites: () => ({ data: mocks.favoritesData }),
}));

vi.mock('@/lib/hooks', () => ({
  useCalendarPreferences: () => ({ data: mocks.calendarPreferences }),
  useSidebarPreferences: () => ({ data: mocks.sidebarPreferences }),
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
  client: {
    id: 'client-1',
    slug: 'acme-co',
    name: 'Acme Co',
    href: '/clients/acme-co',
  },
  board: {
    id: 'board-1',
    name: 'Launch Board',
    href: '/clients/acme-co/boards/board-1',
  },
  isAdminRoute: false,
};

describe('MobileNav', () => {
  beforeEach(() => {
    mocks.pathname = '/clients/acme-co/boards/board-1';
    mocks.searchParams = new URLSearchParams();
    mocks.favoritesData = {
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
        },
      ],
    };
    mocks.calendarPreferences = { showScheduleInSidebar: true };
    mocks.sidebarPreferences = { hiddenNavItems: [], navOrder: [] };
    useUIStore.setState({
      sidebarOpen: true,
      sidebarCollapsed: false,
      expandedClients: [],
      collapsedSections: [],
    });
  });

  it('renders app-wide mobile navigation without the legacy client board tree', () => {
    render(<MobileNav isAdmin shellContext={shellContext} />);

    expect(screen.getByRole('link', { name: 'My Tasks' })).toHaveAttribute('href', '/my-tasks');
    expect(screen.getByRole('link', { name: 'Clients' })).toHaveAttribute('href', '/clients');
    expect(screen.getByRole('link', { name: 'Schedule' })).toHaveAttribute('href', '/schedule');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/settings/admin');
    expect(screen.getByText('Favorite Board').closest('a')).toHaveAttribute(
      'href',
      '/clients/acme-co/boards/board-1'
    );

    expect(screen.queryByRole('link', { name: 'Acme Co' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Launch Board' })).not.toBeInTheDocument();
  });

  it('closes the mobile navigation sheet when an app link is selected', () => {
    render(<MobileNav shellContext={shellContext} />);

    fireEvent.click(screen.getByRole('link', { name: 'Clients' }));

    expect(useUIStore.getState().sidebarOpen).toBe(false);
  });
});
