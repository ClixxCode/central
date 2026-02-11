'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useSiteSettings, useUpdateSiteSettings } from '@/lib/hooks/useSiteSettings';

export function ArchiveSettingsPageClient() {
  const { data: settings, isLoading } = useSiteSettings();
  const updateSettings = useUpdateSiteSettings();

  const [enabled, setEnabled] = React.useState(false);
  const [days, setDays] = React.useState(30);

  // Sync state when settings load
  React.useEffect(() => {
    if (settings) {
      const d = settings.autoArchiveDays;
      setEnabled(d != null && d > 0);
      setDays(d && d > 0 ? d : 30);
    }
  }, [settings]);

  const hasChanges = React.useMemo(() => {
    if (!settings) return false;
    const currentEnabled = settings.autoArchiveDays != null && settings.autoArchiveDays > 0;
    const currentDays = settings.autoArchiveDays ?? 30;
    return enabled !== currentEnabled || (enabled && days !== currentDays);
  }, [settings, enabled, days]);

  const handleSave = async () => {
    const result = await updateSettings.mutateAsync(
      enabled ? { autoArchiveDays: days } : { autoArchiveDays: null }
    );
    if (result.success) {
      toast.success('Archive settings updated');
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
        <h2 className="text-lg font-semibold">Archive</h2>
        <p className="text-sm text-muted-foreground">
          Configure automatic archiving of completed tasks.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auto-Archive</CardTitle>
          <CardDescription>
            Automatically archive completed tasks after a set number of days. Archived tasks are
            hidden from board views but remain searchable and can be restored.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-archive-toggle">Enable auto-archive</Label>
            <Switch
              id="auto-archive-toggle"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
          {enabled && (
            <div className="flex items-center gap-3">
              <Label htmlFor="auto-archive-days" className="shrink-0">
                Archive after
              </Label>
              <Input
                id="auto-archive-days"
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(Math.max(1, Math.min(365, parseInt(e.target.value) || 1)))}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
          )}
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
