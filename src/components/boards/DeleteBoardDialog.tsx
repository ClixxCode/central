'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface DeleteBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board: { id: string; name: string } | null;
  onConfirm: () => void;
  isPending: boolean;
}

export function DeleteBoardDialog({
  open,
  onOpenChange,
  board,
  onConfirm,
  isPending,
}: DeleteBoardDialogProps) {
  const [confirmText, setConfirmText] = useState('');

  if (!board) return null;

  const isMatch = confirmText === board.name;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setConfirmText('');
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Board</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                This will permanently delete <strong>{board.name}</strong> and
                all of its tasks, comments, and attachments. This action cannot
                be undone.
              </p>
              <p>
                Type{' '}
                <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-sm select-all">
                  {board.name}
                </code>{' '}
                to confirm.
              </p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={board.name}
                autoFocus
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row sm:flex-row">
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              setConfirmText('');
            }}
            disabled={!isMatch || isPending}
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </Button>
          <AlertDialogCancel disabled={isPending} onClick={() => setConfirmText('')}>
            Cancel
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
