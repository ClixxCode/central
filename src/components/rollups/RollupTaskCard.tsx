'use client';

import * as React from 'react';
import { GripVertical, Calendar, ExternalLink, Star, Repeat, FolderKanban, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AssigneeAvatars, type AssigneeUser } from '@/components/tasks/AssigneePicker';
import { DateDisplay } from '@/components/tasks/DatePicker';
import { Badge } from '@/components/ui/badge';
import { SubtaskIndicator } from '@/components/tasks/SubtaskIndicator';
import { TaskActivityIndicators } from '@/components/tasks/TaskActivityIndicators';
import type { RollupBoardItem } from '@/lib/actions/rollups';
import type { SectionOption } from '@/lib/db/schema';
import { ClientIcon } from '@/components/clients/ClientIcon';
import { BuildBadge } from '@/components/builds/BuildBadge';

interface RollupTaskCardProps {
  task: RollupBoardItem;
  sectionOptions: SectionOption[];
  assignableUsers: AssigneeUser[];
  onClick?: (e: React.MouseEvent) => void;
  onNavigateToSource?: () => void;
  showClientBadge?: boolean;
  variant?: 'swimlane' | 'kanban';
  isSelected?: boolean;
  onToggleSubtasks?: () => void;
  isExpanded?: boolean;
  hiddenItems?: Set<string>;
  isPriority?: boolean;
  prioritySelectionMode?: boolean;
  priorityFilterActive?: boolean;
}

export function RollupTaskCard({
  task,
  sectionOptions,
  onClick,
  onNavigateToSource,
  showClientBadge = true,
  variant = 'swimlane',
  isSelected,
  onToggleSubtasks,
  isExpanded,
  hiddenItems,
  isPriority,
  prioritySelectionMode,
  priorityFilterActive,
}: RollupTaskCardProps) {
  const section = sectionOptions.find((s) => s.id === task.section);
  const showSection = !hiddenItems?.has('section');
  const showDueDate = !hiddenItems?.has('dueDate');
  const showAssignees = !hiddenItems?.has('assignees');
  const completed = task.kind === 'project' ? task.completedTaskCount : 0;
  const total = task.kind === 'project' ? task.taskCount : 0;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigateToSource?.();
  };

  if (task.kind === 'project') {
    return (
      <div
        className={cn(
          'relative rounded-lg border border-primary/25 bg-primary/[0.03] p-3 shadow-sm transition-all',
          'hover:border-primary/60 hover:bg-primary/[0.06] hover:shadow-md',
          onClick && 'cursor-pointer',
          isSelected && 'ring-2 ring-primary border-primary bg-primary/5'
        )}
        onClick={onClick}
      >
        <div className="flex items-start gap-2">
          <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FolderKanban className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            {showClientBadge && task.clientName && (
              <Badge
                variant="outline"
                className="mb-2 text-xs font-normal"
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
            )}
            {showSection && section && (
              <span
                className="mb-1 inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: `${section.color}20`, color: section.color }}
              >
                {section.label}
              </span>
            )}
            <p className="truncate text-sm font-semibold leading-tight" title={task.title}>
              {task.title}
            </p>
          </div>
          {onNavigateToSource && (
            <button
              type="button"
              onClick={handleNavigate}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              title={`Open ${task.title}`}
            >
              <ExternalLink className="size-3" />
            </button>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          {showDueDate && task.dueDate ? (
            <div className="flex min-w-0 items-center gap-1">
              <Calendar className="size-3 shrink-0" />
              <DateDisplay date={task.dueDate} flexibility="not_set" />
            </div>
          ) : (
            <div />
          )}
          <div className="flex shrink-0 items-center gap-1">
            <ListChecks className="size-3" />
            <span>{completed}/{total}</span>
          </div>
        </div>

        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  if (variant === 'kanban') {
    return (
      <div
        className={cn(
          'relative rounded-lg border bg-background p-3 shadow-sm transition-all',
          'hover:border-primary/50 hover:shadow-md',
          onClick && 'cursor-pointer',
          isSelected && 'ring-2 ring-primary border-primary bg-primary/5',
          prioritySelectionMode && 'cursor-pointer ring-1 ring-inset ring-muted-foreground/20'
        )}
        onClick={onClick}
      >
        {(prioritySelectionMode || (priorityFilterActive && isPriority)) && (
          <div className="absolute right-2 top-2 z-10">
            <Star className={cn('size-4 text-amber-400', isPriority ? 'fill-current' : 'fill-none text-muted-foreground')} />
          </div>
        )}
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

        {task.isAgenticBuild && (
          <div className="mb-1.5">
            <BuildBadge buildStage={task.buildStage} />
          </div>
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
        onClick && 'cursor-pointer',
        isSelected && 'ring-2 ring-primary border-primary bg-primary/5',
        prioritySelectionMode && 'cursor-pointer ring-1 ring-inset ring-muted-foreground/20',
        !prioritySelectionMode && isPriority && 'border-l-2 border-l-amber-400'
      )}
      onClick={onClick}
    >
      {(prioritySelectionMode || (priorityFilterActive && isPriority)) && (
        <div className="absolute right-2 top-2 z-10">
          <Star className={cn('size-4 text-amber-400', isPriority ? 'fill-current' : 'fill-none text-muted-foreground')} />
        </div>
      )}
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

        {task.isAgenticBuild && (
          <div className="mb-1.5">
            <BuildBadge buildStage={task.buildStage} />
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
