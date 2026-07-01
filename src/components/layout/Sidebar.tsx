'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Layers,
  PanelLeftClose,
  PanelLeft,
  MoreHorizontal,
  X,
  Search,
  GripVertical,
  FolderOpen,
  FolderClosed,
  Pencil,
  Trash2,
  ArrowRight,
  ArrowUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { useQuickActionsStore, useUIStore } from '@/lib/stores';
import {
  useFavorites,
  useReorderFavorites,
  useRemoveFavorite,
  useCreateFavoriteFolder,
  useRenameFavoriteFolder,
  useDeleteFavoriteFolder,
  useMoveFavoriteToFolder,
  useReorderFolderContents,
} from '@/lib/hooks/useFavorites';
import type { FavoriteWithDetails, FavoriteFolder, FavoritesData } from '@/lib/db/schema';
import { ClientIcon } from '@/components/clients/ClientIcon';
import { useIsClient } from '@/hooks/useIsClient';
import { useFavoriteHintKeys } from '@/lib/hooks/useFavoriteHintKeys';
import { useCalendarPreferences, useSidebarPreferences, useUpdateSidebarPreferences } from '@/lib/hooks';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { GlobalSearch } from '@/components/search';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  APP_SHELL_NAV_ITEMS,
  DEFAULT_APP_NAV_ORDER,
  getAvailableAppNavPreferenceLabels,
  getAppNavActiveItem,
  getVisibleAppNavItems,
  isAppNavPreferenceLabel,
  normalizeAppNavPreferenceLabels,
  type AppNavPreferenceLabel,
} from './app-nav';
import type { TopShellContext } from './shell-context';
import { AppActions } from './AppActions';

// A top-level item is either a folder or a standalone favorite
type TopLevelItem =
  | { type: 'folder'; folder: FavoriteFolder }
  | { type: 'favorite'; favorite: FavoriteWithDetails };

function buildTopLevelList(data: FavoritesData): TopLevelItem[] {
  const items: TopLevelItem[] = [];

  for (const folder of data.folders) {
    items.push({ type: 'folder', folder });
  }

  for (const fav of data.favorites) {
    if (!fav.folderId) {
      items.push({ type: 'favorite', favorite: fav });
    }
  }

  items.sort((a, b) => {
    const posA = a.type === 'folder' ? a.folder.position : a.favorite.position;
    const posB = b.type === 'folder' ? b.folder.position : b.favorite.position;
    return posA - posB;
  });

  return items;
}

function buildFlatFavoritesList(data: FavoritesData): FavoriteWithDetails[] {
  const topLevel = buildTopLevelList(data);
  const result: FavoriteWithDetails[] = [];

  for (const item of topLevel) {
    if (item.type === 'favorite') {
      result.push(item.favorite);
    } else {
      // Add folder's children sorted by position
      const children = data.favorites
        .filter((f) => f.folderId === item.folder.id)
        .sort((a, b) => a.position - b.position);
      result.push(...children);
    }
  }

  return result;
}

function getFavoriteHref(favorite: FavoriteWithDetails): string {
  if (favorite.boardType === 'personal') return '/my-tasks?tab=personal';
  if (favorite.entityType === 'board' && favorite.clientSlug)
    return `/clients/${favorite.clientSlug}/boards/${favorite.entityId}`;
  return `/rollups/${favorite.entityId}`;
}

function FavoriteIcon({ favorite, size = 'sm' }: { favorite: FavoriteWithDetails; size?: 'sm' | 'xs' }) {
  if (favorite.entityType === 'rollup') {
    return <Layers className={cn(size === 'xs' ? 'h-3.5 w-3.5' : 'h-5 w-5', 'shrink-0 text-muted-foreground')} />;
  }
  if (favorite.boardType === 'personal') {
    return (
      <span
        className="material-symbols-outlined shrink-0"
        style={{ fontSize: size === 'xs' ? '14px' : '20px', color: favorite.boardColor ?? '#3B82F6' }}
      >
        {favorite.boardIcon ?? 'checklist'}
      </span>
    );
  }
  if (favorite.clientColor) {
    return (
      <ClientIcon
        icon={favorite.clientIcon ?? null}
        color={favorite.clientColor}
        name={favorite.clientName}
        size={size}
      />
    );
  }
  return null;
}

