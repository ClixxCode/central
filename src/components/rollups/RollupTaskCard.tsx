'use client';

import * as React from 'react';
import { GripVertical, Calendar, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AssigneeAvatars, type AssigneeUser } from '@/components/tasks/AssigneePicker';
import { DateDisplay } from '@/components/tasks/DatePicker';
import { Badge } from '@/components/ui/badge';
import { SubtaskIndicator } from '@/components/tasks/SubtaskIndicator';
import { TaskActivityIndicators } from '@/components/tasks/TaskActivityIndicators';
import type { RollupTaskWithAssignees } from '@/lib/actions/rollups';
import type { SectionOption } from '@/lib/db/schema';
import { ClientIcon } from '@/components/clients/ClientIcon';

interface RollupTaskCardProps {
  task: RollupTaskWithAssignees;
  sectionOptions: SectionOption[];
  assignableUsers: AssigneeUser[];
  onClick?: () => void;
  onNavigateToSource?: () => void;
  showClientBadge?: boolean;
  variant?: 'swimlane' | 'kanban';
  onToggleSubtasks?: () => void;
  isExpanded?: boolean;
  hiddenItems?: Set<string>;
}

export function RollupTaskCard({
  task,
  sectionOptions,
  assignableUsers,
  onClick,
  onNavigateToSource,
  showClientBadge = true,
  variant = 'swimlane',
  onToggleSubtasks,
  isExpanded,
  hiddenItems,
}: RollupTaskCardProps) {
  const section = sectionOptions.find((s) => s.id === task.section);
  const showSection = !hiddenItems?.has('section');
  const showDueDate = !hiddenItems?.has('dueDate');
  const showAssignees = !hiddenItems?.has('assignees');

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigateToSource?.();
  };

  if (variant === 'kanban') {
    return (
      <div
        className={cn(
          'rounded-lg border bg-background p-3 shadow-sm transition-all',
          'hover:border-primary/50 hover:shadow-md',
          onClick && 'cursor-pointer'
        )}
        onClick={onClick}
      >
        {/* Client Badge */}
        {showClientBadge && task.clientName && (
          <div className="mb-2 flex items-center justify-between">
            <Badge
              variant="outline"
              className="text-xs font-normal"
              style={
                task.clientColor
                  ? {
                      backgroundColor: `${task.clientColor}15`,
                      borderColor: task.clientColor,
                      color: task.clientColor,
                    }
                  : undefined
              }
            >
              <ClientIcon icon={task.clientIcon} color={task.clientColor} size="xs" className="mr-1" />
              {task.clientName}
            </Badge>
            {onNavigateToSource && (
              <button
                type="button"
                onClick={handleNavigate}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                title={`Open in ${task.boardName}`}
              >
                <ExternalLink className="size-3" />
              </button>
            )}
          </div>
        )}

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
              <Calendar className="size-3" />
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
                onToggle={onToggleSubtasks ? (e) => { e.stopPropagation(); onToggleSubtasks(); } : undefined}
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
      </div>
    );
  }

  // Swimlane variant
  return (
    <div
      className={cn(
        'group relative rounded-lg border bg-background p-3 transition-all',
        'hover:border-primary/50 hover:shadow-sm',
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
    >
      {/* Drag Handle placeholder for visual consistency */}
      <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="size-4 text-muted-foreground" />
      </div>

      {/* Content */}
      <div className="ml-4 space-y-2">
        {/* Client Badge Row */}
        {showClientBadge && task.clientName && (
          <div className="flex items-center justify-between">
            <Badge
              variant="outline"
              className="text-xs font-normal"
              style={
                task.clientColor
                  ? {
                      backgroundColor: `${task.clientColor}15`,
                      borderColor: task.clientColor,
                      color: task.clientColor,
                    }
                  : undefined
              }
            >
              <ClientIcon icon={task.clientIcon} color={task.clientColor} size="xs" className="mr-1" />
              {task.clientName}
            </Badge>
            {onNavigateToSource && (
              <button
                type="button"
                onClick={handleNavigate}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                title={`Open in ${task.boardName}`}
              >
                <ExternalLink className="size-3" />
              </button>
            )}
          </div>
        )}

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
              <Calendar className="size-3" />
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
                onToggle={onToggleSubtasks ? (e) => { e.stopPropagation(); onToggleSubtasks(); } : undefined}
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
}
