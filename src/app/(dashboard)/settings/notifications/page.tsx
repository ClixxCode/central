import { Suspense } from 'react';
import { NotificationSettingsPage } from './NotificationSettingsPage';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = {
  title: 'Notification Settings | Central',
};

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}

export default function NotificationSettingsRoute() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <NotificationSettingsPage />
    </Suspense>
  );
}
