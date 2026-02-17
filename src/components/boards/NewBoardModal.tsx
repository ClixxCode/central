'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCreateBoard } from '@/lib/hooks';

interface NewBoardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
}

const DEFAULT_STATUSES = [
  { id: 'todo', label: 'To Do', color: '#6B7280' },
  { id: 'in-progress', label: 'In Progress', color: '#3B82F6' },
  { id: 'review', label: 'Review', color: '#F59E0B' },
  { id: 'complete', label: 'Complete', color: '#10B981' },
];

export function NewBoardModal({ open, onOpenChange, clientId }: NewBoardModalProps) {
  const createBoard = useCreateBoard();

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    try {
      await createBoard.mutateAsync({
        clientId,
        name: name.trim(),
      });
      resetForm();
      onOpenChange(false);
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New Board</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="board-name" className="text-sm font-medium text-foreground">
                Name
              </label>
              <Input
                id="board-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Main Board"
                autoFocus
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createBoard.isPending}>
              {createBoard.isPending ? 'Creating...' : 'Create Board'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
