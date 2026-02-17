'use client';

import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { TaskRow, TaskRowSkeleton } from './TaskRow';
import { useColumnResize } from '@/lib/hooks/useColumnResize';
import type { TaskWithAssignees, UpdateTaskInput, TaskSortOptions } from '@/lib/actions/tasks';
import type { StatusOption, SectionOption } from '@/lib/db/schema';
import type { AssigneeUser } from './AssigneePicker';

type SortField = TaskSortOptions['field'];
type SortDirection = TaskSortOptions['direction'];

interface ColumnConfig {
  title: boolean;
  status: boolean;
  section: boolean;
  assignees: boolean;
  dueDate: boolean;
}

const ROW_HEIGHT = 44; // Height of each row in pixels
const OVERSCAN = 5; // Number of items to render outside of the visible area

interface VirtualizedTaskListProps {
  tasks: TaskWithAssignees[];
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
  assignableUsers: AssigneeUser[];
  onUpdateTask: (input: UpdateTaskInput) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenTaskModal?: (taskId: string) => void;
  updatingTaskIds?: string[];
  columns?: ColumnConfig;
  maxHeight?: number;
}

export function VirtualizedTaskList({
  tasks,
  statusOptions,
  sectionOptions,
  assignableUsers,
  onUpdateTask,
  onDeleteTask,
  onOpenTaskModal,
  updatingTaskIds = [],
  columns = { title: true, status: true, section: true, assignees: true, dueDate: true },
  maxHeight = 600,
}: VirtualizedTaskListProps) {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // Column widths for consistent layout
  const columnHeaders: { key: keyof ColumnConfig; label: string; resizable?: boolean }[] = [
    { key: 'title', label: 'Task' },
    { key: 'status', label: 'Status', resizable: true },
    { key: 'section', label: 'Section', resizable: true },
    { key: 'assignees', label: 'Assignees', resizable: true },
    { key: 'dueDate', label: 'Due Date', resizable: true },
  ];

  const { columnWidths, onResizeStart, isResizing } = useColumnResize();

  const visibleHeaders = columnHeaders.filter((h) => columns[h.key]);

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border">
        <table className="w-full min-w-[600px] table-fixed">
          <colgroup>
            {visibleHeaders.map((header) => (
              <col
                key={header.key}
                style={header.key === 'title' ? undefined : { width: columnWidths[header.key] }}
              />
            ))}
            <col style={{ width: 48 }} />
          </colgroup>
          <thead className="bg-muted/50">
            <tr>
              {visibleHeaders.map((header) => (
                <th
                  key={header.key}
                  className={cn(
                    'px-3 py-2 text-left text-sm font-medium text-muted-foreground',
                    header.key === 'title' && 'min-w-[200px] w-full'
                  )}
                >
                  {header.label}
                </th>
              ))}
              <th className="w-12 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                colSpan={visibleHeaders.length + 1}
                className="px-3 py-8 text-center text-sm text-muted-foreground"
              >
                No tasks found
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border overflow-hidden', isResizing && 'select-none')}>
      {/* Fixed header */}
      <div className="bg-muted/50 border-b">
        <table className="w-full min-w-[600px] table-fixed">
          <colgroup>
            {visibleHeaders.map((header) => (
              <col
                key={header.key}
                style={header.key === 'title' ? undefined : { width: columnWidths[header.key] }}
              />
            ))}
            <col style={{ width: 48 }} />
          </colgroup>
          <thead>
            <tr>
              {visibleHeaders.map((header) => (
                <th
                  key={header.key}
                  className={cn(
                    'relative px-3 py-2 text-left text-sm font-medium text-muted-foreground',
                    header.key === 'title' && 'min-w-[200px] w-full'
                  )}
                >
                  {header.label}
                  {header.resizable && (
                    <div
                      onMouseDown={(e) => onResizeStart(header.key, e)}
                      className="absolute -right-px top-0 h-full w-2 cursor-grab active:cursor-grabbing group/resize"
                    >
                      <div className="mx-auto h-full w-px bg-transparent group-hover/resize:bg-primary/40 group-active/resize:bg-primary/60" />
                    </div>
                  )}
                </th>
              ))}
              <th className="w-12 px-3 py-2" />
            </tr>
          </thead>
        </table>
      </div>

      {/* Virtualized body */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ maxHeight }}
      >
        <div
          style={{
            height: `${totalSize}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          <table className="w-full min-w-[600px] table-fixed">
            <colgroup>
              {visibleHeaders.map((header) => (
                <col
                  key={header.key}
                  style={header.key === 'title' ? undefined : { width: columnWidths[header.key] }}
                />
              ))}
              <col style={{ width: 48 }} />
            </colgroup>
            <tbody>
              {virtualItems.map((virtualItem) => {
                const task = tasks[virtualItem.index];
                return (
                  <tr
                    key={task.id}
                    data-index={virtualItem.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <td colSpan={visibleHeaders.length + 1} className="p-0">
                      <table className="w-full min-w-[600px] table-fixed">
                        <colgroup>
                          {visibleHeaders.map((header) => (
                            <col
                              key={header.key}
                              style={header.key === 'title' ? undefined : { width: columnWidths[header.key] }}
                            />
                          ))}
                          <col style={{ width: 48 }} />
                        </colgroup>
                        <tbody>
                          <TaskRow
                            task={task}
                            statusOptions={statusOptions}
                            sectionOptions={sectionOptions}
                            assignableUsers={assignableUsers}
                            onUpdate={onUpdateTask}
                            onDelete={onDeleteTask}
                            onOpenModal={onOpenTaskModal}
                            isUpdating={updatingTaskIds.includes(task.id)}
                            columns={columns}
                          />
                        </tbody>
                      </table>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight?: number;
  maxHeight?: number;
  className?: string;
  emptyMessage?: string;
}

/**
 * Generic virtualized list component for any content
 */
export function VirtualizedList<T>({
  items,
  renderItem,
  itemHeight = 80,
  maxHeight = 600,
  className,
  emptyMessage = 'No items',
}: VirtualizedListProps<T>) {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan: OVERSCAN,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  if (items.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-8 text-muted-foreground', className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={cn('overflow-auto', className)}
      style={{ maxHeight }}
    >
      <div
        style={{
          height: `${totalSize}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          return (
            <div
              key={virtualItem.index}
              data-index={virtualItem.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type { ColumnConfig };
