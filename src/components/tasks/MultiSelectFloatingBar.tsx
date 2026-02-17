'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { Building2, CalendarIcon, CircleDot, User, FolderOpen, X, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useClients } from '@/lib/hooks/useClients';
import { getDateSuggestions } from '@/lib/utils/parse-natural-date';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import type { StatusOption, SectionOption } from '@/lib/db/schema';
import type { AssigneeUser } from './AssigneePicker';

export interface BulkEditPayload {
  status?: string;
  section?: string | null;
  addAssigneeIds?: string[];
  removeAllAssignees?: boolean;
  dueDate?: string | null;
  boardId?: string;
  targetBoardName?: string;
}

interface MultiSelectFloatingBarProps {
  selectedCount: number;
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
  assignableUsers: AssigneeUser[];
  currentBoardId: string;
  onApply: (updates: BulkEditPayload) => void;
  onDuplicate: () => void;
  onRemoveAllAssignees: () => void;
  onCancel: () => void;
  isPending: boolean;
  isDuplicating: boolean;
  selectedTasksHaveAssignees: boolean;
  bottomOffset?: string;
}

export function MultiSelectFloatingBar({
  selectedCount,
  statusOptions,
  sectionOptions,
  assignableUsers,
  currentBoardId,
  onApply,
  onDuplicate,
  onRemoveAllAssignees,
  onCancel,
  isPending,
  isDuplicating,
  selectedTasksHaveAssignees,
  bottomOffset,
}: MultiSelectFloatingBarProps) {
  // Pending edits
  const [pendingStatus, setPendingStatus] = React.useState<string | undefined>();
  const [pendingSection, setPendingSection] = React.useState<string | null | undefined>();
  const [pendingAssigneeIds, setPendingAssigneeIds] = React.useState<string[]>([]);
  const [pendingDueDate, setPendingDueDate] = React.useState<string | null | undefined>();
  const [pendingBoardId, setPendingBoardId] = React.useState<string | undefined>();
  const [pendingBoardName, setPendingBoardName] = React.useState<string | undefined>();

  // Dropdown states
  const [boardOpen, setBoardOpen] = React.useState(false);
  const [boardSearch, setBoardSearch] = React.useState('');
  const [sectionOpen, setSectionOpen] = React.useState(false);
  const [assigneeOpen, setAssigneeOpen] = React.useState(false);
  const [dateOpen, setDateOpen] = React.useState(false);
  const [statusOpen, setStatusOpen] = React.useState(false);
  const [calendarMonth, setCalendarMonth] = React.useState<Date>(new Date());

  // Refs for click-outside
  const boardRef = React.useRef<HTMLDivElement>(null);
  const sectionRef = React.useRef<HTMLDivElement>(null);
  const assigneeRef = React.useRef<HTMLDivElement>(null);
  const dateRef = React.useRef<HTMLDivElement>(null);
  const statusRef = React.useRef<HTMLDivElement>(null);

  // Data
  const { data: clients } = useClients();

  const closeAll = () => {
    setBoardOpen(false);
    setBoardSearch('');
    setSectionOpen(false);
    setAssigneeOpen(false);
    setDateOpen(false);
    setStatusOpen(false);
  };

  // Click outside handler
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const refs = [boardRef, sectionRef, assigneeRef, dateRef, statusRef];
      const clickedInside = refs.some(
        (ref) => ref.current?.contains(e.target as Node)
      );
      if (!clickedInside) closeAll();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasEdits =
    pendingStatus !== undefined ||
    pendingSection !== undefined ||
    pendingAssigneeIds.length > 0 ||
    pendingDueDate !== undefined ||
    pendingBoardId !== undefined;

  const handleApply = () => {
    const payload: BulkEditPayload = {};
    if (pendingStatus !== undefined) payload.status = pendingStatus;
    if (pendingSection !== undefined) payload.section = pendingSection;
    if (pendingAssigneeIds.length > 0) payload.addAssigneeIds = pendingAssigneeIds;
    if (pendingDueDate !== undefined) payload.dueDate = pendingDueDate;
    if (pendingBoardId !== undefined) {
      payload.boardId = pendingBoardId;
      payload.targetBoardName = pendingBoardName;
    }
    onApply(payload);
  };

  const sortedStatuses = React.useMemo(
    () => [...statusOptions].sort((a, b) => a.position - b.position),
    [statusOptions]
  );

  const currentStatus = sortedStatuses.find((s) => s.id === pendingStatus);
  const currentSection = sectionOptions.find((s) => s.id === pendingSection);

  return createPortal(
    <div style={{ position: 'fixed', bottom: bottomOffset ?? '48px', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
      <div className="flex items-center gap-2 rounded-lg border bg-background px-4 py-3 shadow-2xl">
        {/* Board picker */}
        <div ref={boardRef} className="relative">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => { closeAll(); setBoardOpen(!boardOpen); }}
            className={cn(
              'gap-1 text-xs h-8 px-2',
              pendingBoardId && 'border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-500/30 dark:text-blue-300 dark:bg-blue-500/20'
            )}
          >
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate max-w-[120px]">
              {pendingBoardName ?? 'Move to...'}
            </span>
          </Button>

          {boardOpen && clients && (
            <div style={{ width: 310, maxHeight: 300 }} className="absolute bottom-full left-0 z-50 mb-1 rounded-md border bg-popover shadow-lg flex flex-col">
              <div className="p-2 border-b">
                <input
                  type="text"
                  placeholder="Search boards..."
                  value={boardSearch}
                  onChange={(e) => setBoardSearch(e.target.value)}
                  className="w-full rounded-md border bg-transparent px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  autoFocus
                />
              </div>
              <div className="overflow-y-auto py-1">
                {clients
                  .filter((client) => {
                    if (!boardSearch) return true;
                    const s = boardSearch.toLowerCase();
                    return (
                      client.name.toLowerCase().includes(s) ||
                      client.boards.some(
                        (b) => b.type === 'standard' && b.name.toLowerCase().includes(s)
                      )
                    );
                  })
                  .map((client) => {
                    const standardBoards = client.boards.filter((b) => {
                      if (b.type !== 'standard') return false;
                      if (!boardSearch) return true;
                      const s = boardSearch.toLowerCase();
                      return (
                        b.name.toLowerCase().includes(s) ||
                        client.name.toLowerCase().includes(s)
                      );
                    });
                    if (standardBoards.length === 0) return null;
                    return (
                      <React.Fragment key={client.id}>
                        <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                          {client.name}
                        </div>
                        {standardBoards.map((board) => (
                          <button
                            key={board.id}
                            type="button"
                            className={cn(
                              'flex w-full items-center gap-2 px-4 py-1.5 text-sm hover:bg-accent',
                              board.id === currentBoardId && 'text-muted-foreground',
                              pendingBoardId === board.id && 'bg-accent/50 font-medium'
                            )}
                            disabled={board.id === currentBoardId}
                            onClick={() => {
                              setPendingBoardId(board.id);
                              setPendingBoardName(board.name);
                              setBoardOpen(false);
                              setBoardSearch('');
                            }}
                          >
                            {board.name}
                            {board.id === currentBoardId && (
                              <span className="ml-auto text-xs text-muted-foreground">(current)</span>
                            )}
                          </button>
                        ))}
                      </React.Fragment>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Section picker */}
        <div ref={sectionRef} className="relative">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => { closeAll(); setSectionOpen(!sectionOpen); }}
            className={cn(
              'gap-1 text-xs h-8 px-2',
              pendingSection !== undefined && 'border-green-300 text-green-700 bg-green-50 dark:border-green-500/30 dark:text-green-300 dark:bg-green-500/20'
            )}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {currentSection ? currentSection.label : pendingSection === null ? 'No section' : 'Section'}
          </Button>

          {sectionOpen && (
            <div className="absolute bottom-full left-0 z-50 mb-1 min-w-[160px] rounded-md border bg-popover shadow-lg py-1">
              <button
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent',
                  pendingSection === null && 'bg-accent/50 font-medium'
                )}
                onClick={() => {
                  setPendingSection(null);
                  setSectionOpen(false);
                }}
              >
                <span className="text-muted-foreground">No section</span>
              </button>
              {sectionOptions.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent',
                    pendingSection === section.id && 'bg-accent/50 font-medium'
                  )}
                  onClick={() => {
                    setPendingSection(section.id);
                    setSectionOpen(false);
                  }}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: section.color }}
                  />
                  {section.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Assignee picker */}
        <div ref={assigneeRef} className="relative">
          <div className="flex items-center gap-0.5">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => { closeAll(); setAssigneeOpen(!assigneeOpen); }}
              className={cn(
                'gap-1 text-xs h-8 px-2',
                pendingAssigneeIds.length > 0 && 'border-purple-300 text-purple-700 bg-purple-50 dark:border-purple-500/30 dark:text-purple-300 dark:bg-purple-500/20',
                selectedTasksHaveAssignees && 'rounded-r-none'
              )}
            >
              <User className="h-3.5 w-3.5" />
              {pendingAssigneeIds.length > 0
                ? `+${pendingAssigneeIds.length} assignee${pendingAssigneeIds.length === 1 ? '' : 's'}`
                : 'Assignee'}
            </Button>
            {selectedTasksHaveAssignees && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    className="rounded-l-none border-l-0 px-1.5 h-8"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove all assignees?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove all assignees from {selectedCount} selected task{selectedCount === 1 ? '' : 's'}.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onRemoveAllAssignees}>Remove All</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {assigneeOpen && (
            <div className="absolute bottom-full left-0 z-50 mb-1 max-h-[240px] w-[220px] overflow-y-auto rounded-md border bg-popover shadow-lg py-1">
              {assignableUsers.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  No users available
                </div>
              ) : (
                assignableUsers.map((user) => {
                  const isSelected = pendingAssigneeIds.includes(user.id);
                  const initials = user.name
                    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                    : user.email.slice(0, 2).toUpperCase();

                  return (
                    <button
                      key={user.id}
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent',
                        isSelected && 'bg-purple-50 dark:bg-purple-500/20'
                      )}
                      onClick={() => {
                        if (isSelected) {
                          setPendingAssigneeIds((prev) => prev.filter((id) => id !== user.id));
                        } else {
                          setPendingAssigneeIds((prev) => [...prev, user.id]);
                        }
                      }}
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name ?? ''} />
                        <AvatarFallback className="bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 text-[8px]">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{user.name ?? user.email}</span>
                      {isSelected && <span className="ml-auto text-purple-600 dark:text-purple-400 text-xs">✓</span>}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Date picker */}
        <div ref={dateRef} className="relative">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => { closeAll(); setDateOpen(!dateOpen); }}
            className={cn(
              'gap-1 text-xs h-8 px-2',
              pendingDueDate !== undefined && 'border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-500/30 dark:text-amber-300 dark:bg-amber-500/20'
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {pendingDueDate
              ? format(new Date(pendingDueDate), 'MMM d')
              : pendingDueDate === null
              ? 'Clear date'
              : 'Date'}
          </Button>

          {dateOpen && (
            <div className="absolute bottom-full left-0 z-50 mb-1 w-auto rounded-md border bg-popover shadow-lg">
              <div className="py-1 border-b">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent text-muted-foreground"
                  onClick={() => {
                    setPendingDueDate(null);
                    setDateOpen(false);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                  Clear date
                </button>
                {getDateSuggestions().map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                    onClick={() => {
                      setPendingDueDate(format(s.date, 'yyyy-MM-dd'));
                      setDateOpen(false);
                    }}
                  >
                    <CalendarIcon className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    <span>{s.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground/70">{format(s.date, 'MMM d')}</span>
                  </button>
                ))}
              </div>
              <div className="p-2">
                <Calendar
                  mode="single"
                  selected={pendingDueDate ? new Date(pendingDueDate) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      setPendingDueDate(format(date, 'yyyy-MM-dd'));
                      setDateOpen(false);
                    }
                  }}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                />
              </div>
            </div>
          )}
        </div>

        {/* Status picker */}
        <div ref={statusRef} className="relative">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => { closeAll(); setStatusOpen(!statusOpen); }}
            className={cn(
              'gap-1 text-xs h-8 px-2',
              currentStatus && 'border-border'
            )}
          >
            {currentStatus ? (
              <>
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: currentStatus.color }}
                />
                {currentStatus.label}
              </>
            ) : (
              <>
                <CircleDot className="h-3.5 w-3.5" />
                Status
              </>
            )}
          </Button>

          {statusOpen && (
            <div className="absolute bottom-full left-0 z-50 mb-1 min-w-[140px] rounded-md border bg-popover shadow-lg py-1">
              {sortedStatuses.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent',
                    opt.id === pendingStatus && 'bg-accent/50 font-medium'
                  )}
                  onClick={() => {
                    setPendingStatus(opt.id);
                    setStatusOpen(false);
                  }}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: opt.color }}
                  />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-1 h-6 w-px bg-border" />

        {/* Duplicate */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={isDuplicating}
              className="gap-1 text-xs h-8 px-2"
            >
              <Copy className="h-3.5 w-3.5" />
              {isDuplicating ? 'Duplicating...' : 'Duplicate'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Duplicate {selectedCount} task{selectedCount === 1 ? '' : 's'}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will create {selectedCount === 1 ? 'a copy' : `${selectedCount} copies`} of the selected task{selectedCount === 1 ? '' : 's'} with the same details.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDuplicate}>Duplicate</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Divider */}
        <div className="mx-1 h-6 w-px bg-border" />

        {/* Count + Actions */}
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {selectedCount} selected
        </span>
        <Button variant="ghost" size="sm" onClick={onCancel} className="text-xs h-8">
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleApply}
          disabled={!hasEdits || isPending}
          className="text-xs h-8"
        >
          {isPending ? 'Applying...' : 'Apply Edits'}
        </Button>
      </div>
    </div>,
    document.body
  );
}
