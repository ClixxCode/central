'use client';

import * as React from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Plus, SlidersHorizontal, ChevronDown, Columns3, CalendarDays, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BoardTable } from './BoardTable';
import { TableColumnsButton } from '@/components/shared/TableColumnsButton';
import { SwimlaneBoardView } from './SwimlaneBoardView';
import { KanbanBoardView } from './KanbanBoardView';
import { ViewToggleButtons } from './ViewToggle';
import { TaskFilterBar } from './TaskFilterBar';
import { TaskModal } from './TaskModal';
import { MultiSelectFloatingBar, type BulkEditPayload } from './MultiSelectFloatingBar';
import { MoveTasksDialog } from './MoveTasksDialog';
import { useBoardViewStore, type GroupBy } from '@/lib/stores/boardViewStore';
import { useQuickActionsStore } from '@/lib/stores';
import {
  useTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useAssignableUsers,
  useTask,
  useBulkUpdateTasks,
  useBulkDuplicateTasks,
  useBulkDeleteTasks,
  taskKeys,
} from '@/lib/hooks/useTasks';
import { useRealtimeInvalidation } from '@/lib/hooks/useRealtimeInvalidation';
import type { TaskFilters, TaskSortOptions, CreateTaskInput } from '@/lib/actions/tasks';
import type { StatusOption, SectionOption } from '@/lib/db/schema';
import { trackEvent } from '@/lib/analytics';

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
  const { getBoardView, getBoardTableColumns, toggleBoardTableColumn, getSwimlaneCardItems, toggleSwimlaneCardItem, getGroupBy, setGroupBy } = useBoardViewStore();
  const viewMode = getBoardView(boardId, 'kanban');
  const columns = getBoardTableColumns(boardId);
  const swimlaneCardItems = getSwimlaneCardItems(boardId);
  const rawGroupBy = getGroupBy(boardId);
  // Fall back to 'status' if 'section' is stored but board has no sections
  const groupBy = rawGroupBy === 'section' && sectionOptions.length === 0 ? 'status' : rawGroupBy;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Filter and sort state
  const [filters, setFilters] = React.useState<TaskFilters>({});
  const [sort, setSort] = React.useState<TaskSortOptions>({
    field: 'position',
    direction: 'asc',
  });
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

  // Track board view
  React.useEffect(() => {
    trackEvent('board_viewed', { view_type: viewMode });
  }, [viewMode, boardId]);

  // Fetch data
  const { data: tasks = [], isLoading: isLoadingTasks } = useTasks(boardId, filters, sort);
  const { data: assignableUsers = [], isLoading: isLoadingUsers } = useAssignableUsers(boardId);

  // Mutations
  const createTask = useCreateTask(boardId);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const bulkUpdate = useBulkUpdateTasks();
  const bulkDuplicate = useBulkDuplicateTasks();
  const bulkDelete = useBulkDeleteTasks();

  // Realtime: invalidate board tasks when any task in this board changes
  useRealtimeInvalidation({
    channel: `board-tasks-${boardId}`,
    table: 'tasks',
    filter: `board_id=eq.${boardId}`,
    queryKeys: [taskKeys.lists(), taskKeys.details()],
  });

  // ─── Multi-select state ───────────────────────────────────
  const [selectedTaskIds, setSelectedTaskIds] = React.useState<Set<string>>(new Set());
  const lastSelectedIdRef = React.useRef<string | null>(null);
  const isMultiSelectMode = selectedTaskIds.size > 0;

  // Move tasks dialog state
  const [moveDialog, setMoveDialog] = React.useState<{
    open: boolean;
    payload: BulkEditPayload | null;
  }>({ open: false, payload: null });

  const clearSelection = React.useCallback(() => {
    setSelectedTaskIds(new Set());
    lastSelectedIdRef.current = null;
  }, []);

  // Clear selection when boardId changes
  const prevBoardIdRef = React.useRef(boardId);
  React.useEffect(() => {
    if (prevBoardIdRef.current !== boardId) {
      clearSelection();
      prevBoardIdRef.current = boardId;
    }
  }, [boardId, clearSelection]);

  // Escape key listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMultiSelectMode) {
        clearSelection();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMultiSelectMode, clearSelection]);

  // Multi-select click handler
  const handleTaskMultiSelect = React.useCallback(
    (taskId: string, shiftKey: boolean, orderedTaskIds: string[]) => {
      setSelectedTaskIds((prev) => {
        const next = new Set(prev);

        if (shiftKey && lastSelectedIdRef.current && prev.size > 0) {
          // Range select: select all tasks between lastSelectedId and taskId
          const lastIdx = orderedTaskIds.indexOf(lastSelectedIdRef.current);
          const currentIdx = orderedTaskIds.indexOf(taskId);
          if (lastIdx !== -1 && currentIdx !== -1) {
            const start = Math.min(lastIdx, currentIdx);
            const end = Math.max(lastIdx, currentIdx);
            for (let i = start; i <= end; i++) {
              next.add(orderedTaskIds[i]);
            }
          } else {
            // Fallback: just toggle
            next.has(taskId) ? next.delete(taskId) : next.add(taskId);
          }
        } else {
          // Toggle single task
          next.has(taskId) ? next.delete(taskId) : next.add(taskId);
        }

        lastSelectedIdRef.current = taskId;
        return next;
      });
    },
    []
  );

  // Check if any selected tasks have assignees
  const selectedTasksHaveAssignees = React.useMemo(() => {
    return tasks.some(
      (t) => selectedTaskIds.has(t.id) && t.assignees.length > 0
    );
  }, [tasks, selectedTaskIds]);

  // Handle remove all assignees
  const handleRemoveAllAssignees = React.useCallback(() => {
    bulkUpdate.mutate(
      {
        taskIds: Array.from(selectedTaskIds),
        removeAllAssignees: true,
      },
      { onSuccess: () => clearSelection() }
    );
  }, [selectedTaskIds, bulkUpdate, clearSelection]);

  // Handle bulk edit apply
  const handleBulkApply = React.useCallback(
    (payload: BulkEditPayload) => {
      // If moving to another board, show confirmation dialog
      if (payload.boardId) {
        setMoveDialog({ open: true, payload });
        return;
      }

      bulkUpdate.mutate(
        {
          taskIds: Array.from(selectedTaskIds),
          status: payload.status,
          section: payload.section,
          dueDate: payload.dueDate,
          addAssigneeIds: payload.addAssigneeIds,
        },
        { onSuccess: () => clearSelection() }
      );
    },
    [selectedTaskIds, bulkUpdate, clearSelection]
  );

  // Handle duplicate
  const handleBulkDuplicate = React.useCallback(() => {
    bulkDuplicate.mutate(Array.from(selectedTaskIds), {
      onSuccess: () => clearSelection(),
    });
  }, [selectedTaskIds, bulkDuplicate, clearSelection]);

  const handleBulkDelete = React.useCallback(() => {
    bulkDelete.mutate(Array.from(selectedTaskIds), {
      onSuccess: () => clearSelection(),
    });
  }, [selectedTaskIds, bulkDelete, clearSelection]);

  // Handle confirmed move
  const handleConfirmMove = React.useCallback(() => {
    if (!moveDialog.payload) return;
    bulkUpdate.mutate(
      {
        taskIds: Array.from(selectedTaskIds),
        boardId: moveDialog.payload.boardId,
        status: moveDialog.payload.status,
        section: moveDialog.payload.section,
        dueDate: moveDialog.payload.dueDate,
        addAssigneeIds: moveDialog.payload.addAssigneeIds,
      },
      { onSuccess: () => clearSelection() }
    );
  }, [moveDialog.payload, selectedTaskIds, bulkUpdate, clearSelection]);

  // ─── Existing state ───────────────────────────────────────

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

  // Compute hidden card items set for swimlane view
  const swimlaneHiddenItems = React.useMemo(() => {
    const hidden = new Set<string>();
    if (!swimlaneCardItems.section) hidden.add('section');
    if (!swimlaneCardItems.dueDate) hidden.add('dueDate');
    if (!swimlaneCardItems.assignees) hidden.add('assignees');
    return hidden;
  }, [swimlaneCardItems]);

  const isLoading = isLoadingTasks || isLoadingUsers;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* View Toggle */}
          <ViewToggleButtons boardId={boardId} defaultView="kanban" />

          {/* Column visibility (table/swimlane) / Card items (kanban) */}
          {viewMode === 'table' || viewMode === 'swimlane' ? (
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
          ) : (
            <TableColumnsButton
              columns={[
                { id: 'section', label: 'Section' },
                { id: 'dueDate', label: 'Due Date' },
                { id: 'assignees', label: 'Assignees' },
              ]}
              visibleColumns={swimlaneCardItems}
              onToggle={(col) => toggleSwimlaneCardItem(boardId, col as 'section' | 'dueDate' | 'assignees')}
              label="Card Items"
              menuLabel="Toggle card items"
              icon={SlidersHorizontal}
            />
          )}

          {/* Group By dropdown (kanban/swimlane only) */}
          {viewMode !== 'table' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'h-8 border-dashed',
                    groupBy !== 'status' && 'border-solid bg-primary/10 border-primary/50 text-primary hover:bg-primary/20 hover:text-primary'
                  )}
                >
                  {groupBy === 'date' ? (
                    <CalendarDays className="mr-2 size-3" />
                  ) : groupBy === 'section' ? (
                    <LayoutGrid className="mr-2 size-3" />
                  ) : (
                    <Columns3 className="mr-2 size-3" />
                  )}
                  {groupBy === 'status' ? 'By Status' : groupBy === 'date' ? 'By Date' : 'By Section'}
                  <ChevronDown className="ml-2 size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuRadioGroup value={groupBy} onValueChange={(v) => setGroupBy(boardId, v as GroupBy)}>
                  <DropdownMenuRadioItem value="status">
                    <Columns3 className="mr-2 size-3.5" />
                    By Status
                  </DropdownMenuRadioItem>
                  {sectionOptions.length > 0 && (
                    <DropdownMenuRadioItem value="section">
                      <LayoutGrid className="mr-2 size-3.5" />
                      By Section
                    </DropdownMenuRadioItem>
                  )}
                  <DropdownMenuRadioItem value="date">
                    <CalendarDays className="mr-2 size-3.5" />
                    By Date
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

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
          selectedTaskIds={selectedTaskIds}
          onTaskMultiSelect={handleTaskMultiSelect}
          isMultiSelectMode={isMultiSelectMode}
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
          selectedTaskIds={selectedTaskIds}
          onTaskMultiSelect={handleTaskMultiSelect}
          isMultiSelectMode={isMultiSelectMode}
          groupBy={groupBy}
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
          hiddenItems={swimlaneHiddenItems}
          selectedTaskIds={selectedTaskIds}
          onTaskMultiSelect={handleTaskMultiSelect}
          isMultiSelectMode={isMultiSelectMode}
          groupBy={groupBy}
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

      {/* Multi-select floating bar */}
      {isMultiSelectMode && (
        <MultiSelectFloatingBar
          selectedCount={selectedTaskIds.size}
          statusOptions={statusOptions}
          sectionOptions={sectionOptions}
          assignableUsers={assignableUsers}
          currentBoardId={boardId}
          onApply={handleBulkApply}
          onDuplicate={handleBulkDuplicate}
          onDelete={handleBulkDelete}
          onRemoveAllAssignees={handleRemoveAllAssignees}
          onCancel={clearSelection}
          isPending={bulkUpdate.isPending}
          isDuplicating={bulkDuplicate.isPending}
          isDeleting={bulkDelete.isPending}
          selectedTasksHaveAssignees={selectedTasksHaveAssignees}
        />
      )}

      {/* Move tasks confirmation dialog */}
      <MoveTasksDialog
        open={moveDialog.open}
        onOpenChange={(open) => {
          if (!open) setMoveDialog({ open: false, payload: null });
        }}
        taskCount={selectedTaskIds.size}
        targetBoardName={moveDialog.payload?.targetBoardName ?? ''}
        onConfirm={handleConfirmMove}
      />
    </div>
  );
}
