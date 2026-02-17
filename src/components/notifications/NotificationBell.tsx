'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NotificationItem } from './NotificationItem';
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
} from '@/lib/hooks/useNotifications';

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const [open, setOpen] = useState(false);

  // Fetch unread count with polling
  const { data: unreadCount = 0 } = useUnreadNotificationCount();

  // Fetch unread notifications (only when dropdown is open)
  const { data: notificationsData, isLoading } = useNotifications(
    { limit: 10, unreadOnly: true },
    { enabled: open, refetchInterval: open ? 10000 : false }
  );

  const markAsRead = useMarkNotificationAsRead();

  const markAllAsRead = useMarkAllNotificationsAsRead();

  const notifications = notificationsData?.notifications ?? [];

  const handleMarkAsRead = (id: string) => {
    markAsRead.mutate(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={`relative ${className}`}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 min-w-5 px-1 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 flex flex-col overflow-hidden p-0">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <span className="font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-primary hover:text-primary/80"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsRead.isPending}
            >
              {markAllAsRead.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : null}
              Mark all read
            </Button>
          )}
        </div>

        {/* Notifications list */}
        <ScrollArea className="min-h-0 flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center">
              <Bell className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">No new notifications</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                  isMarkingRead={
                    markAsRead.isPending &&
                    markAsRead.variables === notification.id
                  }
                  compact
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="shrink-0 border-t px-4 py-2">
          <Link
            href="/my-tasks?tab=notifications"
            className="text-sm text-primary hover:text-primary/80"
            onClick={() => setOpen(false)}
          >
            View all notifications
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
