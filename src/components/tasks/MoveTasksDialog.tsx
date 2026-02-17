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
import { ArrowRightLeft } from 'lucide-react';

interface MoveTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskCount: number;
  targetBoardName: string;
  onConfirm: () => void;
}

export function MoveTasksDialog({
  open,
  onOpenChange,
  taskCount,
  targetBoardName,
  onConfirm,
}: MoveTasksDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="size-5" />
            Move {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Move {taskCount} {taskCount === 1 ? 'task' : 'tasks'} to{' '}
            <span className="font-medium text-foreground">{targetBoardName}</span>?
            This will reset their status and section to the new board&apos;s defaults.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Move {taskCount === 1 ? 'task' : 'tasks'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
