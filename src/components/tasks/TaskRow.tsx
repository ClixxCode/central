'use client';

import * as React from 'react';
import { MoreHorizontal, Trash2, ExternalLink, Repeat, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusSelect } from './StatusSelect';
import { SectionSelect } from './SectionSelect';
import { AssigneePicker, AssigneeAvatars, type AssigneeUser } from './AssigneePicker';
import { TaskDatePicker, DateDisplay } from './DatePicker';
import { RecurringIndicator } from './RecurringPicker';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getRecurrenceDescription } from '@/lib/utils/recurring';
import { CompleteParentDialog } from './CompleteParentDialog';
import { DeleteTaskDialog } from './DeleteTaskDialog';
import { isCompleteStatus } from '@/lib/utils/status';
import type { TaskWithAssignees, UpdateTaskInput } from '@/lib/actions/tasks';
import type { StatusOption, SectionOption } from '@/lib/db/schema';

type DateFlexibility = 'not_set' | 'flexible' | 'semi_flexible' | 'not_flexible';

interface TaskRowProps {
  task: TaskWithAssignees;
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
  assignableUsers: AssigneeUser[];
  onUpdate: (input: UpdateTaskInput) => void;
  onDelete: (taskId: string) => void;
  onOpenModal?: (taskId: string) => void;
  isUpdating?: boolean;
  onToggleSubtasks?: () => void;
  isExpanded?: boolean;
  isSubtask?: boolean;
  isSelected?: boolean;
  isMultiSelectMode?: boolean;
  onMultiSelectClick?: (e: React.MouseEvent) => void;
  columns: {
    title: boolean;
    status: boolean;
    section: boolean;
    assignees: boolean;
    dueDate: boolean;
  };
}

