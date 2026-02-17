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

export interface AssigneeUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  deactivatedAt?: Date | string | null;
}

interface AssigneePickerProps {
  value: string[];
  onChange: (value: string[]) => void;
  users: AssigneeUser[];
  disabled?: boolean;
  maxDisplay?: number;
}

export function AssigneePicker({
  value,
  onChange,
  users,
  disabled = false,
  maxDisplay = 3,
}: AssigneePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const selectedUsers = users.filter((user) => value.includes(user.id));
  const remainingCount = selectedUsers.length - maxDisplay;

  const filteredUsers = users.filter((user) => {
    const searchLower = search.toLowerCase();
    return (
      user.name?.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower)
    );
  });

  const toggleUser = (userId: string) => {
    if (value.includes(userId)) {
      onChange(value.filter((id) => id !== userId));
    } else {
      onChange([...value, userId]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            'inline-flex items-center rounded-md transition-colors',
            disabled && 'cursor-not-allowed opacity-50',
            !disabled && 'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            selectedUsers.length === 0 && 'px-2 py-1'
          )}
        >
          {selectedUsers.length === 0 ? (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Plus className="size-4" />
              Assign
            </span>
          ) : (
            <AvatarGroup>
              {selectedUsers.slice(0, maxDisplay).map((user) => (
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
            placeholder="Search users..."
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
                onClick={() => toggleUser(user.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                  'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                  value.includes(user.id) && 'bg-accent'
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
                {value.includes(user.id) && (
                  <Check className="size-4 shrink-0 text-primary" />
                )}
              </button>
            ))
          )}
        </div>
        {selectedUsers.length > 0 && (
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

interface AssigneeAvatarsProps {
  assignees: AssigneeUser[];
  maxDisplay?: number;
  size?: 'sm' | 'default';
  showNames?: boolean;
}

export function AssigneeAvatars({
  assignees,
  maxDisplay = 3,
  size = 'sm',
  showNames = false,
}: AssigneeAvatarsProps) {
  const remainingCount = assignees.length - maxDisplay;

  if (assignees.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">Unassigned</span>
    );
  }

  if (showNames && assignees.length <= 2) {
    return (
      <div className="flex items-center gap-1">
        {assignees.map((user, index) => {
          const isDeactivated = !!user.deactivatedAt;
          return (
            <div key={user.id} className="flex items-center gap-1">
              <Avatar size={size} className={cn(isDeactivated && 'opacity-50 grayscale')}>
                <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name ?? user.email} />
                <AvatarFallback>
                  {getInitials(user.name ?? user.email)}
                </AvatarFallback>
              </Avatar>
              <span className={cn('text-sm', isDeactivated && 'text-muted-foreground')}>
                {user.name ?? user.email.split('@')[0]}
                {isDeactivated && ' (deactivated)'}
              </span>
              {index < assignees.length - 1 && <span className="text-muted-foreground">,</span>}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <AvatarGroup>
      {assignees.slice(0, maxDisplay).map((user) => {
        const isDeactivated = !!user.deactivatedAt;
        return (
          <Avatar key={user.id} size={size} className={cn(isDeactivated && 'opacity-50 grayscale')}>
            <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name ?? user.email} />
            <AvatarFallback>
              {getInitials(user.name ?? user.email)}
            </AvatarFallback>
          </Avatar>
        );
      })}
      {remainingCount > 0 && (
        <AvatarGroupCount>+{remainingCount}</AvatarGroupCount>
      )}
    </AvatarGroup>
  );
}

function getInitials(nameOrEmail: string): string {
  // If it looks like an email, use first letter before @
  if (nameOrEmail.includes('@')) {
    return nameOrEmail.charAt(0).toUpperCase();
  }

  // Split by space and get first letter of each word
  const words = nameOrEmail.split(' ').filter(Boolean);
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }

  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}
