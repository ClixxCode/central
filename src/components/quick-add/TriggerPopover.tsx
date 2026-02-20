'use client';

import * as React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Building2, CalendarIcon, Check } from 'lucide-react';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { useClients } from '@/lib/hooks/useClients';
import { usePersonalBoard } from '@/lib/hooks/useBoards';
import { useQuickAddUsers } from '@/lib/hooks/useQuickAdd';
import { parseNaturalDate, getDateSuggestions } from '@/lib/utils/parse-natural-date';
import { useIgnoreWeekends } from '@/lib/hooks/useIgnoreWeekends';
import { cn } from '@/lib/utils';

export type TriggerMode = '#' | '@' | '!' | '+' | '/';

export interface BoardSelection {
  boardId: string;
  boardName: string;
  clientId: string;
  clientName: string;
}

export interface UserSelection {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface DateSelection {
  date: Date;
  label: string;
}

export interface StatusSelection {
  id: string;
  label: string;
  color: string;
}

export interface SectionSelection {
  id: string;
  label: string;
  color: string;
}

interface TriggerPopoverProps {
  mode: TriggerMode;
  query: string;
  position: { top: number; left: number };
  selectedBoardId?: string;
  statusOptions?: { id: string; label: string; color: string; position: number }[];
  sectionOptions?: { id: string; label: string; color: string; position: number }[];
  onSelectBoard: (board: BoardSelection) => void;
  onSelectUser: (user: UserSelection) => void;
  onSelectDate: (date: DateSelection) => void;
  onSelectStatus: (status: StatusSelection) => void;
  onSelectSection: (section: SectionSelection) => void;
  onClose: () => void;
}

export function TriggerPopover({
  mode,
  query,
  position,
  selectedBoardId,
  statusOptions,
  sectionOptions,
  onSelectBoard,
  onSelectUser,
  onSelectDate,
  onSelectStatus,
  onSelectSection,
  onClose,
}: TriggerPopoverProps) {
  const ignoreWeekends = useIgnoreWeekends();
  const ref = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Close on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  // Reset active index when query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  return (
    <div
      ref={ref}
      className="absolute z-[100] min-w-[240px] max-w-[320px] max-h-[300px] overflow-y-auto rounded-lg border bg-popover shadow-lg"
      style={{ top: position.top + 4, left: Math.max(0, position.left) }}
    >
      {mode === '#' && (
        <BoardList
          query={query}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
          onSelect={onSelectBoard}
          onClose={onClose}
        />
      )}
      {mode === '@' && (
        <UserList
          query={query}
          boardId={selectedBoardId}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
          onSelect={onSelectUser}
          onClose={onClose}
        />
      )}
      {mode === '!' && (
        <DatePicker
          query={query}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
          onSelect={onSelectDate}
          onClose={onClose}
          ignoreWeekends={ignoreWeekends}
        />
      )}
      {mode === '+' && (
        <SectionList
          query={query}
          sectionOptions={sectionOptions ?? []}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
          onSelect={onSelectSection}
          onClose={onClose}
        />
      )}
      {mode === '/' && (
        <StatusList
          query={query}
          statusOptions={statusOptions ?? []}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
          onSelect={onSelectStatus}
          onClose={onClose}
        />
      )}
    </div>
  );
}