interface SortableFavoriteItemProps {
  favorite: FavoriteWithDetails;
  isActive: boolean;
  href: string;
  hintKey?: number | null;
  folders: FavoriteFolder[];
  onMoveToFolder: (entityId: string, folderId: string | null) => void;
  onRemoveFavorite: (entityId: string) => void;
}

function SortableFavoriteItem({
  favorite,
  isActive,
  href,
  hintKey,
  folders,
  onMoveToFolder,
  onRemoveFavorite,
}: SortableFavoriteItemProps) {
  const router = useRouter();
  const wasDragged = useRef(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: favorite.id,
  });

  useEffect(() => {
    if (isDragging) {
      wasDragged.current = true;
    }
  }, [isDragging]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div className="group relative">
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors cursor-grab active:cursor-grabbing',
          isDragging && 'opacity-50',
          isActive
            ? 'bg-primary/10 text-primary font-medium'
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
        ) : (
          <FavoriteIcon favorite={favorite} size="xs" />
        )}
        <span className="truncate flex-1">{favorite.name}</span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-3.5 w-3.5 text-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" className="w-48">
          {folders.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <ArrowRight className="h-4 w-4 mr-2" />
                Move to folder
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-40">
                {folders.map((folder) => (
                  <DropdownMenuItem
                    key={folder.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveToFolder(favorite.entityId, folder.id);
                    }}
                  >
                    <FolderClosed className="h-4 w-4 mr-2" />
                    {folder.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {favorite.folderId && (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onMoveToFolder(favorite.entityId, null);
              }}
            >
              <ArrowUp className="h-4 w-4 mr-2" />
              Remove from folder
            </DropdownMenuItem>
          )}
          {(folders.length > 0 || favorite.folderId) && <DropdownMenuSeparator />}
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onRemoveFavorite(favorite.entityId);
            }}
            className="text-destructive focus:text-destructive"
          >
            <X className="h-4 w-4 mr-2" />
            Remove from favorites
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface SortableFolderItemProps {
  folder: FavoriteFolder;
  favorites: FavoriteWithDetails[];
  allFolders: FavoriteFolder[];
  isExpanded: boolean;
  onToggle: () => void;
  onRename: (folderId: string, name: string) => void;
  onDelete: (folderId: string) => void;
  onMoveToFolder: (entityId: string, folderId: string | null) => void;
  onRemoveFavorite: (entityId: string) => void;
  onReorderContents: (folderId: string, orderedEntityIds: string[]) => void;
  pathname: string;
  searchParams: URLSearchParams;
  fKeyHeld: boolean;
  hintKeyOffset: number;
  sensors: ReturnType<typeof useSensors>;
}

