import {
  Building2,
  CalendarDays,
  FolderKanban,
  LayoutDashboard,
  LayoutTemplate,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppNavItemId } from './shell-context';

export const DEFAULT_APP_NAV_ORDER = [
  'My Work',
  'Clients',
  'Rollups',
  'Schedule',
  'Templates',
] as const;

export type AppNavPreferenceLabel = (typeof DEFAULT_APP_NAV_ORDER)[number];
export type AppNavSurface = 'desktop' | 'mobile';

const LEGACY_APP_NAV_PREFERENCE_LABELS: Record<string, AppNavPreferenceLabel> = {
  ClientList: 'Clients',
};

export interface AppShellNavDefinition {
  preferenceLabel: AppNavPreferenceLabel;
  href: string;
  desktopLabel: string;
  mobileLabel: string;
  icon: LucideIcon;
  alwaysVisible: boolean;
}

export interface AppShellNavItem {
  preferenceLabel: AppNavPreferenceLabel;
  href: string;
  label: string;
  icon: LucideIcon;
  alwaysVisible: boolean;
}

export const APP_SHELL_NAV_ITEMS: Record<AppNavPreferenceLabel, AppShellNavDefinition> = {
  'My Work': {
    preferenceLabel: 'My Work',
    href: '/my-tasks',
    desktopLabel: 'My Work',
    mobileLabel: 'My Tasks',
    icon: LayoutDashboard,
    alwaysVisible: true,
  },
  Clients: {
    preferenceLabel: 'Clients',
    href: '/clients',
    desktopLabel: 'Clients',
    mobileLabel: 'Clients',
    icon: Building2,
    alwaysVisible: false,
  },
  Rollups: {
    preferenceLabel: 'Rollups',
    href: '/rollups',
    desktopLabel: 'Rollups',
    mobileLabel: 'Rollups',
    icon: FolderKanban,
    alwaysVisible: false,
  },
  Schedule: {
    preferenceLabel: 'Schedule',
    href: '/schedule',
    desktopLabel: 'Schedule',
    mobileLabel: 'Schedule',
    icon: CalendarDays,
    alwaysVisible: true,
  },
  Templates: {
    preferenceLabel: 'Templates',
    href: '/templates',
    desktopLabel: 'Templates',
    mobileLabel: 'Templates',
    icon: LayoutTemplate,
    alwaysVisible: false,
  },
};

interface BuildAppNavItemsInput {
  navOrder?: readonly string[] | null;
  hiddenNavItems?: readonly string[] | null;
  showScheduleInSidebar?: boolean;
  surface?: AppNavSurface;
}

export function getAvailableAppNavPreferenceLabels(showScheduleInSidebar = false): AppNavPreferenceLabel[] {
  return DEFAULT_APP_NAV_ORDER.filter(
    (label) => showScheduleInSidebar || label !== 'Schedule'
  );
}

export function getOrderedAppNavItems({
  navOrder,
  showScheduleInSidebar = false,
  surface = 'desktop',
}: BuildAppNavItemsInput): AppShellNavItem[] {
  const availableLabels = new Set(getAvailableAppNavPreferenceLabels(showScheduleInSidebar));
  const orderedLabels = normalizeAppNavPreferenceLabels(navOrder);
  const baseOrder = orderedLabels.length > 0 ? orderedLabels : [...DEFAULT_APP_NAV_ORDER];
  const items: AppShellNavItem[] = [];

  for (const label of baseOrder) {
    if (availableLabels.has(label)) {
      items.push(toAppShellNavItem(APP_SHELL_NAV_ITEMS[label], surface));
    }
  }

  for (const label of availableLabels) {
    if (!baseOrder.includes(label)) {
      items.push(toAppShellNavItem(APP_SHELL_NAV_ITEMS[label], surface));
    }
  }

  return items;
}

export function getVisibleAppNavItems({
  hiddenNavItems = [],
  ...input
}: BuildAppNavItemsInput): AppShellNavItem[] {
  const hiddenLabels = normalizeAppNavPreferenceLabels(hiddenNavItems);

  return getOrderedAppNavItems(input).filter(
    (item) => item.alwaysVisible || !hiddenLabels.includes(item.preferenceLabel)
  );
}

export function normalizeAppNavPreferenceLabels(
  labels?: readonly string[] | null
): AppNavPreferenceLabel[] {
  const normalized: AppNavPreferenceLabel[] = [];
  const seen = new Set<AppNavPreferenceLabel>();

  for (const label of labels ?? []) {
    const preferenceLabel = isAppNavPreferenceLabel(label)
      ? label
      : LEGACY_APP_NAV_PREFERENCE_LABELS[label];

    if (preferenceLabel && !seen.has(preferenceLabel)) {
      normalized.push(preferenceLabel);
      seen.add(preferenceLabel);
    }
  }

  return normalized;
}

function toAppShellNavItem(
  definition: AppShellNavDefinition,
  surface: AppNavSurface
): AppShellNavItem {
  return {
    preferenceLabel: definition.preferenceLabel,
    href: definition.href,
    label: surface === 'mobile' ? definition.mobileLabel : definition.desktopLabel,
    icon: definition.icon,
    alwaysVisible: definition.alwaysVisible,
  };
}

export function isAppNavPreferenceLabel(label: string): label is AppNavPreferenceLabel {
  return label in APP_SHELL_NAV_ITEMS;
}

export function getAppNavActiveItem(
  preferenceLabel: AppNavPreferenceLabel
): AppNavItemId {
  switch (preferenceLabel) {
    case 'My Work':
      return 'my-work';
    case 'Clients':
      return 'clients';
    case 'Rollups':
      return 'rollups';
    case 'Schedule':
      return 'schedule';
    case 'Templates':
      return 'templates';
  }
}
