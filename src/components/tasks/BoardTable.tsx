'use client';

import * as React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, FolderKanban, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TaskRow, TaskRowSkeleton } from './TaskRow';
import { StatusSelect } from './StatusSelect';
import { SectionSelect } from './SectionSelect';
import { TaskDatePicker } from './DatePicker';
import { useColumnResize } from '@/lib/hooks/useColumnResize';
import { useSubtasks } from '@/lib/hooks/useTasks';
import type { BoardItem, ProjectBoardItem, TaskWithAssignees, UpdateTaskInput, TaskSortOptions } from '@/lib/actions/tasks';
import type { UpdateBoardProjectInput } from '@/lib/validations/board-project';
import type { StatusOption, SectionOption } from '@/lib/db/schema';
import type { AssigneeUser } from './AssigneePicker';

type SortField = TaskSortOptions['field'];
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
  items?: BoardItem[];
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
  assignableUsers: AssigneeUser[];
  onUpdateTask: (input: UpdateTaskInput) => void;
  onUpdateProject?: (input: UpdateBoardProjectInput) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenTaskModal?: (taskId: string) => void;
  onOpenProject?: (projectBoardId: string) => void;
  onOpenSubtasks?: (taskId: string) => void;
  updatingTaskIds?: string[];
  isLoading?: boolean;
  sort?: TaskSortOptions;
  onSortChange?: (sort: TaskSortOptions) => void;
  columns?: ColumnConfig;
  emptyMessage?: string;
  selectedTaskIds?: Set<string>;
  onTaskMultiSelect?: (taskId: string, shiftKey: boolean, orderedTaskIds: string[]) => void;
  isMultiSelectMode?: boolean;
  subtaskOnlyParentId?: string | null;
  onEnterSubtaskOnlyMode?: (parentTaskId: string) => void;
}