function SortableFolderItem({
  folder,
  favorites: folderFavorites,
  allFolders,
  isExpanded,
  onToggle,
  onRename,
  onDelete,
  onMoveToFolder,
  onRemoveFavorite,
  onReorderContents,
  pathname,
  searchParams,
  fKeyHeld,
  hintKeyOffset,
  sensors,
}: SortableFolderItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `folder:${folder.id}`,
  });
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== folder.name) {
      onRename(folder.id, trimmed);
    }
    setIsRenaming(false);
  };

  const handleFolderDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = folderFavorites.findIndex((f) => f.id === active.id);
      const newIndex = folderFavorites.findIndex((f) => f.id === over.id);
      const newOrder = [...folderFavorites];
      const [removed] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, removed);
      onReorderContents(folder.id, newOrder.map((f) => f.entityId));
    }
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && 'opacity-50')}>
      <div className="group relative">
        <div
          className="flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-accent cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <button
            className="p-0.5 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/70" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/70" />
            )}
          </button>
          {isExpanded ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <FolderClosed className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          {isRenaming ? (
            <input
              ref={inputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') {
                  setRenameValue(folder.name);
                  setIsRenaming(false);
                }
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 min-w-0 bg-transparent border-b border-primary outline-none text-sm px-1"
            />
          ) : (
            <span className="truncate flex-1 ml-1">{folder.name}</span>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5 text-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right" className="w-40">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setRenameValue(folder.name);
                setIsRenaming(true);
              }}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onDelete(folder.id);
              }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isExpanded && folderFavorites.length > 0 && (
        <div className="ml-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleFolderDragEnd}
          >
            <SortableContext
              items={folderFavorites.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-0.5 py-0.5">
                {folderFavorites.map((favorite, index) => {
                  const href = getFavoriteHref(favorite);
                  const isActive = favorite.boardType === 'personal'
                    ? pathname === '/my-tasks' && searchParams.get('tab') === 'personal'
                    : pathname.startsWith(href);
                  const globalIndex = hintKeyOffset + index;

                  return (
                    <SortableFavoriteItem
                      key={favorite.id}
                      favorite={favorite}
                      isActive={isActive}
                      href={href}
                      hintKey={fKeyHeld && globalIndex < 9 ? globalIndex + 1 : null}
                      folders={allFolders}
                      onMoveToFolder={onMoveToFolder}
                      onRemoveFavorite={onRemoveFavorite}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

interface SortableNavEditItemProps {
  id: string;
  label: string;
  icon: LucideIcon;
  alwaysVisible: boolean;
  isHidden: boolean;
  onToggle: (checked: boolean) => void;
}

function SortableNavEditItem({ id, label, icon: Icon, alwaysVisible, isHidden, onToggle }: SortableNavEditItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 py-1.5 rounded-md',
        isDragging && 'opacity-50 bg-accent',
      )}
    >
      <button
        className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground/50 hover:text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {!alwaysVisible ? (
        <label className="flex flex-1 items-center gap-3 cursor-pointer">
          <Checkbox
            checked={!isHidden}
            onCheckedChange={(checked) => onToggle(!!checked)}
          />
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{label}</span>
        </label>
      ) : (
        <div className="flex flex-1 items-center gap-3">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{label}</span>
        </div>
      )}
    </div>
  );
}

interface SidebarProps {
  clients?: unknown[];
  user: {
    name: string | null;
    email: string;
    image: string | null;
  };
  isAdmin?: boolean;
  isContractor?: boolean;
  shellContext?: TopShellContext;
  onSignOut: () => void;
  visualRefreshEnabled?: boolean;
}

export function Sidebar({
  user,
  isAdmin = false,
  shellContext,
  onSignOut,
  visualRefreshEnabled = true,
}: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const isClient = useIsClient();
  const {
    sidebarCollapsed,
    toggleSidebarCollapse,
    toggleSection,
    isSectionCollapsed,
  } = useUIStore();
  const { data: calPrefs } = useCalendarPreferences();
  const { data: sidebarPrefs } = useSidebarPreferences();
  const updateSidebarPrefs = useUpdateSidebarPreferences();
  const { data: favoritesData = { folders: [], favorites: [] } } = useFavorites();
  const { openQuickAdd } = useQuickActionsStore();
  const reorderFavoritesMut = useReorderFavorites();
  const removeFavoriteMut = useRemoveFavorite();
  const createFolderMut = useCreateFavoriteFolder();
  const renameFolderMut = useRenameFavoriteFolder();
  const deleteFolderMut = useDeleteFavoriteFolder();
  const moveToFolderMut = useMoveFavoriteToFolder();
  const reorderContentsMut = useReorderFolderContents();
  const fKeyHeld = useFavoriteHintKeys();
  const { resolvedTheme } = useTheme();

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [draftHiddenNav, setDraftHiddenNav] = useState<string[]>([]);
  const [draftNavOrder, setDraftNavOrder] = useState<string[]>([...DEFAULT_APP_NAV_ORDER]);

  // Folder creation state
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creatingFolder) {
      folderInputRef.current?.focus();
    }
  }, [creatingFolder]);

  const enterEditMode = () => {
    setDraftHiddenNav(normalizeAppNavPreferenceLabels(sidebarPrefs?.hiddenNavItems));
    const savedOrder = sidebarPrefs?.navOrder;
    const normalizedOrder = normalizeAppNavPreferenceLabels(savedOrder);
    setDraftNavOrder(normalizedOrder.length > 0 ? normalizedOrder : [...DEFAULT_APP_NAV_ORDER]);
    setEditMode(true);
  };

  const cancelEditMode = () => {
    setEditMode(false);
  };

  const saveEditMode = () => {
    updateSidebarPrefs.mutate({
      hiddenNavItems: draftHiddenNav.filter((item) => isAppNavPreferenceLabel(item)),
      navOrder: draftNavOrder,
    });
    setEditMode(false);
  };

  const handleNavEditDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setDraftNavOrder((prev) => {
        const oldIndex = prev.indexOf(active.id as string);
        const newIndex = prev.indexOf(over.id as string);
        const next = [...prev];
        const [removed] = next.splice(oldIndex, 1);
        next.splice(newIndex, 0, removed);
        return next;
      });
    }
  };

  const handleSidebarCollapseToggle = () => {
    if (!sidebarCollapsed) {
      setEditMode(false);
    }
    toggleSidebarCollapse();
  };

  const handleOpenSearch = () => {
    setSearchOpen(true);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const topLevelList = buildTopLevelList(favoritesData);
  const flatFavorites = buildFlatFavoritesList(favoritesData);

  const handleFavoriteDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const currentIds = topLevelList.map((item) =>
        item.type === 'folder' ? `folder:${item.folder.id}` : item.favorite.id
      );
      const oldIndex = currentIds.indexOf(active.id as string);
      const newIndex = currentIds.indexOf(over.id as string);
      const newOrder = [...currentIds];
      const [removed] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, removed);

      // Convert IDs: folder:{id} stays as-is, favorite.id → entityId
      const reorderIds = newOrder.map((id) => {
        if (id.startsWith('folder:')) return id;
        const fav = favoritesData.favorites.find((f) => f.id === id);
        return fav?.entityId ?? id;
      });

      reorderFavoritesMut.mutate(reorderIds);
    }
  };

  const handleCreateFolder = () => {
    const trimmed = newFolderName.trim();
    if (trimmed) {
      createFolderMut.mutate({ name: trimmed });
    }
    setNewFolderName('');
    setCreatingFolder(false);
  };

  const handleMoveToFolder = useCallback(
    (entityId: string, folderId: string | null) => {
      moveToFolderMut.mutate({ entityId, folderId });
    },
    [moveToFolderMut]
  );

  const handleRemoveFavorite = useCallback(
    (entityId: string) => {
      removeFavoriteMut.mutate(entityId);
    },
    [removeFavoriteMut]
  );

  const handleRenameFolder = useCallback(
    (folderId: string, name: string) => {
      renameFolderMut.mutate({ folderId, name });
    },
    [renameFolderMut]
  );

  const handleDeleteFolder = useCallback(
    (folderId: string) => {
      deleteFolderMut.mutate(folderId);
    },
    [deleteFolderMut]
  );

  const handleReorderContents = useCallback(
    (folderId: string, orderedEntityIds: string[]) => {
      reorderContentsMut.mutate({ folderId, orderedEntityIds });
    },
    [reorderContentsMut]
  );

  // Use default values during SSR to prevent hydration mismatch
  const isCollapsed = isClient ? sidebarCollapsed : false;

  const hiddenNavItems = sidebarPrefs?.hiddenNavItems ?? [];
  const savedNavOrder = sidebarPrefs?.navOrder;
  const normalizedNavOrder = normalizeAppNavPreferenceLabels(savedNavOrder);
  const navOrder = normalizedNavOrder.length > 0 ? normalizedNavOrder : DEFAULT_APP_NAV_ORDER;
  const showScheduleInSidebar = !!calPrefs?.showScheduleInSidebar;
  const availableLabels = new Set(getAvailableAppNavPreferenceLabels(showScheduleInSidebar));
  const navItems = getVisibleAppNavItems({
    navOrder,
    hiddenNavItems,
    showScheduleInSidebar,
    surface: 'desktop',
  });
  const draftAvailableNavOrder = draftNavOrder.filter(
    (label): label is AppNavPreferenceLabel =>
      isAppNavPreferenceLabel(label) && availableLabels.has(label)
  );

  const hasFavorites = favoritesData.favorites.length > 0 || favoritesData.folders.length > 0;
  // Prevent hydration mismatch by not rendering until client-side
  // This avoids the sidebar "sliding in" when localStorage state differs from SSR default
  if (!isClient) {
    return (
      <aside
        className={cn(
          'flex w-64 flex-col',
          visualRefreshEnabled ? 'bg-sidebar' : 'border-r bg-muted/50'
        )}
        data-app-sidebar
        data-shell-visual-refresh={visualRefreshEnabled ? 'on' : 'off'}
      >
        {/* Skeleton placeholder during SSR */}
        <div
          className={cn(
            'flex h-14 items-center border-b px-4',
            visualRefreshEnabled && 'border-sidebar-border'
          )}
        >
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

  // Calculate hint key offsets for folder contents
  function getHintKeyOffset(itemIndex: number): number {
    let offset = 0;
    for (let i = 0; i < itemIndex; i++) {
      const item = topLevelList[i];
      if (item.type === 'favorite') {
        offset += 1;
      } else {
        const folderExpanded = !isSectionCollapsed(`folder-${item.folder.id}`);
        if (folderExpanded) {
          const children = favoritesData.favorites.filter((f) => f.folderId === item.folder.id);
          offset += children.length;
        }
      }
    }
    return offset;
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex flex-col shrink-0 h-full overflow-hidden transition-all duration-300',
          visualRefreshEnabled
            ? 'bg-sidebar text-sidebar-foreground'
            : 'border-r bg-muted/50',
          isCollapsed ? 'w-16' : 'w-64'
        )}
        data-app-sidebar
        data-shell-visual-refresh={visualRefreshEnabled ? 'on' : 'off'}
      >
        {/* Header */}
        <div
          className={cn(
            'border-b border-sidebar-border',
            isCollapsed
              ? 'flex flex-col items-center gap-1 px-2 py-2'
              : 'flex h-14 items-center justify-between px-4'
          )}
        >
          {isCollapsed ? (
            <Link
              href="/my-tasks"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
              aria-label="Central"
            >
              C
            </Link>
          ) : (
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
          <div className={cn('flex items-center gap-1', isCollapsed && 'flex-col')}>
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleOpenSearch}
                      className="h-8 w-8"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side={isCollapsed ? 'right' : 'bottom'}>Search</TooltipContent>
              </Tooltip>
              <PopoverContent side={isCollapsed ? 'right' : 'bottom'} align="start" className="w-auto p-2">
                <GlobalSearch inputRef={searchInputRef} />
              </PopoverContent>
            </Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={openQuickAdd}
                  className="h-8 w-8"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side={isCollapsed ? 'right' : 'bottom'}>Quick add</TooltipContent>
            </Tooltip>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSidebarCollapseToggle}
              className="h-8 w-8"
            >
              {isCollapsed ? (
                <PanelLeft className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 overflow-hidden">
          {editMode && !isCollapsed ? (
            <div className="flex flex-col h-full">
              {/* Edit mode header */}
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <span className="text-sm font-semibold">Edit sidebar</span>
                <button
                  onClick={cancelEditMode}
                  className="p-1 rounded-md hover:bg-accent"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <div className="px-3 py-4">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleNavEditDragEnd}
                >
                  <SortableContext
                    items={draftAvailableNavOrder}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1">
                      {draftAvailableNavOrder
                        .map((label) => {
                          const def = APP_SHELL_NAV_ITEMS[label];
                          return (
                            <SortableNavEditItem
                              key={label}
                              id={label}
                              label={def.desktopLabel}
                              icon={def.icon}
                              alwaysVisible={def.alwaysVisible}
                              isHidden={draftHiddenNav.includes(label)}
                              onToggle={(checked) => {
                                setDraftHiddenNav((prev) =>
                                  checked
                                    ? prev.filter((n) => n !== label)
                                    : [...prev, label]
                                );
                              }}
                            />
                          );
                        })}
                    </div>
                  </SortableContext>
                </DndContext>

              </div>

              {/* Footer */}
              <div className="flex items-center gap-2 px-4 py-3 border-t mt-auto">
                <Button variant="outline" size="sm" onClick={cancelEditMode} className="flex-1">
                  Cancel
                </Button>
                <Button size="sm" onClick={saveEditMode} className="flex-1">
                  Save
                </Button>
              </div>
            </div>
          ) : (
          <div className="px-2 py-4">
          {/* Main Navigation */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = shellContext
                ? getAppNavActiveItem(item.preferenceLabel) === shellContext.activeNavItem
                : item.preferenceLabel === 'Clients'
                ? pathname === '/clients'
                : pathname === item.href;
              const Icon = item.icon;

              if (isCollapsed) {
                return (
	                  <Tooltip key={item.href}>
	                    <TooltipTrigger asChild>
	                      <Link
	                        href={item.href}
	                        aria-label={item.label}
	                        aria-current={isActive ? 'page' : undefined}
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

              const isMyWork = item.preferenceLabel === 'My Work';

              return (
                <div key={item.href} className={cn(isMyWork && 'group relative')}>
                  <Link
                    href={item.href}
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
                  {isMyWork && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            enterEditMode();
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity"
                        >
                          <MoreHorizontal className="h-4 w-4 text-foreground" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Edit sidebar</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Favorites Section */}
          {hasFavorites && (
            <div className="mt-6">
              {!isCollapsed && (
                <div className="group flex items-center gap-2 px-3 py-2 w-full">
                  <button
                    onClick={() => toggleSection('favorites')}
                    className="flex items-center gap-2 flex-1"
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => {
                          setNewFolderName('');
                          setCreatingFolder(true);
                        }}
                        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity"
                      >
                        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>New folder</TooltipContent>
                  </Tooltip>
                </div>
              )}

              {isCollapsed ? (
                <div className="space-y-1">
                  {flatFavorites.map((favorite, index) => {
                    const href = getFavoriteHref(favorite);
                    const isActive = favorite.boardType === 'personal'
                      ? pathname === '/my-tasks'
                      : pathname.startsWith(href);

                    return (
	                      <Tooltip key={favorite.id}>
	                        <TooltipTrigger asChild>
	                          <Link
	                            href={href}
	                            aria-label={favorite.name}
	                            aria-current={isActive ? 'page' : undefined}
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
                            <FavoriteIcon favorite={favorite} size="sm" />
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
                    items={topLevelList.map((item) =>
                      item.type === 'folder' ? `folder:${item.folder.id}` : item.favorite.id
                    )}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-0.5">
                      {topLevelList.map((item, itemIndex) => {
                        if (item.type === 'folder') {
                          const folderFavs = favoritesData.favorites
                            .filter((f) => f.folderId === item.folder.id)
                            .sort((a, b) => a.position - b.position);
                          const isExpanded = !isSectionCollapsed(`folder-${item.folder.id}`);

                          return (
                            <SortableFolderItem
                              key={`folder:${item.folder.id}`}
                              folder={item.folder}
                              favorites={folderFavs}
                              allFolders={favoritesData.folders}
                              isExpanded={isExpanded}
                              onToggle={() => toggleSection(`folder-${item.folder.id}`)}
                              onRename={handleRenameFolder}
                              onDelete={handleDeleteFolder}
                              onMoveToFolder={handleMoveToFolder}
                              onRemoveFavorite={handleRemoveFavorite}
                              onReorderContents={handleReorderContents}
                              pathname={pathname}
                              searchParams={searchParams}
                              fKeyHeld={fKeyHeld}
                              hintKeyOffset={getHintKeyOffset(itemIndex)}
                              sensors={sensors}
                            />
                          );
                        }

                        const favorite = item.favorite;
                        const href = getFavoriteHref(favorite);
                        const isActive = favorite.boardType === 'personal'
                          ? pathname === '/my-tasks' && searchParams.get('tab') === 'personal'
                          : pathname.startsWith(href);
                        const hintOffset = getHintKeyOffset(itemIndex);

                        return (
                          <SortableFavoriteItem
                            key={favorite.id}
                            favorite={favorite}
                            isActive={isActive}
                            href={href}
                            hintKey={fKeyHeld && hintOffset < 9 ? hintOffset + 1 : null}
                            folders={favoritesData.folders}
                            onMoveToFolder={handleMoveToFolder}
                            onRemoveFavorite={handleRemoveFavorite}
                          />
                        );
                      })}

                      {/* Inline folder creation input */}
                      {creatingFolder && (
                        <div className="flex items-center gap-2 rounded-lg px-3 py-2">
                          <FolderClosed className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <input
                            ref={folderInputRef}
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onBlur={() => {
                              if (newFolderName.trim()) {
                                handleCreateFolder();
                              } else {
                                setCreatingFolder(false);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCreateFolder();
                              if (e.key === 'Escape') {
                                setNewFolderName('');
                                setCreatingFolder(false);
                              }
                            }}
                            placeholder="Folder name..."
                            className="flex-1 min-w-0 bg-transparent border-b border-primary outline-none text-sm"
                          />
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : null}
            </div>
          )}

          </div>
          )}
        </ScrollArea>

        <div
          className={cn(
            'shrink-0 border-t border-sidebar-border',
            isCollapsed ? 'px-2 py-2' : 'px-3 py-2'
          )}
        >
          <AppActions
            user={user}
            isAdmin={isAdmin}
            onSignOut={onSignOut}
            hidePrimaryActions
            orientation={isCollapsed ? 'vertical' : 'horizontal'}
            className={cn(
              'ml-0',
              isCollapsed
                ? 'flex-col-reverse justify-center gap-1'
                : 'w-full flex-row-reverse justify-between'
            )}
          />
        </div>
      </aside>
    </TooltipProvider>
  );
}
