'use client';

import * as React from 'react';
import { Swimlane } from './Swimlane';
import { BoardTable } from './BoardTable';
import { TaskModal } from './TaskModal';
import { useBoardViewStore } from '@/lib/stores/boardViewStore';
import { useQuickActionsStore } from '@/lib/stores';
import { useUpdateTask, useUpdateProject, useDeleteTask, useTask, useBulkArchiveDone } from '@/lib/hooks/useTasks';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { isCompleteStatus } from '@/lib/utils/status';
import type { BoardItem, TaskWithAssignees, UpdateTaskInput } from '@/lib/actions/tasks';
import type { StatusOption, SectionOption } from '@/lib/db/schema';
import type { AssigneeUser } from './AssigneePicker';
import { getDateBucketDefinitions, groupByDateBucket } from '@/lib/utils/date-buckets';

interface SwimlaneBoardViewProps {
  boardId: string;
  clientSlug?: string;
  tasks: TaskWithAssignees[];
  items?: BoardItem[];
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
  assignableUsers: AssigneeUser[];
  /** Optional task ID to open initially (from URL params) */
  initialTaskId?: string | null;
  /** Optional comment ID to highlight (from URL params) */
  highlightedCommentId?: string | null;
  /** Called when the task modal closes (to clear URL params) */
  onTaskModalClose?: () => void;
  /** Called immediately before opening the task modal */
  onTaskModalOpen?: () => void;
  onOpenProject?: (projectBoardId: string) => void;
  /** Multi-select state */
  selectedTaskIds?: Set<string>;
  onTaskMultiSelect?: (taskId: string, shiftKey: boolean, orderedTaskIds: string[]) => void;
  isMultiSelectMode?: boolean;
  subtaskOnlyParentId?: string | null;
  onEnterSubtaskOnlyMode?: (parentTaskId: string) => void;
  /** Group by status (default), date buckets, or sections */
  groupBy?: 'status' | 'date' | 'section';
}

