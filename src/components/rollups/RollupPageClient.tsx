'use client';

import * as React from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RollupBoardView, RollupViewToggle } from './RollupBoardView';
import { TaskFilterBar } from '@/components/tasks/TaskFilterBar';
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
  const { getBoardView } = useBoardViewStore();
  const viewMode = getBoardView(rollupBoard.id);

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

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* View Toggle */}
          <RollupViewToggle rollupId={rollupBoard.id} />

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
        {onOpenSettings && (
          <Button onClick={onOpenSettings} variant="outline" size="sm">
            <Settings className="mr-1 size-4" />
            Settings
          </Button>
        )}
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
        />
      )}
    </div>
  );
}
