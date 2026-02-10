'use client';

import { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
  Plus,
  FolderKanban,
  Layers,
  PanelLeftClose,
  PanelLeft,
  Star,
} from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { useUIStore } from '@/lib/stores';
import { useFavorites, useReorderFavorites } from '@/lib/hooks/useFavorites';
import type { FavoriteWithDetails } from '@/lib/db/schema';
import { ClientIcon } from '@/components/clients/ClientIcon';
import { useIsClient } from '@/hooks/useIsClient';
import { useFavoriteHintKeys } from '@/lib/hooks/useFavoriteHintKeys';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Client {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string | null;
  defaultBoardId: string | null;
  boards: { id: string; name: string }[];
}

interface SortableFavoriteItemProps {
  favorite: FavoriteWithDetails;
  isActive: boolean;
  href: string;
  hintKey?: number | null;
}

function SortableFavoriteItem({ favorite, isActive, href, hintKey }: SortableFavoriteItemProps) {
  const router = useRouter();
  const wasDragged = useRef(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: favorite.id,
  });

  if (isDragging) {
    wasDragged.current = true;
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50',
        isActive
          ? 'bg-blue-100 text-blue-700 font-medium'
          : 'text-muted-foreground hover:bg-accent'
      )}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (wasDragged.current) {
          wasDragged.current = false;
          return;
        }
        router.push(href);
      }}
    >
      {hintKey != null ? (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-bold">
          {hintKey}
        </span>
      ) : favorite.entityType === 'rollup' ? (
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
    </div>
  );
}

interface SidebarProps {
  clients: Client[];
  isAdmin?: boolean;
}

