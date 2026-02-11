'use client';

import * as React from 'react';
import { Archive, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { DroppableContainer } from '@/components/dnd';
import type { StatusOption } from '@/lib/db/schema';

/**
 * Convert a hex color to an rgba string with low opacity for subtle backgrounds.
 */
function hexToSubtleBg(hex: string, opacity = 0.06): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

interface KanbanColumnProps {
  status: StatusOption;
  taskCount: number;
  children: React.ReactNode;
  taskIds: string[];
  onAddTask?: () => void;
  onArchiveAll?: () => void;
}

export function KanbanColumn({
  status,
  taskCount,
  children,
  taskIds,
  onAddTask,
  onArchiveAll,
}: KanbanColumnProps) {
  return (
    <section
      aria-label={`${status.label} column, ${taskCount} tasks`}
      className="group flex h-full w-72 shrink-0 flex-col rounded-lg border"
      style={{ backgroundColor: hexToSubtleBg(status.color) }}
    >
      {/* Column Header */}
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <span
          className="size-3 shrink-0 rounded-full"
          style={{ backgroundColor: status.color }}
        />
        <span className="font-medium text-sm">{status.label}</span>
        {onArchiveAll && taskCount > 0 ? (
          <button
            type="button"
            onClick={onArchiveAll}
            className="group/archive ml-auto"
            aria-label="Archive all tasks in this column"
          >
            <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors">
              <span className="group-hover/archive:hidden">{taskCount}</span>
              <Archive className="hidden group-hover/archive:block h-3 w-3" />
            </Badge>
          </button>
        ) : (
          <Badge variant="secondary" className="ml-auto text-xs">
            {taskCount}
          </Badge>
        )}
      </header>

      {/* Column Content */}
      <DroppableContainer
        id={status.id}
        items={taskIds}
        className="flex-1 overflow-y-auto p-2"
      >
        {taskCount === 0 && (
          <div className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 text-sm text-muted-foreground">
            No tasks
          </div>
        )}
        <div className="space-y-2">
          {children}
        </div>

        {/* Hover "Add task" button */}
        {onAddTask && (
          <button
            type="button"
            onClick={onAddTask}
            className="mt-2 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hexToSubtleBg(status.color, 0.12)}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Plus className="h-4 w-4" />
            Add task
          </button>
        )}
      </DroppableContainer>
    </section>
  );
}
