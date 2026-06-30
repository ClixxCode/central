import { describe, expect, it } from 'vitest';
import { resolveDashboardShellContext, type DashboardContextClient } from './shell-context';

const clients: DashboardContextClient[] = [
  {
    id: 'client-1',
    name: 'Acme Co',
    slug: 'acme-co',
    boards: [
      { id: 'board-1', name: 'Launch Board' },
      { id: 'board-2', name: 'Retainers' },
    ],
  },
  {
    id: 'client-2',
    name: 'Northwind',
    slug: 'northwind',
    boards: [],
  },
];

describe('resolveDashboardShellContext', () => {
  it('resolves top-level dashboard sections', () => {
    expect(resolveDashboardShellContext({ pathname: '/my-tasks' })).toMatchObject({
      section: 'my-work',
      activeNavItem: 'my-work',
      title: 'My Work',
    });
    expect(resolveDashboardShellContext({ pathname: '/clients' })).toMatchObject({
      section: 'clients',
      activeNavItem: 'clients',
      title: 'Clients',
    });
    expect(resolveDashboardShellContext({ pathname: '/rollups' })).toMatchObject({
      section: 'rollups',
      activeNavItem: 'rollups',
      title: 'Rollups',
    });
    expect(resolveDashboardShellContext({ pathname: '/schedule' })).toMatchObject({
      section: 'schedule',
      activeNavItem: 'schedule',
      title: 'Schedule',
    });
    expect(resolveDashboardShellContext({ pathname: '/templates' })).toMatchObject({
      section: 'templates',
      activeNavItem: 'templates',
      title: 'Templates',
    });
    expect(resolveDashboardShellContext({ pathname: '/settings' })).toMatchObject({
      section: 'settings',
      activeNavItem: 'settings',
      title: 'Settings',
    });
  });

  it('uses search params for my work tab context', () => {
    expect(
      resolveDashboardShellContext({
        pathname: '/my-tasks',
        searchParams: new URLSearchParams('tab=personal'),
      })
    ).toMatchObject({
      section: 'my-work',
      title: 'Personal Tasks',
    });

    expect(
      resolveDashboardShellContext({
        pathname: '/my-tasks?tab=notifications',
        searchParams: '?tab=notifications',
      })
    ).toMatchObject({
      section: 'my-work',
      title: 'Replies & Mentions',
    });
  });

  it('keeps client overview context for /clients/:slug', () => {
    const context = resolveDashboardShellContext({
      pathname: '/clients/acme-co',
      clients,
    });

    expect(context).toMatchObject({
      section: 'client',
      activeNavItem: 'clients',
      title: 'Acme Co',
      client: {
        id: 'client-1',
        slug: 'acme-co',
        name: 'Acme Co',
        href: '/clients/acme-co',
      },
      route: {
        clientSlug: 'acme-co',
      },
    });
    expect(context.board).toBeUndefined();
    expect(context.crumbs).toEqual([
      { label: 'Central', href: '/my-tasks' },
      { label: 'Clients', href: '/clients' },
      { label: 'Acme Co', href: '/clients/acme-co' },
    ]);
    expect(context.breadcrumbs).toEqual(context.crumbs);
  });

  it('resolves board context from the provided client list', () => {
    const context = resolveDashboardShellContext({
      pathname: '/clients/acme-co/boards/board-1',
      clients,
    });

    expect(context).toMatchObject({
      section: 'board',
      activeNavItem: 'clients',
      title: 'Launch Board',
      client: {
        id: 'client-1',
        slug: 'acme-co',
        name: 'Acme Co',
      },
      board: {
        id: 'board-1',
        name: 'Launch Board',
        href: '/clients/acme-co/boards/board-1',
      },
      actionsSlot: 'board',
      route: {
        clientSlug: 'acme-co',
        boardId: 'board-1',
      },
    });
  });

  it('degrades safely when client or board data is missing', () => {
    const context = resolveDashboardShellContext({
      pathname: '/clients/missing-client/boards/1234567890abcdef',
      clients,
    });

    expect(context).toMatchObject({
      section: 'board',
      activeNavItem: 'clients',
      title: 'Board 12345678',
      client: {
        slug: 'missing-client',
        name: 'Missing Client',
      },
      board: {
        id: '1234567890abcdef',
        name: 'Board 12345678',
      },
    });
  });

  it('resolves rollup detail and new rollup routes', () => {
    expect(resolveDashboardShellContext({ pathname: '/rollups/rollup-123/settings' })).toMatchObject({
      section: 'rollup',
      activeNavItem: 'rollups',
      title: 'Rollup rollup-1',
      rollup: {
        id: 'rollup-123',
        href: '/rollups/rollup-123',
      },
      route: {
        rollupId: 'rollup-123',
      },
    });

    expect(resolveDashboardShellContext({ pathname: '/rollups/new' })).toMatchObject({
      section: 'rollups',
      activeNavItem: 'rollups',
      title: 'New Rollup',
    });
  });

  it('marks admin settings while falling back to settings nav for non-admin users', () => {
    expect(
      resolveDashboardShellContext({
        pathname: '/settings/admin/users',
        isAdmin: true,
      })
    ).toMatchObject({
      section: 'admin',
      activeNavItem: 'admin',
      title: 'Admin Settings',
      isAdminRoute: true,
      actionsSlot: 'settings',
    });

    expect(
      resolveDashboardShellContext({
        pathname: '/settings/admin/users',
        isAdmin: false,
      })
    ).toMatchObject({
      section: 'admin',
      activeNavItem: 'settings',
      title: 'Admin Settings',
      isAdminRoute: true,
    });
  });

  it('normalizes trailing slashes and unknown paths', () => {
    expect(resolveDashboardShellContext({ pathname: '/clients/acme-co/' })).toMatchObject({
      section: 'client',
      title: 'Acme Co',
      route: {
        pathname: '/clients/acme-co',
      },
    });

    expect(resolveDashboardShellContext({ pathname: '/does-not-exist' })).toMatchObject({
      section: 'unknown',
      activeNavItem: null,
      title: 'Central',
      crumbs: [{ label: 'Central', href: '/my-tasks' }],
      actionsSlot: 'none',
    });
  });
});
