import type { ReactNode } from 'react';

export type DashboardSection =
  | 'my-work'
  | 'clients'
  | 'client'
  | 'board'
  | 'rollups'
  | 'rollup'
  | 'schedule'
  | 'templates'
  | 'settings'
  | 'admin'
  | 'unknown';

export type AppNavItemId =
  | 'my-work'
  | 'clients'
  | 'rollups'
  | 'schedule'
  | 'templates'
  | 'settings'
  | 'admin';

export interface AppNavItem {
  id: AppNavItemId;
  label: string;
  href: string;
  section: DashboardSection;
  requiresAdmin?: boolean;
}

export interface TopShellCrumb {
  label: string;
  href?: string;
  icon?: ReactNode;
  tone?: 'default' | 'muted';
}

export interface TopShellTab {
  label: string;
  href?: string;
  active: boolean;
}

export interface DashboardContextBoard {
  id: string;
  name: string;
}

export interface DashboardContextClient {
  id: string;
  name: string;
  slug: string;
  boards?: DashboardContextBoard[];
}

export interface DashboardRouteContext {
  pathname: string;
  segments: string[];
  clientSlug?: string;
  boardId?: string;
  rollupId?: string;
  templateId?: string;
}

export interface TopShellEntityContext {
  id?: string;
  slug?: string;
  name: string;
  href: string;
}

export interface TopShellContext {
  section: DashboardSection;
  activeNavItem: AppNavItemId | null;
  title: string;
  subtitle?: ReactNode;
  titleIcon?: ReactNode;
  crumbs: TopShellCrumb[];
  breadcrumbs: TopShellCrumb[];
  tabs?: TopShellTab[];
  actions?: ReactNode;
  actionsSlot: 'global' | 'board' | 'settings' | 'none';
  route: DashboardRouteContext;
  client?: TopShellEntityContext;
  board?: TopShellEntityContext;
  rollup?: TopShellEntityContext;
  template?: TopShellEntityContext;
  isAdminRoute: boolean;
}

type SearchParamsRecord = Record<string, string | string[] | null | undefined>;
type SearchParamsLike =
  | URLSearchParams
  | string
  | SearchParamsRecord
  | {
      get(name: string): string | null;
    };

export interface ResolveDashboardShellContextInput {
  pathname?: string | null;
  searchParams?: SearchParamsLike | null;
  clients?: DashboardContextClient[] | null;
  isAdmin?: boolean;
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  { id: 'my-work', label: 'My Work', href: '/my-tasks', section: 'my-work' },
  { id: 'clients', label: 'Clients', href: '/clients', section: 'clients' },
  { id: 'rollups', label: 'Rollups', href: '/rollups', section: 'rollups' },
  { id: 'schedule', label: 'Schedule', href: '/schedule', section: 'schedule' },
  { id: 'templates', label: 'Templates', href: '/templates', section: 'templates' },
  { id: 'settings', label: 'Settings', href: '/settings', section: 'settings' },
  {
    id: 'admin',
    label: 'Admin Settings',
    href: '/settings/admin',
    section: 'admin',
    requiresAdmin: true,
  },
];

const ROOT_CRUMB: TopShellCrumb = { label: 'Central', href: '/my-tasks' };
const MY_TASKS_TAB_VALUES = ['tasks', 'assigned', 'personal', 'notifications', 'mentions'];

const SETTINGS_SECTION_LABELS: Record<string, string> = {
  profile: 'Profile',
  notifications: 'Notifications',
  integrations: 'Integrations',
  team: 'Team',
  teams: 'Teams',
  users: 'Users',
  'statuses-sections': 'Statuses & Sections',
};

const ADMIN_SETTINGS_SECTION_LABELS: Record<string, string> = {
  general: 'General',
  users: 'Users',
  teams: 'Teams',
  statuses: 'Statuses & Sections',
  archive: 'Archive',
};

