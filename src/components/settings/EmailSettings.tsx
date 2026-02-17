'use client';

import { useState, useEffect } from 'react';
import { Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NotificationTypeToggles, type NotificationToggleSettings } from './NotificationTypeToggles';
import { toast } from 'sonner';

interface EmailSettingsProps {
  settings: {
    enabled: boolean;
    mentions: boolean;
    assignments: boolean;
    dueDates: boolean;
    newComments: boolean;
    replies: boolean;
    digest: 'instant' | 'daily' | 'weekly' | 'none';
  };
  onUpdate: (settings: Partial<EmailSettingsProps['settings']>) => Promise<{ success: boolean; error?: string }>;
}

export function EmailSettings({ settings, onUpdate }: EmailSettingsProps) {
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
      setLocalSettings(settings); // Revert on error
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

  const handleDigestChange = async (digest: 'instant' | 'daily' | 'weekly' | 'none') => {
    setLocalSettings(prev => ({ ...prev, digest }));
    setIsSaving(true);
    const result = await onUpdate({ digest });
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
            <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
              <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-base">Email Notifications</CardTitle>
              <CardDescription>Receive notifications via email</CardDescription>
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
        <CardContent className="space-y-6">
          {/* Digest Frequency */}
          <div className="space-y-2">
            <Label htmlFor="digest-frequency">Delivery Frequency</Label>
            <Select
              value={localSettings.digest}
              onValueChange={handleDigestChange}
              disabled={isSaving}
            >
              <SelectTrigger id="digest-frequency" className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instant">Instant (as they happen)</SelectItem>
                <SelectItem value="daily">Daily digest</SelectItem>
                <SelectItem value="weekly">Weekly digest</SelectItem>
                <SelectItem value="none">Never</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose how often you receive email notifications
            </p>
          </div>

          {/* Notification Types */}
          <div className="space-y-4 pt-4 border-t">
            <Label className="text-base font-medium">Notification Types</Label>
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
