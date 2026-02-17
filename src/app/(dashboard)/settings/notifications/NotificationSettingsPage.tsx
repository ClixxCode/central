'use client';

import { NotificationSettingsMatrix } from '@/components/settings/NotificationSettingsMatrix';
import {
  useNotificationPreferences,
  useUpdateEmailPreferences,
  useUpdateSlackPreferences,
  useUpdateInAppPreferences,
} from '@/lib/hooks';
import { Skeleton } from '@/components/ui/skeleton';

export function NotificationSettingsPage() {
  const { data: preferences, isLoading, error } = useNotificationPreferences();
  const updateEmail = useUpdateEmailPreferences();
  const updateSlack = useUpdateSlackPreferences();
  const updateInApp = useUpdateInAppPreferences();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error || !preferences) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">Failed to load notification preferences</p>
        <p className="text-sm text-muted-foreground mt-2">Please try refreshing the page</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Notifications</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure how and when you receive notifications across all channels
        </p>
      </div>

      <NotificationSettingsMatrix
        preferences={preferences.notifications}
        isContractor={preferences.isContractor}
        onUpdateEmail={async (settings) => {
          const result = await updateEmail.mutateAsync(settings);
          return result;
        }}
        onUpdateSlack={async (settings) => {
          const result = await updateSlack.mutateAsync(settings);
          return result;
        }}
        onUpdateInApp={async (settings) => {
          const result = await updateInApp.mutateAsync(settings);
          return result;
        }}
      />
    </div>
  );
}
