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
    const myWorkContext = resolveDashboardShellContext({ pathname: '/my-tasks' });

    expect(myWorkContext).toMatchObject({
      section: 'my-work',
      activeNavItem: 'my-work',
      title: 'My Work',
    });
    expect(myWorkContext.tabs).toEqual([
      { label: 'Assigned', href: '/my-tasks?tab=tasks', active: true },
      { label: 'Personal', href: '/my-tasks?tab=personal', active: false },
      { label: 'Mentions', href: '/my-tasks?tab=notifications', active: false },
    ]);

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
    const personalContext = resolveDashboardShellContext({
      pathname: '/my-tasks',
      searchParams: new URLSearchParams('tab=personal'),
    });

    expect(personalContext).toMatchObject({
      section: 'my-work',
      title: 'Personal Tasks',
    });
    expect(personalContext.tabs?.find((tab) => tab.label === 'Personal')).toMatchObject({
      active: true,
    });

    const mentionsContext = resolveDashboardShellContext({
      pathname: '/my-tasks?tab=notifications',
      searchParams: '?tab=notifications',
    });

    expect(mentionsContext).toMatchObject({
      section: 'my-work',
      title: 'Replies & Mentions',
    });
    expect(mentionsContext.tabs?.find((tab) => tab.label === 'Mentions')).toMatchObject({
      active: true,
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
    expect(context.tabs).toEqual([
      { label: 'Overview', href: '/clients/acme-co', active: true },
      { label: 'Boards', href: '/clients/acme-co#boards', active: false },
    ]);
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
    expect(context.tabs).toEqual([
      { label: 'Tasks', href: '/clients/acme-co/boards/board-1', active: true },
    ]);
  });

  it('keeps board context while adding child route crumbs', () => {
    const context = resolveDashboardShellContext({
      pathname: '/clients/acme-co/boards/board-1/settings',
      clients,
    });

    expect(context).toMatchObject({
      section: 'board',
      activeNavItem: 'clients',
      title: 'Launch Board',
      actionsSlot: 'board',
    });
    expect(context.crumbs).toEqual([
      { label: 'Central', href: '/my-tasks' },
      { label: 'Clients', href: '/clients' },
      { label: 'Acme Co', href: '/clients/acme-co' },
      { label: 'Launch Board', href: '/clients/acme-co/boards/board-1' },
      { label: 'Settings', href: '/clients/acme-co/boards/board-1/settings' },
    ]);
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
    expect(context.crumbs).toEqual([
      { label: 'Central', href: '/my-tasks' },
      { label: 'Clients', href: '/clients' },
      { label: 'Missing Client', href: '/clients/missing-client' },
      {
        label: 'Board 12345678',
        href: '/clients/missing-client/boards/1234567890abcdef',
      },
    ]);
  });

  it('resolves rollup detail and new rollup routes', () => {
    expect(resolveDashboardShellContext({ pathname: '/rollups/rollup-123/settings' })).toMatchObject({
      section: 'rollup',
      activeNavItem: 'rollups',
      title: 'Settings',
      subtitle: 'Rollup rollup-1',
      crumbs: [
        { label: 'Central', href: '/my-tasks' },
        { label: 'Rollups', href: '/rollups' },
        { label: 'Rollup rollup-1', href: '/rollups/rollup-123' },
        { label: 'Settings', href: '/rollups/rollup-123/settings' },
      ],
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
      title: 'Users',
      subtitle: 'Admin Settings',
      isAdminRoute: true,
      actionsSlot: 'settings',
      tabs: [
        { label: 'General', href: '/settings/admin/general', active: false },
        { label: 'Users', href: '/settings/admin/users', active: true },
        { label: 'Teams', href: '/settings/admin/teams', active: false },
        { label: 'Statuses', href: '/settings/admin/statuses', active: false },
        { label: 'Archive', href: '/settings/admin/archive', active: false },
      ],
    });

    expect(
      resolveDashboardShellContext({
        pathname: '/settings/admin/users',
        isAdmin: false,
      })
    ).toMatchObject({
      section: 'admin',
      activeNavItem: 'settings',
      title: 'Users',
      isAdminRoute: true,
    });
  });

  it('labels regular settings sections with tabs', () => {
    expect(resolveDashboardShellContext({ pathname: '/settings/profile' })).toMatchObject({
      section: 'settings',
      activeNavItem: 'settings',
      title: 'Profile',
      crumbs: [
        { label: 'Central', href: '/my-tasks' },
        { label: 'Settings', href: '/settings' },
        { label: 'Profile', href: '/settings/profile' },
      ],
      tabs: [
        { label: 'Profile', href: '/settings/profile', active: true },
        { label: 'Notifications', href: '/settings/notifications', active: false },
        { label: 'Integrations', href: '/settings/integrations', active: false },
      ],
    });

    expect(resolveDashboardShellContext({ pathname: '/settings/statuses-sections' })).toMatchObject({
      title: 'Statuses & Sections',
      crumbs: [
        { label: 'Central', href: '/my-tasks' },
        { label: 'Settings', href: '/settings' },
        { label: 'Statuses & Sections', href: '/settings/statuses-sections' },
      ],
    });
  });

  it('adds child labels for template edit routes', () => {
    expect(resolveDashboardShellContext({ pathname: '/templates/template-123/edit' })).toMatchObject({
      section: 'templates',
      activeNavItem: 'templates',
      title: 'Edit',
      subtitle: 'Template template',
      crumbs: [
        { label: 'Central', href: '/my-tasks' },
        { label: 'Templates', href: '/templates' },
        { label: 'Template template', href: '/templates/template-123' },
        { label: 'Edit', href: '/templates/template-123/edit' },
      ],
      template: {
        id: 'template-123',
        href: '/templates/template-123',
      },
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
