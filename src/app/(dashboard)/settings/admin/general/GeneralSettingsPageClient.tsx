'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSiteSettings, useUpdateSiteSettings } from '@/lib/hooks/useSiteSettings';

const TIMEZONE_GROUPS: { label: string; timezones: { value: string; label: string }[] }[] = [
  {
    label: 'US & Canada',
    timezones: [
      { value: 'America/New_York', label: 'Eastern Time (ET)' },
      { value: 'America/Chicago', label: 'Central Time (CT)' },
      { value: 'America/Denver', label: 'Mountain Time (MT)' },
      { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
      { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
      { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
    ],
  },
  {
    label: 'Europe',
    timezones: [
      { value: 'Europe/London', label: 'London (GMT/BST)' },
      { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
      { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
      { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)' },
      { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)' },
      { value: 'Europe/Rome', label: 'Rome (CET/CEST)' },
      { value: 'Europe/Zurich', label: 'Zurich (CET/CEST)' },
      { value: 'Europe/Stockholm', label: 'Stockholm (CET/CEST)' },
      { value: 'Europe/Helsinki', label: 'Helsinki (EET/EEST)' },
      { value: 'Europe/Athens', label: 'Athens (EET/EEST)' },
      { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
    ],
  },
  {
    label: 'Asia & Pacific',
    timezones: [
      { value: 'Asia/Dubai', label: 'Dubai (GST)' },
      { value: 'Asia/Kolkata', label: 'India (IST)' },
      { value: 'Asia/Bangkok', label: 'Bangkok (ICT)' },
      { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
      { value: 'Asia/Shanghai', label: 'China (CST)' },
      { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
      { value: 'Asia/Seoul', label: 'Seoul (KST)' },
      { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
      { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)' },
      { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
    ],
  },
  {
    label: 'Americas',
    timezones: [
      { value: 'America/Toronto', label: 'Toronto (ET)' },
      { value: 'America/Vancouver', label: 'Vancouver (PT)' },
      { value: 'America/Mexico_City', label: 'Mexico City (CST)' },
      { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
      { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (ART)' },
      { value: 'America/Bogota', label: 'Bogotá (COT)' },
    ],
  },
  {
    label: 'Africa & Middle East',
    timezones: [
      { value: 'Africa/Cairo', label: 'Cairo (EET)' },
      { value: 'Africa/Lagos', label: 'Lagos (WAT)' },
      { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)' },
      { value: 'Africa/Nairobi', label: 'Nairobi (EAT)' },
      { value: 'Asia/Jerusalem', label: 'Jerusalem (IST)' },
      { value: 'Asia/Riyadh', label: 'Riyadh (AST)' },
    ],
  },
];

const DEFAULT_TIMEZONE = 'America/New_York';

export function GeneralSettingsPageClient() {
  const { data: settings, isLoading } = useSiteSettings();
  const updateSettings = useUpdateSiteSettings();

  const [timezone, setTimezone] = React.useState(DEFAULT_TIMEZONE);

  React.useEffect(() => {
    if (settings) {
      setTimezone(settings.timezone || DEFAULT_TIMEZONE);
    }
  }, [settings]);

  const hasChanges = React.useMemo(() => {
    if (!settings) return false;
    const currentTz = settings.timezone || DEFAULT_TIMEZONE;
    return timezone !== currentTz;
  }, [settings, timezone]);

  const handleSave = async () => {
    const result = await updateSettings.mutateAsync({ timezone });
    if (result.success) {
      toast.success('General settings updated');
    } else {
      toast.error(result.error ?? 'Failed to update settings');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">General</h2>
        <p className="text-sm text-muted-foreground">
          Configure general organization settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timezone</CardTitle>
          <CardDescription>
            Set your organization&apos;s timezone. This is used for due date calculations,
            overdue detection, and scheduled notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Label htmlFor="timezone-select" className="shrink-0">
              Timezone
            </Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="timezone-select" className="w-72">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONE_GROUPS.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.timezones.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateSettings.isPending}
            size="sm"
          >
            {updateSettings.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save changes
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
