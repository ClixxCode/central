'use client';

import * as React from 'react';
import { GripVertical, Calendar, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SortableTask } from '@/components/dnd';
import { AssigneeAvatars, type AssigneeUser } from './AssigneePicker';
import { DateDisplay } from './DatePicker';
import { TaskActivityIndicators } from './TaskActivityIndicators';
import { SubtaskIndicator } from './SubtaskIndicator';
import type { TaskWithAssignees } from '@/lib/actions/tasks';
import type { SectionOption } from '@/lib/db/schema';

interface SwimlaneTaskCardProps {
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

export function SwimlaneTaskCard({
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
}: SwimlaneTaskCardProps) {
  const section = sectionOptions.find((s) => s.id === task.section);
  const showSection = !hiddenItems?.has('section');
  const showDueDate = !hiddenItems?.has('dueDate');
  const showAssignees = !hiddenItems?.has('assignees');

  const cardContent = (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`Task: ${task.title}${section ? `, Section: ${section.label}` : ''}${task.dueDate ? `, Due: ${task.dueDate}` : ''}`}
      className={cn(
        'group relative rounded-lg border bg-background p-3 transition-all',
        'hover:border-primary/50 hover:shadow-sm',
        isDragging && 'opacity-50 border-primary shadow-lg',
        isOverlay && 'border-primary shadow-lg cursor-grabbing',
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
      {/* Drag Handle */}
      <div
        className={cn(
          'absolute left-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity',
          'group-hover:opacity-100',
          isOverlay && 'opacity-100'
        )}
      >
        <GripVertical className="size-4 text-muted-foreground" />
      </div>

      {/* Content */}
      <div className="ml-4 space-y-2">
        {/* Title */}
        <p className="font-medium text-sm leading-tight">{task.title}</p>

        {/* Meta Row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
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

          {/* Subtask indicator, Activity indicators and Assignees */}
          <div className="ml-auto flex items-center gap-2">
            {task.subtaskCount > 0 && (
              <SubtaskIndicator
                subtaskCount={task.subtaskCount}
                subtaskCompletedCount={task.subtaskCompletedCount}
                isExpanded={isExpanded}
                onToggle={onToggleSubtasks}
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
                maxDisplay={3}
                size="sm"
              />
            )}
          </div>
        </div>
      </div>
    </div>
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
