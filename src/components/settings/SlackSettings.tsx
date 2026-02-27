'use client';

import { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NotificationTypeToggles, type NotificationToggleSettings } from './NotificationTypeToggles';
import { toast } from 'sonner';

interface SlackSettingsProps {
  settings: {
    enabled: boolean;
    slackUsername?: string;
    mentions: boolean;
    assignments: boolean;
    dueDates: boolean;
    newComments: boolean;
    replies: boolean;
    reactions?: boolean;
  };
  onUpdate: (settings: Partial<SlackSettingsProps['settings']>) => Promise<{ success: boolean; error?: string }>;
}

export function SlackSettings({ settings, onUpdate }: SlackSettingsProps) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [usernameInput, setUsernameInput] = useState(settings.slackUsername || '');

  useEffect(() => {
    setLocalSettings(settings);
    setUsernameInput(settings.slackUsername || '');
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

  const handleSaveUsername = async () => {
    const cleanUsername = usernameInput.trim().replace(/^@/, '');
    setIsSaving(true);
    const result = await onUpdate({ slackUsername: cleanUsername || undefined });
    setIsSaving(false);
    if (result.success) {
      toast.success('Slack username saved');
    } else {
      toast.error(result.error || 'Failed to save username');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-500/20 rounded-lg">
              <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-base">Slack Notifications</CardTitle>
              <CardDescription>Receive notifications via Slack DM</CardDescription>
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
          {/* Slack Username */}
          <div className="space-y-2">
            <Label htmlFor="slack-username">Your Slack Username</Label>
            <p className="text-xs text-muted-foreground">
              Enter your Slack display name or username (without the @)
            </p>
            <div className="flex gap-2">
              <Input
                id="slack-username"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="johndoe"
                className="max-w-xs"
              />
              <Button
                onClick={handleSaveUsername}
                disabled={isSaving}
                variant="outline"
              >
                Save
              </Button>
            </div>
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
                reactions: localSettings.reactions ?? true,
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
