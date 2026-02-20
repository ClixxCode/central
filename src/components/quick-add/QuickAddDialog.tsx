'use client';

import * as React from 'react';
import { useCallback, useState } from 'react';
import { format } from 'date-fns';
import { Building2, CalendarIcon, ChevronDown, CircleDot, LayoutGrid, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useClients } from '@/lib/hooks/useClients';
import { useBoard, usePersonalBoard } from '@/lib/hooks/useBoards';
import { useQuickAddCreateTask, useQuickAddUsers } from '@/lib/hooks/useQuickAdd';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useQuickActionsStore } from '@/lib/stores';
import { SmartTaskInput, type InputPill, type PasteItem } from './SmartTaskInput';
import { MultiLinePasteDialog } from './MultiLinePasteDialog';
import { cn } from '@/lib/utils';
import { getDateSuggestions } from '@/lib/utils/parse-natural-date';
import { useIgnoreWeekends } from '@/lib/hooks/useIgnoreWeekends';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { createTask as createTaskAction } from '@/lib/actions/tasks';
import { taskKeys } from '@/lib/hooks/useTasks';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  BoardSelection,
  UserSelection,
  DateSelection,
  StatusSelection,
} from './TriggerPopover';

interface QuickAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreatedAndEdit?: (taskId: string, boardPath: string) => void;
}

