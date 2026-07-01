'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Layers, Settings, ShieldCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/lib/stores';
import { useFavorites } from '@/lib/hooks/useFavorites';
import { useCalendarPreferences, useSidebarPreferences } from '@/lib/hooks';
import { ClientIcon } from '@/components/clients/ClientIcon';
import { useIsClient } from '@/hooks/useIsClient';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DEFAULT_APP_NAV_ORDER, getAppNavActiveItem, getVisibleAppNavItems } from './app-nav';
import type { TopShellContext } from './shell-context';

interface MobileNavProps {
  isAdmin?: boolean;
  shellContext?: TopShellContext;
}

export function MobileNav({ isAdmin = false, shellContext }: MobileNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isClient = useIsClient();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const { data: favoritesData } = useFavorites();
  const favorites = favoritesData?.favorites ?? [];
  const { data: calPrefs } = useCalendarPreferences();
  const { data: sidebarPrefs } = useSidebarPreferences();

  // Don't render the sheet until client-side to prevent hydration mismatch
  const isOpen = isClient ? sidebarOpen : false;

  const hiddenNavItems = sidebarPrefs?.hiddenNavItems ?? [];
  const savedNavOrder = sidebarPrefs?.navOrder;
  const navOrder = savedNavOrder && savedNavOrder.length > 0 ? savedNavOrder : DEFAULT_APP_NAV_ORDER;
  const navItems = getVisibleAppNavItems({
    navOrder,
    hiddenNavItems,
    showScheduleInSidebar: !!calPrefs?.showScheduleInSidebar,
    surface: 'mobile',
  });

  const handleLinkClick = () => {
    setSidebarOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setSidebarOpen}>
      <SheetContent side="left" showCloseButton={false} className="w-80 p-0">
        <SheetHeader className="flex h-14 flex-row items-center justify-between border-b px-4">
          <SheetTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">C</span>
            </div>
            <span className="font-semibold">Central</span>
          </SheetTitle>
          <SheetDescription className="sr-only">
            App-wide navigation, favorites, settings, and admin links.
          </SheetDescription>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </Button>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-3.5rem)]">
          <div className="p-4 space-y-6">
            {/* Main Navigation */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = getAppNavActiveItem(item.preferenceLabel) === shellContext?.activeNavItem;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={handleLinkClick}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-accent'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Favorites Section */}
            {favorites.length > 0 && (
              <div>
                <div className="px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Favorites
                  </span>
                </div>
                <div className="space-y-1">
                  {favorites.map((favorite) => {
                    const href =
                      favorite.boardType === 'personal'
                        ? '/my-tasks?tab=personal'
                        : favorite.entityType === 'board' && favorite.clientSlug
                        ? `/clients/${favorite.clientSlug}/boards/${favorite.entityId}`
                        : `/rollups/${favorite.entityId}`;
                    const isActive = favorite.boardType === 'personal'
                      ? pathname === '/my-tasks' && searchParams.get('tab') === 'personal'
                      : pathname.startsWith(href);

                    return (
                      <Link
                        key={favorite.id}
                        href={href}
                        onClick={handleLinkClick}
                        className={cn(
                          'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                          isActive
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:bg-accent'
                        )}
                      >
                        {favorite.entityType === 'rollup' ? (
                          <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        ) : favorite.boardType === 'personal' ? (
                          <span
                            className="material-symbols-outlined shrink-0"
                            style={{ fontSize: '14px', color: favorite.boardColor ?? '#3B82F6' }}
                          >
                            {favorite.boardIcon ?? 'checklist'}
                          </span>
                        ) : favorite.clientColor ? (
                          <ClientIcon
                            icon={favorite.clientIcon ?? null}
                            color={favorite.clientColor}
                            name={favorite.clientName}
                            size="xs"
                          />
                        ) : null}
                        <span className="truncate">{favorite.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            <nav className="space-y-1 border-t pt-4">
              <Link
                href="/settings"
                onClick={handleLinkClick}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  shellContext?.activeNavItem === 'settings'
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent'
                )}
              >
                <Settings className="h-5 w-5" />
                Settings
              </Link>
              {isAdmin && (
                <Link
                  href="/settings/admin"
                  onClick={handleLinkClick}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    shellContext?.activeNavItem === 'admin'
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-accent'
                  )}
                >
                  <ShieldCheck className="h-5 w-5" />
                  Admin
                </Link>
              )}
            </nav>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
