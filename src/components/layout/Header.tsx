'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Menu, LogOut, Settings, User, Keyboard, Users, ShieldCheck, Building2, Plus, Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUIStore, useQuickActionsStore } from '@/lib/stores';
import { NotificationBell } from '@/components/notifications';
import { GlobalSearch } from '@/components/search';
import { KeyboardShortcutsModal } from '@/components/shortcuts';
import { QuickAddDialog } from '@/components/quick-add';
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts';
import { useFavorites } from '@/lib/hooks/useFavorites';
import * as React from 'react';

interface HeaderProps {
  user: {
    name: string | null;
    email: string;
    image: string | null;
  };
  isAdmin?: boolean;
  onSignOut: () => void;
}

export function Header({ user, isAdmin = false, onSignOut }: HeaderProps) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const { setSidebarOpen, sidebarOpen } = useUIStore();
  const { openQuickAdd, quickAddOpen, closeQuickAdd } = useQuickActionsStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { data: favoritesData } = useFavorites();
  const favorites = favoritesData?.favorites ?? [];

  // Build favorite shortcuts (b then 1-9)
  const favoriteShortcuts = React.useMemo(() => {
    return favorites.slice(0, 9).map((fav, index) => ({
      key: ['f', String(index + 1)] as string[],
      description: `Go to ${fav.name}`,
      handler: () => {
        const href =
          fav.entityType === 'board' && fav.clientSlug
            ? `/clients/${fav.clientSlug}/boards/${fav.entityId}`
            : `/rollups/${fav.entityId}`;
        router.push(href);
      },
    }));
  }, [favorites, router]);

  // Keyboard shortcuts
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
    // Navigation shortcuts (multi-key sequences)
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
      <header className="flex h-14 items-center justify-between border-b bg-background px-4">
        {/* Left section */}
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Quick Add Task button */}
          <Button
            variant="outline"
            size="icon-sm"
            onClick={openQuickAdd}
            title="Quick add task (n)"
            className="cursor-pointer border-[#EB3E4B]/30 bg-[#EB3E4B]/10 text-foreground hover:bg-[#EB3E4B]/20 hover:text-foreground dark:border-[#EB3E4B]/30 dark:bg-[#EB3E4B]/10 dark:hover:bg-[#EB3E4B]/20"
          >
            <Plus className="h-4 w-4" />
          </Button>

          {/* Search */}
          <div className="hidden sm:block">
            <GlobalSearch inputRef={searchInputRef} />
          </div>
        </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Mobile search button */}
        <Button variant="ghost" size="icon" className="sm:hidden">
          <Search className="h-5 w-5" />
        </Button>

        {/* Notifications */}
        <NotificationBell />

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')}
          title={!mounted ? undefined : theme === 'light' ? 'Light mode' : theme === 'dark' ? 'Dark mode' : 'System theme'}
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

        {/* Keyboard shortcuts button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShortcutsOpen(true)}
          className="hidden sm:flex"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className="h-5 w-5" />
        </Button>

        {/* User menu */}
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
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin</p>
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
    </header>

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
