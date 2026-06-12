'use client';

import * as React from 'react';
import { Calendar, CircleCheck, CircleDot, Loader2, Lock, CornerDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSubtasks } from '@/lib/hooks/useTasks';
import { Badge } from '@/components/ui/badge';
import { AssigneeAvatars } from './AssigneePicker';
import { DateDisplay } from './DatePicker';
import { TaskActivityIndicators } from './TaskActivityIndicators';
import type { StatusOption, SectionOption } from '@/lib/db/schema';

interface ExpandedSubtasksProps {
  parentTaskId: string;
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
  onTaskClick?: (taskId: string) => void;
  hiddenItems?: Set<string>;
  dependenciesEnabled?: boolean;
  subtaskOnlyParentId?: string | null;
}

export function ExpandedSubtasks({
  parentTaskId,
  statusOptions,
  sectionOptions,
  onTaskClick,
  hiddenItems,
  dependenciesEnabled = false,
  subtaskOnlyParentId,
}: ExpandedSubtasksProps) {
  const { data: subtasks, isLoading } = useSubtasks(parentTaskId);

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

  if (isLoading) {
    return (
      <div className="ml-4 flex items-center gap-2 text-xs text-muted-foreground p-2">
        <Loader2 className="size-3 animate-spin" />
        Loading subtasks...
      </div>
    );
  }

  if (!subtasks || subtasks.length === 0) return null;

  const activeSubtaskId = dependenciesEnabled
    ? subtasks.find((subtask) => !completeStatusIds.includes(subtask.status))?.id ?? null
    : null;

  return (
    <>
      {subtasks.map((subtask) => {
        const status = statusOptions.find((s) => s.id === subtask.status);
        const section = sectionOptions.find((s) => s.id === subtask.section);
        const dependencyState = !dependenciesEnabled
          ? null
          : completeStatusIds.includes(subtask.status)
            ? 'complete'
            : subtask.id === activeSubtaskId
              ? 'active'
              : 'waiting';
        const isFadedBySubtaskOnlyMode =
          !!subtaskOnlyParentId && subtask.parentTaskId !== subtaskOnlyParentId;

        return (
          <div
            key={subtask.id}
            className={cn(
              'flex gap-2 transition-opacity',
              isFadedBySubtaskOnlyMode && 'pointer-events-none opacity-25'
            )}
            aria-disabled={isFadedBySubtaskOnlyMode || undefined}
          >
            {/* Nesting indicator */}
            <div className="flex items-start pt-3.5 pl-1 shrink-0">
              <CornerDownRight className="size-3.5 text-muted-foreground/50" />
            </div>

            {/* Card — same structure as KanbanTaskCard */}
            <div
              role="button"
              tabIndex={0}
              className={cn(
                'flex-1 rounded-lg border bg-background p-3 shadow-sm transition-all',
                'hover:border-primary/50 hover:shadow-md cursor-pointer',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                dependencyState === 'active' && 'border-primary/50 bg-primary/5',
                dependencyState === 'waiting' && 'border-dashed bg-muted/40 opacity-75'
              )}
              onClick={() => onTaskClick?.(subtask.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onTaskClick?.(subtask.id);
                }
              }}
            >
              {/* Section Badge */}
              {!hiddenItems?.has('section') && section && (
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
              <div className="flex min-w-0 items-center gap-2">
                <p className="min-w-0 flex-1 font-medium text-sm leading-tight">{subtask.title}</p>
                {dependencyState === 'active' && (
                  <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px]">
                    <CircleDot className="size-3" />
                    Active
                  </Badge>
                )}
                {dependencyState === 'waiting' && (
                  <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px] text-muted-foreground">
                    <Lock className="size-3" />
                    Waiting
                  </Badge>
                )}
                {dependencyState === 'complete' && (
                  <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px] text-muted-foreground">
                    <CircleCheck className="size-3" />
                    Done
                  </Badge>
                )}
              </div>

              {/* Meta Row — always visible with status badge */}
              <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
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
                  {!hiddenItems?.has('dueDate') && subtask.dueDate && (
                    <div className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      <DateDisplay
                        date={subtask.dueDate}
                        flexibility={subtask.dateFlexibility}
                      />
                    </div>
                  )}
                </div>

                {/* Activity indicators and Assignees */}
                <div className="flex items-center gap-2">
                  <TaskActivityIndicators
                    commentCount={subtask.commentCount}
                    attachmentCount={subtask.attachmentCount}
                    hasNewComments={subtask.hasNewComments}
                  />
                  {!hiddenItems?.has('assignees') && subtask.assignees.length > 0 && (
                    <AssigneeAvatars
                      assignees={subtask.assignees}
                      maxDisplay={2}
                      size="sm"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
