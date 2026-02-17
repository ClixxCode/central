'use client';

import * as React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useColumnResize } from '@/lib/hooks/useColumnResize';
import { DateDisplay, TaskDatePicker } from '@/components/tasks/DatePicker';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { StatusOption, SectionOption } from '@/lib/db/schema';
import { ClientIcon } from '@/components/clients/ClientIcon';

// Assignee can come in two formats
interface AssigneeWithUser {
  user: {
    id: string;
    name: string | null;
    email: string;
    image?: string | null;
    avatarUrl?: string | null;
  };
}

interface FlatAssignee {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
  avatarUrl?: string | null;
}

// Generic task type that covers both board tasks and rollup tasks
export interface TableTask {
  id: string;
  title: string;
  status: string;
  section: string | null;
  position: number;
  dueDate: Date | string | null;
  dateFlexibility?: 'not_set' | 'flexible' | 'semi_flexible' | 'not_flexible';
  assignees: Array<AssigneeWithUser | FlatAssignee>;
  // Optional fields for rollup tasks
  clientName?: string | null;
  clientColor?: string | null;
  clientIcon?: string | null;
  boardName?: string | null;
  boardId?: string;
  clientSlug?: string | null;
}

// Normalize date to YYYY-MM-DD string (handles Date objects and ISO datetime strings)
function normalizeDateString(date: Date | string | null): string | null {
  if (!date) return null;
  if (date instanceof Date) return date.toISOString().split('T')[0];
  // If it's an ISO datetime string like "2026-02-04T00:00:00.000Z", extract just the date part
  if (date.includes('T')) return date.split('T')[0];
  return date;
}

// Helper to normalize assignee data
function normalizeAssignee(assignee: AssigneeWithUser | FlatAssignee) {
  if ('user' in assignee) {
    return {
      id: assignee.user.id,
      name: assignee.user.name,
      email: assignee.user.email,
      image: assignee.user.image ?? assignee.user.avatarUrl ?? null,
    };
  }
  return {
    id: assignee.id,
    name: assignee.name,
    email: assignee.email,
    image: assignee.image ?? assignee.avatarUrl ?? null,
  };
}

type SortField = 'title' | 'status' | 'dueDate' | 'position' | 'client';
type SortDirection = 'asc' | 'desc';

export interface TableSortOptions {
  field: SortField;
  direction: SortDirection;
}

export interface TableColumnConfig {
  title: boolean;
  status: boolean;
  section: boolean;
  assignees: boolean;
  dueDate: boolean;
  source?: boolean; // For rollup - shows client/board
}

const defaultColumns: TableColumnConfig = {
  title: true,
  status: true,
  section: true,
  assignees: true,
  dueDate: true,
  source: false,
};

interface TaskTableProps {
  tasks: TableTask[];
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
  onTaskClick?: (taskId: string) => void;
  onNavigateToSource?: (task: TableTask) => void;
  onTaskUpdate?: (taskId: string, update: { dueDate?: string | null; dateFlexibility?: 'not_set' | 'flexible' | 'semi_flexible' | 'not_flexible' }) => void;
  isLoading?: boolean;
  sort?: TableSortOptions;
  onSortChange?: (sort: TableSortOptions) => void;
  columns?: TableColumnConfig;
  emptyMessage?: string;
  showSource?: boolean; // Enable source column for rollups
  prioritySelectionMode?: boolean;
  priorityFilterActive?: boolean;
  priorityTaskIds?: Set<string>;
}

