'use client';

import * as React from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BoardTable, defaultColumns, type ColumnConfig } from './BoardTable';
import { SwimlaneBoardView } from './SwimlaneBoardView';
import { KanbanBoardView } from './KanbanBoardView';
import { ViewToggleButtons } from './ViewToggle';
import { TaskFilterBar } from './TaskFilterBar';
import { TaskModal } from './TaskModal';
import { useBoardViewStore } from '@/lib/stores/boardViewStore';
import { useQuickActionsStore } from '@/lib/stores';
import {
  useTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useAssignableUsers,
  useTask,
  taskKeys,
} from '@/lib/hooks/useTasks';
import { useRealtimeInvalidation } from '@/lib/hooks/useRealtimeInvalidation';
import type { TaskFilters, TaskSortOptions, CreateTaskInput } from '@/lib/actions/tasks';
import type { StatusOption, SectionOption } from '@/lib/db/schema';

interface BoardPageClientProps {
  boardId: string;
  boardName: string;
  clientSlug: string;
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
}

export function BoardPageClient({
  boardId,
  boardName,
  clientSlug,
  statusOptions,
  sectionOptions,
}: BoardPageClientProps) {
  const { getBoardView } = useBoardViewStore();
  const viewMode = getBoardView(boardId, 'kanban');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Filter and sort state
  const [filters, setFilters] = React.useState<TaskFilters>({});
  const [sort, setSort] = React.useState<TaskSortOptions>({
    field: 'position',
    direction: 'asc',
  });
  const [columns, setColumns] = React.useState<ColumnConfig>(defaultColumns);

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);

  // URL-based task/comment params (for opening task modal from notifications)
  const urlTaskId = searchParams.get('task');
  const urlCommentId = searchParams.get('comment');

  // Clear URL params when modal closes
  const clearUrlParams = React.useCallback(() => {
    if (urlTaskId || urlCommentId) {
      router.replace(pathname, { scroll: false });
    }
  }, [urlTaskId, urlCommentId, router, pathname]);

  // Listen for global create task trigger
  const createTaskTrigger = useQuickActionsStore((state) => state.createTaskTrigger);
  const resetCreateTaskTrigger = useQuickActionsStore((state) => state.resetCreateTaskTrigger);
  const lastHandledTriggerRef = React.useRef(0);
  
  React.useEffect(() => {
    if (createTaskTrigger > 0 && createTaskTrigger !== lastHandledTriggerRef.current) {
      lastHandledTriggerRef.current = createTaskTrigger;
      setIsCreateModalOpen(true);
      // Reset the trigger so it doesn't fire again on remount
      resetCreateTaskTrigger();
    }
  }, [createTaskTrigger, resetCreateTaskTrigger]);

  // Fetch data
  const { data: tasks = [], isLoading: isLoadingTasks } = useTasks(boardId, filters, sort);
  const { data: assignableUsers = [], isLoading: isLoadingUsers } = useAssignableUsers(boardId);

  // Mutations
  const createTask = useCreateTask(boardId);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  // Realtime: invalidate board tasks when any task in this board changes
  useRealtimeInvalidation({
    channel: `board-tasks-${boardId}`,
    table: 'tasks',
    filter: `board_id=eq.${boardId}`,
    queryKeys: [taskKeys.lists(), taskKeys.details()],
  });

  // Task modal state for table view
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);

  // Sync selectedTaskId to URL so links are shareable (table view)
  React.useEffect(() => {
    if (viewMode !== 'table') return;
    const url = new URL(window.location.href);
    if (selectedTaskId) {
      url.searchParams.set('task', selectedTaskId);
    } else {
      url.searchParams.delete('task');
      url.searchParams.delete('comment');
    }
    window.history.replaceState(null, '', url.pathname + url.search);
  }, [selectedTaskId, viewMode]);

  // Combine URL task ID and selected task ID (URL takes precedence on initial load)
  // Only use urlTaskId in table view — kanban/swimlane handle it via their own initialTaskId prop
  const effectiveTaskId = (viewMode === 'table' ? urlTaskId : null) || selectedTaskId;
  const boardTask = React.useMemo(
    () => tasks.find((t) => t.id === effectiveTaskId),
    [tasks, effectiveTaskId]
  );
  // Fetch individually if not found in board tasks (e.g. subtask opened from SubtasksTab)
  const { data: fetchedTask } = useTask(effectiveTaskId ?? '', {
    enabled: !!effectiveTaskId && !boardTask,
  });
  const selectedTask = boardTask ?? fetchedTask;

  // Handle closing the task modal - clear both states and URL
  const handleCloseTaskModal = React.useCallback(() => {
    setSelectedTaskId(null);
    clearUrlParams();
  }, [clearUrlParams]);

  // Track which tasks are being updated
  const updatingTaskIds = React.useMemo(() => {
    const ids: string[] = [];
    if (updateTask.isPending && updateTask.variables) {
      ids.push(updateTask.variables.id);
    }
    return ids;
  }, [updateTask.isPending, updateTask.variables]);

  const handleCreateTask = (input: Omit<CreateTaskInput, 'boardId'>) => {
    createTask.mutate(input, {
      onSuccess: (createdTask) => {
        setIsCreateModalOpen(false);
        // Open the task details after creation
        setSelectedTaskId(createdTask.id);
      },
    });
  };

  const isLoading = isLoadingTasks || isLoadingUsers;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* View Toggle */}
          <ViewToggleButtons boardId={boardId} defaultView="kanban" />

          {/* Filters */}
          <TaskFilterBar
            filters={filters}
            onFiltersChange={setFilters}
            statusOptions={statusOptions}
            sectionOptions={sectionOptions}
            assignableUsers={assignableUsers}
          />
        </div>

        {/* Actions */}
        <Button onClick={() => setIsCreateModalOpen(true)} size="sm">
          <Plus className="mr-1 size-4" />
          New Task
        </Button>
      </div>

      {/* Board View */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading tasks...</div>
        </div>
      ) : viewMode === 'table' ? (
        <BoardTable
          tasks={tasks}
          statusOptions={statusOptions}
          sectionOptions={sectionOptions}
          assignableUsers={assignableUsers}
          onUpdateTask={(input) => updateTask.mutate(input)}
          onDeleteTask={(taskId) => deleteTask.mutate(taskId)}
          onOpenTaskModal={setSelectedTaskId}
          updatingTaskIds={updatingTaskIds}
          sort={sort}
          onSortChange={setSort}
          columns={columns}
          onColumnsChange={setColumns}
        />
      ) : viewMode === 'swimlane' ? (
        <SwimlaneBoardView
          boardId={boardId}
          clientSlug={clientSlug}
          tasks={tasks}
          statusOptions={statusOptions}
          sectionOptions={sectionOptions}
          assignableUsers={assignableUsers}
          onCreateTask={handleCreateTask}
          initialTaskId={urlTaskId}
          highlightedCommentId={urlCommentId}
          onTaskModalClose={clearUrlParams}
        />
      ) : (
        <KanbanBoardView
          boardId={boardId}
          clientSlug={clientSlug}
          tasks={tasks}
          statusOptions={statusOptions}
          sectionOptions={sectionOptions}
          assignableUsers={assignableUsers}
          onCreateTask={handleCreateTask}
          initialTaskId={urlTaskId}
          highlightedCommentId={urlCommentId}
          onTaskModalClose={clearUrlParams}
        />
      )}

      {/* Create Task Modal */}
      <TaskModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        statusOptions={statusOptions}
        sectionOptions={sectionOptions}
        assignableUsers={assignableUsers}
        onCreate={handleCreateTask}
        mode="create"
      />

      {/* Task Detail Modal (for table view and URL-based opening) */}
      <TaskModal
        open={!!effectiveTaskId}
        onOpenChange={(open) => !open && handleCloseTaskModal()}
        task={selectedTask}
        statusOptions={statusOptions}
        sectionOptions={sectionOptions}
        assignableUsers={assignableUsers}
        onUpdate={(input) => updateTask.mutate(input)}
        onDelete={(taskId) => {
          deleteTask.mutate(taskId);
          handleCloseTaskModal();
        }}
        mode="view"
        highlightedCommentId={urlCommentId ?? undefined}
        taskBasePath={`/clients/${clientSlug}/boards/${boardId}`}
        onOpenSubtask={setSelectedTaskId}
      />
    </div>
  );
}
