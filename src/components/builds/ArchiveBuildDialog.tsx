'use client';

import * as React from 'react';
import { Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useArchiveBuild } from '@/lib/hooks';
import { BUILD_ARCHIVE_REASONS } from '@/lib/builds/archive-reasons';
import type { AgenticBuild } from '@/lib/actions/builds';

/**
 * Take a build off the board, with a required reason.
 *
 * Archiving is soft: the card and its stage timings survive and can be restored
 * from the Archived drawer, so this is the safe default for anything that
 * represents real work. Permanent delete lives in that drawer, admin-only.
 */
export function ArchiveBuildDialog({
  build,
  open,
  onOpenChange,
}: {
  build: AgenticBuild;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const archive = useArchiveBuild();
  const [reason, setReason] = React.useState('');
  const [note, setNote] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setReason('');
    setNote('');
  }, [open]);

  const selected = BUILD_ARCHIVE_REASONS.find((r) => r.id === reason);

  function handleArchive() {
    if (!reason || archive.isPending) return;
    archive.mutate(
      { taskId: build.id, input: { reason, note: note.trim() || null } },
      { onSuccess: () => onOpenChange(false) }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive “{build.title}”</DialogTitle>
          <DialogDescription>
            The build comes off the board but nothing is lost — its stage timings are kept, and you
            can restore it from Archived at any time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-sm font-medium">Why is it coming off the board?</p>
            <div className="space-y-1">
              {BUILD_ARCHIVE_REASONS.map((r) => (
                <label
                  key={r.id}
                  className={
                    'flex cursor-pointer items-start gap-2 rounded-md border p-2 transition-colors ' +
                    (reason === r.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50')
                  }
                >
                  <input
                    type="radio"
                    name="build-archive-reason"
                    className="mt-0.5 size-4 shrink-0"
                    checked={reason === r.id}
                    onChange={() => setReason(r.id)}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-tight">{r.label}</span>
                    <span className="block text-xs leading-tight text-muted-foreground">
                      {r.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Anything the team should know when they find this later…"
            />
          </div>

          {selected && (
            <p className="text-xs text-muted-foreground">
              {selected.excludeFromAnalytics
                ? 'Marked as bookkeeping noise — this build’s durations stay out of build-time analytics.'
                : 'Time already spent on this build still counts toward build-time analytics.'}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={archive.isPending}>
            Cancel
          </Button>
          <Button onClick={handleArchive} disabled={!reason || archive.isPending}>
            <Archive className="mr-2 size-4" />
            Archive build
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