export function resolveDashboardShellContext({
  pathname,
  searchParams,
  clients,
  isAdmin = false,
}: ResolveDashboardShellContextInput): TopShellContext {
  const normalizedPathname = normalizePathname(pathname);
  const segments = getPathSegments(normalizedPathname);
  const route: DashboardRouteContext = {
    pathname: normalizedPathname,
    segments,
  };

  if (segments.length === 0) {
    return createContext({
      section: 'my-work',
      activeNavItem: 'my-work',
      title: 'My Work',
      crumbs: [ROOT_CRUMB, { label: 'My Work', href: '/my-tasks' }],
      route,
    });
  }

  const [section, second, third, fourth, fifth] = segments;

  if (section === 'my-tasks') {
    const tab = getSearchParam(searchParams, 'tab');
    const title = getMyTasksTitle(tab);

    return createContext({
      section: 'my-work',
      activeNavItem: 'my-work',
      title,
      crumbs: [ROOT_CRUMB, { label: 'My Work', href: '/my-tasks' }],
      tabs: getMyTasksTabs(tab),
      route,
    });
  }

  if (section === 'clients') {
    if (!second) {
      return createContext({
        section: 'clients',
        activeNavItem: 'clients',
        title: 'Clients',
        crumbs: [ROOT_CRUMB, { label: 'Clients', href: '/clients' }],
        route,
      });
    }

    if (second === 'new') {
      return createContext({
        section: 'clients',
        activeNavItem: 'clients',
        title: 'New Client',
        crumbs: [
          ROOT_CRUMB,
          { label: 'Clients', href: '/clients' },
          { label: 'New Client' },
        ],
        route,
      });
    }

    const client = findClientBySlug(clients, second);
    const clientName = client?.name ?? humanizeSegment(second);
    const clientHref = `/clients/${second}`;
    route.clientSlug = second;

    if (third === 'boards' && fourth) {
      const board = client?.boards?.find((item) => item.id === fourth);
      const boardName = board?.name ?? `Board ${shortIdentifier(fourth)}`;
      const boardHref = `${clientHref}/boards/${fourth}`;
      const childLabel = fifth ? humanizeSegment(fifth) : null;
      route.boardId = fourth;

      return createContext({
        section: 'board',
        activeNavItem: 'clients',
        title: boardName,
        crumbs: [
          ROOT_CRUMB,
          { label: 'Clients', href: '/clients' },
          { label: clientName, href: clientHref },
          { label: boardName, href: boardHref },
          ...(childLabel ? [{ label: childLabel, href: `${boardHref}/${fifth}` }] : []),
        ],
        tabs: getBoardTabs(boardHref),
        route,
        client: {
          id: client?.id,
          slug: second,
          name: clientName,
          href: clientHref,
        },
        board: {
          id: fourth,
          name: boardName,
          href: boardHref,
        },
        actionsSlot: 'board',
      });
    }

    return createContext({
      section: 'client',
      activeNavItem: 'clients',
      title: clientName,
      crumbs: [
        ROOT_CRUMB,
        { label: 'Clients', href: '/clients' },
        { label: clientName, href: clientHref },
      ],
      tabs: getClientTabs(clientHref),
      route,
      client: {
        id: client?.id,
        slug: second,
        name: clientName,
        href: clientHref,
      },
    });
  }

  if (section === 'rollups') {
    if (!second) {
      return createContext({
        section: 'rollups',
        activeNavItem: 'rollups',
        title: 'Rollups',
        crumbs: [ROOT_CRUMB, { label: 'Rollups', href: '/rollups' }],
        route,
      });
    }

    if (second === 'new') {
      return createContext({
        section: 'rollups',
        activeNavItem: 'rollups',
        title: 'New Rollup',
        crumbs: [
          ROOT_CRUMB,
          { label: 'Rollups', href: '/rollups' },
          { label: 'New Rollup' },
        ],
        route,
      });
    }

    const rollupName = `Rollup ${shortIdentifier(second)}`;
    const rollupHref = `/rollups/${second}`;
    const rollupChildLabel = third ? humanizeSegment(third) : null;
    route.rollupId = second;

    return createContext({
      section: 'rollup',
      activeNavItem: 'rollups',
      title: rollupChildLabel ?? rollupName,
      subtitle: rollupChildLabel ? rollupName : undefined,
      crumbs: [
        ROOT_CRUMB,
        { label: 'Rollups', href: '/rollups' },
        { label: rollupName, href: rollupHref },
        ...(rollupChildLabel ? [{ label: rollupChildLabel, href: `${rollupHref}/${third}` }] : []),
      ],
      route,
      rollup: {
        id: second,
        name: rollupName,
        href: rollupHref,
      },
    });
  }

  if (section === 'schedule') {
    return createContext({
      section: 'schedule',
      activeNavItem: 'schedule',
      title: 'Schedule',
      crumbs: [ROOT_CRUMB, { label: 'Schedule', href: '/schedule' }],
      route,
    });
  }

  if (section === 'templates') {
    if (!second) {
      return createContext({
        section: 'templates',
        activeNavItem: 'templates',
        title: 'Templates',
        crumbs: [ROOT_CRUMB, { label: 'Templates', href: '/templates' }],
        route,
      });
    }

    const templateName = `Template ${shortIdentifier(second)}`;
    const templateChildLabel = third ? humanizeSegment(third) : null;
    route.templateId = second;

    return createContext({
      section: 'templates',
      activeNavItem: 'templates',
      title: templateChildLabel ?? templateName,
      subtitle: templateChildLabel ? templateName : undefined,
      crumbs: [
        ROOT_CRUMB,
        { label: 'Templates', href: '/templates' },
        { label: templateName, href: `/templates/${second}` },
        ...(templateChildLabel ? [{ label: templateChildLabel, href: `/templates/${second}/${third}` }] : []),
      ],
      route,
      template: {
        id: second,
        name: templateName,
        href: `/templates/${second}`,
      },
    });
  }

  if (section === 'settings') {
    const isAdminRoute = second === 'admin';

    if (isAdminRoute) {
      const adminSectionLabel = third ? getAdminSettingsSectionLabel(third) : null;

      return createContext({
        section: 'admin',
        activeNavItem: isAdmin ? 'admin' : 'settings',
        title: adminSectionLabel ?? 'Admin Settings',
        subtitle: adminSectionLabel ? 'Admin Settings' : undefined,
        crumbs: [
          ROOT_CRUMB,
          { label: 'Settings', href: '/settings' },
          { label: 'Admin Settings', href: '/settings/admin' },
          ...(adminSectionLabel
            ? [{ label: adminSectionLabel, href: `/settings/admin/${third}` }]
            : []),
        ],
        tabs: getAdminSettingsTabs(third),
        route,
        isAdminRoute: true,
        actionsSlot: 'settings',
      });
    }

    const settingsSectionLabel = second ? getSettingsSectionLabel(second) : 'Settings';

    return createContext({
      section: 'settings',
      activeNavItem: 'settings',
      title: settingsSectionLabel,
      crumbs: [
        ROOT_CRUMB,
        { label: 'Settings', href: '/settings' },
        ...(second ? [{ label: settingsSectionLabel, href: `/settings/${second}` }] : []),
      ],
      tabs: getSettingsTabs(second),
      route,
      actionsSlot: 'settings',
    });
  }

  return createContext({
    section: 'unknown',
    activeNavItem: null,
    title: 'Central',
    crumbs: [ROOT_CRUMB],
    route,
    actionsSlot: 'none',
  });
}

