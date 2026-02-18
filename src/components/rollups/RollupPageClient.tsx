'use client';

import * as React from 'react';
import { Settings, SlidersHorizontal, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RollupBoardView, RollupViewToggle } from './RollupBoardView';
import { TaskFilterBar } from '@/components/tasks/TaskFilterBar';
import { TableColumnsButton } from '@/components/shared/TableColumnsButton';
import { MultiSelectFloatingBar, type BulkEditPayload } from '@/components/tasks/MultiSelectFloatingBar';
import { MoveTasksDialog } from '@/components/tasks/MoveTasksDialog';
import { useBoardViewStore } from '@/lib/stores/boardViewStore';
import { useRollupTasks, rollupKeys } from '@/lib/hooks/useRollupBoards';
import { useRealtimeInvalidation } from '@/lib/hooks/useRealtimeInvalidation';
import { useBulkUpdateTasks, useBulkDuplicateTasks, useBulkDeleteTasks } from '@/lib/hooks/useTasks';
import type { TaskFilters, TaskSortOptions } from '@/lib/actions/tasks';
import type { RollupBoardWithSources } from '@/lib/actions/rollups';

interface RollupPageClientProps {
  rollupBoard: RollupBoardWithSources;
  onOpenSettings?: () => void;
}

export function RollupPageClient({
  rollupBoard,
  onOpenSettings,
}: RollupPageClientProps) {
  const { getBoardView, getBoardTableColumns, toggleBoardTableColumn, getSwimlaneCardItems, toggleSwimlaneCardItem, areAllSwimlanesCollapsed, setAllSwimlanesCollapsed, activeReviewBoardId, setActiveReviewBoardId } = useBoardViewStore();
  const viewMode = getBoardView(rollupBoard.id);
  const columns = getBoardTableColumns(rollupBoard.id, {
    title: true,
    status: true,
    section: true,
    assignees: true,
    dueDate: true,
    source: true,
  });
  const swimlaneCardItems = getSwimlaneCardItems(rollupBoard.id);

  // Realtime: invalidate rollup tasks when any source board task changes
  const sourceBoardIds = rollupBoard.sources.map((s) => s.boardId);
  const realtimeFilter = sourceBoardIds.length > 0
    ? `board_id=in.(${sourceBoardIds.join(',')})`
    : undefined;
  useRealtimeInvalidation({
    channel: `rollup-tasks-${rollupBoard.id}`,
    table: 'tasks',
    filter: realtimeFilter,
    queryKeys: [rollupKeys.tasks()],
    enabled: sourceBoardIds.length > 0,
  });

  // Filter and sort state
  const [filters, setFilters] = React.useState<TaskFilters>({});
  const [sort] = React.useState<TaskSortOptions>({
    field: 'position',
    direction: 'asc',
  });

  // Fetch tasks
  const { data, isLoading } = useRollupTasks(rollupBoard.id, filters, sort);

  const tasks = data?.tasks ?? [];
  const statusOptions = data?.statusOptions ?? [];
  const sectionOptions = data?.sectionOptions ?? [];

  // Compute hidden card items set for swimlane view
  const swimlaneHiddenItems = React.useMemo(() => {
    const hidden = new Set<string>();
    if (!swimlaneCardItems.section) hidden.add('section');
    if (!swimlaneCardItems.dueDate) hidden.add('dueDate');
    if (!swimlaneCardItems.assignees) hidden.add('assignees');
    return hidden;
  }, [swimlaneCardItems]);

  // Collect all unique assignees from tasks for the filter
  const assignableUsers = React.useMemo(() => {
    const usersMap = new Map<
      string,
      { id: string; email: string; name: string | null; avatarUrl: string | null }
    >();
    tasks.forEach((task) => {
      task.assignees.forEach((assignee) => {
        usersMap.set(assignee.id, assignee);
      });
    });
    return Array.from(usersMap.values());
  }, [tasks]);

  // Unique board IDs for collapse/expand all in swimlane view
  const swimlaneBoardIds = React.useMemo(() => {
    const ids = new Set<string>();
    tasks.forEach((t) => ids.add(t.boardId));
    return Array.from(ids);
  }, [tasks]);

  const allCollapsed = areAllSwimlanesCollapsed(rollupBoard.id, swimlaneBoardIds);

  // ─── Multi-select state ───────────────────────────────────
  const bulkUpdate = useBulkUpdateTasks();
  const bulkDuplicate = useBulkDuplicateTasks();
  const bulkDelete = useBulkDeleteTasks();
  const [selectedTaskIds, setSelectedTaskIds] = React.useState<Set<string>>(new Set());
  const lastSelectedIdRef = React.useRef<string | null>(null);
  const isMultiSelectMode = selectedTaskIds.size > 0;

  const [moveDialog, setMoveDialog] = React.useState<{
    open: boolean;
    payload: BulkEditPayload | null;
  }>({ open: false, payload: null });

  const clearSelection = React.useCallback(() => {
    setSelectedTaskIds(new Set());
    lastSelectedIdRef.current = null;
  }, []);

  const handleTaskMultiSelect = React.useCallback(
    (taskId: string, shiftKey: boolean, orderedTaskIds: string[]) => {
      setSelectedTaskIds((prev) => {
        const next = new Set(prev);

        if (shiftKey && lastSelectedIdRef.current && prev.size > 0) {
          const lastIdx = orderedTaskIds.indexOf(lastSelectedIdRef.current);
          const currentIdx = orderedTaskIds.indexOf(taskId);
          if (lastIdx !== -1 && currentIdx !== -1) {
            const start = Math.min(lastIdx, currentIdx);
            const end = Math.max(lastIdx, currentIdx);
            for (let i = start; i <= end; i++) {
              next.add(orderedTaskIds[i]);
            }
          } else {
            next.has(taskId) ? next.delete(taskId) : next.add(taskId);
          }
        } else {
          next.has(taskId) ? next.delete(taskId) : next.add(taskId);
        }

        lastSelectedIdRef.current = taskId;
        return next;
      });
    },
    []
  );

  const selectedTasksHaveAssignees = React.useMemo(() => {
    return tasks.some(
      (t) => selectedTaskIds.has(t.id) && t.assignees.length > 0
    );
  }, [tasks, selectedTaskIds]);

  const handleRemoveAllAssignees = React.useCallback(() => {
    bulkUpdate.mutate(
      {
        taskIds: Array.from(selectedTaskIds),
        removeAllAssignees: true,
      },
      { onSuccess: () => clearSelection() }
    );
  }, [selectedTaskIds, bulkUpdate, clearSelection]);

  const handleBulkApply = React.useCallback(
    (payload: BulkEditPayload) => {
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

  // Escape key: clear multi-select first, then exit review mode
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMultiSelectMode) {
        clearSelection();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMultiSelectMode, clearSelection]);

  // Review mode state (driven by store, triggered from header button)
  const reviewMode = activeReviewBoardId === rollupBoard.id;
  const [reviewIndex, setReviewIndex] = React.useState(0);

  // Clear selection when navigating review mode
  React.useEffect(() => {
    clearSelection();
  }, [reviewIndex, clearSelection]);

  // Expand all swimlanes and reset index when entering review mode
  const prevReviewMode = React.useRef(reviewMode);
  React.useEffect(() => {
    if (reviewMode && !prevReviewMode.current) {
      setReviewIndex(0);
      setAllSwimlanesCollapsed(rollupBoard.id, swimlaneBoardIds, false);
    }
    prevReviewMode.current = reviewMode;
  }, [reviewMode, rollupBoard.id, swimlaneBoardIds, setAllSwimlanesCollapsed]);

  const exitReviewMode = React.useCallback(() => {
    setActiveReviewBoardId(null);
  }, [setActiveReviewBoardId]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* View Toggle */}
          <RollupViewToggle rollupId={rollupBoard.id} />

          {/* Column visibility (table) / Card items (swimlane/kanban) */}
          {viewMode === 'table' ? (
            <TableColumnsButton
              columns={[
                { id: 'source', label: 'Board' },
                { id: 'status', label: 'Status' },
                { id: 'section', label: 'Section' },
                { id: 'assignees', label: 'Assignees' },
                { id: 'dueDate', label: 'Due Date' },
              ]}
              visibleColumns={columns}
              onToggle={(col) => toggleBoardTableColumn(rollupBoard.id, col as keyof typeof columns)}
            />
          ) : (
            <TableColumnsButton
              columns={[
                { id: 'section', label: 'Section' },
                { id: 'dueDate', label: 'Due Date' },
                { id: 'assignees', label: 'Assignees' },
              ]}
              visibleColumns={swimlaneCardItems}
              onToggle={(col) => toggleSwimlaneCardItem(rollupBoard.id, col as 'section' | 'dueDate' | 'assignees')}
              label="Card Items"
              menuLabel="Toggle card items"
              icon={SlidersHorizontal}
            />
          )}

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
        <div className="flex items-center gap-2">
          {viewMode === 'swimlane' && swimlaneBoardIds.length > 0 && !reviewMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAllSwimlanesCollapsed(rollupBoard.id, swimlaneBoardIds, !allCollapsed)}
            >
              <ChevronsUpDown className="mr-1 size-4" />
              {allCollapsed ? 'Expand All' : 'Collapse All'}
            </Button>
          )}
          {onOpenSettings && (
            <Button onClick={onOpenSettings} variant="outline" size="sm">
              <Settings className="mr-1 size-4" />
              Settings
            </Button>
          )}
        </div>
      </div>

      {/* Board View */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading tasks...</div>
        </div>
      ) : (
        <RollupBoardView
          rollupBoard={rollupBoard}
          tasks={tasks}
          statusOptions={statusOptions}
          sectionOptions={sectionOptions}
          assignableUsers={assignableUsers}
          viewMode={viewMode as 'swimlane' | 'kanban' | 'table'}
          tableColumns={columns}
          hiddenCardItems={swimlaneHiddenItems}
          reviewMode={reviewMode}
          reviewIndex={reviewIndex}
          onReviewIndexChange={setReviewIndex}
          onExitReview={exitReviewMode}
          selectedTaskIds={selectedTaskIds}
          isMultiSelectMode={isMultiSelectMode}
          onTaskMultiSelect={handleTaskMultiSelect}
        />
      )}

      {/* Multi-select floating bar */}
      {isMultiSelectMode && (
        <MultiSelectFloatingBar
          selectedCount={selectedTaskIds.size}
          statusOptions={statusOptions}
          sectionOptions={sectionOptions}
          assignableUsers={assignableUsers}
          currentBoardId=""
          onApply={handleBulkApply}
          onDuplicate={handleBulkDuplicate}
          onDelete={handleBulkDelete}
          onRemoveAllAssignees={handleRemoveAllAssignees}
          onCancel={clearSelection}
          isPending={bulkUpdate.isPending}
          isDuplicating={bulkDuplicate.isPending}
          isDeleting={bulkDelete.isPending}
          selectedTasksHaveAssignees={selectedTasksHaveAssignees}
          bottomOffset={reviewMode ? '112px' : undefined}
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
