import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TopShellHeader } from './TopShellHeader';
import { useUIStore } from '@/lib/stores';
import type { TopShellContext } from './shell-context';

vi.mock('./AppActions', () => ({
  AppActions: () => <div data-testid="app-actions" />,
}));

const user = {
  name: 'AJ Griem',
  email: 'aj@example.com',
  image: null,
};

const shellContext: TopShellContext = {
  section: 'board',
  activeNavItem: 'clients',
  title: 'Launch Board',
  subtitle: 'Acme Co',
  crumbs: [
    { label: 'Central', href: '/my-tasks' },
    { label: 'Clients', href: '/clients' },
    { label: 'Acme Co', href: '/clients/acme-co' },
    { label: 'Launch Board', href: '/clients/acme-co/boards/board-1' },
  ],
  breadcrumbs: [
    { label: 'Central', href: '/my-tasks' },
    { label: 'Clients', href: '/clients' },
    { label: 'Acme Co', href: '/clients/acme-co' },
    { label: 'Launch Board', href: '/clients/acme-co/boards/board-1' },
  ],
  tabs: [
    { label: 'Tasks', href: '/clients/acme-co/boards/board-1', active: true },
    { label: 'Settings', href: '/clients/acme-co/boards/board-1/settings', active: false },
  ],
  actions: <button type="button">Board action</button>,
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

describe('TopShellHeader', () => {
  beforeEach(() => {
    useUIStore.setState({
      sidebarOpen: false,
      sidebarCollapsed: false,
      expandedClients: [],
      collapsedSections: [],
    });
  });

  it('renders contextual title, breadcrumbs, actions, and accessible tabs', () => {
    render(
      <TopShellHeader
        user={user}
        isAdmin
        onSignOut={vi.fn()}
        shellContext={shellContext}
      />
    );

    expect(screen.getByRole('heading', { name: 'Launch Board' })).toBeInTheDocument();
    expect(screen.getAllByText('Acme Co')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Central' })).toHaveAttribute('href', '/my-tasks');
    expect(screen.getByRole('link', { name: 'Clients' })).toHaveAttribute('href', '/clients');
    expect(screen.getByRole('button', { name: 'Board action' })).toBeInTheDocument();
    expect(screen.getByTestId('app-actions')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tasks' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Settings' })).not.toHaveAttribute('aria-current');
  });

  it('toggles the shared mobile navigation state from the hamburger button', () => {
    render(
      <TopShellHeader
        user={user}
        onSignOut={vi.fn()}
        shellContext={shellContext}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Toggle navigation' }));

    expect(useUIStore.getState().sidebarOpen).toBe(true);
  });
});
