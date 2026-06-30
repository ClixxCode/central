'use client';

import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/lib/stores';
import type { TopShellContext } from './shell-context';
import { AppActions } from './AppActions';

interface TopShellHeaderUser {
  name: string | null;
  email: string;
  image: string | null;
}

interface TopShellHeaderProps {
  user: TopShellHeaderUser;
  isAdmin?: boolean;
  onSignOut: () => void;
  shellContext?: TopShellContext;
}

export function TopShellHeader({
  user,
  isAdmin = false,
  onSignOut,
  shellContext,
}: TopShellHeaderProps) {
  const { setSidebarOpen, sidebarOpen } = useUIStore();

  return (
    <header
      className="flex h-14 items-center justify-between border-b bg-background px-4"
      data-shell-header-section={shellContext?.section}
      data-shell-header-nav-item={shellContext?.activeNavItem ?? undefined}
    >
      <AppActions
        user={user}
        isAdmin={isAdmin}
        onSignOut={onSignOut}
        mobileMenuSlot={
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        }
      />
    </header>
  );
}
