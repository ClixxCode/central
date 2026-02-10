'use client';

import * as React from 'react';
import { Settings, SlidersHorizontal, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RollupBoardView, RollupViewToggle } from './RollupBoardView';
import { TaskFilterBar } from '@/components/tasks/TaskFilterBar';
import { TableColumnsButton } from '@/components/shared/TableColumnsButton';
import { useBoardViewStore } from '@/lib/stores/boardViewStore';
import { useRollupTasks, rollupKeys } from '@/lib/hooks/useRollupBoards';
import { useRealtimeInvalidation } from '@/lib/hooks/useRealtimeInvalidation';
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
  const { getBoardView, getBoardTableColumns, toggleBoardTableColumn, getSwimlaneCardItems, toggleSwimlaneCardItem, areAllSwimlanesCollapsed, setAllSwimlanesCollapsed } = useBoardViewStore();
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
          {viewMode === 'swimlane' && swimlaneBoardIds.length > 0 && (
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
        />
      )}
    </div>
  );
}