export function Sidebar({ clients, isAdmin = false }: SidebarProps) {
  const pathname = usePathname();
  const isClient = useIsClient();
  const {
    sidebarCollapsed,
    expandedClients,
    toggleSidebarCollapse,
    toggleClientExpanded,
    toggleSection,
    isSectionCollapsed,
  } = useUIStore();
  const { data: favorites = [] } = useFavorites();
  const reorderFavorites = useReorderFavorites();
  const fKeyHeld = useFavoriteHintKeys();
  const { resolvedTheme } = useTheme();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const router = useRouter();

  const handleFavoriteDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = favorites.findIndex((f) => f.id === active.id);
      const newIndex = favorites.findIndex((f) => f.id === over.id);
      const newOrder = [...favorites];
      const [removed] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, removed);
      reorderFavorites.mutate(newOrder.map((f) => f.entityId));
    }
  };

  const getDefaultBoard = (client: Client) => {
    // 1. Explicit defaultBoardId (if set and exists in accessible boards)
    if (client.defaultBoardId) {
      const explicit = client.boards.find((b) => b.id === client.defaultBoardId);
      if (explicit) return explicit;
    }
    // 2. Board whose name matches client name (case-insensitive)
    const nameMatch = client.boards.find(
      (b) => b.name.toLowerCase() === client.name.toLowerCase()
    );
    if (nameMatch) return nameMatch;
    // 3. First board
    return client.boards[0];
  };

  // Use default values during SSR to prevent hydration mismatch
  const isCollapsed = isClient ? sidebarCollapsed : false;
  const clientsExpanded = isClient ? expandedClients : [];

  const navItems = [
    { href: '/my-tasks', label: 'My Work', icon: LayoutDashboard },
    { href: '/rollups', label: 'Rollups', icon: FolderKanban },
  ];

  // Prevent hydration mismatch by not rendering until client-side
  // This avoids the sidebar "sliding in" when localStorage state differs from SSR default
  if (!isClient) {
    return (
      <aside className="flex flex-col border-r bg-muted/50 w-64">
        {/* Skeleton placeholder during SSR */}
        <div className="flex h-14 items-center border-b px-4">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="ml-2 h-4 w-20" />
        </div>
        <div className="p-2 space-y-2">
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      </aside>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex flex-col shrink-0 h-full overflow-hidden border-r bg-muted/50 transition-all duration-300',
          isCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b px-4">
          {!isCollapsed && (
            <Link href="/my-tasks" className="flex items-center gap-2">
              <Image
                src={resolvedTheme === 'dark' ? '/clix_logo_white.png' : '/clix_logo_black.png'}
                alt="Clix Logo"
                width={32}
                height={32}
              />
              <span className="font-semibold text-foreground">CENTRAL</span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebarCollapse}
            className={cn('h-8 w-8', isCollapsed && 'mx-auto')}
          >
            {isCollapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>

        <ScrollArea className="flex-1 overflow-hidden">
          <div className="px-2 py-4">
          {/* Main Navigation */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              if (isCollapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg mx-auto',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-accent'
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-blue-100 text-blue-700 font-medium'
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
            <div className="mt-6">
              {!isCollapsed && (
                <button
                  onClick={() => toggleSection('favorites')}
                  className="group flex items-center gap-2 px-3 py-2 w-full"
                >
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Favorites
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-3 w-3 text-muted-foreground/70 opacity-0 group-hover:opacity-100 transition-all',
                      isSectionCollapsed('favorites') && '-rotate-90'
                    )}
                  />
                </button>
              )}

              {isCollapsed ? (
                <div className="space-y-1">
                  {favorites.map((favorite, index) => {
                    const href =
                      favorite.boardType === 'personal'
                        ? '/my-tasks?tab=personal'
                        : favorite.entityType === 'board' && favorite.clientSlug
                        ? `/clients/${favorite.clientSlug}/boards/${favorite.entityId}`
                        : `/rollups/${favorite.entityId}`;
                    const isActive = favorite.boardType === 'personal'
                      ? pathname === '/my-tasks'
                      : pathname.startsWith(href);

                    return (
                      <Tooltip key={favorite.id}>
                        <TooltipTrigger asChild>
                          <Link
                            href={href}
                            className={cn(
                              'relative flex h-10 w-10 items-center justify-center rounded-lg mx-auto',
                              isActive
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-accent'
                            )}
                          >
                            {fKeyHeld && index < 9 && (
                              <span className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
                                {index + 1}
                              </span>
                            )}
                            {favorite.entityType === 'rollup' ? (
                              <Layers className="h-5 w-5" />
                            ) : favorite.boardType === 'personal' ? (
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: '20px', color: favorite.boardColor ?? '#3B82F6' }}
                              >
                                {favorite.boardIcon ?? 'checklist'}
                              </span>
                            ) : (
                              <ClientIcon
                                icon={favorite.clientIcon ?? null}
                                color={favorite.clientColor ?? undefined}
                                name={favorite.clientName}
                                size="sm"
                              />
                            )}
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right">{favorite.name}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ) : !isSectionCollapsed('favorites') ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleFavoriteDragEnd}
                >
                  <SortableContext
                    items={favorites.map((f) => f.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1">
                      {favorites.map((favorite, index) => {
                        const href =
                          favorite.boardType === 'personal'
                            ? '/my-tasks?tab=personal'
                            : favorite.entityType === 'board' && favorite.clientSlug
                            ? `/clients/${favorite.clientSlug}/boards/${favorite.entityId}`
                            : `/rollups/${favorite.entityId}`;
                        const isActive = favorite.boardType === 'personal'
                          ? pathname === '/my-tasks'
                          : pathname.startsWith(href);

                        return (
                          <SortableFavoriteItem
                            key={favorite.id}
                            favorite={favorite}
                            isActive={isActive}
                            href={href}
                            hintKey={fKeyHeld && index < 9 ? index + 1 : null}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : null}
            </div>
          )}

          {/* Clients Section */}
          {!isCollapsed && (
            <div className="mt-6">
              <div className="group flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <Link
                    href="/clients"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clients
                  </Link>
                  <button onClick={() => toggleSection('clients')}>
                    <ChevronDown
                      className={cn(
                        'h-3 w-3 text-muted-foreground/70 opacity-0 group-hover:opacity-100 transition-all',
                        isSectionCollapsed('clients') && '-rotate-90'
                      )}
                    />
                  </button>
                </div>
                {isAdmin && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                        <Link href="/clients/new">
                          <Plus className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Add Client</TooltipContent>
                  </Tooltip>
                )}
              </div>

              {!isSectionCollapsed('clients') && <div className="space-y-1">
                {clients.map((client) => {
                  const isExpanded = clientsExpanded.includes(client.id);
                  const isClientActive = pathname.includes(`/clients/${client.slug}`);
                  const hasSingleBoard = client.boards.length === 1;

                  // Single-board clients render as a direct link
                  if (hasSingleBoard) {
                    const board = client.boards[0];
                    const boardPath = `/clients/${client.slug}/boards/${board.id}`;
                    const isBoardActive = pathname.startsWith(boardPath);

                    return (
                      <Link
                        key={client.id}
                        href={boardPath}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                          isBoardActive
                            ? 'bg-blue-100 text-blue-700 font-medium'
                            : 'text-muted-foreground hover:bg-accent'
                        )}
                      >
                        <ClientIcon icon={client.icon} color={client.color} name={client.name} size="xs" />
                        <span className="flex-1 truncate text-left">{client.name}</span>
                      </Link>
                    );
                  }

                  // Multi-board clients use collapsible menu
                  return (
                    <Collapsible
                      key={client.id}
                      open={isExpanded}
                      onOpenChange={() => toggleClientExpanded(client.id)}
                    >
                      <div
                        className={cn(
                          'flex w-full items-center rounded-lg text-sm transition-colors',
                          isClientActive
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent'
                        )}
                      >
                        <CollapsibleTrigger asChild>
                          <button
                            className="flex items-center pl-3 py-2 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground/70" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground/70" />
                            )}
                          </button>
                        </CollapsibleTrigger>
                        <button
                          className="flex flex-1 items-center gap-2 py-2 pr-3 min-w-0"
                          onClick={() => {
                            const board = getDefaultBoard(client);
                            if (board) {
                              router.push(`/clients/${client.slug}/boards/${board.id}`);
                            }
                            if (!isExpanded) {
                              toggleClientExpanded(client.id);
                            }
                          }}
                        >
                          <ClientIcon icon={client.icon} color={client.color} name={client.name} size="xs" />
                          <span className="flex-1 truncate text-left">{client.name}</span>
                        </button>
                      </div>
                      <CollapsibleContent>
                        <div className="ml-6 space-y-1 py-1">
                          {client.boards.map((board) => {
                            const boardPath = `/clients/${client.slug}/boards/${board.id}`;
                            const isBoardActive = pathname.startsWith(boardPath);

                            return (
                              <Link
                                key={board.id}
                                href={boardPath}
                                className={cn(
                                  'flex items-center rounded-lg px-3 py-1.5 text-sm transition-colors',
                                  isBoardActive
                                    ? 'bg-blue-100 text-blue-700 font-medium'
                                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                )}
                              >
                                {board.name}
                              </Link>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>}
            </div>
          )}
          </div>
        </ScrollArea>
      </aside>
    </TooltipProvider>
  );
}
