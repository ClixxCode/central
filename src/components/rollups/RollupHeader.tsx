'use client';

import * as React from 'react';
import Link from 'next/link';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FavoriteButton } from '@/components/shared/FavoriteButton';
import { RollupReviewButton } from './RollupReviewButton';
import { useTopShellContextOverride } from '@/components/layout/top-shell-override';
import type { TopShellContext } from '@/components/layout/shell-context';

interface RollupHeaderProps {
  rollupId: string;
  rollupName: string;
  reviewModeEnabled: boolean;
}

export function RollupHeader({
  rollupId,
  rollupName,
  reviewModeEnabled,
}: RollupHeaderProps) {
  const shellContext = React.useMemo<TopShellContext>(() => {
    const rollupHref = `/rollups/${rollupId}`;
    const crumbs = [
      { label: 'Central', href: '/my-tasks' },
      { label: 'Rollups', href: '/rollups' },
      { label: rollupName, href: rollupHref },
    ];

    return {
      section: 'rollup',
      activeNavItem: 'rollups',
      title: rollupName,
      crumbs,
      breadcrumbs: crumbs,
      actions: (
        <div className="flex items-center gap-0.5">
          <FavoriteButton
            entityType="rollup"
            entityId={rollupId}
            className="size-8"
          />
          <RollupReviewButton
            rollupId={rollupId}
            reviewModeEnabled={reviewModeEnabled}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            asChild
          >
            <Link href={`${rollupHref}/settings`} aria-label="Rollup settings">
              <Settings className="size-4" />
            </Link>
          </Button>
        </div>
      ),
      actionsSlot: 'board',
      route: {
        pathname: rollupHref,
        segments: ['rollups', rollupId],
        rollupId,
      },
      rollup: {
        id: rollupId,
        name: rollupName,
        href: rollupHref,
      },
      isAdminRoute: false,
    };
  }, [reviewModeEnabled, rollupId, rollupName]);

  useTopShellContextOverride(shellContext);

  return null;
}
