'use client';

import * as React from 'react';
import { Plus, LayoutList, Kanban, Star, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BoardTable } from './BoardTable';
import { KanbanBoardView } from './KanbanBoardView';
import { TaskFilterBar } from './TaskFilterBar';
import { TaskModal } from './TaskModal';
import { usePersonalBoard } from '@/lib/hooks/useBoards';
import {
  useTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useTask,
  taskKeys,
} from '@/lib/hooks/useTasks';
import { useToggleFavorite } from '@/lib/hooks/useFavorites';
import { useRealtimeInvalidation } from '@/lib/hooks/useRealtimeInvalidation';
import { usePersonalRollupStore } from '@/lib/stores/personalRollupStore';
import { useMyWorkPreferences } from '@/lib/hooks/useMyWorkPreferences';
import type { TaskSortOptions, CreateTaskInput } from '@/lib/actions/tasks';

const HIDDEN_ITEMS = new Set(['assignees']);
const TABLE_COLUMNS = { title: true, status: true, section: true, assignees: false, dueDate: true } as const;

export function PersonalListTab() {
  const { data: board, isLoading: boardLoading, error: boardError, refetch: refetchBoard } = usePersonalBoard();
  const { personalListViewMode, setPersonalListViewMode } = usePersonalRollupStore();

  const boardId = board?.id ?? '';
  const statusOptions = board?.statusOptions ?? [];
  const sectionOptions = board?.sectionOptions ?? [];

  // Fetch tasks
  const { personalTaskFilters: filters, setPersonalTaskFilters: setFilters } = useMyWorkPreferences();
  const [sort, setSort] = React.useState<TaskSortOptions>({ field: 'position', direction: 'asc' });
  const { data: tasks = [], isLoading: tasksLoading } = useTasks(boardId, filters, sort);

  // Mutations
  const createTask = useCreateTask(boardId);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  // Favorites
  const { toggle: toggleFavorite, isFavorited } = useToggleFavorite();
  const favorited = isFavorited(boardId);

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);

  // Fetch individually if not found in board tasks (e.g. subtask)
  const boardTask = React.useMemo(
    () => tasks.find((t) => t.id === selectedTaskId),
    [tasks, selectedTaskId]
  );
  const { data: fetchedTask } = useTask(selectedTaskId ?? '', {
    enabled: !!selectedTaskId && !boardTask,
  });
  const selectedTask = boardTask ?? fetchedTask;

  // Realtime
  useRealtimeInvalidation({
    channel: `board-tasks-${boardId}`,
    table: 'tasks',
    filter: boardId ? `board_id=eq.${boardId}` : undefined,
    queryKeys: [taskKeys.lists(), taskKeys.details()],
    enabled: !!boardId,
  });

  // Track updating tasks
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
        setSelectedTaskId(createdTask.id);
      },
    });
  };

  const handleCloseTaskModal = React.useCallback(() => {
    setSelectedTaskId(null);
  }, []);

  // Loading state
  if (boardLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (boardError || !board) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-destructive/10 p-4 mb-4">
          <AlertCircle className="size-8 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Failed to load personal list</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-4">
          {boardError instanceof Error ? boardError.message : 'An unexpected error occurred'}
        </p>
        <Button variant="outline" onClick={() => refetchBoard()}>
          <RefreshCw className="size-4 mr-2" />
          Try again
        </Button>
      </div>
    );
  }

  const isLoading = tasksLoading;

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="inline-flex rounded-md border bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setPersonalListViewMode('kanban')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-3 py-1 text-sm transition-colors',
                personalListViewMode === 'kanban' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
              )}
            >
              <Kanban className="size-4" />
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setPersonalListViewMode('table')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-3 py-1 text-sm transition-colors',
                personalListViewMode === 'table' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
              )}
            >
              <LayoutList className="size-4" />
              Table
            </button>
          </div>

          {/* Filters */}
          <TaskFilterBar
            filters={filters}
            onFiltersChange={setFilters}
            statusOptions={statusOptions}
            sectionOptions={sectionOptions}
            assignableUsers={[]}
            hideAssigneeFilter
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Favorite toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleFavorite('board', boardId)}
          >
            <Star className={cn('size-4 transition-colors', favorited && 'fill-foreground text-foreground')} />
          </Button>

          {/* New Task */}
          <Button onClick={() => setIsCreateModalOpen(true)} size="sm">
            <Plus className="mr-1 size-4" />
            New Task
          </Button>
        </div>
      </div>

      {/* Board View */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading tasks...</div>
        </div>
      ) : personalListViewMode === 'table' ? (
        <BoardTable
          tasks={tasks}
          statusOptions={statusOptions}
          sectionOptions={sectionOptions}
          assignableUsers={[]}
          onUpdateTask={(input) => updateTask.mutate(input)}
          onDeleteTask={(taskId) => deleteTask.mutate(taskId)}
          onOpenTaskModal={setSelectedTaskId}
          updatingTaskIds={updatingTaskIds}
          sort={sort}
          onSortChange={setSort}
          columns={TABLE_COLUMNS}
        />
      ) : (
        <KanbanBoardView
          boardId={boardId}
          tasks={tasks}
          statusOptions={statusOptions}
          sectionOptions={sectionOptions}
          assignableUsers={[]}
          onCreateTask={handleCreateTask}
          hiddenItems={HIDDEN_ITEMS}
        />
      )}

      {/* Create Task Modal */}
      <TaskModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        statusOptions={statusOptions}
        sectionOptions={sectionOptions}
        assignableUsers={[]}
        onCreate={handleCreateTask}
        mode="create"
      />

      {/* Task Detail Modal */}
      <TaskModal
        open={!!selectedTaskId}
        onOpenChange={(open) => !open && handleCloseTaskModal()}
        task={selectedTask}
        statusOptions={statusOptions}
        sectionOptions={sectionOptions}
        assignableUsers={[]}
        onUpdate={(input) => updateTask.mutate(input)}
        onDelete={(taskId) => {
          deleteTask.mutate(taskId);
          handleCloseTaskModal();
        }}
        mode="view"
        onOpenSubtask={setSelectedTaskId}
      />
    </div>
  );
}
