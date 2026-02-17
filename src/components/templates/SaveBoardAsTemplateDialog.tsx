'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useCreateTemplateFromBoard } from '@/lib/hooks';

interface SaveBoardAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  boardName: string;
  taskCount?: number;
}

export function SaveBoardAsTemplateDialog({
  open,
  onOpenChange,
  boardId,
  boardName,
  taskCount = 0,
}: SaveBoardAsTemplateDialogProps) {
  const [name, setName] = React.useState(boardName);
  const [description, setDescription] = React.useState('');
  const [includeTasks, setIncludeTasks] = React.useState(true);
  const createFromBoard = useCreateTemplateFromBoard();

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setName(boardName);
      setDescription('');
      setIncludeTasks(true);
    }
  }, [open, boardName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createFromBoard.mutate(
      {
        boardId,
        name: name.trim(),
        description: description.trim() || null,
        includeTasks,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
            <DialogDescription>
              Create a board template from this board&apos;s configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="save-template-name">Template Name</Label>
              <Input
                id="save-template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="save-template-desc">Description (optional)</Label>
              <Textarea
                id="save-template-desc"
                placeholder="Describe this template..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            {taskCount > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="include-tasks"
                  checked={includeTasks}
                  onCheckedChange={(checked) => setIncludeTasks(checked === true)}
                />
                <Label htmlFor="include-tasks" className="text-sm font-normal cursor-pointer">
                  Include tasks ({taskCount} {taskCount === 1 ? 'task' : 'tasks'})
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || createFromBoard.isPending}>
              {createFromBoard.isPending ? 'Saving...' : 'Save Template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
