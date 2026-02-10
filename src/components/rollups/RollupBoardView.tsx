'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, LayoutList, Kanban, TableRowsSplit, ExternalLink, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RollupTaskCard } from './RollupTaskCard';
import { TaskModal } from '@/components/tasks/TaskModal';
import { TaskTable, type TableTask, type TableSortOptions, type TableColumnConfig } from '@/components/shared/TaskTable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DndProvider, type DragEndEvent } from '@/components/dnd';
import { DroppableContainer } from '@/components/dnd/DroppableContainer';
import { SortableTask } from '@/components/dnd/SortableTask';
import { useBoardViewStore } from '@/lib/stores/boardViewStore';
import { useQuickActionsStore } from '@/lib/stores';
import { useUpdateTask, useDeleteTask, useTask } from '@/lib/hooks/useTasks';
import type { RollupTaskWithAssignees, RollupBoardWithSources } from '@/lib/actions/rollups';
import type { StatusOption, SectionOption } from '@/lib/db/schema';
import type { AssigneeUser } from '@/components/tasks/AssigneePicker';
import { ExpandedSubtasks } from '@/components/tasks/ExpandedSubtasks';
import { ClientIcon } from '@/components/clients/ClientIcon';

type RollupViewMode = 'swimlane' | 'kanban' | 'table';

// Represents a Client + Board group for swimlane view
interface BoardGroup {
  boardId: string;
  boardName: string;
  clientName: string;
  clientSlug: string;
  clientColor: string | null;
  clientIcon: string | null;
  tasks: RollupTaskWithAssignees[];
}

interface RollupBoardViewProps {
  rollupBoard: RollupBoardWithSources;
  tasks: RollupTaskWithAssignees[];
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
  assignableUsers: AssigneeUser[];
  viewMode?: RollupViewMode;
  tableColumns?: TableColumnConfig;
  hiddenCardItems?: Set<string>;
}

