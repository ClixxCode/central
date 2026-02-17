'use client';

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
import { Button } from '@/components/ui/button';
import { Repeat, Trash2 } from 'lucide-react';

interface RecurringEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditThisOnly: () => void;
  onEditAllFuture: () => void;
}

/**
 * Dialog shown when editing a recurring task.
 * Asks if the user wants to edit only this occurrence or all future occurrences.
 */
export function RecurringEditDialog({
  open,
  onOpenChange,
  onEditThisOnly,
  onEditAllFuture,
}: RecurringEditDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Repeat className="size-5" />
            Edit recurring task
          </AlertDialogTitle>
          <AlertDialogDescription>
            This task is part of a recurring series. Do you want to edit only
            this occurrence, or all future occurrences?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="outline"
            onClick={() => {
              onEditThisOnly();
              onOpenChange(false);
            }}
          >
            This task only
          </Button>
          <Button
            onClick={() => {
              onEditAllFuture();
              onOpenChange(false);
            }}
          >
            All future tasks
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface RecurringDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteThisOnly: () => void;
  onDeleteFuture: () => void;
  onDeleteAll: () => void;
}

/**
 * Dialog shown when deleting a recurring task.
 * Asks if the user wants to delete this task only, this and future tasks, or the entire series.
 */
export function RecurringDeleteDialog({
  open,
  onOpenChange,
  onDeleteThisOnly,
  onDeleteFuture,
  onDeleteAll,
}: RecurringDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="size-5 text-destructive" />
            Delete recurring task
          </AlertDialogTitle>
          <AlertDialogDescription>
            This task is part of a recurring series. What would you like to
            delete?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <AlertDialogCancel className="sm:w-full">Cancel</AlertDialogCancel>
          <Button
            variant="outline"
            className="sm:w-full"
            onClick={() => {
              onDeleteThisOnly();
              onOpenChange(false);
            }}
          >
            This task only
          </Button>
          <Button
            variant="outline"
            className="sm:w-full"
            onClick={() => {
              onDeleteFuture();
              onOpenChange(false);
            }}
          >
            This and future tasks
          </Button>
          <Button
            variant="destructive"
            className="sm:w-full"
            onClick={() => {
              onDeleteAll();
              onOpenChange(false);
            }}
          >
            Delete entire series
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
