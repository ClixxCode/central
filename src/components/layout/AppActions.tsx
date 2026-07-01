'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Keyboard,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  User,
  Users,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationBell } from '@/components/notifications';
import { QuickAddDialog } from '@/components/quick-add';
import { GlobalSearch } from '@/components/search';
import { KeyboardShortcutsModal } from '@/components/shortcuts';
import { useIsClient } from '@/hooks/useIsClient';
import { useFavorites } from '@/lib/hooks/useFavorites';
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts';
import { useQuickActionsStore } from '@/lib/stores';

interface AppActionsUser {
  name: string | null;
  email: string;
  image: string | null;
}

interface AppActionsProps {
  user: AppActionsUser;
  isAdmin?: boolean;
  onSignOut: () => void;
  mobileMenuSlot?: React.ReactNode;
}

export function AppActions({
  user,
  isAdmin = false,
  onSignOut,
  mobileMenuSlot,
}: AppActionsProps) {
  const router = useRouter();
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const { openQuickAdd, quickAddOpen, closeQuickAdd } = useQuickActionsStore();
  const { theme, setTheme } = useTheme();
  const mounted = useIsClient();
  const { data: favoritesData } = useFavorites();

  const favoriteShortcuts = React.useMemo(() => {
    const favorites = favoritesData?.favorites ?? [];
    return favorites.slice(0, 9).map((fav, index) => ({
      key: ['f', String(index + 1)] as string[],
      description: `Go to ${fav.name}`,
      handler: () => {
        const href =
          fav.boardType === 'personal'
            ? '/my-tasks?tab=personal'
            : fav.entityType === 'board' && fav.clientSlug
            ? `/clients/${fav.clientSlug}/boards/${fav.entityId}`
            : `/rollups/${fav.entityId}`;
        router.push(href);
      },
    }));
  }, [favoritesData?.favorites, router]);

  useKeyboardShortcuts([
    {
      key: '/',
      description: 'Focus search',
      handler: () => {
        searchInputRef.current?.focus();
      },
    },
    {
      key: '?',
      shift: true,
      description: 'Show keyboard shortcuts',
      handler: () => {
        setShortcutsOpen(true);
      },
    },
    {
      key: 'n',
      description: 'Quick add task',
      handler: () => {
        openQuickAdd();
      },
    },
    {
      key: 'Escape',
      description: 'Close modal',
      handler: () => {
        setShortcutsOpen(false);
      },
      ignoreInputs: false,
      preventDefault: false,
    },
    {
      key: ['g', 't'],
      description: 'Go to My Tasks',
      handler: () => {
        router.push('/my-tasks?tab=tasks');
      },
    },
    {
      key: ['g', 'p'],
      description: 'Go to Personal Tasks',
      handler: () => {
        router.push('/my-tasks?tab=personal');
      },
    },
    {
      key: ['g', 'm'],
      description: 'Go to Replies & Mentions',
      handler: () => {
        router.push('/my-tasks?tab=notifications');
      },
    },
    {
      key: ['g', 's'],
      description: 'Go to Settings',
      handler: () => {
        router.push('/settings');
      },
    },
    ...favoriteShortcuts,
  ]);

  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email.slice(0, 2).toUpperCase();

  return (
    <>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {mobileMenuSlot}
        <Button
          variant="outline"
          size="icon-sm"
          onClick={openQuickAdd}
          title="Quick add task (n)"
          className="cursor-pointer border-primary/25 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
        >
          <Plus className="h-4 w-4" />
        </Button>

        <div className="hidden sm:block">
          <GlobalSearch inputRef={searchInputRef} />
        </div>

        <Button variant="ghost" size="icon" className="sm:hidden">
          <Search className="h-5 w-5" />
        </Button>

        <NotificationBell />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')}
          title={
            !mounted
              ? undefined
              : theme === 'light'
              ? 'Light mode'
              : theme === 'dark'
              ? 'Dark mode'
              : 'System theme'
          }
        >
          {!mounted ? (
            <span className="h-5 w-5" />
          ) : theme === 'dark' ? (
            <Moon className="h-5 w-5" />
          ) : theme === 'light' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Monitor className="h-5 w-5" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShortcutsOpen(true)}
          className="hidden sm:flex"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className="h-5 w-5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.image ?? undefined} alt={user.name ?? ''} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings/notifications" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Admin
                  </p>
                </div>
                <DropdownMenuItem asChild>
                  <Link href="/clients" className="cursor-pointer">
                    <Building2 className="mr-2 h-4 w-4" />
                    Manage Clients
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings/users" className="cursor-pointer">
                    <Users className="mr-2 h-4 w-4" />
                    Manage Users
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings/teams" className="cursor-pointer">
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Manage Teams
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings/statuses-sections" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Statuses & Sections
                  </Link>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={onSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <KeyboardShortcutsModal
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />

      <QuickAddDialog
        open={quickAddOpen}
        onOpenChange={(open) => {
          if (!open) closeQuickAdd();
        }}
        onTaskCreatedAndEdit={(taskId, boardPath) => {
          router.push(`${boardPath}?task=${taskId}`);
        }}
      />
    </>
  );
}
