'use client';

import * as React from 'react';
import { Check, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  AvatarGroup,
  AvatarGroupCount,
} from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useAllUsers } from '@/lib/hooks';

export interface SelectedPerson {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

interface TeamMemberSelectProps {
  selected: SelectedPerson[];
  onChange: (people: SelectedPerson[]) => void;
  maxDisplay?: number;
  currentUserId?: string;
}

function getInitials(nameOrEmail: string): string {
  if (nameOrEmail.includes('@')) {
    return nameOrEmail.charAt(0).toUpperCase();
  }
  const words = nameOrEmail.split(' ').filter(Boolean);
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

export function TeamMemberSelect({
  selected,
  onChange,
  maxDisplay = 3,
  currentUserId,
}: TeamMemberSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const { data: users = [] } = useAllUsers();

  const selectedIds = React.useMemo(() => new Set(selected.map((p) => p.id)), [selected]);
  const remainingCount = selected.length - maxDisplay;

  // Filter out current user (they're always included automatically)
  const availableUsers = React.useMemo(
    () => users.filter((u) => u.id !== currentUserId),
    [users, currentUserId]
  );

  const filteredUsers = availableUsers.filter((user) => {
    const searchLower = search.toLowerCase();
    return (
      user.name?.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower)
    );
  });

  const toggleUser = (user: (typeof users)[0]) => {
    if (selectedIds.has(user.id)) {
      onChange(selected.filter((p) => p.id !== user.id));
    } else {
      onChange([...selected, user]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center rounded-md transition-colors',
            'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            selected.length === 0 && 'px-2 py-1'
          )}
        >
          {selected.length === 0 ? (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Plus className="size-4" />
              Add people
            </span>
          ) : (
            <AvatarGroup>
              {selected.slice(0, maxDisplay).map((user) => (
                <Avatar key={user.id} size="sm">
                  <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name ?? user.email} />
                  <AvatarFallback>
                    {getInitials(user.name ?? user.email)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {remainingCount > 0 && (
                <AvatarGroupCount>+{remainingCount}</AvatarGroupCount>
              )}
            </AvatarGroup>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-2">
          <Input
            placeholder="Search people..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filteredUsers.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No users found
            </p>
          ) : (
            filteredUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => toggleUser(user)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                  'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                  selectedIds.has(user.id) && 'bg-accent'
                )}
              >
                <Avatar size="sm">
                  <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name ?? user.email} />
                  <AvatarFallback>
                    {getInitials(user.name ?? user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-1 flex-col overflow-hidden">
                  <span className="truncate text-sm font-medium">
                    {user.name ?? user.email}
                  </span>
                  {user.name && (
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  )}
                </div>
                {selectedIds.has(user.id) && (
                  <Check className="size-4 shrink-0 text-primary" />
                )}
              </button>
            ))
          )}
        </div>
        {selected.length > 0 && (
          <div className="border-t p-2">
            <button
              type="button"
              onClick={() => onChange([])}
              className="flex w-full items-center justify-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-3" />
              Clear all
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
