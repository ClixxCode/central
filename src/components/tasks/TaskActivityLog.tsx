'use client';

import { useTaskActivity } from '@/lib/hooks';
import type { BoardActivityEntry } from '@/lib/actions/board-activity';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import { Activity } from 'lucide-react';

interface TaskActivityLogProps {
  taskId: string;
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  return email[0].toUpperCase();
}

function getDateLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

function buildDescription(entry: BoardActivityEntry): string {
  const userName = entry.user.name ?? entry.user.email;
  const meta = entry.metadata ?? {};

  switch (entry.action) {
    case 'task_created':
      return `${userName} created this task`;
    case 'subtask_created':
      return `${userName} added a subtask`;
    case 'subtask_deleted':
      return `${userName} deleted a subtask`;
    case 'task_status_changed':
      return `${userName} changed status from ${meta.oldLabel ?? meta.oldValue} to ${meta.newLabel ?? meta.newValue}`;
    case 'task_title_changed':
      return `${userName} renamed from '${meta.oldValue}' to '${meta.newValue}'`;
    case 'task_section_changed':
      return `${userName} moved to section ${meta.newLabel ?? 'None'}`;
    case 'task_due_date_changed': {
      const newDate = meta.newValue
        ? format(new Date(meta.newValue as string), 'MMM d')
        : 'none';
      return `${userName} changed due date to ${newDate}`;
    }
    case 'task_assigned':
      return `${userName} assigned ${meta.assigneeName}`;
    case 'task_unassigned':
      return `${userName} unassigned ${meta.assigneeName}`;
    case 'comment_added':
      return `${userName} added a comment`;
    case 'task_archived':
      return `${userName} archived this task`;
    case 'task_unarchived':
      return `${userName} unarchived this task`;
    default:
      return `${userName} updated this task`;
  }
}

function groupByDate(entries: BoardActivityEntry[]): { label: string; entries: BoardActivityEntry[] }[] {
  const groups: Map<string, BoardActivityEntry[]> = new Map();

  for (const entry of entries) {
    const date = new Date(entry.createdAt);
    const label = getDateLabel(date);
    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label)!.push(entry);
  }

  return Array.from(groups.entries()).map(([label, entries]) => ({
    label,
    entries,
  }));
}

export function TaskActivityLog({ taskId }: TaskActivityLogProps) {
  const { data: entries, isLoading } = useTaskActivity(taskId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-7 w-7 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Activity className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">No activity recorded for this task</p>
      </div>
    );
  }

  const groups = groupByDate(entries);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.label}>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            {group.label}
          </h3>
          <div className="space-y-3">
            {group.entries.map((entry) => {
              const description = buildDescription(entry);
              const timeAgo = formatDistanceToNow(new Date(entry.createdAt), {
                addSuffix: true,
              });

              return (
                <div key={entry.id} className="flex items-start gap-3">
                  <Avatar className="h-7 w-7 mt-0.5">
                    <AvatarImage src={entry.user.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {getInitials(entry.user.name, entry.user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug">{description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {timeAgo}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
