'use client';

import * as React from 'react';
import { Calendar, CornerDownRight, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SortableTask } from '@/components/dnd';
import { AssigneeAvatars, type AssigneeUser } from './AssigneePicker';
import { DateDisplay } from './DatePicker';
import { TaskActivityIndicators } from './TaskActivityIndicators';
import { SubtaskIndicator } from './SubtaskIndicator';
import { BuildBadge } from '@/components/builds/BuildBadge';
import type { TaskWithAssignees } from '@/lib/actions/tasks';
import type { SectionOption } from '@/lib/db/schema';

interface KanbanTaskCardProps {
  task: TaskWithAssignees;
  sectionOptions: SectionOption[];
  assignableUsers: AssigneeUser[];
  onClick?: (e: React.MouseEvent) => void;
  isDragging?: boolean;
  isOverlay?: boolean;
  onToggleSubtasks?: () => void;
  onOpenSubtasks?: () => void;
  isExpanded?: boolean;
  hiddenItems?: Set<string>;
  isSelected?: boolean;
  isFaded?: boolean;
  isSubtaskOnlyParent?: boolean;
  subtaskOnlyHighlightColor?: string;
  onEnterSubtaskOnlyMode?: (parentTaskId: string) => void;
}

export function KanbanTaskCard({
  task,
  sectionOptions,
  assignableUsers,
  onClick,
  isDragging = false,
  isOverlay = false,
  onToggleSubtasks,
  onOpenSubtasks,
  isExpanded,
  hiddenItems,
  isSelected,
  isFaded,
  isSubtaskOnlyParent,
  subtaskOnlyHighlightColor,
  onEnterSubtaskOnlyMode,
}: KanbanTaskCardProps) {
  const section = sectionOptions.find((s) => s.id === task.section);
  const showSection = !hiddenItems?.has('section');
  const showDueDate = !hiddenItems?.has('dueDate');
  const showAssignees = !hiddenItems?.has('assignees');
  const openSubtasks = onOpenSubtasks ?? onToggleSubtasks;
  const subtaskOnlyHighlightStyle: React.CSSProperties | undefined =
    isSubtaskOnlyParent && subtaskOnlyHighlightColor
      ? {
          borderColor: subtaskOnlyHighlightColor,
          backgroundColor: `color-mix(in srgb, ${subtaskOnlyHighlightColor} 10%, transparent)`,
          boxShadow: `0 0 0 1px color-mix(in srgb, ${subtaskOnlyHighlightColor} 55%, transparent), 0 8px 18px color-mix(in srgb, ${subtaskOnlyHighlightColor} 10%, transparent)`,
        }
      : undefined;

  const cardContent = (
    <article
      role={onClick && !isFaded ? 'button' : undefined}
      tabIndex={onClick && !isFaded ? 0 : undefined}
      aria-label={`Task: ${task.title}${section ? `, Section: ${section.label}` : ''}${task.dueDate ? `, Due: ${task.dueDate}` : ''}`}
      className={cn(
        'rounded-lg border bg-background p-3 shadow-sm transition-all',
        'hover:border-primary/50 hover:shadow-md',
        task.isAgenticBuild && 'border-l-[3px] border-l-[#7C3AED]',
        isDragging && 'opacity-50 border-primary shadow-lg',
        isOverlay && 'border-primary shadow-lg cursor-grabbing rotate-2',
        onClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected && 'ring-2 ring-primary border-primary bg-primary/5',
        isSubtaskOnlyParent && 'shadow-md',
        isFaded && 'pointer-events-none opacity-25 saturate-50'
      )}
      style={subtaskOnlyHighlightStyle}
      onClick={(e) => {
        if (isFaded) return;
        onClick?.(e);
      }}
      onKeyDown={(e) => {
        if (isFaded) return;
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick(e as unknown as React.MouseEvent);
        }
      }}
    >
      {/* Section Badge */}
      {showSection && section && (
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

      {/* Agentic build badge */}
      {task.isAgenticBuild && (
        <div className="mb-2">
          <BuildBadge buildStage={task.buildStage} />
        </div>
      )}

      {/* Title */}
      <p className="truncate font-medium text-sm leading-tight" title={task.title}>
        {task.title}
      </p>
      {task.parentTaskId && task.parentTaskTitle && onEnterSubtaskOnlyMode && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEnterSubtaskOnlyMode?.(task.parentTaskId!);
          }}
          className="mt-2 flex min-w-0 items-center gap-1 rounded text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Show only subtasks for ${task.parentTaskTitle}`}
        >
          <CornerDownRight className="size-3 shrink-0" />
          <span className="truncate" title={task.parentTaskTitle}>
            {task.parentTaskTitle}
          </span>
        </button>
      )}
      {task.parentTaskId && task.parentTaskTitle && !onEnterSubtaskOnlyMode && (
        <div className="mt-2 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <CornerDownRight className="size-3 shrink-0" />
          <span className="truncate" title={task.parentTaskTitle}>
            {task.parentTaskTitle}
          </span>
        </div>
      )}

      {/* Meta Row */}
      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {/* Due Date */}
        {showDueDate && task.dueDate ? (
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
        ) : (
          <div />
        )}

        {/* Subtask indicator, Activity indicators and Assignees */}
        <div className="flex items-center gap-2">
          {task.subtaskCount > 0 && (
            <SubtaskIndicator
              subtaskCount={task.subtaskCount}
              subtaskCompletedCount={task.subtaskCompletedCount}
              isExpanded={isExpanded}
              onClick={openSubtasks ? () => openSubtasks() : undefined}
              onLongPress={
                task.subtasksBreakoutEnabled && onEnterSubtaskOnlyMode
                  ? () => onEnterSubtaskOnlyMode(task.id)
                  : undefined
              }
            />
          )}
          <TaskActivityIndicators
            commentCount={task.commentCount}
            attachmentCount={task.attachmentCount}
            hasNewComments={task.hasNewComments}
          />
          {showAssignees && task.assignees.length > 0 && (
            <AssigneeAvatars
              assignees={task.assignees}
              maxDisplay={2}
              size="sm"
            />
          )}
        </div>
      </div>
    </article>
  );

  if (isOverlay) {
    return cardContent;
  }

  return (
    <SortableTask id={task.id} disabled={isFaded}>
      {cardContent}
    </SortableTask>
  );
}