export function TaskTable({
  tasks,
  statusOptions,
  sectionOptions,
  onTaskClick,
  onNavigateToSource,
  onTaskUpdate,
  isLoading = false,
  sort = { field: 'position', direction: 'asc' },
  onSortChange,
  columns: columnsProp,
  emptyMessage = 'No tasks found',
  showSource = false,
  prioritySelectionMode = false,
  priorityFilterActive = false,
  priorityTaskIds,
}: TaskTableProps) {
  // Merge default columns with showSource (showSource enables source column by default,
  // but explicit columnsProp.source can override it)
  const columns = React.useMemo(() => ({
    ...defaultColumns,
    source: showSource,
    ...columnsProp,
  }), [columnsProp, showSource]);

  const handleSort = (field: SortField) => {
    if (!onSortChange) return;

    if (sort.field === field) {
      onSortChange({
        field,
        direction: sort.direction === 'asc' ? 'desc' : 'asc',
      });
    } else {
      onSortChange({ field, direction: 'asc' });
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sort.field !== field) {
      return <ArrowUpDown className="ml-1 size-3 text-muted-foreground" />;
    }
    return sort.direction === 'asc' ? (
      <ArrowUp className="ml-1 size-3" />
    ) : (
      <ArrowDown className="ml-1 size-3" />
    );
  };

  const columnHeaders: {
    key: keyof TableColumnConfig;
    label: string;
    sortField?: SortField;
    resizable?: boolean;
  }[] = [
    { key: 'title', label: 'Task', sortField: 'title' },
    { key: 'source', label: 'Board', sortField: 'client', resizable: true },
    { key: 'status', label: 'Status', sortField: 'status', resizable: true },
    { key: 'section', label: 'Section', resizable: true },
    { key: 'assignees', label: 'Assignees', resizable: true },
    { key: 'dueDate', label: 'Due Date', sortField: 'dueDate', resizable: true },
  ];

  const { columnWidths, onResizeStart, isResizing } = useColumnResize();

  const visibleHeaders = columnHeaders.filter((h) => columns[h.key]);

  // Get status and section labels
  const getStatusLabel = (statusId: string) => {
    const status = statusOptions.find((s) => s.id === statusId);
    return status ? { label: status.label, color: status.color } : { label: statusId, color: '#888' };
  };

  const getSectionLabel = (sectionId: string | null) => {
    if (!sectionId) return '';
    const section = sectionOptions.find((s) => s.id === sectionId);
    return section?.label ?? sectionId;
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full table-fixed" style={{ minWidth: 600 }}>
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
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-t">
                {visibleHeaders.map((header) => (
                  <td key={header.key} className="px-3 py-3">
                    <Skeleton className="h-5 w-full" />
                  </td>
                ))}
                <td className="px-3 py-3" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Compute dynamic min-width so resizing columns causes horizontal scroll
  // instead of squishing the title column
  const tableMinWidth = React.useMemo(() => {
    const titleMinWidth = 200;
    const actionsWidth = 48;
    const otherColumnsWidth = visibleHeaders
      .filter((h) => h.key !== 'title')
      .reduce((sum, h) => sum + (columnWidths[h.key] ?? 120), 0);
    return titleMinWidth + otherColumnsWidth + actionsWidth;
  }, [visibleHeaders, columnWidths]);

  return (
    <TooltipProvider>
      <div className={cn('overflow-x-auto rounded-lg border', isResizing && 'select-none')}>
        <table className="w-full table-fixed" style={{ minWidth: tableMinWidth }}>
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
                    'relative px-3 py-2 text-left text-sm font-medium text-muted-foreground',
                    header.key === 'title' && 'min-w-[200px] w-full'
                  )}
                >
                  {header.sortField && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => handleSort(header.sortField!)}
                      className={cn(
                        'inline-flex items-center rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        sort.field === header.sortField && 'text-foreground'
                      )}
                    >
                      {header.label}
                      <SortIcon field={header.sortField} />
                    </button>
                  ) : (
                    header.label
                  )}
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
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleHeaders.length + 1}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              tasks.map((task) => {
                const status = getStatusLabel(task.status);

                return (
                  <tr
                    key={task.id}
                    onClick={() => onTaskClick?.(task.id)}
                    className={cn(
                      'border-t transition-colors',
                      onTaskClick && 'cursor-pointer hover:bg-muted/50'
                    )}
                  >
                    {/* Title */}
                    {columns.title && (
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          {(prioritySelectionMode || (priorityFilterActive && priorityTaskIds?.has(task.id))) && (
                            <Star
                              className={cn(
                                'size-3.5 shrink-0 text-amber-400',
                                priorityTaskIds?.has(task.id) ? 'fill-current' : 'fill-none text-muted-foreground'
                              )}
                            />
                          )}
                          <span className="font-medium text-sm">{task.title}</span>
                        </div>
                      </td>
                    )}

                    {/* Source (client/board) */}
                    {columns.source && (
                      <td className="px-3 py-3">
                        {task.clientName ? (
                          <div className="flex items-center gap-2 min-w-0">
                            <ClientIcon icon={task.clientIcon ?? null} color={task.clientColor ?? null} name={task.clientName ?? undefined} size="xs" className="shrink-0" />
                            <span className="text-sm truncate min-w-0">
                              {task.boardName && task.boardName.toLowerCase() !== task.clientName?.toLowerCase()
                                ? `${task.clientName} / ${task.boardName}`
                                : task.clientName}
                            </span>
                            {onNavigateToSource && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigateToSource(task);
                                }}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                    )}

                    {/* Status */}
                    {columns.status && (
                      <td className="px-3 py-3">
                        <Badge
                          variant="outline"
                          className="max-w-full truncate whitespace-nowrap"
                          style={{
                            borderColor: status.color,
                            backgroundColor: `${status.color}15`,
                          }}
                        >
                          <span
                            className="mr-1.5 h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: status.color }}
                          />
                          <span className="truncate">{status.label}</span>
                        </Badge>
                      </td>
                    )}

                    {/* Section */}
                    {columns.section && (
                      <td className="px-3 py-3">
                        <span className="text-sm text-muted-foreground">
                          {getSectionLabel(task.section)}
                        </span>
                      </td>
                    )}

                    {/* Assignees */}
                    {columns.assignees && (
                      <td className="px-3 py-3">
                        <div className="flex -space-x-2">
                          {task.assignees.slice(0, 3).map((a) => {
                            const assignee = normalizeAssignee(a);
                            return (
                              <Tooltip key={assignee.id}>
                                <TooltipTrigger asChild>
                                  <Avatar className="h-6 w-6 border-2 border-background">
                                    <AvatarImage src={assignee.image ?? undefined} />
                                    <AvatarFallback className="text-[10px]">
                                      {getInitials(assignee.name, assignee.email)}
                                    </AvatarFallback>
                                  </Avatar>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {assignee.name ?? assignee.email}
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                          {task.assignees.length > 3 && (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px]">
                              +{task.assignees.length - 3}
                            </div>
                          )}
                          {task.assignees.length === 0 && (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                    )}

                    {/* Due Date */}
                    {columns.dueDate && (
                      <td className="px-3 py-3" onClick={(e) => onTaskUpdate && e.stopPropagation()}>
                        {onTaskUpdate ? (
                          <TaskDatePicker
                            date={normalizeDateString(task.dueDate)}
                            onDateChange={(date) => onTaskUpdate(task.id, { dueDate: date })}
                            flexibility={task.dateFlexibility ?? 'not_set'}
                            onFlexibilityChange={(flexibility) => onTaskUpdate(task.id, { dateFlexibility: flexibility })}
                          />
                        ) : (
                          <DateDisplay
                            date={normalizeDateString(task.dueDate)}
                            flexibility={task.dateFlexibility}
                            className="text-sm"
                          />
                        )}
                      </td>
                    )}

                    {/* Actions placeholder */}
                    <td className="px-3 py-3" />
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
}

export { defaultColumns as defaultTableColumns };