export function RollupBoardView({
  rollupBoard,
  tasks,
  statusOptions,
  sectionOptions,
  assignableUsers,
  viewMode = 'swimlane',
  tableColumns,
  hiddenCardItems,
}: RollupBoardViewProps) {
  const router = useRouter();
  const { isSwimlaneCollapsed, toggleSwimlane } = useBoardViewStore();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  // Modal state
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);

  // Group tasks by board (for swimlane view)
  const boardGroups = React.useMemo(() => {
    const groupMap = new Map<string, BoardGroup>();

    tasks.forEach((task) => {
      const existing = groupMap.get(task.boardId);
      if (existing) {
        existing.tasks.push(task);
      } else {
        groupMap.set(task.boardId, {
          boardId: task.boardId,
          boardName: task.boardName ?? 'Unknown Board',
          clientName: task.clientName ?? 'Unknown Client',
          clientSlug: task.clientSlug ?? '',
          clientColor: task.clientColor ?? null,
          clientIcon: task.clientIcon ?? null,
          tasks: [task],
        });
      }
    });

    // Sort groups by client name, then board name
    const groups = Array.from(groupMap.values());
    groups.sort((a, b) => {
      const clientCompare = a.clientName.localeCompare(b.clientName);
      if (clientCompare !== 0) return clientCompare;
      return a.boardName.localeCompare(b.boardName);
    });

    // Sort tasks within each group by position
    groups.forEach((group) => {
      group.tasks.sort((a, b) => a.position - b.position);
    });

    return groups;
  }, [tasks]);

  // Group tasks by status (for kanban view)
  const tasksByStatus = React.useMemo(() => {
    const grouped: Record<string, RollupTaskWithAssignees[]> = {};

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

    // Sort tasks within each group by client, then position
    Object.keys(grouped).forEach((status) => {
      grouped[status].sort((a, b) => {
        // Sort by client name first
        const clientA = a.clientName ?? '';
        const clientB = b.clientName ?? '';
        if (clientA !== clientB) {
          return clientA.localeCompare(clientB);
        }
        // Then by position
        return a.position - b.position;
      });
    });

    return grouped;
  }, [tasks, statusOptions]);

  // Get selected task for modal — check rollup tasks first, then fetch individually (for subtasks)
  const rollupTask = React.useMemo(
    () => tasks.find((t) => t.id === selectedTaskId),
    [tasks, selectedTaskId]
  );
  const { data: fetchedTask } = useTask(selectedTaskId ?? '', {
    enabled: !!selectedTaskId && !rollupTask,
  });
  const selectedTask = rollupTask ?? fetchedTask;

  // Extract clientSlug safely — exists on RollupTaskWithAssignees but not TaskWithAssignees
  const selectedTaskClientSlug = React.useMemo(() => {
    if (!selectedTask) return undefined;
    return 'clientSlug' in selectedTask ? (selectedTask as { clientSlug: string | null }).clientSlug ?? undefined : undefined;
  }, [selectedTask]);

  // Navigate to source board
  const navigateToSourceBoard = React.useCallback(
    (task: RollupTaskWithAssignees | TableTask) => {
      const clientSlug = 'clientSlug' in task ? task.clientSlug : undefined;
      if (clientSlug) {
        router.push(`/clients/${clientSlug}/boards/${task.boardId}`);
      }
    },
    [router]
  );

  // Sort status options by position
  const sortedStatusOptions = React.useMemo(
    () => [...statusOptions].sort((a, b) => a.position - b.position),
    [statusOptions]
  );

  // Table view state
  const [tableSort, setTableSort] = React.useState<TableSortOptions>({
    field: 'client',
    direction: 'asc',
  });

  // Sorted tasks for table view
  const sortedTasks = React.useMemo(() => {
    const sorted = [...tasks];
    sorted.sort((a, b) => {
      let comparison = 0;
      switch (tableSort.field) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'status':
          const statusA = statusOptions.find((s) => s.id === a.status)?.position ?? 0;
          const statusB = statusOptions.find((s) => s.id === b.status)?.position ?? 0;
          comparison = statusA - statusB;
          break;
        case 'dueDate':
          const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          comparison = dateA - dateB;
          break;
        case 'client':
          comparison = (a.clientName ?? '').localeCompare(b.clientName ?? '');
          break;
        default:
          comparison = a.position - b.position;
      }
      return tableSort.direction === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [tasks, tableSort, statusOptions]);

  // Table view
  if (viewMode === 'table') {
    return (
      <>
        <TaskTable
          tasks={sortedTasks as TableTask[]}
          statusOptions={statusOptions}
          sectionOptions={sectionOptions}
          onTaskClick={setSelectedTaskId}
          onNavigateToSource={navigateToSourceBoard}
          sort={tableSort}
          onSortChange={setTableSort}
          columns={tableColumns}
          showSource
          emptyMessage="No tasks in this rollup"
        />

        {/* Task Detail Modal */}
        {selectedTask && (
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
            taskBasePath={selectedTaskClientSlug ? `/clients/${selectedTaskClientSlug}/boards/${selectedTask.boardId}` : undefined}
            onOpenSubtask={setSelectedTaskId}
          />
        )}
      </>
    );
  }

  if (viewMode === 'kanban') {
    return (
      <>
        <div className="flex h-[calc(100vh-12rem)] gap-4 overflow-x-auto pb-4">
          {sortedStatusOptions.map((status) => {
            const columnTasks = tasksByStatus[status.id] || [];

            return (
              <RollupKanbanColumn
                key={status.id}
                status={status}
                tasks={columnTasks}
                statusOptions={statusOptions}
                sectionOptions={sectionOptions}
                assignableUsers={assignableUsers}
                onTaskClick={setSelectedTaskId}
                onNavigateToSource={navigateToSourceBoard}
                hiddenCardItems={hiddenCardItems}
              />
            );
          })}
        </div>

        {/* Task Detail Modal */}
        {selectedTask && (
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
            taskBasePath={selectedTaskClientSlug ? `/clients/${selectedTaskClientSlug}/boards/${selectedTask.boardId}` : undefined}
            onOpenSubtask={setSelectedTaskId}
          />
        )}
      </>
    );
  }

  // Swimlane view - grouped by Client + Board, with status columns
  return (
    <>
      <div className="space-y-4">
        {boardGroups.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            No tasks in this rollup
          </div>
        ) : (
          <>
            {/* Swimlanes */}
            <div className="space-y-6">
              {boardGroups.map((group) => {
                const isCollapsed = isSwimlaneCollapsed(rollupBoard.id, group.boardId);

                return (
                  <RollupBoardSwimlane
                    key={group.boardId}
                    group={group}
                    statusOptions={sortedStatusOptions}
                    sectionOptions={sectionOptions}
                    assignableUsers={assignableUsers}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={() => toggleSwimlane(rollupBoard.id, group.boardId)}
                    onTaskClick={setSelectedTaskId}
                    onNavigateToBoard={() => {
                      if (group.clientSlug) {
                        router.push(`/clients/${group.clientSlug}/boards/${group.boardId}`);
                      }
                    }}
                    onTaskStatusChange={(taskId, newStatus) => {
                      updateTask.mutate({ id: taskId, status: newStatus });
                    }}
                    hiddenCardItems={hiddenCardItems}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
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
          taskBasePath={selectedTaskClientSlug ? `/clients/${selectedTaskClientSlug}/boards/${selectedTask.boardId}` : undefined}
          onOpenSubtask={setSelectedTaskId}
        />
      )}
    </>
  );
}

// Rollup Board Swimlane Component - displays a Client + Board with status columns
interface RollupBoardSwimlaneProps {
  group: BoardGroup;
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
  assignableUsers: AssigneeUser[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onTaskClick: (taskId: string) => void;
  onNavigateToBoard: () => void;
  onTaskStatusChange: (taskId: string, newStatus: string) => void;
  hiddenCardItems?: Set<string>;
}

function hexToSubtleBg(hex: string, opacity = 0.06): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function RollupBoardSwimlane({
  group,
  statusOptions,
  sectionOptions,
  assignableUsers,
  isCollapsed,
  onToggleCollapse,
  onTaskClick,
  onNavigateToBoard,
  onTaskStatusChange,
  hiddenCardItems,
}: RollupBoardSwimlaneProps) {
  const openQuickAddWithContext = useQuickActionsStore((s) => s.openQuickAddWithContext);

  // Expanded subtasks state
  const [expandedParents, setExpandedParents] = React.useState<Set<string>>(new Set());
  const toggleExpanded = React.useCallback((taskId: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  // Group tasks by status within this board
  const tasksByStatus = React.useMemo(() => {
    const grouped: Record<string, RollupTaskWithAssignees[]> = {};
    statusOptions.forEach((status) => {
      grouped[status.id] = [];
    });
    group.tasks.forEach((task) => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });
    return grouped;
  }, [group.tasks, statusOptions]);

  // Handle drag end - update task status when dropped on a different column
  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const taskId = active.id as string;
      const overId = over.id as string;

      // Find the task being dragged
      const task = group.tasks.find((t) => t.id === taskId);
      if (!task) return;

      // Determine target status - could be dropping on a status column or on another task
      let targetStatus = overId;
      const overTask = group.tasks.find((t) => t.id === overId);
      if (overTask) {
        targetStatus = overTask.status;
      }

      // Check if it's a valid status
      const isValidStatus = statusOptions.some((s) => s.id === targetStatus);
      if (!isValidStatus) return;

      // Only update if status changed
      if (task.status !== targetStatus) {
        onTaskStatusChange(taskId, targetStatus);
      }
    },
    [group.tasks, statusOptions, onTaskStatusChange]
  );

  // Render overlay for dragging
  const renderOverlay = React.useCallback(
    (activeId: string | number | null) => {
      if (!activeId) return null;
      const task = group.tasks.find((t) => t.id === activeId);
      if (!task) return null;

      return (
        <div className="opacity-90">
          <RollupTaskCard
            task={task}
            sectionOptions={sectionOptions}
            assignableUsers={assignableUsers}
            showClientBadge={false}
            variant="kanban"
            hiddenItems={hiddenCardItems}
          />
        </div>
      );
    },
    [group.tasks, sectionOptions, assignableUsers, hiddenCardItems]
  );

  return (
    <div className="rounded-lg border bg-muted/30">
      {/* Header - Client + Board */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
        >
          {isCollapsed ? (
            <ChevronRight className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
          <ClientIcon icon={group.clientIcon} color={group.clientColor} name={group.clientName} size="sm" />
          <span
            className="font-medium"
            style={{ color: group.clientColor ?? undefined }}
          >
            {group.clientName}
          </span>
          {group.boardName.toLowerCase() !== group.clientName.toLowerCase() && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="font-medium">{group.boardName}</span>
            </>
          )}
        </button>
        <span className="ml-auto text-sm text-muted-foreground">
          {group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}
        </span>
        <button
          type="button"
          onClick={onNavigateToBoard}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Open board"
        >
          <ExternalLink className="size-4" />
        </button>
      </div>

      {/* Status Columns - DndProvider always rendered to maintain hook order */}
      <DndProvider onDragEnd={handleDragEnd} renderOverlay={renderOverlay}>
        {!isCollapsed && (
          <div className="flex gap-2 overflow-x-auto p-4">
            {statusOptions.map((status) => {
              const columnTasks = tasksByStatus[status.id] || [];
              const taskIds = columnTasks.map((t) => t.id);

              return (
                <div
                  key={status.id}
                  className="group min-w-[240px] flex-1 rounded-lg border"
                  style={{ backgroundColor: hexToSubtleBg(status.color) }}
                >
                  {/* Status Column Header */}
                  <div className="flex items-center gap-2 border-b px-3 py-2">
                    <div
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: status.color }}
                    />
                    <span className="text-sm font-medium">{status.label}</span>
                    <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs">
                      {columnTasks.length}
                    </span>
                  </div>

                  {/* Tasks - scrollable with max height for ~5 cards */}
                  <DroppableContainer
                    id={status.id}
                    items={taskIds}
                    className="overflow-y-auto p-2 min-h-[100px]"
                  >
                    <div
                      className="space-y-2"
                      style={{ maxHeight: '380px' }}
                    >
                      {columnTasks.length === 0 ? (
                        <p className="py-4 text-center text-xs text-muted-foreground">
                          No tasks
                        </p>
                      ) : (
                        columnTasks.map((task) => (
                          <React.Fragment key={task.id}>
                            <SortableTask id={task.id}>
                              <RollupTaskCard
                                task={task}
                                sectionOptions={sectionOptions}
                                assignableUsers={assignableUsers}
                                onClick={() => onTaskClick(task.id)}
                                showClientBadge={false}
                                variant="kanban"
                                onToggleSubtasks={task.subtaskCount > 0 ? () => toggleExpanded(task.id) : undefined}
                                isExpanded={expandedParents.has(task.id)}
                                hiddenItems={hiddenCardItems}
                              />
                            </SortableTask>
                            {expandedParents.has(task.id) && (
                              <ExpandedSubtasks
                                parentTaskId={task.id}
                                statusOptions={statusOptions}
                                sectionOptions={sectionOptions}
                                onTaskClick={onTaskClick}
                                hiddenItems={hiddenCardItems}
                              />
                            )}
                          </React.Fragment>
                        ))
                      )}
                    </div>

                    {/* Hover "Add task" button */}
                    <button
                      type="button"
                      onClick={() => openQuickAddWithContext(group.boardId, status.id)}
                      className="mt-2 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hexToSubtleBg(status.color, 0.12)}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Plus className="h-4 w-4" />
                      Add task
                    </button>
                  </DroppableContainer>
                </div>
              );
            })}
          </div>
        )}
      </DndProvider>
    </div>
  );
}

// Rollup Kanban Column Component
interface RollupKanbanColumnProps {
  status: StatusOption;
  tasks: RollupTaskWithAssignees[];
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
  assignableUsers: AssigneeUser[];
  onTaskClick: (taskId: string) => void;
  onNavigateToSource: (task: RollupTaskWithAssignees) => void;
  hiddenCardItems?: Set<string>;
}

function RollupKanbanColumn({
  status,
  tasks,
  statusOptions,
  sectionOptions,
  assignableUsers,
  onTaskClick,
  onNavigateToSource,
  hiddenCardItems,
}: RollupKanbanColumnProps) {
  const [expandedParents, setExpandedParents] = React.useState<Set<string>>(new Set());
  const toggleExpanded = React.useCallback((taskId: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  return (
    <div
      className="flex h-full w-72 shrink-0 flex-col rounded-lg border"
      style={{ backgroundColor: hexToSubtleBg(status.color) }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <div
          className="size-3 rounded-full"
          style={{ backgroundColor: status.color }}
        />
        <span className="font-medium">{status.label}</span>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs">
          {tasks.length}
        </span>
      </div>

      {/* Tasks */}
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No tasks
            </p>
          ) : (
            tasks.map((task) => (
              <React.Fragment key={task.id}>
                <RollupTaskCard
                  task={task}
                  sectionOptions={sectionOptions}
                  assignableUsers={assignableUsers}
                  onClick={() => onTaskClick(task.id)}
                  onNavigateToSource={() => onNavigateToSource(task)}
                  variant="kanban"
                  onToggleSubtasks={task.subtaskCount > 0 ? () => toggleExpanded(task.id) : undefined}
                  isExpanded={expandedParents.has(task.id)}
                  hiddenItems={hiddenCardItems}
                />
                {expandedParents.has(task.id) && (
                  <ExpandedSubtasks
                    parentTaskId={task.id}
                    statusOptions={statusOptions}
                    sectionOptions={sectionOptions}
                    onTaskClick={onTaskClick}
                    hiddenItems={hiddenCardItems}
                  />
                )}
              </React.Fragment>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// View Toggle for Rollup Boards
interface RollupViewToggleProps {
  rollupId: string;
}

const viewOptions = [
  { value: 'swimlane' as const, label: 'Swimlane', icon: TableRowsSplit },
  { value: 'kanban' as const, label: 'Kanban', icon: Kanban },
  { value: 'table' as const, label: 'Table', icon: LayoutList },
];

export function RollupViewToggle({ rollupId }: RollupViewToggleProps) {
  const { getBoardView, setBoardView } = useBoardViewStore();
  const currentView = getBoardView(rollupId);

  return (
    <div className="inline-flex rounded-md border bg-muted p-0.5">
      {viewOptions.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setBoardView(rollupId, option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded px-3 py-1 text-sm transition-colors',
              currentView === option.value
                ? 'bg-background shadow-sm'
                : 'hover:bg-background/50'
            )}
          >
            <Icon className="h-4 w-4" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
