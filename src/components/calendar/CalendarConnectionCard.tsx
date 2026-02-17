'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Calendar, ExternalLink, Loader2, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  useCalendarConnection,
  useDisconnectCalendar,
  useCalendarPreferences,
  useUpdateCalendarPreferences,
} from '@/lib/hooks';
import { trackEvent } from '@/lib/analytics';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function CalendarConnectionCard() {
  const searchParams = useSearchParams();
  const { data: connection, isLoading } = useCalendarConnection();
  const disconnectMutation = useDisconnectCalendar();
  const { data: calPrefs } = useCalendarPreferences();
  const updatePrefs = useUpdateCalendarPreferences();

  useEffect(() => {
    if (searchParams.get('calendar') === 'connected') {
      toast.success('Google Calendar connected successfully');
      trackEvent('calendar_connected');
      window.history.replaceState({}, '', '/settings/integrations');
    } else if (searchParams.get('calendar') === 'error') {
      toast.error('Failed to connect Google Calendar');
      window.history.replaceState({}, '', '/settings/integrations');
    }
  }, [searchParams]);

  const handleDisconnect = () => {
    disconnectMutation.mutate(undefined, {
      onSuccess: () => {
        updatePrefs.mutate({ showScheduleInSidebar: false });
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Google Calendar
        </CardTitle>
        <CardDescription>
          Connect your Google Calendar to see today&apos;s events and schedule calendar holds with your team.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking connection...
          </div>
        ) : connection?.connected ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm">
                  Connected as <span className="font-medium">{connection.email}</span>
                </span>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={disconnectMutation.isPending}>
                    <Unplug className="h-4 w-4 mr-1" />
                    Disconnect
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect Google Calendar?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You&apos;ll no longer see calendar events in My Work or be able to create calendar holds.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDisconnect}>
                      Disconnect
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-schedule" className="text-sm cursor-pointer">
                  Show Schedule in sidebar
                </Label>
                <Switch
                  id="show-schedule"
                  checked={calPrefs?.showScheduleInSidebar ?? false}
                  onCheckedChange={(checked) => updatePrefs.mutate({ showScheduleInSidebar: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-events" className="text-sm cursor-pointer">
                  Show calendar events in My Work
                </Label>
                <Switch
                  id="show-events"
                  checked={calPrefs?.showEventsInMyWork ?? true}
                  onCheckedChange={(checked) => updatePrefs.mutate({ showEventsInMyWork: checked })}
                />
              </div>
            </div>
          </>
        ) : (
          <Button asChild>
            <a href="/api/google-calendar/connect">
              <ExternalLink className="h-4 w-4 mr-2" />
              Connect Google Calendar
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
