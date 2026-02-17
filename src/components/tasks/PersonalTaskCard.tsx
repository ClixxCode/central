'use client';

import * as React from 'react';
import { Building2, Calendar, FolderKanban, CornerDownRight, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AssigneeAvatars } from './AssigneePicker';
import { DateDisplay } from './DatePicker';
import { SubtaskIndicator } from './SubtaskIndicator';
import { useMyWorkPreferences } from '@/lib/hooks/useMyWorkPreferences';
import type { MyTaskWithContext } from '@/lib/actions/tasks';

interface PersonalTaskCardProps {
  task: MyTaskWithContext;
  onClick?: () => void;
  showClient?: boolean;
  clientName?: string;
}

export function PersonalTaskCard({
  task,
  onClick,
  showClient,
  clientName,
}: PersonalTaskCardProps) {
  const { isColumnHidden } = useMyWorkPreferences();

  const section = task.board.sectionOptions.find((s) => s.id === task.section);
  const status = task.board.statusOptions.find((s) => s.id === task.status);

  const showBoard = !isColumnHidden('board');
  const showSection = !isColumnHidden('section');
  const showDueDate = !isColumnHidden('dueDate');
  const showAssignees = !isColumnHidden('assignees');

  // Check if any meta content should be shown
  const hasVisibleMeta =
    (showClient && clientName) ||
    (showBoard) ||
    (showSection && section) ||
    (showDueDate && task.dueDate) ||
    (showAssignees && task.assignees.length > 0);

  return (
    <div
      className={cn(
        'group relative rounded-lg border bg-background p-3 transition-all',
        'hover:border-primary/50 hover:shadow-sm',
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
    >
      {/* Content */}
      <div className="space-y-2">
        {/* Title Row */}
        <div className="flex items-start gap-2">
          {/* Status dot */}
          {status && (
            <span
              className="mt-1.5 size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: status.color }}
            />
          )}
          <p className="font-medium text-sm leading-tight flex-1">{task.title}</p>
          {task.subtaskCount > 0 && (
            <SubtaskIndicator
              subtaskCount={task.subtaskCount}
              subtaskCompletedCount={task.subtaskCompletedCount}
            />
          )}
        </div>

        {/* Parent task context for subtasks */}
        {task.parentTask && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground ml-4">
            <CornerDownRight className="size-3 shrink-0" />
            <span className="truncate">subtask of: {task.parentTask.title}</span>
          </div>
        )}

        {/* Meta Row - only show if there's visible content */}
        {hasVisibleMeta && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {/* Client Name */}
            {showClient && clientName && (
              <div className="flex items-center gap-1">
                <Building2 className="size-3" />
                <span className="max-w-[120px] truncate font-medium">{clientName}</span>
              </div>
            )}

            {/* Board Name */}
            {showBoard && (
              <div className="flex items-center gap-1">
                <FolderKanban className="size-3" />
                <span className="max-w-[120px] truncate">{task.board.name}</span>
              </div>
            )}

            {/* Section Badge */}
            {showSection && section && (
              <span
                className="inline-flex items-center rounded px-1.5 py-0.5 font-medium"
                style={{
                  backgroundColor: `${section.color}20`,
                  color: section.color,
                }}
              >
                {section.label}
              </span>
            )}

            {/* Due Date */}
            {showDueDate && task.dueDate && (
              <div className="flex items-center gap-1">
                {task.recurringConfig ? (
                  <Repeat className="size-3" />
                ) : (
                  <Calendar className="size-3" />
                )}
                <DateDisplay
                  date={task.dueDate}
                  flexibility={task.dateFlexibility}
                />
              </div>
            )}

            {/* Assignees */}
            {showAssignees && task.assignees.length > 0 && (
              <div className="ml-auto flex items-center gap-1">
                <AssigneeAvatars
                  assignees={task.assignees}
                  maxDisplay={3}
                  size="sm"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