export function SwimlaneBoardView({
  boardId,
  clientSlug,
  tasks,
  items,
  statusOptions,
  sectionOptions,
  assignableUsers,
  initialTaskId,
  highlightedCommentId,
  onTaskModalClose,
  onTaskModalOpen,
  onOpenProject,
  selectedTaskIds,
  onTaskMultiSelect,
  isMultiSelectMode,
  subtaskOnlyParentId,
  onEnterSubtaskOnlyMode,
  groupBy = 'status',
}: SwimlaneBoardViewProps) {
  const { isSwimlaneCollapsed, toggleSwimlane, getBoardTableColumns, getSwimlaneSortConfig, setSwimlaneSortConfig } = useBoardViewStore();
  const openQuickAddWithContext = useQuickActionsStore((s) => s.openQuickAddWithContext);
  const updateTask = useUpdateTask();
  const updateProject = useUpdateProject();
  const deleteTask = useDeleteTask();
  const bulkArchive = useBulkArchiveDone(boardId);
  const { isAdmin } = useCurrentUser();
  const boardItems = React.useMemo<BoardItem[]>(
    () => items ?? tasks.map((task) => ({ ...task, kind: 'task' as const })),
    [items, tasks]
  );

  // Swimlane sort config (persisted per board)
  const swimlaneSort = getSwimlaneSortConfig(boardId);
  const columns = getBoardTableColumns(boardId);

  // Modal state - use initialTaskId if provided
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(initialTaskId ?? null);
  const [selectedTaskInitialTab, setSelectedTaskInitialTab] = React.useState<'details' | 'subtasks'>('details');

  const openTaskModal = React.useCallback((taskId: string, initialTab: 'details' | 'subtasks' = 'details') => {
    onTaskModalOpen?.();
    setSelectedTaskInitialTab(initialTab);
    setSelectedTaskId(taskId);
  }, [onTaskModalOpen]);

  // Sync with initialTaskId prop changes
  React.useEffect(() => {
    if (initialTaskId) {
      onTaskModalOpen?.();
      setSelectedTaskInitialTab('details');
      setSelectedTaskId(initialTaskId);
    }
  }, [initialTaskId, onTaskModalOpen]);

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
    setSelectedTaskInitialTab('details');
    onTaskModalClose?.();
  }, [onTaskModalClose]);

  // Group items by status
  const itemsByStatus = React.useMemo(() => {
    const grouped: Record<string, BoardItem[]> = {};

    // Initialize all statuses
    statusOptions.forEach((status) => {
      grouped[status.id] = [];
    });

    boardItems.forEach((item) => {
      if (grouped[item.status]) {
        grouped[item.status].push(item);
      }
    });

    // Sort tasks within each group by position
    Object.keys(grouped).forEach((status) => {
      grouped[status].sort((a, b) => a.position - b.position);
    });

    return grouped;
  }, [boardItems, statusOptions]);

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
    return groupByDateBucket(boardItems);
  }, [boardItems, groupBy]);

  // Build synthetic StatusOptions from date buckets
  const dateBucketStatusOptions: StatusOption[] = React.useMemo(
    () => dateBucketDefs.map((b, i) => ({ id: b.id, label: b.label, color: b.color, position: i })),
    [dateBucketDefs]
  );

  // Group tasks by section
  const tasksBySection = React.useMemo(() => {
    if (groupBy !== 'section') return {};
    const grouped: Record<string, BoardItem[]> = {};

    sectionOptions.forEach((s) => { grouped[s.id] = []; });
    grouped['__no_section__'] = [];

    boardItems.forEach((item) => {
      const key = item.section && grouped[item.section] ? item.section : '__no_section__';
      grouped[key].push(item);
    });

    Object.values(grouped).forEach((items) => {
      items.sort((a, b) => a.position - b.position);
    });

    return grouped;
  }, [boardItems, sectionOptions, groupBy]);

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
      : itemsByStatus;

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
    const result: Record<string, BoardItem[]> = {};
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
          const swimlaneItems = sortedGroupedTasks[status.id] || [];
          const taskIds = swimlaneItems.map((item) => item.id);

          return (
            <Swimlane
              key={status.id}
              status={status}
              taskCount={swimlaneItems.length}
              isCollapsed={isSwimlaneCollapsed(boardId, status.id)}
              onToggleCollapse={() => toggleSwimlane(boardId, status.id)}
              taskIds={taskIds}
              onAddTask={groupBy === 'status' ? () => openQuickAddWithContext(boardId, status.id) : undefined}
              onArchiveAll={groupBy === 'status' && isAdmin && isCompleteStatus(status.id, statusOptions) ? () => bulkArchive.mutate() : undefined}
              disableDnd
            >
              <BoardTable
                tasks={swimlaneItems.filter((item): item is Extract<BoardItem, { kind: 'task' }> => item.kind === 'task')}
                items={swimlaneItems}
                statusOptions={statusOptions}
                sectionOptions={sectionOptions}
                assignableUsers={assignableUsers}
                onUpdateTask={handleUpdateTask}
                onUpdateProject={(input) => updateProject.mutate(input)}
                onDeleteTask={handleDeleteTask}
                onOpenTaskModal={openTaskModal}
                onOpenProject={onOpenProject}
                onOpenSubtasks={(taskId) => openTaskModal(taskId, 'subtasks')}
                updatingTaskIds={updatingTaskIds}
                sort={swimlaneSort}
                onSortChange={(sort) => setSwimlaneSortConfig(boardId, sort)}
                columns={columns}
                emptyMessage="No tasks"
                selectedTaskIds={selectedTaskIds}
                onTaskMultiSelect={onTaskMultiSelect}
                isMultiSelectMode={isMultiSelectMode}
                subtaskOnlyParentId={subtaskOnlyParentId}
                onEnterSubtaskOnlyMode={onEnterSubtaskOnlyMode}
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
        onOpenSubtask={(taskId) => openTaskModal(taskId)}
        initialTab={selectedTaskInitialTab}
      />
    </>
  );
}
