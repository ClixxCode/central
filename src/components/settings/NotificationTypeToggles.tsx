'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export interface NotificationToggleSettings {
  mentions: boolean;
  assignments: boolean;
  dueDates: boolean;
  newComments: boolean;
  replies: boolean;
}

interface NotificationTypeTogglesProps {
  settings: NotificationToggleSettings;
  onChange: (key: keyof NotificationToggleSettings, value: boolean) => void;
  disabled?: boolean;
}

const NOTIFICATION_TYPES = [
  {
    key: 'mentions' as const,
    label: 'Mentions',
    description: 'When someone @mentions you in a task or comment',
  },
  {
    key: 'assignments' as const,
    label: 'Task Assignments',
    description: 'When you are assigned to a task',
  },
  {
    key: 'dueDates' as const,
    label: 'Due Date Reminders',
    description: 'Reminders for upcoming and overdue tasks',
  },
  {
    key: 'newComments' as const,
    label: 'New Comments',
    description: 'When someone comments on a task you are assigned to',
  },
  {
    key: 'replies' as const,
    label: 'Replies',
    description: 'When someone replies to your comments',
  },
];

export function NotificationTypeToggles({
  settings,
  onChange,
  disabled,
}: NotificationTypeTogglesProps) {
  return (
    <div className="space-y-4">
      {NOTIFICATION_TYPES.map(({ key, label, description }) => (
        <div key={key} className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor={`toggle-${key}`} className="text-sm font-medium">
              {label}
            </Label>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <Switch
            id={`toggle-${key}`}
            checked={settings[key]}
            onCheckedChange={(checked: boolean) => onChange(key, checked)}
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  );
}
