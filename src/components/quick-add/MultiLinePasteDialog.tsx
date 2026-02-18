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
import { CornerDownRight, List } from 'lucide-react';
import type { PasteItem } from './SmartTaskInput';

const MAX_LINES = 50;
const PREVIEW_COUNT = 5;

interface MultiLinePasteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PasteItem[];
  onConfirm: () => void;
  isCreating: boolean;
  progress: { completed: number; total: number } | null;
}

export function MultiLinePasteDialog({
  open,
  onOpenChange,
  items,
  onConfirm,
  isCreating,
  progress,
}: MultiLinePasteDialogProps) {
  const itemCount = Math.min(items.length, MAX_LINES);
  const previewItems = items.slice(0, PREVIEW_COUNT);
  const remaining = itemCount - PREVIEW_COUNT;
  const parentCount = items.slice(0, MAX_LINES).filter((i) => !i.isSubtask).length;
  const subtaskCount = items.slice(0, MAX_LINES).filter((i) => i.isSubtask).length;

  return (
    <AlertDialog open={open} onOpenChange={isCreating ? undefined : onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <List className="size-5" />
            Create {itemCount} {itemCount === 1 ? 'task' : 'tasks'}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {subtaskCount > 0
              ? `${parentCount} ${parentCount === 1 ? 'task' : 'tasks'} and ${subtaskCount} ${subtaskCount === 1 ? 'subtask' : 'subtasks'} will be created. Indented lines become subtasks of the task above them.`
              : 'Each line will become a separate task with the current board, status, assignee, and date settings.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-1">
          {previewItems.map((item, i) => (
            <div key={i} className="flex gap-2 text-sm py-0.5 items-center">
              {item.isSubtask ? (
                <CornerDownRight className="size-3.5 text-muted-foreground/60 shrink-0 ml-5" />
              ) : (
                <span className="text-muted-foreground/60 tabular-nums w-5 shrink-0 text-right">
                  &bull;
                </span>
              )}
              <span className={`truncate ${item.isSubtask ? 'text-muted-foreground' : ''}`}>
                {item.title}
              </span>
            </div>
          ))}
          {remaining > 0 && (
            <p className="text-xs text-muted-foreground pl-7">
              and {remaining} more...
            </p>
          )}
        </div>

        {items.length > MAX_LINES && (
          <p className="text-xs text-muted-foreground">
            Only the first {MAX_LINES} lines will be created ({items.length - MAX_LINES} lines omitted).
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
              Create {itemCount} {itemCount === 1 ? 'task' : 'tasks'}
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
