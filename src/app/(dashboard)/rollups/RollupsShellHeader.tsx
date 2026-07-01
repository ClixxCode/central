'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTopShellActions } from '@/components/layout/top-shell-actions';
import { useTopShellContextOverride } from '@/components/layout/top-shell-override';
import type { TopShellContext } from '@/components/layout/shell-context';

export function RollupsShellHeader() {
  const actions = React.useMemo(
    () => (
      <Button
        asChild
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-foreground"
      >
        <Link href="/rollups/new" aria-label="New rollup">
          <Plus className="size-4" />
        </Link>
      </Button>
    ),
    []
  );

  const shellContext = React.useMemo<TopShellContext>(() => {
    const crumbs = [
      { label: 'Central', href: '/my-tasks' },
      { label: 'Rollups', href: '/rollups' },
    ];

    return {
      section: 'rollups',
      activeNavItem: 'rollups',
      title: 'Rollups',
      subtitle: 'Aggregate tasks from multiple boards into a single view',
      crumbs,
      breadcrumbs: crumbs,
      actionsSlot: 'board',
      route: {
        pathname: '/rollups',
        segments: ['rollups'],
      },
      isAdminRoute: false,
    };
  }, []);

  useTopShellContextOverride(shellContext);
  useTopShellActions(actions);

  return null;
}
