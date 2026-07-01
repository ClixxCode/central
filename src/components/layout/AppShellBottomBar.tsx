'use client';

import type { ReactNode } from 'react';

interface AppShellBottomBarProps {
  children?: ReactNode;
}

export function AppShellBottomBar({ children }: AppShellBottomBarProps) {
  return (
    <div
      className="flex h-[52px] shrink-0 items-center justify-between border-t bg-background/95 px-3 text-xs text-muted-foreground sm:px-4"
      data-shell-bottom-bar
    >
      {children ?? <div aria-hidden="true" className="min-w-0 flex-1" />}
    </div>
  );
}
