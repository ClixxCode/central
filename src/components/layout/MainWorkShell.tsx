'use client';

import type { ReactNode } from 'react';
import type { TopShellContext } from './shell-context';

interface MainWorkShellProps {
  children: ReactNode;
  shellContext: TopShellContext;
}

export function MainWorkShell({ children, shellContext }: MainWorkShellProps) {
  return (
    <main
      className="flex-1 overflow-auto bg-background p-4 lg:p-6"
      data-shell-section={shellContext.section}
      data-shell-nav-item={shellContext.activeNavItem ?? undefined}
    >
      {children}
    </main>
  );
}