function createContext(
  context: Omit<TopShellContext, 'actionsSlot' | 'breadcrumbs' | 'isAdminRoute'> &
    Partial<Pick<TopShellContext, 'actionsSlot' | 'breadcrumbs' | 'isAdminRoute'>>
): TopShellContext {
  return {
    actionsSlot: 'global',
    breadcrumbs: context.crumbs,
    isAdminRoute: false,
    ...context,
  };
}

function findClientBySlug(
  clients: DashboardContextClient[] | null | undefined,
  slug: string
): DashboardContextClient | undefined {
  return clients?.find((client) => client.slug === slug);
}

function normalizePathname(pathname: string | null | undefined): string {
  if (!pathname) return '/';

  const pathnameOnly = pathname.split(/[?#]/)[0] ?? '/';
  const withLeadingSlash = pathnameOnly.startsWith('/') ? pathnameOnly : `/${pathnameOnly}`;
  const withoutTrailingSlash =
    withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, '') : withLeadingSlash;

  return withoutTrailingSlash || '/';
}

function getPathSegments(pathname: string): string[] {
  return pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => safeDecodeURIComponent(segment));
}

function getSearchParam(searchParams: SearchParamsLike | null | undefined, key: string): string | null {
  if (!searchParams) return null;

  if (typeof searchParams === 'string') {
    return new URLSearchParams(searchParams.startsWith('?') ? searchParams.slice(1) : searchParams).get(key);
  }

  if (hasSearchParamGetter(searchParams)) {
    return searchParams.get(key);
  }

  const value = searchParams[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function hasSearchParamGetter(
  searchParams: Exclude<SearchParamsLike, string>
): searchParams is URLSearchParams | { get(name: string): string | null } {
  return typeof (searchParams as { get?: unknown }).get === 'function';
}

function getMyTasksTitle(tab: string | null): string {
  if (tab === 'personal') return 'Personal Tasks';
  if (tab === 'mentions' || tab === 'notifications') return 'Replies & Mentions';
  return 'My Work';
}

function getMyTasksTabs(tab: string | null): TopShellTab[] {
  const activeTab = getMyTasksActiveTab(tab);

  return [
    {
      label: 'Assigned',
      href: '/my-tasks?tab=tasks',
      active: activeTab === 'assigned',
    },
    {
      label: 'Personal',
      href: '/my-tasks?tab=personal',
      active: activeTab === 'personal',
    },
    {
      label: 'Mentions',
      href: '/my-tasks?tab=notifications',
      active: activeTab === 'mentions',
    },
  ];
}

function getMyTasksActiveTab(tab: string | null): 'assigned' | 'personal' | 'mentions' {
  if (tab === 'personal') return 'personal';
  if (tab === 'mentions' || tab === 'notifications') return 'mentions';
  if (tab && !MY_TASKS_TAB_VALUES.includes(tab)) return 'assigned';
  return 'assigned';
}

function getClientTabs(clientHref: string): TopShellTab[] {
  return [
    { label: 'Overview', href: clientHref, active: true },
    { label: 'Activity', href: `${clientHref}#activity`, active: false },
    { label: 'Boards', href: `${clientHref}#boards`, active: false },
  ];
}

function getBoardTabs(boardHref: string): TopShellTab[] {
  return [
    { label: 'Tasks', href: boardHref, active: true },
  ];
}

function getSettingsTabs(activeSection: string | undefined): TopShellTab[] {
  const active = activeSection ?? 'profile';

  return [
    { label: 'Profile', href: '/settings/profile', active: active === 'profile' },
    { label: 'Notifications', href: '/settings/notifications', active: active === 'notifications' },
    { label: 'Integrations', href: '/settings/integrations', active: active === 'integrations' },
  ];
}

function getAdminSettingsTabs(activeSection: string | undefined): TopShellTab[] {
  const active = activeSection ?? 'general';

  return [
    { label: 'General', href: '/settings/admin/general', active: active === 'general' },
    { label: 'Users', href: '/settings/admin/users', active: active === 'users' },
    { label: 'Teams', href: '/settings/admin/teams', active: active === 'teams' },
    { label: 'Statuses', href: '/settings/admin/statuses', active: active === 'statuses' },
    { label: 'Archive', href: '/settings/admin/archive', active: active === 'archive' },
  ];
}

function getSettingsSectionLabel(section: string): string {
  return SETTINGS_SECTION_LABELS[section] ?? humanizeSegment(section);
}

function getAdminSettingsSectionLabel(section: string): string {
  return ADMIN_SETTINGS_SECTION_LABELS[section] ?? humanizeSegment(section);
}

function humanizeSegment(segment: string): string {
  const words = safeDecodeURIComponent(segment)
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return 'Unknown';

  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function shortIdentifier(identifier: string): string {
  const decoded = safeDecodeURIComponent(identifier).trim();
  if (decoded.length <= 8) return decoded || 'unknown';
  return decoded.slice(0, 8);
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
