'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Mail, Bell, AtSign, UserPlus, Clock } from 'lucide-react';
import type { UserPreferences } from '@/lib/db/schema/users';
import { updateEmailPreferences, updateInAppPreferences } from '@/lib/actions/user-preferences';

interface NotificationSettingsFormProps {
  preferences: UserPreferences;
}

export function NotificationSettingsForm({ preferences }: NotificationSettingsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [emailPrefs, setEmailPrefs] = useState(preferences.notifications.email);
  const [inAppPrefs, setInAppPrefs] = useState(preferences.notifications.inApp);

  const handleEmailToggle = (field: keyof typeof emailPrefs, value: boolean) => {
    const newPrefs = { ...emailPrefs, [field]: value };
    setEmailPrefs(newPrefs);

    startTransition(async () => {
      const result = await updateEmailPreferences({ [field]: value });
      if (!result.success) {
        // Revert on error
        setEmailPrefs(emailPrefs);
        toast.error('Failed to update preferences');
      } else {
        toast.success('Preferences updated');
      }
    });
  };

  const handleDigestChange = (value: 'instant' | 'daily' | 'weekly' | 'none') => {
    const newPrefs = { ...emailPrefs, digest: value };
    setEmailPrefs(newPrefs);

    startTransition(async () => {
      const result = await updateEmailPreferences({ digest: value });
      if (!result.success) {
        // Revert on error
        setEmailPrefs(emailPrefs);
        toast.error('Failed to update preferences');
      } else {
        toast.success('Preferences updated');
      }
    });
  };

  const handleInAppToggle = (enabled: boolean) => {
    const newPrefs = { ...inAppPrefs, enabled };
    setInAppPrefs(newPrefs);

    startTransition(async () => {
      const result = await updateInAppPreferences({ enabled });
      if (!result.success) {
        // Revert on error
        setInAppPrefs(inAppPrefs);
        toast.error('Failed to update preferences');
      } else {
        toast.success('Preferences updated');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <CardTitle>Email Notifications</CardTitle>
          </div>
          <CardDescription>
            Configure which notifications you receive via email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Master toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-enabled" className="text-base font-medium">
                Enable Email Notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications via email
              </p>
            </div>
            <Switch
              id="email-enabled"
              checked={emailPrefs.enabled}
              onCheckedChange={(checked) => handleEmailToggle('enabled', checked)}
              disabled={isPending}
            />
          </div>

          {emailPrefs.enabled && (
            <>
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-4">Notification Types</h4>
                <div className="space-y-4">
                  {/* Mentions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AtSign className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label htmlFor="email-mentions" className="font-normal">
                          Mentions
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          When someone @mentions you
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="email-mentions"
                      checked={emailPrefs.mentions}
                      onCheckedChange={(checked) => handleEmailToggle('mentions', checked)}
                      disabled={isPending}
                    />
                  </div>

                  {/* Assignments */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <UserPlus className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label htmlFor="email-assignments" className="font-normal">
                          Task Assignments
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          When you're assigned to a task
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="email-assignments"
                      checked={emailPrefs.assignments}
                      onCheckedChange={(checked) => handleEmailToggle('assignments', checked)}
                      disabled={isPending}
                    />
                  </div>

                  {/* Due dates */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label htmlFor="email-due-dates" className="font-normal">
                          Due Date Reminders
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Reminders for upcoming and overdue tasks
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="email-due-dates"
                      checked={emailPrefs.dueDates}
                      onCheckedChange={(checked) => handleEmailToggle('dueDates', checked)}
                      disabled={isPending}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-4">Delivery Frequency</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="email-digest" className="font-normal">
                      Email Frequency
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      How often you want to receive email notifications
                    </p>
                  </div>
                  <Select
                    value={emailPrefs.digest}
                    onValueChange={handleDigestChange}
                    disabled={isPending}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instant">Instant</SelectItem>
                      <SelectItem value="daily">Daily Digest</SelectItem>
                      <SelectItem value="weekly">Weekly Digest</SelectItem>
                      <SelectItem value="none">Never</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {emailPrefs.digest === 'daily' && (
                  <p className="text-sm text-muted-foreground mt-2">
                    You'll receive a daily summary at 7 AM with your tasks and notifications.
                  </p>
                )}
                {emailPrefs.digest === 'weekly' && (
                  <p className="text-sm text-muted-foreground mt-2">
                    You'll receive a weekly summary every Monday at 7 AM.
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* In-App Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>In-App Notifications</CardTitle>
          </div>
          <CardDescription>
            Configure notifications shown within the application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="inapp-enabled" className="text-base font-medium">
                Enable In-App Notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                Show notifications in the notification bell
              </p>
            </div>
            <Switch
              id="inapp-enabled"
              checked={inAppPrefs.enabled}
              onCheckedChange={handleInAppToggle}
              disabled={isPending}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
