'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { AssigneeAvatars, type AssigneeUser } from './AssigneePicker';
import { DateDisplay } from './DatePicker';
import { SectionBadge } from './SectionSelect';
import { RecurringIndicator } from './RecurringPicker';
import { TaskActivityIndicators } from './TaskActivityIndicators';
import type { TaskWithAssignees } from '@/lib/actions/tasks';
import type { SectionOption } from '@/lib/db/schema';

type DateFlexibility = 'not_set' | 'flexible' | 'semi_flexible' | 'not_flexible';

interface TaskCardProps {
  task: TaskWithAssignees;
  sectionOptions: SectionOption[];
  onClick?: () => void;
  isUpdating?: boolean;
}

export function TaskCard({
  task,
  sectionOptions,
  onClick,
  isUpdating = false,
}: TaskCardProps) {
  const section = sectionOptions.find((s) => s.id === task.section);

  return (
    <Card
      className={cn(
        'cursor-pointer transition-shadow hover:shadow-md',
        isUpdating && 'opacity-50'
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        {/* Title */}
        <h4 className="font-medium text-sm line-clamp-2">{task.title}</h4>

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Section badge */}
          {section && (
            <SectionBadge
              label={section.label}
              color={section.color}
              className="text-xs px-1.5 py-0"
            />
          )}

          {/* Recurring indicator */}
          {task.recurringConfig && (
            <RecurringIndicator className="shrink-0" />
          )}

          {/* Due date */}
          {task.dueDate && (
            <DateDisplay
              date={task.dueDate}
              flexibility={task.dateFlexibility as DateFlexibility}
              showFlexibility={task.dateFlexibility !== 'not_set'}
              className="text-xs"
            />
          )}
        </div>

        {/* Bottom row: assignees and activity indicators */}
        <div className="flex items-center justify-between pt-1">
          {/* Assignees */}
          {task.assignees.length > 0 ? (
            <AssigneeAvatars
              assignees={task.assignees as AssigneeUser[]}
              maxDisplay={3}
              size="sm"
            />
          ) : (
            <div />
          )}

          {/* Activity indicators */}
          <TaskActivityIndicators
            commentCount={task.commentCount}
            attachmentCount={task.attachmentCount}
            hasNewComments={task.hasNewComments}
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface TaskCardSkeletonProps {
  className?: string;
}

export function TaskCardSkeleton({ className }: TaskCardSkeletonProps) {
  return (
    <Card className={className}>
      <CardContent className="p-3 space-y-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        <div className="flex items-center gap-2 pt-1">
          <div className="h-6 w-6 animate-pulse rounded-full bg-muted" />
          <div className="h-6 w-6 animate-pulse rounded-full bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
