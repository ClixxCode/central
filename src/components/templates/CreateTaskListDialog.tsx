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
import { useCreateTaskList } from '@/lib/hooks';

interface CreateTaskListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTaskListDialog({ open, onOpenChange }: CreateTaskListDialogProps) {
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const createTaskList = useCreateTaskList();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createTaskList.mutate(
      {
        name: name.trim(),
        description: description.trim() || null,
      },
      {
        onSuccess: () => {
          setName('');
          setDescription('');
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
            <DialogTitle>New Task List</DialogTitle>
            <DialogDescription>
              Create a named collection of tasks that can be quickly added to any board.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tasklist-name">Name</Label>
              <Input
                id="tasklist-name"
                placeholder="e.g., Onboarding Checklist"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tasklist-desc">Description (optional)</Label>
              <Textarea
                id="tasklist-desc"
                placeholder="Describe what this task list is for..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || createTaskList.isPending}>
              {createTaskList.isPending ? 'Creating...' : 'Create Task List'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