export function QuickAddDialog({ open, onOpenChange, onTaskCreatedAndEdit }: QuickAddDialogProps) {
  const ignoreWeekends = useIgnoreWeekends();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedBoard, setSelectedBoard] = useState<BoardSelection | null>(null);
  const [assignees, setAssignees] = useState<UserSelection[]>([]);
  const [dueDate, setDueDate] = useState<DateSelection | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pills, setPills] = useState<InputPill[]>([]);
  const [boardDropdownOpen, setBoardDropdownOpen] = useState(false);
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [sectionDropdownOpen, setSectionDropdownOpen] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [pasteItems, setPasteItems] = useState<PasteItem[] | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [isBatchCreating, setIsBatchCreating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ completed: number; total: number } | null>(null);
  const boardDropdownRef = React.useRef<HTMLDivElement>(null);
  const assigneeDropdownRef = React.useRef<HTMLDivElement>(null);
  const dateDropdownRef = React.useRef<HTMLDivElement>(null);
  const statusDropdownRef = React.useRef<HTMLDivElement>(null);
  const sectionDropdownRef = React.useRef<HTMLDivElement>(null);
  const addMenuRef = React.useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();
  const { data: clients } = useClients();
  const { data: personalBoard } = usePersonalBoard();
  const { user: currentUser } = useCurrentUser();
  const { data: boardData } = useBoard(selectedBoard?.boardId ?? '');
  const isPersonalBoard = selectedBoard?.boardId === personalBoard?.id;
  const { data: assignableUsers } = useQuickAddUsers(isPersonalBoard ? undefined : selectedBoard?.boardId);
  const createTask = useQuickAddCreateTask();
  const quickAddContext = useQuickActionsStore((s) => s.quickAddContext);

  // Apply prefilled context from store (e.g. column "Add task" button)
  const appliedContextRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!open || !quickAddContext || !clients) return;
    const contextKey = `${quickAddContext.boardId}:${quickAddContext.statusId}`;
    if (appliedContextRef.current === contextKey) return;
    appliedContextRef.current = contextKey;

    // Check if context matches the personal board
    if (personalBoard && quickAddContext.boardId === personalBoard.id) {
      const boardSel: BoardSelection = {
        boardId: personalBoard.id,
        boardName: personalBoard.name,
        clientId: 'personal',
        clientName: 'Personal',
      };
      setSelectedBoard(boardSel);
      setStatus(quickAddContext.statusId);
      setPills((prev) => {
        const filtered = prev.filter((p) => p.type !== 'board');
        return [
          ...filtered,
          { type: 'board', id: personalBoard.id, label: personalBoard.name, data: boardSel },
        ];
      });
    } else {
      // Find client + board names from clients data
      for (const client of clients) {
        const board = client.boards.find((b) => b.id === quickAddContext.boardId);
        if (board) {
          const boardSel: BoardSelection = {
            boardId: board.id,
            boardName: board.name,
            clientId: client.id,
            clientName: client.name,
          };
          setSelectedBoard(boardSel);
          setStatus(quickAddContext.statusId);
          setPills((prev) => {
            const filtered = prev.filter((p) => p.type !== 'board');
            return [
              ...filtered,
              { type: 'board', id: board.id, label: `${client.name} / ${board.name}`, data: boardSel },
            ];
          });
          break;
        }
      }
    }
  }, [open, quickAddContext, clients, personalBoard]);

  // Reset applied context ref when dialog closes
  React.useEffect(() => {
    if (!open) {
      appliedContextRef.current = null;
    }
  }, [open]);

  // Set default status when board data loads
  React.useEffect(() => {
    if (boardData?.statusOptions?.length && !status) {
      // Sort by position and pick the first
      const sorted = [...boardData.statusOptions].sort((a, b) => a.position - b.position);
      setStatus(sorted[0].id);
    }
  }, [boardData, status]);

  // Close dropdowns on outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (boardDropdownRef.current && !boardDropdownRef.current.contains(e.target as Node)) {
        setBoardDropdownOpen(false);
      }
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(e.target as Node)) {
        setAssigneeDropdownOpen(false);
      }
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setDateDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false);
      }
      if (sectionDropdownRef.current && !sectionDropdownRef.current.contains(e.target as Node)) {
        setSectionDropdownOpen(false);
      }
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false);
      }
    }
    const anyOpen = boardDropdownOpen || assigneeDropdownOpen || dateDropdownOpen || statusDropdownOpen || sectionDropdownOpen || addMenuOpen;
    if (anyOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [boardDropdownOpen, assigneeDropdownOpen, dateDropdownOpen, statusDropdownOpen, sectionDropdownOpen, addMenuOpen]);

  const resetForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setSelectedBoard(null);
    setAssignees([]);
    setDueDate(null);
    setStatus(null);
    setSection(null);
    setPills([]);
    setPasteItems(null);
    setAddMenuOpen(false);
    setIsBatchCreating(false);
    setBatchProgress(null);
  }, []);

  const handleClose = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        resetForm();
      }
      onOpenChange(isOpen);
    },
    [onOpenChange, resetForm]
  );

  const handleBoardSelect = useCallback((board: BoardSelection) => {
    setSelectedBoard(board);
    setStatus(null); // Reset status to pick default from new board
    setSection(null); // Reset section for new board
    // Clear assignees when switching to personal board
    if (board.boardId === personalBoard?.id) {
      setAssignees([]);
      setPills((prev) => prev.filter((p) => p.type !== 'board' && p.type !== 'assignee' && p.type !== 'section'));
    } else {
      setPills((prev) => prev.filter((p) => p.type !== 'board' && p.type !== 'section'));
    }
    setPills((prev) => [
      ...prev,
      { type: 'board', id: board.boardId, label: `${board.clientName} / ${board.boardName}`, data: board },
    ]);
  }, [personalBoard?.id]);

  const handleUserSelect = useCallback((user: UserSelection) => {
    setAssignees((prev) => {
      if (prev.some((a) => a.id === user.id)) return prev;
      return [...prev, user];
    });
    setPills((prev) => {
      if (prev.some((p) => p.type === 'assignee' && p.id === user.id)) return prev;
      return [
        ...prev,
        { type: 'assignee', id: user.id, label: user.name ?? user.email, data: user },
      ];
    });
  }, []);

  const handleDateSelect = useCallback((date: DateSelection) => {
    setDueDate(date);
    setPills((prev) => {
      const filtered = prev.filter((p) => p.type !== 'date');
      return [...filtered, { type: 'date', id: 'due-date', label: date.label, data: date }];
    });
  }, []);

  const handleBoardRemove = useCallback(() => {
    setSelectedBoard(null);
    setStatus(null);
    setPills((prev) => prev.filter((p) => p.type !== 'board'));
  }, []);

  const handleUserRemove = useCallback((userId: string) => {
    setAssignees((prev) => prev.filter((a) => a.id !== userId));
    setPills((prev) => prev.filter((p) => !(p.type === 'assignee' && p.id === userId)));
  }, []);

  const handleDateRemove = useCallback(() => {
    setDueDate(null);
    setPills((prev) => prev.filter((p) => p.type !== 'date'));
  }, []);

  const handleStatusSelect = useCallback((statusSel: StatusSelection) => {
    setStatus(statusSel.id);
    setPills((prev) => {
      const filtered = prev.filter((p) => p.type !== 'status');
      return [...filtered, { type: 'status' as const, id: statusSel.id, label: statusSel.label, data: statusSel }];
    });
  }, []);

  const handleStatusRemove = useCallback(() => {
    setStatus(null);
    setPills((prev) => prev.filter((p) => p.type !== 'status'));
  }, []);

  const handleSectionSelect = useCallback((sectionSel: { id: string; label: string; color: string }) => {
    setSection(sectionSel.id);
    setPills((prev) => {
      const filtered = prev.filter((p) => p.type !== 'section');
      return [...filtered, { type: 'section' as const, id: sectionSel.id, label: sectionSel.label, data: sectionSel }];
    });
  }, []);

  const handleSectionRemove = useCallback(() => {
    setSection(null);
    setPills((prev) => prev.filter((p) => p.type !== 'section'));
  }, []);

  const handleBoardFromDropdown = useCallback(
    (board: BoardSelection) => {
      handleBoardSelect(board);
      setBoardDropdownOpen(false);
    },
    [handleBoardSelect]
  );

  const handleSubmit = useCallback(async (openAfter = false) => {
    if (!selectedBoard || !title.trim()) return;

    const statusToUse = status ?? boardData?.statusOptions?.[0]?.id ?? 'todo';

    // Auto-assign current user for personal board
    const assigneeIds = isPersonalBoard && currentUser
      ? [currentUser.id]
      : assignees.map((a) => a.id);

    createTask.mutate(
      {
        boardId: selectedBoard.boardId,
        title: title.trim(),
        status: statusToUse,
        section: section ?? undefined,
        assigneeIds,
        dueDate: dueDate ? format(dueDate.date, 'yyyy-MM-dd') : undefined,
        descriptionJson: description.trim()
          ? JSON.stringify({
              type: 'doc',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: description.trim() }] }],
            })
          : undefined,
      },
      {
        onSuccess: (task) => {
          if (openAfter && onTaskCreatedAndEdit) {
            // Find client slug for URL
            const client = clients?.find((c) => c.id === selectedBoard.clientId);
            const boardPath = client
              ? `/clients/${client.slug}/boards/${selectedBoard.boardId}`
              : `/my-tasks`;
            onTaskCreatedAndEdit(task.id, boardPath);
          }
          resetForm();
          onOpenChange(false);
        },
      }
    );
  }, [selectedBoard, title, status, section, boardData, assignees, dueDate, description, createTask, resetForm, onOpenChange, isPersonalBoard, currentUser, onTaskCreatedAndEdit, clients]);

  const handleBatchCreate = useCallback(async () => {
    if (!pasteItems || !selectedBoard) return;

    const MAX_LINES = 50;
    const items = pasteItems.slice(0, MAX_LINES);
    const statusToUse = status ?? boardData?.statusOptions?.[0]?.id ?? 'todo';
    const assigneeIdList = isPersonalBoard && currentUser
      ? [currentUser.id]
      : assignees.map((a) => a.id);
    const dueDateStr = dueDate ? format(dueDate.date, 'yyyy-MM-dd') : undefined;

    setIsBatchCreating(true);
    setBatchProgress({ completed: 0, total: items.length });

    let successCount = 0;
    let failCount = 0;
    let lastParentTaskId: string | null = null;

    for (const item of items) {
      const result = await createTaskAction({
        boardId: selectedBoard.boardId,
        title: item.title,
        status: statusToUse,
        section: section ?? undefined,
        assigneeIds: assigneeIdList,
        dueDate: dueDateStr,
        ...(item.isSubtask && lastParentTaskId ? { parentTaskId: lastParentTaskId } : {}),
      });

      if (result.success) {
        successCount++;
        if (!item.isSubtask && result.task) {
          lastParentTaskId = result.task.id;
        }
      } else {
        failCount++;
        if (!item.isSubtask) {
          lastParentTaskId = null;
        }
      }

      setBatchProgress({ completed: successCount + failCount, total: items.length });
    }

    await queryClient.invalidateQueries({ queryKey: taskKeys.lists() });

    const subtaskCount = items.filter((i) => i.isSubtask).length;
    if (failCount === 0) {
      toast.success(
        subtaskCount > 0
          ? `Created ${successCount - subtaskCount} tasks and ${subtaskCount} subtasks`
          : `Created ${successCount} tasks`
      );
    } else {
      toast.warning(`Created ${successCount} tasks, ${failCount} failed`);
    }

    resetForm();
    onOpenChange(false);
  }, [pasteItems, selectedBoard, status, boardData, assignees, dueDate, queryClient, resetForm, onOpenChange, isPersonalBoard, currentUser]);

  const canSubmit = !!selectedBoard && !!title.trim() && !createTask.isPending;

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="gap-3 overflow-visible" style={{ maxWidth: '48vw', minWidth: '360px' }} showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-base">Quick Add Task</DialogTitle>
        </DialogHeader>

        {/* Task name input with smart triggers */}
        <SmartTaskInput
          onTitleChange={setTitle}
          onBoardSelect={handleBoardSelect}
          onUserSelect={handleUserSelect}
          onDateSelect={handleDateSelect}
          onStatusSelect={handleStatusSelect}
          onSectionSelect={handleSectionSelect}
          onBoardRemove={handleBoardRemove}
          onUserRemove={handleUserRemove}
          onDateRemove={handleDateRemove}
          onStatusRemove={handleStatusRemove}
          onSectionRemove={handleSectionRemove}
          onSubmit={handleSubmit}
          onMultiLinePaste={setPasteItems}
          hasBoardSelected={!!selectedBoard}
          selectedBoardId={selectedBoard?.boardId}
          statusOptions={boardData?.statusOptions}
          sectionOptions={boardData?.sectionOptions}
          pills={pills}
          autoFocus={open}
        />

        {/* Description */}
        <textarea
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-none"
          placeholder="Description (optional)"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />

        {/* Footer: option dropdowns + actions */}
        <DialogFooter className="!flex-row !justify-start items-center gap-1 flex-wrap">
          {/* Option dropdowns */}
            {/* Board selector */}
            <div ref={boardDropdownRef} className="relative">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => {
                  setBoardDropdownOpen(!boardDropdownOpen);
                  setAssigneeDropdownOpen(false);
                  setDateDropdownOpen(false);
                  setStatusDropdownOpen(false);
                  setSectionDropdownOpen(false);
                }}
                className={cn(
                  'gap-1 text-xs h-8 px-2',
                  selectedBoard && 'border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-500/30 dark:text-blue-300 dark:bg-blue-500/20'
                )}
              >
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate max-w-[180px]">
                  {selectedBoard
                    ? selectedBoard.boardName
                    : 'Board'}
                </span>
              </Button>

              {boardDropdownOpen && clients && (
                <div className="absolute top-full left-0 z-50 mt-1 max-h-[240px] w-[240px] overflow-y-auto rounded-md border bg-popover shadow-lg py-1">
                  {/* Personal board */}
                  {personalBoard && (
                    <>
                      <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider truncate">
                        Personal
                      </div>
                      <button
                        type="button"
                        className={cn(
                          'flex w-full items-center gap-2 px-4 py-1.5 text-sm hover:bg-accent truncate',
                          selectedBoard?.boardId === personalBoard.id && 'bg-accent/50 font-medium'
                        )}
                        onClick={() =>
                          handleBoardFromDropdown({
                            boardId: personalBoard.id,
                            boardName: personalBoard.name,
                            clientId: '',
                            clientName: 'Personal',
                          })
                        }
                      >
                        <span className="truncate">{personalBoard.name}</span>
                      </button>
                    </>
                  )}
                  {clients.map((client) => (
                    <React.Fragment key={client.id}>
                      {client.boards.filter((b) => b.type === 'standard').length > 0 && (
                        <>
                          <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider truncate">
                            {client.name}
                          </div>
                          {client.boards
                            .filter((b) => b.type === 'standard')
                            .map((board) => (
                              <button
                                key={board.id}
                                type="button"
                                className={cn(
                                  'flex w-full items-center gap-2 px-4 py-1.5 text-sm hover:bg-accent',
                                  selectedBoard?.boardId === board.id && 'bg-accent/50 font-medium'
                                )}
                                onClick={() =>
                                  handleBoardFromDropdown({
                                    boardId: board.id,
                                    boardName: board.name,
                                    clientId: client.id,
                                    clientName: client.name,
                                  })
                                }
                              >
                                <span className="truncate">{board.name}</span>
                              </button>
                            ))}
                        </>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>

            {/* Assignee selector - hidden for personal board */}
            {!isPersonalBoard && <div ref={assigneeDropdownRef} className="relative">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => {
                  setAssigneeDropdownOpen(!assigneeDropdownOpen);
                  setBoardDropdownOpen(false);
                  setDateDropdownOpen(false);
                  setStatusDropdownOpen(false);
                  setSectionDropdownOpen(false);
                }}
                className={cn(
                  'gap-1 text-xs h-8 px-2',
                  assignees.length > 0 && 'border-purple-300 text-purple-700 bg-purple-50 dark:border-purple-500/30 dark:text-purple-300 dark:bg-purple-500/20'
                )}
              >
                <User className="h-3.5 w-3.5" />
                {assignees.length > 0
                  ? `${assignees.length} assigned`
                  : 'Assignee'}
              </Button>

              {assigneeDropdownOpen && (
                <div className="absolute bottom-full left-0 z-50 mb-1 max-h-[240px] w-[220px] overflow-y-auto rounded-md border bg-popover shadow-lg py-1">
                  {!assignableUsers || assignableUsers.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      {selectedBoard ? 'No users available' : 'Select a board first'}
                    </div>
                  ) : (
                    assignableUsers.map((user) => {
                      const isSelected = assignees.some((a) => a.id === user.id);
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
                              handleUserRemove(user.id);
                            } else {
                              handleUserSelect({
                                id: user.id,
                                name: user.name,
                                email: user.email,
                                avatarUrl: user.avatarUrl ?? null,
                              });
                            }
                          }}
                        >
                          <Avatar size="sm" className="h-5 w-5">
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
            </div>}

            {/* Date selector */}
            <div ref={dateDropdownRef} className="relative">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => {
                  setDateDropdownOpen(!dateDropdownOpen);
                  setBoardDropdownOpen(false);
                  setAssigneeDropdownOpen(false);
                  setStatusDropdownOpen(false);
                  setSectionDropdownOpen(false);
                }}
                className={cn(
                  'gap-1 text-xs h-8 px-2',
                  dueDate && 'border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-500/30 dark:text-amber-300 dark:bg-amber-500/20'
                )}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {dueDate ? dueDate.label : 'Date'}
              </Button>

              {dateDropdownOpen && (
                <div className="absolute bottom-full left-0 z-50 mb-1 w-auto rounded-md border bg-popover shadow-lg">
                  {/* Quick date suggestions */}
                  <div className="py-1 border-b">
                    {getDateSuggestions(ignoreWeekends).map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                        onClick={() => {
                          handleDateSelect({ date: s.date, label: s.label });
                          setDateDropdownOpen(false);
                        }}
                      >
                        <CalendarIcon className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        <span>{s.label}</span>
                        <span className="ml-auto text-xs text-muted-foreground/70">{format(s.date, 'MMM d')}</span>
                      </button>
                    ))}
                  </div>
                  {/* Calendar */}
                  <div className="p-2">
                    <Calendar
                      mode="single"
                      selected={dueDate?.date}
                      onSelect={(date) => {
                        if (date) {
                          handleDateSelect({ date, label: format(date, 'MMM d, yyyy') });
                          setDateDropdownOpen(false);
                        }
                      }}
                      month={calendarMonth}
                      onMonthChange={setCalendarMonth}
                      hideWeekends={ignoreWeekends}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Status selector */}
            <div ref={statusDropdownRef} className="relative">
              {(() => {
                const currentStatus = boardData?.statusOptions?.find((s) => s.id === status);
                return (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => {
                        setStatusDropdownOpen(!statusDropdownOpen);
                        setBoardDropdownOpen(false);
                        setAssigneeDropdownOpen(false);
                        setDateDropdownOpen(false);
                        setSectionDropdownOpen(false);
                      }}
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

                    {statusDropdownOpen && boardData?.statusOptions && (
                      <div className="absolute bottom-full left-0 z-50 mb-1 min-w-[140px] rounded-md border bg-popover shadow-lg py-1">
                        {[...boardData.statusOptions]
                          .sort((a, b) => a.position - b.position)
                          .map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              className={cn(
                                'flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent',
                                opt.id === status && 'bg-accent/50 font-medium'
                              )}
                              onClick={() => {
                                handleStatusSelect({ id: opt.id, label: opt.label, color: opt.color });
                                setStatusDropdownOpen(false);
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
                  </>
                );
              })()}
            </div>
            {/* Section selector - only if board has sections */}
            {boardData?.sectionOptions && boardData.sectionOptions.length > 0 && (
              <div ref={sectionDropdownRef} className="relative">
                {(() => {
                  const currentSection = boardData.sectionOptions.find((s) => s.id === section);
                  return (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => {
                          setSectionDropdownOpen(!sectionDropdownOpen);
                          setBoardDropdownOpen(false);
                          setAssigneeDropdownOpen(false);
                          setDateDropdownOpen(false);
                          setStatusDropdownOpen(false);
                        }}
                        className={cn(
                          'gap-1 text-xs h-8 px-2',
                          currentSection && 'border-border'
                        )}
                        style={currentSection?.color ? {
                          borderColor: currentSection.color + '40',
                          color: currentSection.color,
                          backgroundColor: currentSection.color + '14',
                        } : undefined}
                      >
                        {currentSection ? (
                          <>
                            <span
                              className="h-2.5 w-2.5 rounded-sm"
                              style={{ backgroundColor: currentSection.color }}
                            />
                            {currentSection.label}
                          </>
                        ) : (
                          <>
                            <LayoutGrid className="h-3.5 w-3.5" />
                            Section
                          </>
                        )}
                      </Button>

                      {sectionDropdownOpen && (
                        <div className="absolute bottom-full left-0 z-50 mb-1 min-w-[200px] max-h-[300px] overflow-y-auto rounded-md border bg-popover shadow-lg py-1">
                          <button
                            type="button"
                            className={cn(
                              'flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent',
                              !section && 'bg-accent/50 font-medium'
                            )}
                            onClick={() => {
                              setSection(null);
                              setSectionDropdownOpen(false);
                            }}
                          >
                            <span className="text-muted-foreground">None</span>
                          </button>
                          {[...boardData.sectionOptions]
                            .sort((a, b) => a.position - b.position)
                            .map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                className={cn(
                                  'flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent',
                                  opt.id === section && 'bg-accent/50 font-medium'
                                )}
                                onClick={() => {
                                  setSection(opt.id);
                                  setSectionDropdownOpen(false);
                                }}
                              >
                                <span
                                  className="h-2.5 w-2.5 rounded-sm"
                                  style={{ backgroundColor: opt.color }}
                                />
                                <span>{opt.label}</span>
                              </button>
                            ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

          <div className="flex items-center gap-2 ml-auto">
            <Button variant="ghost" size="sm" type="button" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <div ref={addMenuRef} className="flex items-center relative">
              <Button
                size="sm"
                type="button"
                disabled={!canSubmit}
                onClick={() => handleSubmit(false)}
                className={cn(onTaskCreatedAndEdit && 'rounded-r-none border-r-0')}
              >
                {createTask.isPending ? 'Adding...' : 'Add task'}
              </Button>
              {onTaskCreatedAndEdit && (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    type="button"
                    disabled={!canSubmit}
                    onClick={() => setAddMenuOpen(!addMenuOpen)}
                    className="rounded-l-none px-1.5 border-l border-primary-foreground/20"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  {addMenuOpen && (
                    <div className="absolute bottom-full right-0 mb-1 min-w-[140px] rounded-md border bg-popover shadow-lg py-1 z-50">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                        onClick={() => {
                          setAddMenuOpen(false);
                          handleSubmit(true);
                        }}
                      >
                        Add &amp; open
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

      <MultiLinePasteDialog
        open={!!pasteItems}
        onOpenChange={(open) => {
          if (!open) setPasteItems(null);
        }}
        items={pasteItems ?? []}
        onConfirm={handleBatchCreate}
        isCreating={isBatchCreating}
        progress={batchProgress}
      />
    </>
  );
}
