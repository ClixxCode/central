'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BoardTable } from './BoardTable';
import { TableColumnsButton } from '@/components/shared/TableColumnsButton';
import { useBoardViewStore } from '@/lib/stores/boardViewStore';
import { NewTaskRow } from './NewTaskRow';
import { TaskFilterBar } from './TaskFilterBar';
import { TaskModal } from './TaskModal';
import {
  useTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useAssignableUsers,
  useTask,
} from '@/lib/hooks/useTasks';
import type { TaskFilters, TaskSortOptions, CreateTaskInput } from '@/lib/actions/tasks';
import type { StatusOption, SectionOption } from '@/lib/db/schema';

interface BoardViewProps {
  boardId: string;
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
}

/**
 * Standalone board view component with its own toolbar, filters, and modals.
 * Note: BoardPageClient uses BoardTable directly for table view, not this component.
 */
export function BoardView({
  boardId,
  statusOptions,
  sectionOptions,
}: BoardViewProps) {
  const { getBoardTableColumns, toggleBoardTableColumn } = useBoardViewStore();
  const columns = getBoardTableColumns(boardId);

  // Filter and sort state
  const [filters, setFilters] = React.useState<TaskFilters>({});
  const [sort, setSort] = React.useState<TaskSortOptions>({
    field: 'position',
    direction: 'asc',
  });

  // Modal state
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);

  // Fetch data
  const { data: tasks = [], isLoading: isLoadingTasks } = useTasks(boardId, filters, sort);
  const { data: assignableUsers = [], isLoading: isLoadingUsers } = useAssignableUsers(boardId);

  // Mutations
  const createTask = useCreateTask(boardId);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  // Track which tasks are being updated
  const updatingTaskIds = React.useMemo(() => {
    const ids: string[] = [];
    if (updateTask.isPending && updateTask.variables) {
      ids.push(updateTask.variables.id);
    }
    return ids;
  }, [updateTask.isPending, updateTask.variables]);

  // Get selected task for modal — check board tasks first, then fetch individually (for subtasks)
  const boardTask = React.useMemo(
    () => tasks.find((t) => t.id === selectedTaskId),
    [tasks, selectedTaskId]
  );
  const { data: fetchedTask } = useTask(selectedTaskId ?? '', {
    enabled: !!selectedTaskId && !boardTask,
  });
  const selectedTask = boardTask ?? fetchedTask;

  const handleCreateTask = (input: Omit<CreateTaskInput, 'boardId'>) => {
    createTask.mutate(input, {
      onSuccess: (createdTask) => {
        // Open the task modal after creation
        setSelectedTaskId(createdTask.id);
      },
    });
  };

  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  const isLoading = isLoadingTasks || isLoadingUsers;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Filters */}
          <TaskFilterBar
            filters={filters}
            onFiltersChange={setFilters}
            statusOptions={statusOptions}
            sectionOptions={sectionOptions}
            assignableUsers={assignableUsers}
          />

          {/* Column visibility */}
          <TableColumnsButton
            columns={[
              { id: 'status', label: 'Status' },
              { id: 'section', label: 'Section' },
              { id: 'assignees', label: 'Assignees' },
              { id: 'dueDate', label: 'Due Date' },
            ]}
            visibleColumns={columns}
            onToggle={(col) => toggleBoardTableColumn(boardId, col as keyof typeof columns)}
          />
        </div>

        {/* Actions */}
        <Button onClick={handleOpenCreateModal} size="sm">
          <Plus className="mr-1 size-4" />
          New Task
        </Button>
      </div>

      {/* Table */}
      <BoardTable
        tasks={tasks}
        statusOptions={statusOptions}
        sectionOptions={sectionOptions}
        assignableUsers={assignableUsers}
        onUpdateTask={(input) => updateTask.mutate(input)}
        onDeleteTask={(taskId) => deleteTask.mutate(taskId)}
        onOpenTaskModal={setSelectedTaskId}
        updatingTaskIds={updatingTaskIds}
        isLoading={isLoading}
        sort={sort}
        onSortChange={setSort}
        columns={columns}
      />

      {/* Inline new task row */}
      {!isLoading && (
        <div className="rounded-lg border">
          <table className="w-full">
            <tbody>
              <NewTaskRow
                statusOptions={statusOptions}
                sectionOptions={sectionOptions}
                assignableUsers={assignableUsers}
                onCreateTask={handleCreateTask}
                isCreating={createTask.isPending}
                columns={columns}
              />
            </tbody>
          </table>
        </div>
      )}

      {/* Task Detail Modal */}
      <TaskModal
        open={!!selectedTaskId}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
        task={selectedTask}
        statusOptions={statusOptions}
        sectionOptions={sectionOptions}
        assignableUsers={assignableUsers}
        onUpdate={(input) => updateTask.mutate(input)}
        onDelete={(taskId) => {
          deleteTask.mutate(taskId);
          setSelectedTaskId(null);
        }}
        mode="view"
        onOpenSubtask={setSelectedTaskId}
      />

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
    </div>
  );
}
