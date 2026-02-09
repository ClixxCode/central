'use client';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ListTree } from 'lucide-react';

interface CompleteParentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incompleteCount: number;
  onConfirm: (completeSubtasks: boolean) => void;
}

/**
 * Confirmation dialog shown when completing a parent task that has incomplete subtasks.
 * User can choose to complete all subtasks, just the parent, or cancel.
 */
export function CompleteParentDialog({
  open,
  onOpenChange,
  incompleteCount,
  onConfirm,
}: CompleteParentDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ListTree className="size-5" />
            Complete task with subtasks
          </AlertDialogTitle>
          <AlertDialogDescription>
            This task has {incompleteCount} incomplete{' '}
            {incompleteCount === 1 ? 'subtask' : 'subtasks'}. Would you like to
            mark {incompleteCount === 1 ? 'it' : 'them'} as complete too?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="outline"
            onClick={() => {
              onConfirm(false);
              onOpenChange(false);
            }}
          >
            Just this task
          </Button>
          <Button
            onClick={() => {
              onConfirm(true);
              onOpenChange(false);
            }}
          >
            Complete all
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