// Keyboard handler hook for lists
function useListKeyboard(
  itemCount: number,
  activeIndex: number,
  setActiveIndex: (i: number) => void,
  onSelect: (index: number) => void,
  onClose: () => void
) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(Math.min(activeIndex + 1, itemCount - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(Math.max(activeIndex - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (itemCount > 0) onSelect(activeIndex);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [itemCount, activeIndex, setActiveIndex, onSelect, onClose]);
}

// --- Board list ---
function BoardList({
  query,
  activeIndex,
  setActiveIndex,
  onSelect,
  onClose,
}: {
  query: string;
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  onSelect: (board: BoardSelection) => void;
  onClose: () => void;
}) {
  const { data: clients } = useClients();
  const { data: personalBoard } = usePersonalBoard();
  const lowerQuery = query.toLowerCase();

  const items: BoardSelection[] = React.useMemo(() => {
    const result: BoardSelection[] = [];
    // Include personal board
    if (personalBoard) {
      const searchStr = `personal ${personalBoard.name}`.toLowerCase();
      if (!lowerQuery || searchStr.includes(lowerQuery)) {
        result.push({
          boardId: personalBoard.id,
          boardName: personalBoard.name,
          clientId: '',
          clientName: 'Personal',
        });
      }
    }
    if (!clients) return result;
    for (const client of clients) {
      for (const board of client.boards) {
        if (board.type === 'rollup') continue;
        const searchStr = `${client.name} ${board.name}`.toLowerCase();
        if (!lowerQuery || searchStr.includes(lowerQuery)) {
          result.push({
            boardId: board.id,
            boardName: board.name,
            clientId: client.id,
            clientName: client.name,
          });
        }
      }
    }
    return result;
  }, [clients, personalBoard, lowerQuery]);

  const handleSelect = useCallback(
    (index: number) => {
      if (items[index]) onSelect(items[index]);
    },
    [items, onSelect]
  );

  useListKeyboard(items.length, activeIndex, setActiveIndex, handleSelect, onClose);

  if (items.length === 0) {
    return <div className="p-3 text-sm text-muted-foreground">No boards found</div>;
  }

  return (
    <div className="py-1">
      {items.map((item, i) => (
        <button
          key={item.boardId}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent',
            i === activeIndex && 'bg-accent'
          )}
          onClick={() => onSelect(item)}
          onMouseEnter={() => setActiveIndex(i)}
        >
          <Building2 className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="truncate">
            <span className="text-muted-foreground">{item.clientName}</span>
            <span className="text-muted-foreground/70 mx-1">/</span>
            <span className="font-medium">{item.boardName}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

// --- User list ---
function UserList({
  query,
  boardId,
  activeIndex,
  setActiveIndex,
  onSelect,
  onClose,
}: {
  query: string;
  boardId?: string;
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  onSelect: (user: UserSelection) => void;
  onClose: () => void;
}) {
  const { data: users, isLoading, error } = useQuickAddUsers(boardId);
  const lowerQuery = query.toLowerCase();

  const items: UserSelection[] = React.useMemo(() => {
    if (!users) return [];
    return users.filter((u) => {
      const searchStr = `${u.name ?? ''} ${u.email}`.toLowerCase();
      return !lowerQuery || searchStr.includes(lowerQuery);
    });
  }, [users, lowerQuery]);

  const handleSelect = useCallback(
    (index: number) => {
      if (items[index]) onSelect(items[index]);
    },
    [items, onSelect]
  );

  useListKeyboard(items.length, activeIndex, setActiveIndex, handleSelect, onClose);

  if (isLoading) {
    return <div className="p-3 text-sm text-muted-foreground">Loading users...</div>;
  }

  if (error) {
    return <div className="p-3 text-sm text-destructive">Failed to load users</div>;
  }

  if (items.length === 0) {
    return <div className="p-3 text-sm text-muted-foreground">{users && users.length > 0 ? 'No matching users' : 'No users found'}</div>;
  }

  return (
    <div className="py-1">
      {items.map((user, i) => {
        const initials = user.name
          ? user.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)
          : user.email.slice(0, 2).toUpperCase();

        return (
          <button
            key={user.id}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent',
              i === activeIndex && 'bg-accent'
            )}
            onClick={() => onSelect(user)}
            onMouseEnter={() => setActiveIndex(i)}
          >
            <Avatar size="sm">
              <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name ?? ''} />
              <AvatarFallback className="bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="truncate">
              <span className="font-medium">{user.name ?? user.email}</span>
              {user.name && (
                <span className="text-muted-foreground/70 ml-1 text-xs">{user.email}</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// --- Date picker ---
function DatePicker({
  query,
  activeIndex,
  setActiveIndex,
  onSelect,
  onClose,
  ignoreWeekends,
}: {
  query: string;
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  onSelect: (date: DateSelection) => void;
  onClose: () => void;
  ignoreWeekends?: boolean;
}) {
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const parsed = query ? parseNaturalDate(query) : null;
  const suggestions = getDateSuggestions(ignoreWeekends);

  // Build items: parsed result first (if any), then suggestions
  const items: DateSelection[] = React.useMemo(() => {
    const result: DateSelection[] = [];
    if (parsed) {
      result.push({ date: parsed.date, label: parsed.label });
    }
    for (const s of suggestions) {
      // Don't duplicate parsed result
      if (parsed && s.date.getTime() === parsed.date.getTime()) continue;
      result.push({ date: s.date, label: s.label });
    }
    return result;
  }, [parsed, suggestions]);

  const handleSelect = useCallback(
    (index: number) => {
      if (items[index]) onSelect(items[index]);
    },
    [items, onSelect]
  );

  useListKeyboard(items.length, activeIndex, setActiveIndex, handleSelect, onClose);

  return (
    <div>
      {/* Suggestions list */}
      <div className="py-1 border-b">
        {parsed && (
          <div className="px-3 py-1">
            <span className="text-xs text-muted-foreground/70">Parsed:</span>
          </div>
        )}
        {items.map((item, i) => (
          <button
            key={`${item.label}-${item.date.getTime()}`}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent',
              i === activeIndex && 'bg-accent'
            )}
            onClick={() => onSelect(item)}
            onMouseEnter={() => setActiveIndex(i)}
          >
            <CalendarIcon className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{item.label}</span>
            <span className="ml-auto text-xs text-muted-foreground/70">
              {format(item.date, 'MMM d')}
            </span>
          </button>
        ))}
      </div>
      {/* Calendar */}
      <div className="p-2">
        <Calendar
          mode="single"
          selected={parsed?.date}
          onSelect={(date) => {
            if (date) {
              onSelect({ date, label: format(date, 'MMM d, yyyy') });
            }
          }}
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          hideWeekends={ignoreWeekends}
        />
      </div>
    </div>
  );
}

// --- Status list ---
function StatusList({
  query,
  statusOptions,
  activeIndex,
  setActiveIndex,
  onSelect,
  onClose,
}: {
  query: string;
  statusOptions: { id: string; label: string; color: string; position: number }[];
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  onSelect: (status: StatusSelection) => void;
  onClose: () => void;
}) {
  const lowerQuery = query.toLowerCase();

  const items = React.useMemo(() => {
    const sorted = [...statusOptions].sort((a, b) => a.position - b.position);
    if (!lowerQuery) return sorted;
    return sorted.filter((s) => s.label.toLowerCase().includes(lowerQuery));
  }, [statusOptions, lowerQuery]);

  const handleSelect = useCallback(
    (index: number) => {
      if (items[index]) {
        onSelect({ id: items[index].id, label: items[index].label, color: items[index].color });
      }
    },
    [items, onSelect]
  );

  useListKeyboard(items.length, activeIndex, setActiveIndex, handleSelect, onClose);

  if (statusOptions.length === 0) {
    return <div className="p-3 text-sm text-muted-foreground">Select a board first</div>;
  }

  if (items.length === 0) {
    return <div className="p-3 text-sm text-muted-foreground">No matching status</div>;
  }

  return (
    <div className="py-1">
      {items.map((item, i) => (
        <button
          key={item.id}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent',
            i === activeIndex && 'bg-accent'
          )}
          onClick={() => onSelect({ id: item.id, label: item.label, color: item.color })}
          onMouseEnter={() => setActiveIndex(i)}
        >
          <span
            className="h-3 w-3 rounded-full shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

// --- Section list ---
function SectionList({
  query,
  sectionOptions,
  activeIndex,
  setActiveIndex,
  onSelect,
  onClose,
}: {
  query: string;
  sectionOptions: { id: string; label: string; color: string; position: number }[];
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  onSelect: (section: SectionSelection) => void;
  onClose: () => void;
}) {
  const lowerQuery = query.toLowerCase();

  const items = React.useMemo(() => {
    const sorted = [...sectionOptions].sort((a, b) => a.position - b.position);
    if (!lowerQuery) return sorted;
    return sorted.filter((s) => s.label.toLowerCase().includes(lowerQuery));
  }, [sectionOptions, lowerQuery]);

  const handleSelect = useCallback(
    (index: number) => {
      if (items[index]) {
        onSelect({ id: items[index].id, label: items[index].label, color: items[index].color });
      }
    },
    [items, onSelect]
  );

  useListKeyboard(items.length, activeIndex, setActiveIndex, handleSelect, onClose);

  if (sectionOptions.length === 0) {
    return <div className="p-3 text-sm text-muted-foreground">No sections on this board</div>;
  }

  if (items.length === 0) {
    return <div className="p-3 text-sm text-muted-foreground">No matching section</div>;
  }

  return (
    <div className="py-1">
      {items.map((item, i) => (
        <button
          key={item.id}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent',
            i === activeIndex && 'bg-accent'
          )}
          onClick={() => onSelect({ id: item.id, label: item.label, color: item.color })}
          onMouseEnter={() => setActiveIndex(i)}
        >
          <span
            className="h-3 w-3 rounded-sm shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
