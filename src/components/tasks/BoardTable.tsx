'use client';

import * as React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TaskRow, TaskRowSkeleton } from './TaskRow';
import { useColumnResize } from '@/lib/hooks/useColumnResize';
import { useSubtasks } from '@/lib/hooks/useTasks';
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

const defaultColumns: ColumnConfig = {
  title: true,
  status: true,
  section: true,
  assignees: true,
  dueDate: true,
};

interface BoardTableProps {
  tasks: TaskWithAssignees[];
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
  assignableUsers: AssigneeUser[];
  onUpdateTask: (input: UpdateTaskInput) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenTaskModal?: (taskId: string) => void;
  updatingTaskIds?: string[];
  isLoading?: boolean;
  sort?: TaskSortOptions;
  onSortChange?: (sort: TaskSortOptions) => void;
  columns?: ColumnConfig;
  emptyMessage?: string;
  selectedTaskIds?: Set<string>;
  onTaskMultiSelect?: (taskId: string, shiftKey: boolean, orderedTaskIds: string[]) => void;
  isMultiSelectMode?: boolean;
}

export function BoardTable({
  tasks,
  statusOptions,
  sectionOptions,
  assignableUsers,
  onUpdateTask,
  onDeleteTask,
  onOpenTaskModal,
  updatingTaskIds = [],
  isLoading = false,
  sort = { field: 'position', direction: 'asc' },
  onSortChange,
  columns = defaultColumns,
  emptyMessage = 'No tasks found',
  selectedTaskIds,
  onTaskMultiSelect,
  isMultiSelectMode,
}: BoardTableProps) {
  const handleSort = (field: SortField) => {
    if (!onSortChange) return;

    if (sort.field === field) {
      // Toggle direction
      onSortChange({
        field,
        direction: sort.direction === 'asc' ? 'desc' : 'asc',
      });
    } else {
      // New field, default to ascending
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

  const columnHeaders: { key: keyof ColumnConfig; label: string; sortField?: SortField; resizable?: boolean }[] = [
    { key: 'title', label: 'Task', sortField: 'title' },
    { key: 'status', label: 'Status', sortField: 'status', resizable: true },
    { key: 'section', label: 'Section', resizable: true },
    { key: 'assignees', label: 'Assignees', resizable: true },
    { key: 'dueDate', label: 'Due Date', sortField: 'dueDate', resizable: true },
  ];

  const [expandedParents, setExpandedParents] = React.useState<Set<string>>(new Set());

  const toggleExpanded = React.useCallback((taskId: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const { columnWidths, onResizeStart, isResizing } = useColumnResize();

  const visibleHeaders = columnHeaders.filter((h) => columns[h.key]);

  if (isLoading) {
    return (
      <div className="overflow-x-auto rounded-lg border">
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
            {Array.from({ length: 5 }).map((_, i) => (
              <TaskRowSkeleton key={i} columns={columns} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto rounded-lg border', isResizing && 'select-none')}>
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
                  'relative px-3 py-2 text-left text-sm font-medium text-muted-foreground',
                  header.key === 'title' && 'min-w-[200px] w-full'
                )}
              >
                {header.sortField ? (
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
            tasks.map((task) => (
              <React.Fragment key={task.id}>
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
                  onToggleSubtasks={task.subtaskCount > 0 ? () => toggleExpanded(task.id) : undefined}
                  isExpanded={expandedParents.has(task.id)}
                  isSelected={selectedTaskIds?.has(task.id)}
                  isMultiSelectMode={isMultiSelectMode}
                  onMultiSelectClick={(e) => onTaskMultiSelect?.(task.id, e.shiftKey, tasks.map((t) => t.id))}
                />
                {expandedParents.has(task.id) && (
                  <SubtaskRows
                    parentTaskId={task.id}
                    statusOptions={statusOptions}
                    sectionOptions={sectionOptions}
                    assignableUsers={assignableUsers}
                    onUpdate={onUpdateTask}
                    onDelete={onDeleteTask}
                    onOpenModal={onOpenTaskModal}
                    updatingTaskIds={updatingTaskIds}
                    columns={columns}
                  />
                )}
              </React.Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Renders subtask rows inline in the table when a parent is expanded */
function SubtaskRows({
  parentTaskId,
  statusOptions,
  sectionOptions,
  assignableUsers,
  onUpdate,
  onDelete,
  onOpenModal,
  updatingTaskIds,
  columns,
}: {
  parentTaskId: string;
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
  assignableUsers: AssigneeUser[];
  onUpdate: (input: UpdateTaskInput) => void;
  onDelete: (taskId: string) => void;
  onOpenModal?: (taskId: string) => void;
  updatingTaskIds: string[];
  columns: ColumnConfig;
}) {
  const { data: subtasks, isLoading } = useSubtasks(parentTaskId);

  if (isLoading) {
    return <TaskRowSkeleton columns={columns} />;
  }

  if (!subtasks || subtasks.length === 0) return null;

  return (
    <>
      {subtasks.map((subtask) => (
        <TaskRow
          key={subtask.id}
          task={subtask}
          statusOptions={statusOptions}
          sectionOptions={sectionOptions}
          assignableUsers={assignableUsers}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onOpenModal={onOpenModal}
          isUpdating={updatingTaskIds.includes(subtask.id)}
          columns={columns}
          isSubtask
        />
      ))}
    </>
  );
}

export { defaultColumns };
export type { ColumnConfig };
