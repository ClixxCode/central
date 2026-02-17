'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArchiveRestore, Search, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { useArchivedTasks, useUnarchiveTask, useDeleteTask } from '@/lib/hooks/useTasks';
import type { StatusOption } from '@/lib/db/schema';
import { formatDistanceToNow } from 'date-fns';

interface ArchivedTasksTabProps {
  boardId: string;
  clientSlug: string;
  statusOptions: StatusOption[];
}

export function ArchivedTasksTab({
  boardId,
  clientSlug,
  statusOptions,
}: ArchivedTasksTabProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const unarchiveTask = useUnarchiveTask();
  const deleteTask = useDeleteTask();
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: archivedTasks = [], isLoading } = useArchivedTasks(
    boardId,
    debouncedSearch || undefined
  );

  const deleteConfirmTask = deleteConfirmId
    ? archivedTasks.find((t) => t.id === deleteConfirmId)
    : null;

  const handleOpenTask = (taskId: string) => {
    router.push(`/clients/${clientSlug}/boards/${boardId}?task=${taskId}`);
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search archived tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Loading...
        </p>
      ) : archivedTasks.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {debouncedSearch
            ? 'No archived tasks match your search.'
            : 'No archived tasks yet.'}
        </p>
      ) : (
        <div className="space-y-1">
          {archivedTasks.map((task) => {
            const statusOption = statusOptions.find((s) => s.id === task.status);
            return (
              <div
                key={task.id}
                className="group flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted transition-colors"
              >
                {statusOption && (
                  <div
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: statusOption.color }}
                  />
                )}
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left"
                  onClick={() => handleOpenTask(task.id)}
                >
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Archived {formatDistanceToNow(new Date(task.archivedAt), { addSuffix: true })}
                  </p>
                </button>

                {task.assignees.length > 0 && (
                  <div className="flex -space-x-1 shrink-0">
                    {task.assignees.slice(0, 3).map((a) => (
                      <Avatar key={a.id} className="h-5 w-5 border-2 border-background">
                        <AvatarImage src={a.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-[8px]">
                          {(a.name ?? '?')[0]}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={() => unarchiveTask.mutate(task.id)}
                  title="Restore task"
                >
                  <ArchiveRestore className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-destructive hover:text-destructive"
                  onClick={() => setDeleteConfirmId(task.id)}
                  title="Delete permanently"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmTask
                ? <>This will permanently delete &ldquo;{deleteConfirmTask.title}&rdquo; and all its subtasks, comments, and attachments. This action cannot be undone.</>
                : 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirmId) {
                  deleteTask.mutate(deleteConfirmId);
                  setDeleteConfirmId(null);
                }
              }}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
