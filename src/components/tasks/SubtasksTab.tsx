'use client';

import * as React from 'react';
import { Plus, Trash2, Loader2, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AssigneeAvatars } from './AssigneePicker';
import { DateDisplay } from './DatePicker';
import { TaskActivityIndicators } from './TaskActivityIndicators';
import { useSubtasks, useCreateSubtask, useDeleteTask } from '@/lib/hooks/useTasks';
import { DeleteTaskDialog } from './DeleteTaskDialog';
import type { StatusOption, SectionOption } from '@/lib/db/schema';

interface SubtasksTabProps {
  parentTaskId: string;
  boardId: string;
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
  onOpenSubtask?: (taskId: string) => void;
}

export function SubtasksTab({
  parentTaskId,
  boardId,
  statusOptions,
  sectionOptions,
  onOpenSubtask,
}: SubtasksTabProps) {
  const { data: subtasks, isLoading } = useSubtasks(parentTaskId);
  const createSubtask = useCreateSubtask(parentTaskId, boardId);
  const deleteTask = useDeleteTask();

  const [newTitle, setNewTitle] = React.useState('');
  const [deleteSubtaskId, setDeleteSubtaskId] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const completeStatusIds = React.useMemo(
    () =>
      statusOptions
        .filter(
          (s) =>
            s.id === 'complete' ||
            s.id === 'done' ||
            s.label.toLowerCase().includes('complete') ||
            s.label.toLowerCase().includes('done')
        )
        .map((s) => s.id),
    [statusOptions]
  );

  const completedCount = subtasks?.filter((s) => completeStatusIds.includes(s.status)).length ?? 0;

  const totalCount = subtasks?.length ?? 0;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleAdd = () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    createSubtask.mutate(
      {
        title: trimmed,
        status: statusOptions[0]?.id ?? '',
      },
      {
        onSuccess: () => {
          setNewTitle('');
          inputRef.current?.focus();
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{completedCount}/{totalCount} completed</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Subtask cards */}
      {subtasks && subtasks.length > 0 && (
        <div className="space-y-2">
          {subtasks.map((subtask) => {
            const status = statusOptions.find((s) => s.id === subtask.status);
            const section = sectionOptions.find((s) => s.id === subtask.section);

            return (
              <div
                key={subtask.id}
                role="button"
                tabIndex={0}
                className={cn(
                  'group relative rounded-lg border bg-background p-3 transition-all',
                  'hover:border-primary/50 hover:shadow-sm cursor-pointer',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
                onClick={() => onOpenSubtask?.(subtask.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenSubtask?.(subtask.id);
                  }
                }}
              >
                {/* Delete button - top right on hover */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-1.5 right-1.5 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteSubtaskId(subtask.id);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>

                {/* Section Badge */}
                {section && (
                  <span
                    className="mb-2 inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: `${section.color}20`,
                      color: section.color,
                    }}
                  >
                    {section.label}
                  </span>
                )}

                {/* Title */}
                <p className="font-medium text-sm leading-tight pr-6">{subtask.title}</p>

                {/* Meta Row */}
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {/* Status badge */}
                    {status && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: status.color }}
                      >
                        {status.label}
                      </span>
                    )}

                    {/* Due Date */}
                    {subtask.dueDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        <DateDisplay
                          date={subtask.dueDate}
                          flexibility={subtask.dateFlexibility}
                        />
                      </div>
                    )}
                  </div>

                  {/* Right side: activity indicators + assignees */}
                  <div className="flex items-center gap-2">
                    <TaskActivityIndicators
                      commentCount={subtask.commentCount}
                      attachmentCount={subtask.attachmentCount}
                      hasNewComments={subtask.hasNewComments}
                    />
                    {subtask.assignees.length > 0 && (
                      <AssigneeAvatars
                        assignees={subtask.assignees}
                        maxDisplay={3}
                        size="sm"
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Always-visible add subtask input */}
      <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2">
        <Plus className="size-4 shrink-0 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a subtask..."
          className="h-7 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
        />
        {newTitle.trim() && (
          <Button
            size="sm"
            className="h-7 px-3"
            onClick={handleAdd}
            disabled={createSubtask.isPending}
          >
            {createSubtask.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              'Add'
            )}
          </Button>
        )}
      </div>

      {/* Empty state hint */}
      {(!subtasks || subtasks.length === 0) && (
        <p className="text-center text-xs text-muted-foreground py-4">
          Break this task into smaller pieces. Click a subtask to open its full details.
        </p>
      )}

      <DeleteTaskDialog
        open={deleteSubtaskId !== null}
        onOpenChange={(open) => { if (!open) setDeleteSubtaskId(null); }}
        onConfirm={() => {
          if (deleteSubtaskId) deleteTask.mutate(deleteSubtaskId);
          setDeleteSubtaskId(null);
        }}
        isSubtask
      />
    </div>
  );
}
