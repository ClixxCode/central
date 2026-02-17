'use client';

import * as React from 'react';
import { Calendar, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SortableTask } from '@/components/dnd';
import { AssigneeAvatars, type AssigneeUser } from './AssigneePicker';
import { DateDisplay } from './DatePicker';
import { TaskActivityIndicators } from './TaskActivityIndicators';
import { SubtaskIndicator } from './SubtaskIndicator';
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
  isExpanded?: boolean;
  hiddenItems?: Set<string>;
  isSelected?: boolean;
}

export function KanbanTaskCard({
  task,
  sectionOptions,
  assignableUsers,
  onClick,
  isDragging = false,
  isOverlay = false,
  onToggleSubtasks,
  isExpanded,
  hiddenItems,
  isSelected,
}: KanbanTaskCardProps) {
  const section = sectionOptions.find((s) => s.id === task.section);
  const showSection = !hiddenItems?.has('section');
  const showDueDate = !hiddenItems?.has('dueDate');
  const showAssignees = !hiddenItems?.has('assignees');

  const cardContent = (
    <article
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`Task: ${task.title}${section ? `, Section: ${section.label}` : ''}${task.dueDate ? `, Due: ${task.dueDate}` : ''}`}
      className={cn(
        'rounded-lg border bg-background p-3 shadow-sm transition-all',
        'hover:border-primary/50 hover:shadow-md',
        isDragging && 'opacity-50 border-primary shadow-lg',
        isOverlay && 'border-primary shadow-lg cursor-grabbing rotate-2',
        onClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected && 'ring-2 ring-primary border-primary bg-primary/5'
      )}
      onClick={(e) => onClick?.(e)}
      onKeyDown={(e) => {
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

      {/* Title */}
      <p className="font-medium text-sm leading-tight">{task.title}</p>

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
              onToggle={onToggleSubtasks ? () => onToggleSubtasks() : undefined}
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
    <SortableTask id={task.id}>
      {cardContent}
    </SortableTask>
  );
}