export function TaskRow({
  task,
  statusOptions,
  sectionOptions,
  assignableUsers,
  onUpdate,
  onDelete,
  onOpenModal,
  isUpdating = false,
  onToggleSubtasks,
  isExpanded,
  isSubtask,
  isSelected,
  isMultiSelectMode,
  onMultiSelectClick,
  columns,
}: TaskRowProps) {
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [editedTitle, setEditedTitle] = React.useState(task.title);
  const [completeParentOpen, setCompleteParentOpen] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [pendingStatus, setPendingStatus] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const clickTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when entering edit mode
  React.useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingTitle]);

  // Reset edited title when task changes
  React.useEffect(() => {
    setEditedTitle(task.title);
  }, [task.title]);

  const handleTitleSubmit = () => {
    const trimmedTitle = editedTitle.trim();
    if (trimmedTitle && trimmedTitle !== task.title) {
      onUpdate({ id: task.id, title: trimmedTitle });
    } else {
      setEditedTitle(task.title);
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setEditedTitle(task.title);
      setIsEditingTitle(false);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    // Check if completing a parent task with incomplete subtasks
    const hasIncompleteSubtasks =
      !task.parentTaskId &&
      task.subtaskCount > 0 &&
      task.subtaskCompletedCount < task.subtaskCount;
    const movingToComplete = isCompleteStatus(newStatus, statusOptions);
    const wasNotComplete = !isCompleteStatus(task.status, statusOptions);

    if (hasIncompleteSubtasks && movingToComplete && wasNotComplete) {
      setPendingStatus(newStatus);
      setCompleteParentOpen(true);
      return;
    }

    onUpdate({ id: task.id, status: newStatus });
  };

  const handleSectionChange = (section: string | null) => {
    onUpdate({ id: task.id, section });
  };

  const handleAssigneesChange = (assigneeIds: string[]) => {
    onUpdate({ id: task.id, assigneeIds });
  };

  const handleDateChange = (dueDate: string | null) => {
    onUpdate({ id: task.id, dueDate });
  };

  const handleFlexibilityChange = (dateFlexibility: DateFlexibility) => {
    onUpdate({ id: task.id, dateFlexibility });
  };

  return (
    <>
    <CompleteParentDialog
      open={completeParentOpen}
      onOpenChange={(open) => {
        if (!open) {
          setCompleteParentOpen(false);
          setPendingStatus(null);
        }
      }}
      incompleteCount={task.subtaskCount - task.subtaskCompletedCount}
      onConfirm={(completeSubtasks) => {
        if (pendingStatus) {
          onUpdate({ id: task.id, status: pendingStatus, completeSubtasks });
          setPendingStatus(null);
        }
      }}
    />
    <tr
      className={cn(
        'group border-b transition-colors',
        'hover:bg-muted/50',
        isUpdating && 'opacity-50',
        isSelected && 'bg-primary/10 hover:bg-primary/15'
      )}
      onClick={(e) => {
        if (isMultiSelectMode || e.shiftKey) {
          // Only handle selection from title cell clicks, not from interactive controls
          const target = e.target as HTMLElement;
          if (target.closest('[data-task-title-cell]')) {
            onMultiSelectClick?.(e);
          }
        }
      }}
    >
      {/* Title Column */}
      {columns.title && (
        <td className="px-3 py-2" data-task-title-cell>
          <div className={cn('flex items-center gap-1.5', isSubtask && 'pl-6')}>
            {task.subtaskCount > 0 && onToggleSubtasks && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSubtasks();
                }}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </button>
            )}
            {task.recurringConfig && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="shrink-0">
                    <RecurringIndicator />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {getRecurrenceDescription(task.recurringConfig)}
                </TooltipContent>
              </Tooltip>
            )}
            {isEditingTitle ? (
              <Input
                ref={inputRef}
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={handleTitleKeyDown}
                className="h-7 text-sm flex-1"
              />
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  // In multi-select mode, let the row onClick handle it
                  if (isMultiSelectMode || e.shiftKey) return;
                  // Cancel any existing timeout first
                  if (clickTimeoutRef.current) {
                    clearTimeout(clickTimeoutRef.current);
                  }
                  // Use timeout to distinguish single click from double click
                  clickTimeoutRef.current = setTimeout(() => {
                    clickTimeoutRef.current = null;
                    onOpenModal?.(task.id);
                  }, 250);
                }}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  // Cancel the single click timeout
                  if (clickTimeoutRef.current) {
                    clearTimeout(clickTimeoutRef.current);
                    clickTimeoutRef.current = null;
                  }
                  setIsEditingTitle(true);
                }}
                className="flex-1 text-left text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
              >
                {task.title}
              </button>
            )}
          </div>
        </td>
      )}

      {/* Status Column */}
      {columns.status && (
        <td className="px-3 py-2">
          <StatusSelect
            value={task.status}
            onChange={handleStatusChange}
            options={statusOptions}
            size="sm"
          />
        </td>
      )}

      {/* Section Column */}
      {columns.section && (
        <td className="px-3 py-2">
          <SectionSelect
            value={task.section}
            onChange={handleSectionChange}
            options={sectionOptions}
          />
        </td>
      )}

      {/* Assignees Column */}
      {columns.assignees && (
        <td className="px-3 py-2">
          <AssigneePicker
            value={task.assignees.map((a) => a.id)}
            onChange={handleAssigneesChange}
            users={assignableUsers}
          />
        </td>
      )}

      {/* Due Date Column */}
      {columns.dueDate && (
        <td className="px-3 py-2">
          <TaskDatePicker
            date={task.dueDate}
            onDateChange={handleDateChange}
            flexibility={task.dateFlexibility}
            onFlexibilityChange={handleFlexibilityChange}
          />
        </td>
      )}

      {/* Actions Column */}
      <td className="px-3 py-2 w-12">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            >
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onOpenModal && (
              <DropdownMenuItem onClick={() => onOpenModal(task.id)}>
                <ExternalLink className="mr-2 size-4" />
                Open details
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setDeleteConfirmOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 size-4" />
              Delete task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DeleteTaskDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          onConfirm={() => onDelete(task.id)}
          isSubtask={isSubtask}
        />
      </td>
    </tr>
    </>
  );
}

interface TaskRowSkeletonProps {
  columns: {
    title: boolean;
    status: boolean;
    section: boolean;
    assignees: boolean;
    dueDate: boolean;
  };
}

export function TaskRowSkeleton({ columns }: TaskRowSkeletonProps) {
  const columnCount = Object.values(columns).filter(Boolean).length + 1; // +1 for actions

  return (
    <tr className="border-b">
      {columns.title && (
        <td className="px-3 py-2">
          <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        </td>
      )}
      {columns.status && (
        <td className="px-3 py-2">
          <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
        </td>
      )}
      {columns.section && (
        <td className="px-3 py-2">
          <div className="h-5 w-16 animate-pulse rounded bg-muted" />
        </td>
      )}
      {columns.assignees && (
        <td className="px-3 py-2">
          <div className="h-6 w-6 animate-pulse rounded-full bg-muted" />
        </td>
      )}
      {columns.dueDate && (
        <td className="px-3 py-2">
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        </td>
      )}
      <td className="px-3 py-2 w-12">
        <div className="h-7 w-7 animate-pulse rounded bg-muted" />
      </td>
    </tr>
  );
}
