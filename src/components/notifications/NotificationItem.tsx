'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  AtSign,
  UserPlus,
  Clock,
  AlertTriangle,
  MessageSquare,
  SmilePlus,
  Check,
  X,
  Circle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { NotificationWithContext, NotificationType } from '@/lib/actions/notifications';

interface NotificationItemProps {
  notification: NotificationWithContext;
  onMarkAsRead?: (id: string) => void;
  onMarkAsUnread?: (id: string) => void;
  onDelete?: (id: string) => void;
  isMarkingRead?: boolean;
  isMarkingUnread?: boolean;
  isDeleting?: boolean;
  compact?: boolean;
}

const notificationIcons: Record<NotificationType, typeof AtSign> = {
  mention: AtSign,
  task_assigned: UserPlus,
  task_due_soon: Clock,
  task_overdue: AlertTriangle,
  comment_added: MessageSquare,
  reaction_added: SmilePlus,
};

const notificationColors: Record<NotificationType, string> = {
  mention: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/20',
  task_assigned: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-500/20',
  task_due_soon: 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-500/20',
  task_overdue: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/20',
  comment_added: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-500/20',
  reaction_added: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-500/20',
};

export function NotificationItem({
  notification,
  onMarkAsRead,
  onMarkAsUnread,
  onDelete,
  isMarkingRead,
  isMarkingUnread,
  isDeleting,
  compact = false,
}: NotificationItemProps) {
  const Icon = notificationIcons[notification.type];
  const colorClass = notificationColors[notification.type];
  const isUnread = !notification.readAt;

  // Build the link to the task (include comment if present)
  const taskLink = notification.task
    ? `/clients/${notification.task.board.client.slug}/boards/${notification.task.boardId}?task=${notification.task.id}${notification.commentId ? `&comment=${notification.commentId}` : ''}`
    : null;

  const handleClick = () => {
    if (isUnread && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
  };

  const content = (
    <div
      className={cn(
        'group flex items-start gap-3 px-4 py-3 transition-colors',
        isUnread ? 'bg-primary/5' : 'bg-background',
        'hover:bg-accent/50',
        compact && 'py-2',
        (isMarkingRead || isMarkingUnread || isDeleting) && 'pointer-events-none opacity-50'
      )}
      onClick={handleClick}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          colorClass
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className={cn(
                'text-sm',
                isUnread ? 'font-medium text-foreground' : 'text-foreground'
              )}
            >
              {notification.title}
            </p>
            {notification.body && !compact && (
              <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                {notification.body}
              </p>
            )}
            {notification.task && (
              <p className="mt-0.5 text-xs text-muted-foreground/70">
                {notification.task.board.client.name} / {notification.task.board.name}
              </p>
            )}
          </div>

          {/* Actions */}
          {!compact && (
            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {isUnread && onMarkAsRead && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onMarkAsRead(notification.id);
                  }}
                  disabled={isMarkingRead}
                  title="Mark as read"
                >
                  <Check className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
              {!isUnread && onMarkAsUnread && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onMarkAsUnread(notification.id);
                  }}
                  disabled={isMarkingUnread}
                  title="Mark as unread"
                >
                  <Circle className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete(notification.id);
                  }}
                  disabled={isDeleting}
                  title="Delete notification"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <p className="mt-1 text-xs text-muted-foreground/70">
          {formatDistanceToNow(new Date(notification.createdAt), {
            addSuffix: true,
          })}
        </p>
      </div>

      {/* Unread indicator */}
      {isUnread && (
        <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </div>
  );

  if (taskLink) {
    return (
      <Link href={taskLink} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
