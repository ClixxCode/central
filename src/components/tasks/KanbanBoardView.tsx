'use client';

import * as React from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { DndProvider, type DragEndEvent, type UniqueIdentifier } from '@/components/dnd';
import { KanbanColumn } from './KanbanColumn';
import { KanbanTaskCard } from './KanbanTaskCard';
import { ExpandedSubtasks } from './ExpandedSubtasks';
import { CompleteParentDialog } from './CompleteParentDialog';
import { TaskModal } from './TaskModal';
import { useUpdateTaskPositions, useUpdateTask, useDeleteTask, useTask, useBulkArchiveDone } from '@/lib/hooks/useTasks';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useQuickActionsStore } from '@/lib/stores';
import { isCompleteStatus } from '@/lib/utils/status';
import type { TaskWithAssignees, CreateTaskInput } from '@/lib/actions/tasks';
import type { StatusOption, SectionOption } from '@/lib/db/schema';
import type { AssigneeUser } from './AssigneePicker';

interface KanbanBoardViewProps {
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
  /** Set of card item IDs to hide (e.g. 'section', 'dueDate', 'assignees') */
  hiddenItems?: Set<string>;
}

export function KanbanBoardView({
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
  hiddenItems,
}: KanbanBoardViewProps) {
  const updateTaskPositions = useUpdateTaskPositions();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const bulkArchive = useBulkArchiveDone(boardId);
  const { isAdmin } = useCurrentUser();
  const openQuickAddWithContext = useQuickActionsStore((s) => s.openQuickAddWithContext);

  // Expanded subtasks state
  const [expandedParents, setExpandedParents] = React.useState<Set<string>>(new Set());

  // Complete parent dialog state for DnD
  const [completeParentOpen, setCompleteParentOpen] = React.useState(false);
  const pendingDnDRef = React.useRef<{
    taskId: string;
    updates: { id: string; position: number; status?: string }[];
    incompleteCount: number;
  } | null>(null);

  const toggleExpanded = React.useCallback((taskId: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

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

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      // Find the task being dragged
      const activeTask = tasks.find((t) => t.id === activeId);
      if (!activeTask) return;

      // Determine the target status
      let targetStatus = overId;
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) {
        targetStatus = overTask.status;
      }

      // Check if status is a valid status option
      const isValidStatus = statusOptions.some((s) => s.id === targetStatus);
      if (!isValidStatus && !overTask) return;

      const sourceStatus = activeTask.status;
      const newStatus = overTask ? overTask.status : targetStatus;

      // Get tasks in source and target columns
      const sourceTasks = [...tasksByStatus[sourceStatus]];
      const targetTasks = sourceStatus === newStatus
        ? sourceTasks
        : [...tasksByStatus[newStatus]];

      // Find indices
      const activeIndex = sourceTasks.findIndex((t) => t.id === activeId);

      if (sourceStatus === newStatus) {
        // Reorder within same column
        const overIndex = overTask
          ? targetTasks.findIndex((t) => t.id === overId)
          : targetTasks.length;

        if (activeIndex === overIndex) return;

        const reorderedTasks = arrayMove(sourceTasks, activeIndex, overIndex);

        // Calculate position updates
        const updates = reorderedTasks.map((task, index) => ({
          id: task.id,
          position: index * 1000,
        }));

        updateTaskPositions.mutate(updates);
      } else {
        // Move between columns
        sourceTasks.splice(activeIndex, 1);

        const overIndex = overTask
          ? targetTasks.findIndex((t) => t.id === overId)
          : targetTasks.length;

        const updates: { id: string; position: number; status?: string }[] = [];

        // Update moved task's position and status
        updates.push({
          id: activeId,
          position: overIndex * 1000,
          status: newStatus,
        });

        // Reindex target tasks after insertion point
        targetTasks.forEach((task, index) => {
          if (index >= overIndex) {
            updates.push({
              id: task.id,
              position: (index + 1) * 1000,
            });
          }
        });

        // Check if dragging a parent task with incomplete subtasks to a complete column
        const hasIncompleteSubtasks =
          activeTask &&
          !activeTask.parentTaskId &&
          activeTask.subtaskCount > 0 &&
          activeTask.subtaskCompletedCount < activeTask.subtaskCount;
        const movingToComplete = isCompleteStatus(newStatus, statusOptions);
        const wasNotComplete = !isCompleteStatus(sourceStatus, statusOptions);

        if (hasIncompleteSubtasks && movingToComplete && wasNotComplete) {
          pendingDnDRef.current = {
            taskId: activeId,
            updates,
            incompleteCount: activeTask.subtaskCount - activeTask.subtaskCompletedCount,
          };
          setCompleteParentOpen(true);
          return;
        }

        updateTaskPositions.mutate(updates);
      }
    },
    [tasks, statusOptions, tasksByStatus, updateTaskPositions]
  );

  const renderOverlay = React.useCallback(
    (activeId: UniqueIdentifier | null) => {
      if (!activeId) return null;

      const task = tasks.find((t) => t.id === activeId);
      if (!task) return null;

      return (
        <KanbanTaskCard
          task={task}
          sectionOptions={sectionOptions}
          assignableUsers={assignableUsers}
          isOverlay
          hiddenItems={hiddenItems}
        />
      );
    },
    [tasks, sectionOptions, assignableUsers, hiddenItems]
  );

  // Sort status options by position
  const sortedStatusOptions = React.useMemo(
    () => [...statusOptions].sort((a, b) => a.position - b.position),
    [statusOptions]
  );

  return (
    <>
      <DndProvider onDragEnd={handleDragEnd} renderOverlay={renderOverlay}>
        <div className="flex h-[calc(100vh-12rem)] gap-4 overflow-x-auto pb-4">
          {sortedStatusOptions.map((status) => {
            const columnTasks = tasksByStatus[status.id] || [];
            const taskIds = columnTasks.map((t) => t.id);

            return (
              <KanbanColumn
                key={status.id}
                status={status}
                taskCount={columnTasks.length}
                taskIds={taskIds}
                onAddTask={() => openQuickAddWithContext(boardId, status.id)}
                onArchiveAll={isAdmin && isCompleteStatus(status.id, statusOptions) ? () => bulkArchive.mutate() : undefined}
              >
                {columnTasks.map((task) => (
                  <React.Fragment key={task.id}>
                    <KanbanTaskCard
                      task={task}
                      sectionOptions={sectionOptions}
                      assignableUsers={assignableUsers}
                      onClick={() => setSelectedTaskId(task.id)}
                      onToggleSubtasks={task.subtaskCount > 0 ? () => toggleExpanded(task.id) : undefined}
                      isExpanded={expandedParents.has(task.id)}
                      hiddenItems={hiddenItems}
                    />
                    {expandedParents.has(task.id) && (
                      <ExpandedSubtasks
                        parentTaskId={task.id}
                        statusOptions={statusOptions}
                        sectionOptions={sectionOptions}
                        onTaskClick={setSelectedTaskId}
                        hiddenItems={hiddenItems}
                      />
                    )}
                  </React.Fragment>
                ))}
              </KanbanColumn>
            );
          })}
        </div>
      </DndProvider>

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

      {/* Confirmation dialog for DnD to complete column with incomplete subtasks */}
      <CompleteParentDialog
        open={completeParentOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCompleteParentOpen(false);
            pendingDnDRef.current = null;
          }
        }}
        incompleteCount={pendingDnDRef.current?.incompleteCount ?? 0}
        onConfirm={(completeSubtasks) => {
          const pending = pendingDnDRef.current;
          if (pending) {
            updateTaskPositions.mutate(pending.updates);
            if (completeSubtasks) {
              updateTask.mutate({ id: pending.taskId, completeSubtasks: true });
            }
            pendingDnDRef.current = null;
          }
        }}
      />
    </>
  );
}
