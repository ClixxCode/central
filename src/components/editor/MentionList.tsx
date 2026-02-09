'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export interface MentionUser {
  id: string;
  name: string | null;
  email: string;
  avatarUrl?: string | null;
}

interface MentionListProps {
  items: MentionUser[];
  selectedIndex: number;
  onSelect: (user: MentionUser) => void;
  style?: React.CSSProperties;
  className?: string;
}

export const MentionList = forwardRef<HTMLDivElement, MentionListProps>(
  function MentionList({ items, selectedIndex, onSelect, style, className }, ref) {
    return (
      <div
        ref={ref}
        style={style}
        className={cn(
          'z-50 min-w-[200px] max-w-[300px]',
          'rounded-md border bg-popover p-1 shadow-md',
          'animate-in fade-in-0 zoom-in-95',
          className
        )}
      >
        {items.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">No users found</div>
        ) : items.map((user, index) => (
          <button
            key={user.id}
            type="button"
            className={cn(
              'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
              'cursor-pointer outline-none',
              'hover:bg-accent hover:text-accent-foreground',
              index === selectedIndex && 'bg-accent text-accent-foreground'
            )}
            onClick={() => onSelect(user)}
          >
            <Avatar className="h-6 w-6">
              <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name ?? user.email} />
              <AvatarFallback className="text-xs">
                {getInitials(user.name ?? user.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start overflow-hidden">
              <span className="truncate font-medium">
                {user.name ?? user.email.split('@')[0]}
              </span>
              {user.name && (
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    );
  }
);

function getInitials(name: string): string {
  const parts = name.split(/[\s@]+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