export function BoardTable({
  tasks,
  items,
  statusOptions,
  sectionOptions,
  assignableUsers,
  onUpdateTask,
  onUpdateProject,
  onDeleteTask,
  onOpenTaskModal,
  onOpenProject,
  onOpenSubtasks,
  updatingTaskIds = [],
  isLoading = false,
  sort = { field: 'position', direction: 'asc' },
  onSortChange,
  columns = defaultColumns,
  emptyMessage = 'No tasks found',
  selectedTaskIds,
  onTaskMultiSelect,
  isMultiSelectMode,
  subtaskOnlyParentId,
  onEnterSubtaskOnlyMode,
}: BoardTableProps) {
  const [expandedParents, setExpandedParents] = React.useState<Set<string>>(new Set());
  const rows = React.useMemo<BoardItem[]>(
    () => items ?? tasks.map((task) => ({ ...task, kind: 'task' as const })),
    [items, tasks]
  );

  const toggleExpanded = React.useCallback((taskId: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

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
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={visibleHeaders.length + 1}
                className="px-3 py-8 text-center text-sm text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((item) => {
              if (item.kind === 'project') {
                return (
                  <ProjectRow
                    key={item.id}
                    project={item}
                    statusOptions={statusOptions}
                    sectionOptions={sectionOptions}
                    onUpdate={onUpdateProject}
                    onOpenProject={onOpenProject}
                    columns={columns}
                  />
                );
              }

              const task = item;
              const showInlineSubtasks = task.subtaskCount > 0 && !task.subtasksBreakoutEnabled;
              const openSubtasksSheet = task.subtaskCount > 0 && task.subtasksBreakoutEnabled;
              const isSubtaskOnlyParent = task.id === subtaskOnlyParentId;
              const statusColor = statusOptions.find((status) => status.id === task.status)?.color;
              const isFadedBySubtaskOnlyMode =
                !!subtaskOnlyParentId &&
                task.id !== subtaskOnlyParentId &&
                task.parentTaskId !== subtaskOnlyParentId;

              return (
                <React.Fragment key={task.id}>
                  <TaskRow
                    task={task}
                    statusOptions={statusOptions}
                    sectionOptions={sectionOptions}
                    assignableUsers={assignableUsers}
                    onUpdate={onUpdateTask}
                    onDelete={onDeleteTask}
                    onOpenModal={onOpenTaskModal}
                    onOpenSubtasks={openSubtasksSheet ? () => onOpenSubtasks?.(task.id) : undefined}
                    onToggleSubtasks={showInlineSubtasks ? () => toggleExpanded(task.id) : undefined}
                    isExpanded={showInlineSubtasks ? expandedParents.has(task.id) : undefined}
                    isUpdating={updatingTaskIds.includes(task.id)}
                    columns={columns}
                    isSelected={selectedTaskIds?.has(task.id)}
                    isMultiSelectMode={isMultiSelectMode}
                    onMultiSelectClick={(e) => onTaskMultiSelect?.(task.id, e.shiftKey, rows.filter((row) => row.kind === 'task').map((row) => row.id))}
                    isFaded={isFadedBySubtaskOnlyMode}
                    isSubtaskOnlyParent={isSubtaskOnlyParent}
                    subtaskOnlyHighlightColor={statusColor}
                    onEnterSubtaskOnlyMode={onEnterSubtaskOnlyMode}
                  />
                  {showInlineSubtasks && expandedParents.has(task.id) && (
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
                      subtaskOnlyParentId={subtaskOnlyParentId}
                      onEnterSubtaskOnlyMode={onEnterSubtaskOnlyMode}
                    />
                  )}
                </React.Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function ProjectRow({
  project,
  statusOptions,
  sectionOptions,
  onUpdate,
  onOpenProject,
  columns,
}: {
  project: ProjectBoardItem;
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
  onUpdate?: (input: UpdateBoardProjectInput) => void;
  onOpenProject?: (projectBoardId: string) => void;
  columns: ColumnConfig;
}) {
  return (
    <tr className="group border-b bg-primary/[0.02] transition-colors hover:bg-primary/[0.05]">
      {columns.title && (
        <td className="px-3 py-2">
          <button
            type="button"
            onClick={() => onOpenProject?.(project.projectBoardId)}
            className="flex min-w-0 items-center gap-2 rounded text-left text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={project.title}
          >
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FolderKanban className="size-4" />
            </span>
            <span className="min-w-0 truncate">{project.title}</span>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-normal text-muted-foreground">
              <ListChecks className="size-3" />
              {project.completedTaskCount}/{project.taskCount}
            </span>
          </button>
        </td>
      )}
      {columns.status && (
        <td className="px-3 py-2">
          <StatusSelect
            value={project.status}
            onChange={(status) => onUpdate?.({ id: project.id, status })}
            options={statusOptions}
            size="sm"
            disabled={!onUpdate}
          />
        </td>
      )}
      {columns.section && (
        <td className="px-3 py-2">
          <SectionSelect
            value={project.section}
            onChange={(section) => onUpdate?.({ id: project.id, section })}
            options={sectionOptions}
            disabled={!onUpdate}
          />
        </td>
      )}
      {columns.assignees && <td className="px-3 py-2 text-sm text-muted-foreground" />}
      {columns.dueDate && (
        <td className="px-3 py-2">
          <TaskDatePicker
            date={project.dueDate}
            onDateChange={(dueDate) => onUpdate?.({ id: project.id, dueDate })}
            flexibility="not_set"
            onFlexibilityChange={() => undefined}
            disabled={!onUpdate}
            showFlexibility={false}
          />
        </td>
      )}
      <td className="px-3 py-2 w-12" />
    </tr>
  );
}

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
  subtaskOnlyParentId,
  onEnterSubtaskOnlyMode,
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
  subtaskOnlyParentId?: string | null;
  onEnterSubtaskOnlyMode?: (parentTaskId: string) => void;
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
          isFaded={!!subtaskOnlyParentId && subtask.parentTaskId !== subtaskOnlyParentId}
          onEnterSubtaskOnlyMode={onEnterSubtaskOnlyMode}
        />
      ))}
    </>
  );
}

export { defaultColumns };
export type { ColumnConfig };
