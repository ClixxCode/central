'use client';

import * as React from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClientIcon } from '@/components/clients/ClientIcon';

export interface SourceBoard {
  id: string;
  name: string;
  clientId: string | null;
  clientName: string | null;
  clientSlug: string | null;
  clientColor: string | null;
  clientIcon: string | null;
}

interface RollupSourceSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
  boards: SourceBoard[];
  disabled?: boolean;
  placeholder?: string;
}

export function RollupSourceSelector({
  value,
  onChange,
  boards,
  disabled = false,
  placeholder = 'Select boards...',
}: RollupSourceSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const selectedBoards = boards.filter((board) => value.includes(board.id));

  // Group boards by client
  const groupedBoards = React.useMemo(() => {
    const groups: Record<string, SourceBoard[]> = {};
    const noClient: SourceBoard[] = [];

    boards.forEach((board) => {
      if (board.clientName) {
        if (!groups[board.clientName]) {
          groups[board.clientName] = [];
        }
        groups[board.clientName].push(board);
      } else {
        noClient.push(board);
      }
    });

    return { groups, noClient };
  }, [boards]);

  const filteredBoards = React.useMemo(() => {
    if (!search) return boards;

    const searchLower = search.toLowerCase();
    return boards.filter(
      (board) =>
        board.name.toLowerCase().includes(searchLower) ||
        board.clientName?.toLowerCase().includes(searchLower)
    );
  }, [boards, search]);

  // Group filtered boards
  const filteredGrouped = React.useMemo(() => {
    const groups: Record<string, SourceBoard[]> = {};
    const noClient: SourceBoard[] = [];

    filteredBoards.forEach((board) => {
      if (board.clientName) {
        if (!groups[board.clientName]) {
          groups[board.clientName] = [];
        }
        groups[board.clientName].push(board);
      } else {
        noClient.push(board);
      }
    });

    return { groups, noClient };
  }, [filteredBoards]);

  const toggleBoard = (boardId: string) => {
    if (value.includes(boardId)) {
      onChange(value.filter((id) => id !== boardId));
    } else {
      onChange([...value, boardId]);
    }
  };

  const removeBoard = (boardId: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    onChange(value.filter((id) => id !== boardId));
  };

  const selectAllFromClient = (clientName: string) => {
    const clientBoards = groupedBoards.groups[clientName] || [];
    const clientBoardIds = clientBoards.map((b) => b.id);
    const allSelected = clientBoardIds.every((id) => value.includes(id));

    if (allSelected) {
      // Deselect all from this client
      onChange(value.filter((id) => !clientBoardIds.includes(id)));
    } else {
      // Select all from this client
      const newValue = new Set([...value, ...clientBoardIds]);
      onChange(Array.from(newValue));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'h-auto min-h-10 w-full justify-between',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          <div className="flex flex-wrap gap-1">
            {selectedBoards.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selectedBoards.map((board) => (
                <Badge
                  key={board.id}
                  variant="secondary"
                  className="flex items-center gap-1"
                  style={
                    board.clientColor
                      ? {
                          backgroundColor: `${board.clientColor}20`,
                          borderColor: board.clientColor,
                        }
                      : undefined
                  }
                >
                  <span className="max-w-[150px] truncate">
                    {board.clientName ? `${board.clientName}: ` : ''}
                    {board.name}
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => removeBoard(board.id, e)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        removeBoard(board.id, e);
                      }
                    }}
                    className="ml-1 rounded-full hover:bg-accent cursor-pointer"
                  >
                    <X className="size-3" />
                    <span className="sr-only">Remove {board.name}</span>
                  </span>
                </Badge>
              ))
            )}
          </div>
          <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-2">
          <Input
            placeholder="Search boards..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <ScrollArea className="max-h-72 overflow-hidden">
          <div className="p-1">
            {filteredBoards.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No boards found
              </p>
            ) : (
              <>
                {/* Grouped by client */}
                {Object.entries(filteredGrouped.groups)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([clientName, clientBoards]) => (
                    <div key={clientName} className="mb-2">
                      <button
                        type="button"
                        onClick={() => selectAllFromClient(clientName)}
                        className="flex w-full items-center justify-between px-2 py-1 text-xs font-semibold uppercase text-muted-foreground hover:bg-accent"
                      >
                        <span>{clientName}</span>
                        <span className="text-xs font-normal">
                          {
                            clientBoards.filter((b) => value.includes(b.id))
                              .length
                          }
                          /{clientBoards.length}
                        </span>
                      </button>
                      {clientBoards.map((board) => (
                        <BoardItem
                          key={board.id}
                          board={board}
                          isSelected={value.includes(board.id)}
                          onToggle={() => toggleBoard(board.id)}
                        />
                      ))}
                    </div>
                  ))}

                {/* Boards without client */}
                {filteredGrouped.noClient.length > 0 && (
                  <div className="mb-2">
                    <div className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">
                      Other Boards
                    </div>
                    {filteredGrouped.noClient.map((board) => (
                      <BoardItem
                        key={board.id}
                        board={board}
                        isSelected={value.includes(board.id)}
                        onToggle={() => toggleBoard(board.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
        {selectedBoards.length > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange([])}
              className="w-full"
            >
              <X className="mr-2 size-3" />
              Clear all ({selectedBoards.length})
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface BoardItemProps {
  board: SourceBoard;
  isSelected: boolean;
  onToggle: () => void;
}

function BoardItem({ board, isSelected, onToggle }: BoardItemProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
        'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
        isSelected && 'bg-accent'
      )}
    >
      <ClientIcon icon={board.clientIcon} color={board.clientColor} name={board.clientName ?? undefined} size="xs" />
      <span className="flex-1 truncate text-sm">{board.name}</span>
      {isSelected && <Check className="size-4 shrink-0 text-primary" />}
    </button>
  );
}

interface SelectedBoardsDisplayProps {
  boards: SourceBoard[];
  onRemove?: (boardId: string) => void;
  showClientName?: boolean;
}

export function SelectedBoardsDisplay({
  boards,
  onRemove,
  showClientName = true,
}: SelectedBoardsDisplayProps) {
  if (boards.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">No boards selected</span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {boards.map((board) => (
        <Badge
          key={board.id}
          variant="secondary"
          className="flex items-center gap-1"
          style={
            board.clientColor
              ? {
                  backgroundColor: `${board.clientColor}20`,
                  borderColor: board.clientColor,
                }
              : undefined
          }
        >
          {showClientName && board.clientName && (
            <span className="font-normal text-muted-foreground">
              {board.clientName}:
            </span>
          )}
          <span>{board.name}</span>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(board.id)}
              className="ml-1 rounded-full hover:bg-accent"
            >
              <X className="size-3" />
              <span className="sr-only">Remove {board.name}</span>
            </button>
          )}
        </Badge>
      ))}
    </div>
  );
}
