'use client';

import * as React from 'react';
import { RotateCcw, Trash2, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ClientIcon } from '@/components/clients/ClientIcon';
import { useArchivedBuilds, useUnarchiveBuild, useDeleteBuild, useCurrentUser } from '@/lib/hooks';
import { getBuildArchiveReason } from '@/lib/builds/archive-reasons';
import { getBuildStage } from '@/lib/builds/stages';
import type { AgenticBuild } from '@/lib/actions/builds';

/** Builds taken off the board: why, by whom, and how to get them back. */
export function ArchivedBuildsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: builds = [], isLoading } = useArchivedBuilds(open);
  const unarchive = useUnarchiveBuild();
  const del = useDeleteBuild();
  const { isAdmin } = useCurrentUser();
  const [confirmDelete, setConfirmDelete] = React.useState<AgenticBuild | null>(null);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="size-4" />
              Archived builds
            </DialogTitle>
            <DialogDescription>
              Builds taken off the board, newest first. Restoring puts one back in the stage it left.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : builds.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing archived yet.
            </p>
          ) : (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {builds.map((b) => {
                const reason = getBuildArchiveReason(b.archiveReason);
                const stage = getBuildStage(b.buildStage);
                return (
                  <div key={b.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {b.clientName && (
                          <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <ClientIcon
                              icon={b.clientIcon}
                              color={b.clientColor ?? '#6B7280'}
                              name={b.clientName}
                              size="sm"
                            />
                            <span className="truncate">{b.clientName}</span>
                          </div>
                        )}
                        <p className="text-sm font-medium leading-snug">{b.title}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none">
                            {reason?.label ?? 'No reason recorded'}
                          </span>
                          {stage && (
                            <span className="text-muted-foreground">
                              left in {stage.label}
                            </span>
                          )}
                          <span className="text-muted-foreground">
                            · {b.archivedAt?.slice(0, 10)}
                            {b.archivedByName ? ` by ${b.archivedByName}` : ''}
                          </span>
                        </div>
                        {b.archiveNote && (
                          <p className="mt-1.5 border-l-2 pl-2 text-xs italic text-muted-foreground">
                            {b.archiveNote}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => unarchive.mutate(b.id)}
                          disabled={unarchive.isPending}
                        >
                          <RotateCcw className="mr-1.5 size-3.5" />
                          Restore
                        </Button>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => setConfirmDelete(b)}
                            title="Delete permanently"
                            aria-label={`Delete ${b.title} permanently`}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{confirmDelete?.title}” permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the build and its stage history for good, so the time it spent in each
              stage stops counting toward build-time analytics. Only do this for cards that were
              never a real build — otherwise leave it archived.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDelete) del.mutate(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
