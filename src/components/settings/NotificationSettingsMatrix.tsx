'use client';

import { useState, useEffect } from 'react';
import { Bell, Mail, MessageSquare, Check, X, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { UserPreferences } from '@/lib/schema/users';

// Notification types with their display info
const NOTIFICATION_TYPES = [
  {
    key: 'mentions' as const,
    label: 'Mentions',
    description: 'When someone @mentions you',
  },
  {
    key: 'assignments' as const,
    label: 'Task Assignments',
    description: 'When you are assigned to a task',
  },
  {
    key: 'dueDates' as const,
    label: 'Due Dates',
    description: 'Reminders for upcoming and overdue tasks',
  },
  {
    key: 'newComments' as const,
    label: 'New Comments',
    description: 'Comments on tasks you are assigned to',
  },
  {
    key: 'replies' as const,
    label: 'Replies',
    description: 'Replies to your comments',
  },
  {
    key: 'reactions' as const,
    label: 'Reactions',
    description: 'Reactions to your comments',
  },
];

// Channel configuration
const CHANNELS = [
  {
    key: 'inApp' as const,
    label: 'In-App',
    icon: Bell,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-500/20',
  },
  {
    key: 'email' as const,
    label: 'Email',
    icon: Mail,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-500/20',
  },
  {
    key: 'slack' as const,
    label: 'Slack',
    icon: MessageSquare,
    colorStyle: '#E11E5A',
    bgColor: 'bg-red-100 dark:bg-red-500/20',
  },
];

type NotificationType = (typeof NOTIFICATION_TYPES)[number]['key'];
type ChannelKey = (typeof CHANNELS)[number]['key'];

interface NotificationSettingsMatrixProps {
  preferences: UserPreferences['notifications'];
  isContractor?: boolean;
  onUpdateEmail: (settings: Partial<UserPreferences['notifications']['email']>) => Promise<{ success: boolean; error?: string }>;
  onUpdateSlack: (settings: Partial<UserPreferences['notifications']['slack']>) => Promise<{ success: boolean; error?: string }>;
  onUpdateInApp: (settings: Partial<UserPreferences['notifications']['inApp'] & { mentions?: boolean; assignments?: boolean; dueDates?: boolean; newComments?: boolean; replies?: boolean; reactions?: boolean }>) => Promise<{ success: boolean; error?: string }>;
}

export function NotificationSettingsMatrix({
  preferences,
  isContractor = false,
  onUpdateEmail,
  onUpdateSlack,
  onUpdateInApp,
}: NotificationSettingsMatrixProps) {
  const [localPrefs, setLocalPrefs] = useState(preferences);
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set());
  const [slackUsername, setSlackUsername] = useState(preferences.slack.slackUsername ?? '');

  useEffect(() => {
    setLocalPrefs(preferences);
    setSlackUsername(preferences.slack.slackUsername ?? '');
  }, [preferences]);

  const isChannelEnabled = (channel: ChannelKey): boolean => {
    return localPrefs[channel].enabled;
  };

  const isTypeEnabled = (channel: ChannelKey, type: NotificationType): boolean => {
    const channelPrefs = localPrefs[channel];
    return (channelPrefs as unknown as Record<string, boolean>)[type] ?? true;
  };

  const handleChannelToggle = async (channel: ChannelKey, enabled: boolean) => {
    const key = `${channel}-enabled`;
    setPendingChanges((prev) => new Set(prev).add(key));

    setLocalPrefs((prev) => ({
      ...prev,
      [channel]: { ...prev[channel], enabled },
    }));

    let result: { success: boolean; error?: string };
    if (channel === 'email') {
      result = await onUpdateEmail({ enabled });
    } else if (channel === 'slack') {
      result = await onUpdateSlack({ enabled });
    } else {
      result = await onUpdateInApp({ enabled });
    }

    setPendingChanges((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

    if (!result.success) {
      toast.error(result.error ?? 'Failed to update settings');
      setLocalPrefs(preferences);
    }
  };

  const handleTypeToggle = async (channel: ChannelKey, type: NotificationType, enabled: boolean) => {
    const key = `${channel}-${type}`;
    setPendingChanges((prev) => new Set(prev).add(key));

    setLocalPrefs((prev) => ({
      ...prev,
      [channel]: { ...prev[channel], [type]: enabled },
    }));

    let result: { success: boolean; error?: string };
    if (channel === 'email') {
      result = await onUpdateEmail({ [type]: enabled });
    } else if (channel === 'slack') {
      result = await onUpdateSlack({ [type]: enabled });
    } else {
      result = await onUpdateInApp({ [type]: enabled });
    }

    setPendingChanges((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

    if (!result.success) {
      toast.error(result.error ?? 'Failed to update settings');
      setLocalPrefs(preferences);
    }
  };

  const handleDigestChange = async (digest: 'instant' | 'daily' | 'weekly' | 'none') => {
    const key = 'email-digest';
    setPendingChanges((prev) => new Set(prev).add(key));

    setLocalPrefs((prev) => ({
      ...prev,
      email: { ...prev.email, digest },
    }));

    const result = await onUpdateEmail({ digest });

    setPendingChanges((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

    if (!result.success) {
      toast.error(result.error ?? 'Failed to update settings');
      setLocalPrefs(preferences);
    }
  };

  const handleSaveSlackUsername = async () => {
    const key = 'slack-username';
    setPendingChanges((prev) => new Set(prev).add(key));

    const cleanUsername = slackUsername.trim().replace(/^@/, '');
    const result = await onUpdateSlack({ slackUsername: cleanUsername || undefined });

    setPendingChanges((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

    if (result.success) {
      toast.success('Slack username saved');
    } else {
      toast.error(result.error ?? 'Failed to save username');
    }
  };

  const handleSlackLinkTypeChange = async (value: 'web' | 'app') => {
    const key = 'slack-linktype';
    setPendingChanges((prev) => new Set(prev).add(key));

    setLocalPrefs((prev) => ({
      ...prev,
      slack: { ...prev.slack, slackLinkType: value },
    }));

    const result = await onUpdateSlack({ slackLinkType: value });

    setPendingChanges((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

    if (!result.success) {
      toast.error(result.error ?? 'Failed to update setting');
      setLocalPrefs(preferences);
    }
  };

  const isPending = (key: string) => pendingChanges.has(key);

  // Contractors don't get Slack notifications
  const visibleChannels = isContractor
    ? CHANNELS.filter((c) => c.key !== 'slack')
    : CHANNELS;

  // Check if a specific cell should be hidden
  const isCellHidden = (channelKey: ChannelKey, typeKey: NotificationType): boolean => {
    // Non-contractors can't get email due date notifications
    if (!isContractor && channelKey === 'email' && typeKey === 'dueDates') return true;
    return false;
  };

  return (
    <div className="space-y-6">
      {/* Channel Master Toggles */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Channels</CardTitle>
          <CardDescription>
            Enable or disable entire notification channels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={cn('grid gap-4', visibleChannels.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
            {visibleChannels.map((channel) => {
              const Icon = channel.icon;
              const enabled = isChannelEnabled(channel.key);
              const pending = isPending(`${channel.key}-enabled`);

              return (
                <div
                  key={channel.key}
                  className={cn(
                    'flex items-center justify-between rounded-lg border p-4 transition-colors',
                    enabled ? 'bg-muted/30' : 'opacity-60'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn('rounded-lg p-2', channel.bgColor)}>
                      <Icon className={cn('h-5 w-5', 'color' in channel && channel.color)} style={'colorStyle' in channel ? { color: channel.colorStyle } : undefined} />
                    </div>
                    <Label className="font-medium">{channel.label}</Label>
                  </div>
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch
                      checked={enabled}
                      onCheckedChange={(checked) => handleChannelToggle(channel.key, checked)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Notification Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Types</CardTitle>
          <CardDescription>
            Choose which notifications you receive on each channel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Notification</TableHead>
                  {visibleChannels.map((channel) => {
                    const Icon = channel.icon;
                    return (
                      <TableHead key={channel.key} className="text-center w-[100px]">
                        <div className="flex items-center justify-center gap-2">
                          <Icon className={cn('h-4 w-4', 'color' in channel && channel.color)} style={'colorStyle' in channel ? { color: channel.colorStyle } : undefined} />
                          <span className="hidden sm:inline">{channel.label}</span>
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {NOTIFICATION_TYPES.map((notif) => (
                  <TableRow key={notif.key}>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <p className="font-medium">{notif.label}</p>
                            <p className="text-xs text-muted-foreground hidden sm:block">
                              {notif.description}
                            </p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="sm:hidden">
                          {notif.description}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    {visibleChannels.map((channel) => {
                      const hidden = isCellHidden(channel.key, notif.key);
                      if (hidden) {
                        return <TableCell key={channel.key} className="text-center" />;
                      }

                      const channelEnabled = isChannelEnabled(channel.key);
                      const typeEnabled = isTypeEnabled(channel.key, notif.key);
                      const pending = isPending(`${channel.key}-${notif.key}`);
                      const disabled = !channelEnabled;

                      return (
                        <TableCell key={channel.key} className="text-center">
                          {pending ? (
                            <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                          ) : (
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() => handleTypeToggle(channel.key, notif.key, !typeEnabled)}
                              className={cn(
                                'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                                disabled && 'cursor-not-allowed opacity-30',
                                !disabled && typeEnabled && 'bg-primary/10 text-primary hover:bg-primary/20',
                                !disabled && !typeEnabled && 'bg-muted text-muted-foreground hover:bg-muted/80'
                              )}
                            >
                              {typeEnabled ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <X className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* Channel-specific settings */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Email Settings */}
        {localPrefs.email.enabled && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Email Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="digest-frequency">Delivery Frequency</Label>
                <Select
                  value={localPrefs.email.digest}
                  onValueChange={handleDigestChange}
                  disabled={isPending('email-digest')}
                >
                  <SelectTrigger id="digest-frequency" className="w-full">
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
            </CardContent>
          </Card>
        )}

        {/* Slack Settings */}
        {!isContractor && localPrefs.slack.enabled && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" style={{ color: '#E11E5A' }} />
                Slack Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="slack-username">Your Slack Username</Label>
                  <p className="text-xs text-muted-foreground">
                    Enter your Slack display name or username (without the @)
                  </p>
                  <div className="flex gap-2">
                    <Input
                      id="slack-username"
                      value={slackUsername}
                      onChange={(e) => setSlackUsername(e.target.value)}
                      placeholder="johndoe"
                    />
                    <Button
                      onClick={handleSaveSlackUsername}
                      disabled={isPending('slack-username')}
                      variant="outline"
                    >
                      {isPending('slack-username') ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Save'
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slack-link-type">Open Slack links in</Label>
                  <Select
                    value={localPrefs.slack.slackLinkType ?? 'web'}
                    onValueChange={(v) => handleSlackLinkTypeChange(v as 'web' | 'app')}
                    disabled={isPending('slack-linktype')}
                  >
                    <SelectTrigger id="slack-link-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="web">Web browser</SelectItem>
                      <SelectItem value="app">Desktop app</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose how the &ldquo;Slack&rdquo; button on tasks opens your channel
                  </p>
                </div>

              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
