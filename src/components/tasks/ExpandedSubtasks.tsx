'use client';

import * as React from 'react';
import { Calendar, Loader2, CornerDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSubtasks } from '@/lib/hooks/useTasks';
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
}

export function ExpandedSubtasks({
  parentTaskId,
  statusOptions,
  sectionOptions,
  onTaskClick,
  hiddenItems,
}: ExpandedSubtasksProps) {
  const { data: subtasks, isLoading } = useSubtasks(parentTaskId);

  if (isLoading) {
    return (
      <div className="ml-4 flex items-center gap-2 text-xs text-muted-foreground p-2">
        <Loader2 className="size-3 animate-spin" />
        Loading subtasks...
      </div>
    );
  }

  if (!subtasks || subtasks.length === 0) return null;

  return (
    <>
      {subtasks.map((subtask) => {
        const status = statusOptions.find((s) => s.id === subtask.status);
        const section = sectionOptions.find((s) => s.id === subtask.section);

        return (
          <div
            key={subtask.id}
            className="flex gap-2"
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
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
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
              <p className="font-medium text-sm leading-tight">{subtask.title}</p>

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
