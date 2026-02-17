'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArchiveRestore, Search } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useArchivedTasks, useUnarchiveTask } from '@/lib/hooks/useTasks';
import type { StatusOption } from '@/lib/db/schema';
import { formatDistanceToNow } from 'date-fns';

interface ArchivePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  statusOptions: StatusOption[];
}

export function ArchivePanel({
  open,
  onOpenChange,
  boardId,
  statusOptions,
}: ArchivePanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const unarchiveTask = useUnarchiveTask();

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: archivedTasks = [], isLoading } = useArchivedTasks(
    boardId,
    debouncedSearch || undefined
  );

  const handleOpenTask = (taskId: string) => {
    onOpenChange(false);
    router.push(`${pathname}?task=${taskId}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Archived Tasks</SheetTitle>
        </SheetHeader>

        <div className="relative mt-4 px-4">
          <Search className="absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search archived tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="flex-1 mt-4 px-4">
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
                      title="Unarchive"
                    >
                      <ArchiveRestore className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
