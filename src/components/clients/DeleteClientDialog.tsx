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
import type { ClientWithBoards } from '@/lib/actions/clients';

interface DeleteClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ClientWithBoards | null;
  onConfirm: () => void;
  isPending: boolean;
}

export function DeleteClientDialog({
  open,
  onOpenChange,
  client,
  onConfirm,
  isPending,
}: DeleteClientDialogProps) {
  if (!client) return null;

  const boardCount = client.boards.length;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Client</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{client.name}</strong>?
            {boardCount > 0 && (
              <>
                {' '}
                This will also delete {boardCount} {boardCount === 1 ? 'board' : 'boards'}{' '}
                and all associated tasks.
              </>
            )}
            {' '}This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-destructive hover:bg-destructive/90 focus:ring-destructive"
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
