'use client';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { List } from 'lucide-react';

const MAX_LINES = 50;
const PREVIEW_COUNT = 3;

interface MultiLinePasteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lines: string[];
  onConfirm: () => void;
  isCreating: boolean;
  progress: { completed: number; total: number } | null;
}

export function MultiLinePasteDialog({
  open,
  onOpenChange,
  lines,
  onConfirm,
  isCreating,
  progress,
}: MultiLinePasteDialogProps) {
  const taskCount = Math.min(lines.length, MAX_LINES);
  const previewLines = lines.slice(0, PREVIEW_COUNT);
  const remaining = taskCount - PREVIEW_COUNT;

  return (
    <AlertDialog open={open} onOpenChange={isCreating ? undefined : onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <List className="size-5" />
            Create {taskCount} tasks?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Each line will become a separate task with the current board, status, assignee, and date settings.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-1">
          {previewLines.map((line, i) => (
            <div key={i} className="flex gap-2 text-sm py-0.5">
              <span className="text-muted-foreground/60 tabular-nums w-5 shrink-0 text-right">
                {i + 1}.
              </span>
              <span className="truncate">{line}</span>
            </div>
          ))}
          {remaining > 0 && (
            <p className="text-xs text-muted-foreground pl-7">
              and {remaining} more...
            </p>
          )}
        </div>

        {lines.length > MAX_LINES && (
          <p className="text-xs text-muted-foreground">
            Only the first {MAX_LINES} lines will be created ({lines.length - MAX_LINES} lines omitted).
          </p>
        )}

        {isCreating && progress ? (
          <div className="space-y-2">
            <Progress value={(progress.completed / progress.total) * 100} />
            <p className="text-sm text-muted-foreground text-center">
              {progress.completed < progress.total
                ? `Creating task ${progress.completed + 1} of ${progress.total}...`
                : `Finishing up...`}
            </p>
          </div>
        ) : (
          <AlertDialogFooter>
            <Button onClick={onConfirm}>
              Create {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </AlertDialogFooter>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
