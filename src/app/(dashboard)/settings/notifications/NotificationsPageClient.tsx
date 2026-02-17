'use client';

import { useState } from 'react';
import { Bell, CheckCheck, Trash2, Loader2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NotificationItem } from '@/components/notifications';
import type { NotificationWithContext } from '@/lib/actions/notifications';
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  useDeleteNotification,
  useClearReadNotifications,
} from '@/lib/hooks/useNotifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserPreferences } from '@/lib/actions/user-preferences';
import { useUpdateInAppPreferences } from '@/lib/hooks/useNotifications';

export function NotificationsPageClient() {
  const [activeTab, setActiveTab] = useState('all');
  const queryClient = useQueryClient();

  // Fetch notifications
  const {
    data: notificationsData,
    isLoading: isLoadingNotifications,
  } = useNotifications(
    { limit: 100, unreadOnly: activeTab === 'unread' },
    { refetchInterval: 30000 }
  );

  // Fetch preferences
  const { data: preferencesData, isLoading: isLoadingPreferences } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: async () => {
      const result = await getUserPreferences();
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch preferences');
      }
      return result.preferences!;
    },
  });

  // Toggle in-app notifications mutation
  const toggleInAppMutation = useUpdateInAppPreferences();

  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();
  const deleteNotification = useDeleteNotification();
  const clearRead = useClearReadNotifications();

  const notifications = notificationsData?.notifications ?? [];
  const total = notificationsData?.total ?? 0;
  const inAppEnabled = preferencesData?.notifications?.inApp?.enabled ?? true;

  const handleToggleInApp = () => {
    toggleInAppMutation.mutate({ enabled: !inAppEnabled });
  };

  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const readCount = notifications.filter((n) => n.readAt).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-muted-foreground">
          View and manage your notifications and preferences.
        </p>
      </div>

      {/* Preferences Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Configure how you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="in-app-notifications" className="text-base">
                In-app notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications within the application
              </p>
            </div>
            <Switch
              id="in-app-notifications"
              checked={inAppEnabled}
              onCheckedChange={handleToggleInApp}
              disabled={isLoadingPreferences || toggleInAppMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notifications List Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification History
              </CardTitle>
              <CardDescription>
                {total} total notifications
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllAsRead.mutate()}
                  disabled={markAllAsRead.isPending}
                >
                  {markAllAsRead.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCheck className="mr-2 h-4 w-4" />
                  )}
                  Mark all read
                </Button>
              )}
              {readCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => clearRead.mutate()}
                  disabled={clearRead.isPending}
                >
                  {clearRead.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Clear read
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">
                All
                {total > 0 && (
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">
                    {total}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="unread">
                Unread
                {unreadCount > 0 && (
                  <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                    {unreadCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-0">
              <NotificationsList
                notifications={notifications}
                isLoading={isLoadingNotifications}
                onMarkAsRead={(id) => markAsRead.mutate(id)}
                onDelete={(id) => deleteNotification.mutate(id)}
                markingReadId={markAsRead.isPending ? markAsRead.variables : undefined}
                deletingId={deleteNotification.isPending ? deleteNotification.variables : undefined}
              />
            </TabsContent>

            <TabsContent value="unread" className="mt-0">
              <NotificationsList
                notifications={notifications}
                isLoading={isLoadingNotifications}
                onMarkAsRead={(id) => markAsRead.mutate(id)}
                onDelete={(id) => deleteNotification.mutate(id)}
                markingReadId={markAsRead.isPending ? markAsRead.variables : undefined}
                deletingId={deleteNotification.isPending ? deleteNotification.variables : undefined}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

interface NotificationsListProps {
  notifications: NotificationWithContext[];
  isLoading: boolean;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  markingReadId?: string;
  deletingId?: string;
}

function NotificationsList({
  notifications,
  isLoading,
  onMarkAsRead,
  onDelete,
  markingReadId,
  deletingId,
}: NotificationsListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="py-12 text-center">
        <Bell className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <p className="mt-4 text-muted-foreground">No notifications to display</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px]">
      <div className="divide-y rounded-lg border">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onMarkAsRead={onMarkAsRead}
            onDelete={onDelete}
            isMarkingRead={markingReadId === notification.id}
            isDeleting={deletingId === notification.id}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
