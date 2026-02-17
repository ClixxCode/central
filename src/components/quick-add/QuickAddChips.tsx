'use client';

import * as React from 'react';
import { Building2, CalendarIcon, User, X, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { StatusOption } from '@/lib/db/schema';

interface QuickAddChipsProps {
  board?: { boardId: string; boardName: string; clientName: string } | null;
  assignees: { id: string; name: string | null; email: string; avatarUrl: string | null }[];
  dueDate?: { date: Date; label: string } | null;
  status?: string | null;
  statusOptions?: StatusOption[];
  onRemoveAssignee: (userId: string) => void;
  onRemoveDate: () => void;
  onStatusChange: (statusId: string) => void;
}

export function QuickAddChips({
  board,
  assignees,
  dueDate,
  status,
  statusOptions = [],
  onRemoveAssignee,
  onRemoveDate,
  onStatusChange,
}: QuickAddChipsProps) {
  const [statusOpen, setStatusOpen] = React.useState(false);
  const statusRef = React.useRef<HTMLDivElement>(null);

  // Close status dropdown on outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setStatusOpen(false);
      }
    }
    if (statusOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [statusOpen]);

  const hasChips = board || assignees.length > 0 || dueDate || status;
  if (!hasChips) return null;

  const currentStatus = statusOptions.find((s) => s.id === status);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Board chip */}
      {board && (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-500/20 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
          <Building2 className="h-3 w-3" />
          <span className="text-blue-500 dark:text-blue-400">{board.clientName}</span>
          <span>/</span>
          <span>{board.boardName}</span>
        </span>
      )}

      {/* Assignee chips */}
      {assignees.map((user) => {
        const initials = user.name
          ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
          : user.email.slice(0, 2).toUpperCase();

        return (
          <span
            key={user.id}
            className="inline-flex items-center gap-1 rounded-full bg-purple-50 dark:bg-purple-500/20 px-2 py-1 text-xs font-medium text-purple-700 dark:text-purple-300"
          >
            <Avatar size="sm" className="h-4 w-4">
              <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name ?? ''} />
              <AvatarFallback className="bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 text-[8px]">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span>{user.name ?? user.email}</span>
            <button
              type="button"
              onClick={() => onRemoveAssignee(user.id)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-purple-200 dark:hover:bg-purple-500/30"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        );
      })}

      {/* Due date chip */}
      {dueDate && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
          <CalendarIcon className="h-3 w-3" />
          <span>{dueDate.label}</span>
          <button
            type="button"
            onClick={onRemoveDate}
            className="ml-0.5 rounded-full p-0.5 hover:bg-amber-200 dark:hover:bg-amber-500/30"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      )}

      {/* Status chip */}
      {status && statusOptions.length > 0 && (
        <div ref={statusRef} className="relative">
          <button
            type="button"
            onClick={() => setStatusOpen(!statusOpen)}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border hover:bg-accent/50"
            style={currentStatus ? { borderColor: currentStatus.color, color: currentStatus.color } : undefined}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: currentStatus?.color ?? '#6B7280' }}
            />
            <span>{currentStatus?.label ?? status}</span>
            <ChevronDown className="h-3 w-3" />
          </button>

          {statusOpen && (
            <div className="absolute top-full left-0 z-50 mt-1 min-w-[140px] rounded-md border bg-popover shadow-md py-1">
              {statusOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent',
                    opt.id === status && 'bg-accent/50'
                  )}
                  onClick={() => {
                    onStatusChange(opt.id);
                    setStatusOpen(false);
                  }}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: opt.color }}
                  />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
