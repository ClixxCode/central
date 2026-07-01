'use client';

import { MobileNav } from './MobileNav';
import type { TopShellContext } from './shell-context';

interface MobileDashboardNavProps {
  isAdmin: boolean;
  shellContext: TopShellContext;
}

export function MobileDashboardNav({ isAdmin, shellContext }: MobileDashboardNavProps) {
  return <MobileNav isAdmin={isAdmin} shellContext={shellContext} />;
}
