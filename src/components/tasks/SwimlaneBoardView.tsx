'use client';

import * as React from 'react';
import { Swimlane } from './Swimlane';
import { BoardTable } from './BoardTable';
import { TaskModal } from './TaskModal';
import { useBoardViewStore } from '@/lib/stores/boardViewStore';
import { useQuickActionsStore } from '@/lib/stores';
import { useUpdateTask, useDeleteTask, useTask, useBulkArchiveDone } from '@/lib/hooks/useTasks';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { isCompleteStatus } from '@/lib/utils/status';
import type { TaskWithAssignees, CreateTaskInput, UpdateTaskInput } from '@/lib/actions/tasks';
import type { StatusOption, SectionOption } from '@/lib/db/schema';
import type { AssigneeUser } from './AssigneePicker';
import { getDateBucketDefinitions, groupByDateBucket } from '@/lib/utils/date-buckets';

interface SwimlaneBoardViewProps {
  boardId: string;
  clientSlug?: string;
  tasks: TaskWithAssignees[];
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
  assignableUsers: AssigneeUser[];
  onCreateTask?: (input: Omit<CreateTaskInput, 'boardId'>) => void;
  /** Optional task ID to open initially (from URL params) */
  initialTaskId?: string | null;
  /** Optional comment ID to highlight (from URL params) */
  highlightedCommentId?: string | null;
  /** Called when the task modal closes (to clear URL params) */
  onTaskModalClose?: () => void;
  /** Multi-select state */
  selectedTaskIds?: Set<string>;
  onTaskMultiSelect?: (taskId: string, shiftKey: boolean, orderedTaskIds: string[]) => void;
  isMultiSelectMode?: boolean;
  /** Group by status (default), date buckets, or sections */
  groupBy?: 'status' | 'date' | 'section';
}

