'use client';

import * as React from 'react';
import { useTopShellContextOverride } from '@/components/layout/top-shell-override';
import type { TopShellContext } from '@/components/layout/shell-context';

interface RollupSettingsHeaderProps {
  rollupId: string;
  rollupName: string;
}

export function RollupSettingsHeader({
  rollupId,
  rollupName,
}: RollupSettingsHeaderProps) {
  const shellContext = React.useMemo<TopShellContext>(() => {
    const rollupHref = `/rollups/${rollupId}`;
    const settingsHref = `${rollupHref}/settings`;
    const crumbs = [
      { label: 'Central', href: '/my-tasks' },
      { label: 'Rollups', href: '/rollups' },
      { label: rollupName, href: rollupHref },
      { label: 'Settings', href: settingsHref },
    ];

    return {
      section: 'rollup',
      activeNavItem: 'rollups',
      title: 'Settings',
      subtitle: rollupName,
      crumbs,
      breadcrumbs: crumbs,
      actionsSlot: 'none',
      route: {
        pathname: settingsHref,
        segments: ['rollups', rollupId, 'settings'],
        rollupId,
      },
      rollup: {
        id: rollupId,
        name: rollupName,
        href: rollupHref,
      },
      isAdminRoute: false,
    };
  }, [rollupId, rollupName]);

  useTopShellContextOverride(shellContext);

  return null;
}
