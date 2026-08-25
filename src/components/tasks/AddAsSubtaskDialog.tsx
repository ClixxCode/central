'use client';

import * as React from 'react';
import { Check, CornerDownRight, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAddTasksAsSubtasks, useParentTaskCandidates } from '@/lib/hooks/useTasks';
import { cn } from '@/lib/utils';

interface AddAsSubtaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskIds: string[];
  onAdded?: () => void;
}

export function AddAsSubtaskDialog({
  open,
  onOpenChange,
  taskIds,
  onAdded,
}: AddAsSubtaskDialogProps) {
  const [search, setSearch] = React.useState('');
  const [selectedParentId, setSelectedParentId] = React.useState<string | null>(null);
  const deferredSearch = React.useDeferredValue(search);
  const candidates = useParentTaskCandidates(taskIds, deferredSearch, { enabled: open });
  const addAsSubtask = useAddTasksAsSubtasks();

  React.useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedParentId(null);
    }
  }, [open]);

  const selectedParent = candidates.data?.find((candidate) => candidate.id === selectedParentId);
  const taskLabel = taskIds.length === 1 ? 'task' : `${taskIds.length} tasks`;

  const handleConfirm = async () => {
    if (!selectedParentId) return;
    try {
      await addAsSubtask.mutateAsync({ taskIds, parentTaskId: selectedParentId });
      onOpenChange(false);
      onAdded?.();
    } catch {
      // The mutation hook displays the server-provided error and keeps the
      // dialog open so the user can choose another parent or retry.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CornerDownRight className="size-5" />
            Add {taskLabel} as {taskIds.length === 1 ? 'a subtask' : 'subtasks'}
          </DialogTitle>
          <DialogDescription>
            Choose a parent task from the same board. Task details, comments, attachments, and
            assignees will be preserved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelectedParentId(null);
              }}
              placeholder="Search parent tasks..."
              className="pl-9"
              autoFocus
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-md border p-1">
            {candidates.isLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Loading tasks...
              </div>
            ) : candidates.error ? (
              <p className="px-3 py-8 text-center text-sm text-destructive">
                {candidates.error.message}
              </p>
            ) : candidates.data?.length ? (
              candidates.data.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => setSelectedParentId(candidate.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent',
                    selectedParentId === candidate.id && 'bg-accent'
                  )}
                >
                  <CornerDownRight className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{candidate.title}</span>
                  {selectedParentId === candidate.id && <Check className="size-4 shrink-0" />}
                </button>
              ))
            ) : (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                {search.trim() ? 'No matching parent tasks.' : 'No eligible parent tasks on this board.'}
              </p>
            )}
          </div>

          {selectedParent && (
            <p className="text-sm text-muted-foreground">
              {taskIds.length === 1 ? 'This task' : `These ${taskIds.length} tasks`} will be appended
              under <span className="font-medium text-foreground">{selectedParent.title}</span>.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={addAsSubtask.isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedParentId || addAsSubtask.isPending}>
            {addAsSubtask.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Add as subtask
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
