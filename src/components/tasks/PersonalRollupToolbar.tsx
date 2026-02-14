'use client';

import * as React from 'react';
import { Eye, EyeOff, FolderKanban, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { usePersonalRollupStore } from '@/lib/stores/personalRollupStore';
import { useMyWorkPreferences } from '@/lib/hooks/useMyWorkPreferences';
import { TableColumnsButton } from '@/components/shared/TableColumnsButton';
import type { MyTasksByClient } from '@/lib/actions/tasks';
import { ClientIcon } from '@/components/clients/ClientIcon';

// Define available columns for the personal rollup view
export const PERSONAL_ROLLUP_COLUMNS = [
  { id: 'section', label: 'Section' },
  { id: 'dueDate', label: 'Due Date' },
  { id: 'assignees', label: 'Assignees' },
] as const;

// Table columns available for toggle
const TABLE_COLUMNS = [
  { id: 'source', label: 'Board' },
  { id: 'status', label: 'Status' },
  { id: 'section', label: 'Section' },
  { id: 'assignees', label: 'Assignees' },
  { id: 'dueDate', label: 'Due Date' },
] as const;

interface PersonalRollupToolbarProps {
  tasksByClient: MyTasksByClient[];
  viewMode?: 'swimlane' | 'date' | 'table';
}

export function PersonalRollupToolbar({ tasksByClient, viewMode = 'swimlane' }: PersonalRollupToolbarProps) {
  const {
    tableColumns,
    toggleTableColumn,
  } = usePersonalRollupStore();
  const { isColumnHidden, toggleColumn, toggleBoard, isBoardHidden, setHiddenBoards } = useMyWorkPreferences();

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
      {/* Column Visibility Toggle / Card Items Toggle */}
      {viewMode === 'swimlane' ? (
        <TableColumnsButton
          columns={PERSONAL_ROLLUP_COLUMNS.map((c) => ({ id: c.id, label: c.label }))}
          visibleColumns={Object.fromEntries(PERSONAL_ROLLUP_COLUMNS.map((c) => [c.id, !isColumnHidden(c.id)]))}
          onToggle={(col) => toggleColumn(col)}
          label="Card Items"
          menuLabel="Toggle card items"
          icon={SlidersHorizontal}
        />
      ) : (
        <TableColumnsButton
          columns={TABLE_COLUMNS.map((c) => ({ id: c.id, label: c.label }))}
          visibleColumns={tableColumns}
          onToggle={(col) => toggleTableColumn(col as keyof typeof tableColumns)}
        />
      )}

      {/* Board Visibility Toggle */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <FolderKanban className="size-4" />
            Boards
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 tabular-nums">
              {visibleBoardCount}/{allBoards.length}
            </Badge>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-0 max-h-[min(400px,var(--radix-popover-content-available-height))] overflow-hidden flex flex-col">
          <div className="p-3 border-b shrink-0">
            <h4 className="font-medium text-sm">Toggle boards</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Show or hide boards in your task view
            </p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
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
          {hiddenBoardCount > 0 && (
            <div className="p-2 border-t shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => setHiddenBoards([])}
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