export function SwimlaneBoardView({
  boardId,
  clientSlug,
  tasks,
  statusOptions,
  sectionOptions,
  assignableUsers,
  onCreateTask,
  initialTaskId,
  highlightedCommentId,
  onTaskModalClose,
  selectedTaskIds,
  onTaskMultiSelect,
  isMultiSelectMode,
  groupBy = 'status',
}: SwimlaneBoardViewProps) {
  const { isSwimlaneCollapsed, toggleSwimlane, getBoardTableColumns, getSwimlaneSortConfig, setSwimlaneSortConfig } = useBoardViewStore();
  const openQuickAddWithContext = useQuickActionsStore((s) => s.openQuickAddWithContext);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const bulkArchive = useBulkArchiveDone(boardId);
  const { isAdmin } = useCurrentUser();

  // Swimlane sort config (persisted per board)
  const swimlaneSort = getSwimlaneSortConfig(boardId);
  const columns = getBoardTableColumns(boardId);

  // Modal state - use initialTaskId if provided
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(initialTaskId ?? null);

  // Sync with initialTaskId prop changes
  React.useEffect(() => {
    if (initialTaskId) {
      setSelectedTaskId(initialTaskId);
    }
  }, [initialTaskId]);

  // Sync selectedTaskId to URL so links are shareable
  React.useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedTaskId) {
      url.searchParams.set('task', selectedTaskId);
    } else {
      url.searchParams.delete('task');
      url.searchParams.delete('comment');
    }
    window.history.replaceState(null, '', url.pathname + url.search);
  }, [selectedTaskId]);

  // Handle modal close
  const handleCloseModal = React.useCallback(() => {
    setSelectedTaskId(null);
    onTaskModalClose?.();
  }, [onTaskModalClose]);

  // Group tasks by status
  const tasksByStatus = React.useMemo(() => {
    const grouped: Record<string, TaskWithAssignees[]> = {};

    // Initialize all statuses
    statusOptions.forEach((status) => {
      grouped[status.id] = [];
    });

    // Group tasks
    tasks.forEach((task) => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });

    // Sort tasks within each group by position
    Object.keys(grouped).forEach((status) => {
      grouped[status].sort((a, b) => a.position - b.position);
    });

    return grouped;
  }, [tasks, statusOptions]);

  // Get selected task for modal - check board tasks first, then fetch individually (for subtasks)
  const boardTask = React.useMemo(
    () => tasks.find((t) => t.id === selectedTaskId),
    [tasks, selectedTaskId]
  );
  const { data: fetchedTask } = useTask(selectedTaskId ?? '', {
    enabled: !!selectedTaskId && !boardTask,
  });
  const selectedTask = boardTask ?? fetchedTask;

  // Sort status options by position
  const sortedStatusOptions = React.useMemo(
    () => [...statusOptions].sort((a, b) => a.position - b.position),
    [statusOptions]
  );

  // Date bucket definitions (for groupBy='date')
  const dateBucketDefs = React.useMemo(() => getDateBucketDefinitions(), []);

  // Group tasks by date bucket
  const tasksByDate = React.useMemo(() => {
    if (groupBy !== 'date') return {};
    return groupByDateBucket(tasks);
  }, [tasks, groupBy]);

  // Build synthetic StatusOptions from date buckets
  const dateBucketStatusOptions: StatusOption[] = React.useMemo(
    () => dateBucketDefs.map((b, i) => ({ id: b.id, label: b.label, color: b.color, position: i })),
    [dateBucketDefs]
  );

  // Group tasks by section
  const tasksBySection = React.useMemo(() => {
    if (groupBy !== 'section') return {};
    const grouped: Record<string, TaskWithAssignees[]> = {};

    sectionOptions.forEach((s) => { grouped[s.id] = []; });
    grouped['__no_section__'] = [];

    tasks.forEach((task) => {
      const key = task.section && grouped[task.section] ? task.section : '__no_section__';
      grouped[key].push(task);
    });

    Object.values(grouped).forEach((items) => {
      items.sort((a, b) => a.position - b.position);
    });

    return grouped;
  }, [tasks, sectionOptions, groupBy]);

  // Build synthetic StatusOptions from sections
  const sectionLaneOptions: StatusOption[] = React.useMemo(
    () => [
      ...sectionOptions.map((s, i) => ({ id: s.id, label: s.label, color: s.color, position: i })),
      { id: '__no_section__', label: 'No Section', color: '#9ca3af', position: sectionOptions.length },
    ],
    [sectionOptions]
  );

  // Choose lanes and grouping based on groupBy mode
  const lanes = groupBy === 'date'
    ? dateBucketStatusOptions
    : groupBy === 'section'
      ? sectionLaneOptions
      : sortedStatusOptions;
  const groupedTasks = groupBy === 'date'
    ? tasksByDate
    : groupBy === 'section'
      ? tasksBySection
      : tasksByStatus;

  // In date mode, skip empty buckets. In section mode, hide empty "No Section" lane.
  const visibleLanes = React.useMemo(
    () => groupBy === 'date'
      ? lanes.filter((lane) => (groupedTasks[lane.id]?.length ?? 0) > 0)
      : groupBy === 'section'
        ? lanes.filter((lane) => lane.id !== '__no_section__' || (groupedTasks[lane.id]?.length ?? 0) > 0)
        : lanes,
    [groupBy, lanes, groupedTasks]
  );

  // Sort tasks within each lane according to swimlane sort config
  const sortedGroupedTasks = React.useMemo(() => {
    const result: Record<string, TaskWithAssignees[]> = {};
    for (const lane of visibleLanes) {
      const laneTasks = [...(groupedTasks[lane.id] || [])];
      laneTasks.sort((a, b) => {
        let comparison = 0;
        switch (swimlaneSort.field) {
          case 'title':
            comparison = a.title.localeCompare(b.title);
            break;
          case 'status': {
            const aPos = statusOptions.find((s) => s.id === a.status)?.position ?? 0;
            const bPos = statusOptions.find((s) => s.id === b.status)?.position ?? 0;
            comparison = aPos - bPos;
            break;
          }
          case 'dueDate': {
            const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
            const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
            comparison = aDate - bDate;
            break;
          }
          default:
            comparison = a.position - b.position;
        }
        return swimlaneSort.direction === 'asc' ? comparison : -comparison;
      });
      result[lane.id] = laneTasks;
    }
    return result;
  }, [visibleLanes, groupedTasks, swimlaneSort, statusOptions]);

  // Track updating task IDs
  const updatingTaskIds = React.useMemo(() => {
    const ids: string[] = [];
    if (updateTask.isPending && updateTask.variables) {
      ids.push(updateTask.variables.id);
    }
    return ids;
  }, [updateTask.isPending, updateTask.variables]);

  const handleUpdateTask = React.useCallback(
    (input: UpdateTaskInput) => {
      updateTask.mutate(input);
    },
    [updateTask]
  );

  const handleDeleteTask = React.useCallback(
    (taskId: string) => {
      deleteTask.mutate(taskId);
    },
    [deleteTask]
  );

  return (
    <>
      <div className="space-y-4">
        {visibleLanes.map((status) => {
          const swimlaneTasks = sortedGroupedTasks[status.id] || [];
          const taskIds = swimlaneTasks.map((t) => t.id);

          return (
            <Swimlane
              key={status.id}
              status={status}
              taskCount={swimlaneTasks.length}
              isCollapsed={isSwimlaneCollapsed(boardId, status.id)}
              onToggleCollapse={() => toggleSwimlane(boardId, status.id)}
              taskIds={taskIds}
              onAddTask={groupBy === 'status' ? () => openQuickAddWithContext(boardId, status.id) : undefined}
              onArchiveAll={groupBy === 'status' && isAdmin && isCompleteStatus(status.id, statusOptions) ? () => bulkArchive.mutate() : undefined}
              disableDnd
            >
              <BoardTable
                tasks={swimlaneTasks}
                statusOptions={statusOptions}
                sectionOptions={sectionOptions}
                assignableUsers={assignableUsers}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={handleDeleteTask}
                onOpenTaskModal={setSelectedTaskId}
                updatingTaskIds={updatingTaskIds}
                sort={swimlaneSort}
                onSortChange={(sort) => setSwimlaneSortConfig(boardId, sort)}
                columns={columns}
                emptyMessage="No tasks"
                selectedTaskIds={selectedTaskIds}
                onTaskMultiSelect={onTaskMultiSelect}
                isMultiSelectMode={isMultiSelectMode}
              />
            </Swimlane>
          );
        })}
      </div>

      {/* Task Detail Modal */}
      <TaskModal
        open={!!selectedTaskId}
        onOpenChange={(open) => !open && handleCloseModal()}
        task={selectedTask}
        statusOptions={statusOptions}
        sectionOptions={sectionOptions}
        assignableUsers={assignableUsers}
        onUpdate={(input) => updateTask.mutate(input)}
        onDelete={(taskId) => {
          deleteTask.mutate(taskId);
          handleCloseModal();
        }}
        mode="view"
        highlightedCommentId={highlightedCommentId ?? undefined}
        taskBasePath={clientSlug ? `/clients/${clientSlug}/boards/${boardId}` : undefined}
        onOpenSubtask={setSelectedTaskId}
      />
    </>
  );
}
