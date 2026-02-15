'use client';

import * as React from 'react';
import { Archive, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DroppableContainer } from '@/components/dnd';
import type { StatusOption } from '@/lib/db/schema';

function hexToSubtleBg(hex: string, opacity = 0.06): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

interface SwimlaneProps {
  status: StatusOption;
  taskCount: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  children: React.ReactNode;
  taskIds: string[];
  onAddTask?: () => void;
  onArchiveAll?: () => void;
  /** When true, renders children directly without DnD wrapping */
  disableDnd?: boolean;
}

export function Swimlane({
  status,
  taskCount,
  isCollapsed,
  onToggleCollapse,
  children,
  taskIds,
  onAddTask,
  onArchiveAll,
  disableDnd,
}: SwimlaneProps) {
  return (
    <div
      className="group rounded-lg border"
      style={{ backgroundColor: hexToSubtleBg(status.color) }}
    >
      {/* Swimlane Header */}
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-expanded={!isCollapsed}
        aria-controls={`swimlane-content-${status.id}`}
        aria-label={`${status.label} status, ${taskCount} tasks${isCollapsed ? ', collapsed' : ', expanded'}`}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-left transition-colors',
          'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
          !isCollapsed && 'border-b'
        )}
      >
        {isCollapsed ? (
          <ChevronRight className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}

        <span
          className="size-3 shrink-0 rounded-full"
          style={{ backgroundColor: status.color }}
        />

        <span className="font-medium">{status.label}</span>

        {onArchiveAll && taskCount > 0 ? (
          <span
            role="button"
            tabIndex={0}
            className="group/archive ml-auto"
            onClick={(e) => {
              e.stopPropagation();
              onArchiveAll();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                e.preventDefault();
                onArchiveAll();
              }
            }}
            aria-label="Archive all tasks in this lane"
          >
            <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80 transition-colors">
              <span className="group-hover/archive:hidden">{taskCount}</span>
              <Archive className="hidden group-hover/archive:block h-3 w-3" />
            </Badge>
          </span>
        ) : (
          <Badge variant="secondary" className="ml-auto">
            {taskCount}
          </Badge>
        )}
      </button>

      {/* Swimlane Content */}
      {!isCollapsed && (
        disableDnd ? (
          <div className="p-2">
            {taskCount === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                No tasks
              </div>
            ) : (
              children
            )}

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
          </div>
        ) : (
          <DroppableContainer
            id={status.id}
            items={taskIds}
            className="p-2"
            aria-label={`Tasks with ${status.label} status`}
          >
            {taskCount === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                No tasks
              </div>
            ) : (
              <div className="space-y-2">
                {children}
              </div>
            )}

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
        )
      )}
    </div>
  );
}
