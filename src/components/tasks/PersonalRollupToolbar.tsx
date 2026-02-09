'use client';

import * as React from 'react';
import { Columns, Eye, EyeOff, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { usePersonalRollupStore } from '@/lib/stores/personalRollupStore';
import type { MyTasksByClient } from '@/lib/actions/tasks';
import { ClientIcon } from '@/components/clients/ClientIcon';

// Define available columns for the personal rollup view
export const PERSONAL_ROLLUP_COLUMNS = [
  { id: 'board', label: 'Board' },
  { id: 'section', label: 'Section' },
  { id: 'dueDate', label: 'Due Date' },
  { id: 'assignees', label: 'Assignees' },
] as const;

interface PersonalRollupToolbarProps {
  tasksByClient: MyTasksByClient[];
}

export function PersonalRollupToolbar({ tasksByClient }: PersonalRollupToolbarProps) {
  const {
    hiddenColumns,
    toggleColumn,
    toggleBoard,
    isColumnHidden,
    isBoardHidden,
  } = usePersonalRollupStore();

  // Get all unique boards across all clients
  const allBoards = React.useMemo(() => {
    const boards: { id: string; name: string; clientName: string; clientColor: string | null; clientIcon: string | null }[] = [];

    tasksByClient.forEach((clientGroup) => {
      clientGroup.boards.forEach((board) => {
        boards.push({
          id: board.id,
          name: board.name,
          clientName: clientGroup.client.name,
          clientColor: clientGroup.client.color,
          clientIcon: clientGroup.client.icon ?? null,
        });
      });
    });

    return boards;
  }, [tasksByClient]);

  const visibleBoardCount = allBoards.filter((b) => !isBoardHidden(b.id)).length;
  const hiddenBoardCount = allBoards.length - visibleBoardCount;

  return (
    <div className="flex items-center gap-2">
      {/* Column Visibility Toggle */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Columns className="size-4" />
            Columns
            {hiddenColumns.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0">
                {PERSONAL_ROLLUP_COLUMNS.length - hiddenColumns.length}/{PERSONAL_ROLLUP_COLUMNS.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {PERSONAL_ROLLUP_COLUMNS.map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={!isColumnHidden(column.id)}
              onCheckedChange={() => toggleColumn(column.id)}
            >
              {column.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Board Visibility Toggle */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <FolderKanban className="size-4" />
            Boards
            {hiddenBoardCount > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0">
                {visibleBoardCount}/{allBoards.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-0">
          <div className="p-3 border-b">
            <h4 className="font-medium text-sm">Toggle boards</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Show or hide boards in your task view
            </p>
          </div>
          <ScrollArea className="max-h-64">
            <div className="p-2 space-y-1">
              {allBoards.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No boards available
                </p>
              ) : (
                allBoards.map((board) => {
                  const isHidden = isBoardHidden(board.id);
                  return (
                    <button
                      key={board.id}
                      type="button"
                      onClick={() => toggleBoard(board.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                        'hover:bg-accent',
                        isHidden && 'opacity-60'
                      )}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <ClientIcon icon={board.clientIcon} color={board.clientColor} name={board.clientName} size="xs" />
                        <span className="truncate">{board.name}</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {board.clientName}
                        </span>
                      </div>
                      {isHidden ? (
                        <EyeOff className="size-4 text-muted-foreground shrink-0" />
                      ) : (
                        <Eye className="size-4 text-primary shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
          {hiddenBoardCount > 0 && (
            <div className="p-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  // Show all boards
                  allBoards.forEach((board) => {
                    if (isBoardHidden(board.id)) {
                      toggleBoard(board.id);
                    }
                  });
                }}
              >
                Show all boards
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
