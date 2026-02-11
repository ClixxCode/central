'use client';

import { useBoardActivity } from '@/lib/hooks';
import type { BoardActivityEntry } from '@/lib/actions/board-activity';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import { Activity } from 'lucide-react';
import Link from 'next/link';

interface ActivityLogProps {
  boardId: string;
  clientSlug: string;
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

function buildDescription(entry: BoardActivityEntry): {
  text: string;
  taskTitle: string | null;
} {
  const userName = entry.user.name ?? entry.user.email;
  const meta = entry.metadata ?? {};
  const taskTitle = entry.taskTitle;

  switch (entry.action) {
    case 'task_created':
      return { text: `${userName} created`, taskTitle };
    case 'task_deleted':
      return { text: `${userName} deleted`, taskTitle };
    case 'subtask_created':
      return { text: `${userName} added subtask`, taskTitle };
    case 'subtask_deleted':
      return { text: `${userName} deleted subtask`, taskTitle };
    case 'task_status_changed':
      return {
        text: `${userName} changed status from ${meta.oldLabel ?? meta.oldValue} to ${meta.newLabel ?? meta.newValue} on`,
        taskTitle,
      };
    case 'task_title_changed':
      return {
        text: `${userName} renamed '${meta.oldValue}' to`,
        taskTitle: meta.newValue as string,
      };
    case 'task_section_changed':
      return {
        text: `${userName} moved to section ${meta.newLabel ?? 'None'} on`,
        taskTitle,
      };
    case 'task_due_date_changed': {
      const newDate = meta.newValue
        ? format(new Date(meta.newValue as string), 'MMM d')
        : 'none';
      return {
        text: `${userName} changed due date to ${newDate} on`,
        taskTitle,
      };
    }
    case 'task_assigned':
      return {
        text: `${userName} assigned ${meta.assigneeName} to`,
        taskTitle,
      };
    case 'task_unassigned':
      return {
        text: `${userName} unassigned ${meta.assigneeName} from`,
        taskTitle,
      };
    case 'comment_added':
      return { text: `${userName} commented on`, taskTitle };
    case 'task_archived':
      return { text: `${userName} archived`, taskTitle };
    case 'task_unarchived':
      return { text: `${userName} unarchived`, taskTitle };
    case 'tasks_bulk_archived':
      return { text: `${userName} bulk archived`, taskTitle };
    default:
      return { text: `${userName} updated`, taskTitle };
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

export function ActivityLog({ boardId, clientSlug }: ActivityLogProps) {
  const { data: entries, isLoading } = useBoardActivity(boardId);

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
        <p className="text-sm">No activity in the last 30 days</p>
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
              const { text, taskTitle } = buildDescription(entry);
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
                    <p className="text-sm leading-snug">
                      <span>{text}</span>
                      {taskTitle && entry.taskId && (
                        <>
                          {' '}
                          <Link
                            href={`/clients/${clientSlug}/boards/${boardId}?task=${entry.taskId}`}
                            className="font-medium text-foreground hover:underline"
                          >
                            {taskTitle}
                          </Link>
                        </>
                      )}
                      {taskTitle && !entry.taskId && (
                        <span className="font-medium"> {taskTitle}</span>
                      )}
                    </p>
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
