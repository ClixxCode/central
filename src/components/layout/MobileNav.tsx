'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { X, LayoutDashboard, CalendarDays, FolderKanban, LayoutTemplate, Layers, Users, Settings, ChevronRight, Building2, Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/lib/stores';
import { useFavorites } from '@/lib/hooks/useFavorites';
import { useCalendarPreferences, useSidebarPreferences } from '@/lib/hooks';
import { ClientIcon } from '@/components/clients/ClientIcon';
import { useIsClient } from '@/hooks/useIsClient';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Client {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string | null;
  defaultBoardId: string | null;
  boards: { id: string; name: string }[];
}

interface MobileNavProps {
  clients: Client[];
  isAdmin?: boolean;
  isContractor?: boolean;
}

export function MobileNav({ clients, isAdmin = false, isContractor = false }: MobileNavProps) {
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
  const DEFAULT_NAV_ORDER = ['My Work', 'Clients', 'Rollups', 'Schedule', 'Templates'];
  const savedNavOrder = sidebarPrefs?.navOrder;
  const navOrder = savedNavOrder && savedNavOrder.length > 0 ? savedNavOrder : DEFAULT_NAV_ORDER;

  const navItemDefs: Record<string, { href: string; label: string; icon: LucideIcon; alwaysVisible: boolean }> = {
    'My Work': { href: '/my-tasks', label: 'My Tasks', icon: LayoutDashboard, alwaysVisible: true },
    'Schedule': { href: '/schedule', label: 'Schedule', icon: CalendarDays, alwaysVisible: true },
    'Rollups': { href: '/rollups', label: 'Rollups', icon: FolderKanban, alwaysVisible: false },
    'Templates': { href: '/templates', label: 'Templates', icon: LayoutTemplate, alwaysVisible: false },
    'Clients': { href: '/clients', label: 'Clients', icon: Building2, alwaysVisible: false },
  };

  const availableLabels = new Set(Object.keys(navItemDefs));
  if (!calPrefs?.showScheduleInSidebar) availableLabels.delete('Schedule');

  const navItems = navOrder
    .filter((label) => availableLabels.has(label))
    .map((label) => navItemDefs[label])
    .filter((item) => item.alwaysVisible || !hiddenNavItems.includes(item.label));

  const showClientsSection = !hiddenNavItems.includes('ClientList');

  const adminItems = [
    { href: '/settings/users', label: 'Users', icon: Users },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  const handleLinkClick = () => {
    setSidebarOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setSidebarOpen}>
      <SheetContent side="left" className="w-80 p-0">
        <SheetHeader className="flex h-14 flex-row items-center justify-between border-b px-4">
          <SheetTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">C</span>
            </div>
            <span className="font-semibold">Central</span>
          </SheetTitle>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-3.5rem)]">
          <div className="p-4 space-y-6">
            {/* Main Navigation */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
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

            {/* Clients Section */}
            {showClientsSection && (clients.length > 0 || !isContractor) && (
            <div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Clients
                </span>
                {!isContractor && (
                  <Link
                    href="/clients/new"
                    onClick={handleLinkClick}
                    className="p-0.5 rounded hover:bg-accent"
                  >
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                )}
              </div>
              <div className="space-y-1">
                {clients.map((client) => (
                  <div key={client.id}>
                    <Link
                      href={`/clients/${client.slug}`}
                      onClick={handleLinkClick}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                        pathname.includes(`/clients/${client.slug}`)
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent'
                      )}
                    >
                      <ClientIcon icon={client.icon} color={client.color} name={client.name} size="xs" />
                      <span className="flex-1">{client.name}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/70" />
                    </Link>
                    {pathname.includes(`/clients/${client.slug}`) && (
                      <div className="ml-5 space-y-1 py-1">
                        {client.boards.map((board) => {
                          const boardPath = `/clients/${client.slug}/boards/${board.id}`;
                          const isBoardActive = pathname.startsWith(boardPath);

                          return (
                            <Link
                              key={board.id}
                              href={boardPath}
                              onClick={handleLinkClick}
                              className={cn(
                                'flex items-center rounded-lg px-3 py-1.5 text-sm transition-colors',
                                isBoardActive
                                  ? 'bg-primary/10 text-primary font-medium'
                                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                              )}
                            >
                              {board.name}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            )}

            {/* Admin Section */}
            {isAdmin && (
              <div>
                <div className="px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Admin
                  </span>
                </div>
                <nav className="space-y-1">
                  {adminItems.map((item) => {
                    const isActive = pathname === item.href;
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
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
