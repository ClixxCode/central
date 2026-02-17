'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { NotificationTypeToggles, type NotificationToggleSettings } from './NotificationTypeToggles';
import { toast } from 'sonner';

interface InAppSettingsProps {
  settings: {
    enabled: boolean;
    mentions: boolean;
    assignments: boolean;
    dueDates: boolean;
    newComments: boolean;
    replies: boolean;
  };
  onUpdate: (settings: Partial<InAppSettingsProps['settings']>) => Promise<{ success: boolean; error?: string }>;
}

export function InAppSettings({ settings, onUpdate }: InAppSettingsProps) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleToggleChange = async (key: keyof NotificationToggleSettings, value: boolean) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setIsSaving(true);
    const result = await onUpdate({ [key]: value });
    setIsSaving(false);
    if (!result.success) {
      toast.error(result.error || 'Failed to update settings');
      setLocalSettings(settings);
    }
  };

  const handleEnabledChange = async (enabled: boolean) => {
    setLocalSettings(prev => ({ ...prev, enabled }));
    setIsSaving(true);
    const result = await onUpdate({ enabled });
    setIsSaving(false);
    if (!result.success) {
      toast.error(result.error || 'Failed to update settings');
      setLocalSettings(settings);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-500/20 rounded-lg">
              <Bell className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle className="text-base">In-App Notifications</CardTitle>
              <CardDescription>Notifications shown in the app</CardDescription>
            </div>
          </div>
          <Switch
            checked={localSettings.enabled}
            onCheckedChange={handleEnabledChange}
            disabled={isSaving}
          />
        </div>
      </CardHeader>

      {localSettings.enabled && (
        <CardContent>
          <Label className="text-base font-medium">Notification Types</Label>
          <div className="mt-3">
            <NotificationTypeToggles
              settings={{
                mentions: localSettings.mentions,
                assignments: localSettings.assignments,
                dueDates: localSettings.dueDates,
                newComments: localSettings.newComments,
                replies: localSettings.replies,
              }}
              onChange={handleToggleChange}
              disabled={isSaving}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
