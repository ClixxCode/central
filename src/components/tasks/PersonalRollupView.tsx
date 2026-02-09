'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, ExternalLink, Plus } from 'lucide-react';
import { TaskModal } from './TaskModal';
import { RollupTaskCard } from '@/components/rollups/RollupTaskCard';
import { TaskTable, type TableTask, type TableSortOptions, type TableColumnConfig } from '@/components/shared/TaskTable';
import { DndProvider, type DragEndEvent } from '@/components/dnd';
import { DroppableContainer } from '@/components/dnd/DroppableContainer';
import { SortableTask } from '@/components/dnd/SortableTask';
import { usePersonalRollupStore } from '@/lib/stores/personalRollupStore';
import { useQuickActionsStore } from '@/lib/stores';
import { useUpdateMyTask } from '@/lib/hooks/useMyTasks';
import { useDeleteTask, useTask } from '@/lib/hooks/useTasks';
import type { MyTasksByClient, MyTaskWithContext, UpdateTaskInput } from '@/lib/actions/tasks';
import type { StatusOption, SectionOption } from '@/lib/db/schema';
import type { AssigneeUser } from './AssigneePicker';
import { ExpandedSubtasks } from './ExpandedSubtasks';
import { ClientIcon } from '@/components/clients/ClientIcon';

// Represents a Client + Board group for swimlane view
interface BoardGroup {
  boardId: string;
  boardName: string;
  clientId: string;
  clientName: string;
  clientSlug: string;
  clientColor: string | null;
  clientIcon: string | null;
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
  tasks: MyTaskWithContext[];
}

interface PersonalRollupViewProps {
  tasksByClient: MyTasksByClient[];
  viewMode?: 'swimlane' | 'table';
}

export function PersonalRollupView({ tasksByClient, viewMode = 'swimlane' }: PersonalRollupViewProps) {
  const router = useRouter();
  const {
    isClientCollapsed,
    toggleClient,
    isBoardHidden,
  } = usePersonalRollupStore();

  const updateTask = useUpdateMyTask();
  const deleteTask = useDeleteTask();

  // Modal state — ID-based so subtask navigation works via onOpenSubtask
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);

  // Filter out hidden boards and compute filtered task counts
  const filteredTasksByClient = React.useMemo(() => {
    return tasksByClient
      .map((clientGroup) => {
        const visibleTasks = clientGroup.tasks.filter(
          (task) => !isBoardHidden(task.board.id)
        );
        return {
          ...clientGroup,
          tasks: visibleTasks,
        };
      })
      .filter((clientGroup) => clientGroup.tasks.length > 0);
  }, [tasksByClient, isBoardHidden]);

  // Group tasks by board for swimlane view
  const boardGroups = React.useMemo(() => {
    const groupMap = new Map<string, BoardGroup>();

    filteredTasksByClient.forEach((clientGroup) => {
      clientGroup.tasks.forEach((task) => {
        const existing = groupMap.get(task.board.id);
        if (existing) {
          existing.tasks.push(task);
        } else {
          groupMap.set(task.board.id, {
            boardId: task.board.id,
            boardName: task.board.name,
            clientId: clientGroup.client.id,
            clientName: clientGroup.client.name,
            clientSlug: clientGroup.client.slug,
            clientColor: clientGroup.client.color,
            clientIcon: clientGroup.client.icon,
            statusOptions: task.board.statusOptions,
            sectionOptions: task.board.sectionOptions,
            tasks: [task],
          });
        }
      });
    });

    // Sort groups by client name, then board name
    const groups = Array.from(groupMap.values());
    groups.sort((a, b) => {
      const clientCompare = a.clientName.localeCompare(b.clientName);
      if (clientCompare !== 0) return clientCompare;
      return a.boardName.localeCompare(b.boardName);
    });

    return groups;
  }, [filteredTasksByClient]);

  // Find the selected task from flat data, or fetch individually (for subtasks)
  const myTask = React.useMemo(
    () => filteredTasksByClient.flatMap((c) => c.tasks).find((t) => t.id === selectedTaskId),
    [filteredTasksByClient, selectedTaskId]
  );
  const { data: fetchedTask } = useTask(selectedTaskId ?? '', {
    enabled: !!selectedTaskId && !myTask,
  });
  const selectedTask = myTask ?? fetchedTask;

  // Get assignable users for the selected task's board
  const selectedTaskAssignableUsers = React.useMemo((): AssigneeUser[] => {
    if (!selectedTaskId) return [];

    // Find the client group that contains this task (or its board)
    const boardId = myTask?.board.id ?? fetchedTask?.boardId;
    if (!boardId) return [];

    const clientGroup = tasksByClient.find((c) =>
      c.tasks.some((t) => t.board.id === boardId)
    );
    if (!clientGroup) return [];

    const usersMap = new Map<string, AssigneeUser>();
    clientGroup.tasks
      .filter((t) => t.board.id === boardId)
      .forEach((task) => {
        task.assignees.forEach((assignee) => {
          usersMap.set(assignee.id, assignee);
        });
      });

    return Array.from(usersMap.values());
  }, [selectedTaskId, myTask, fetchedTask, tasksByClient]);

  const handleUpdateTask = React.useCallback(
    (input: UpdateTaskInput) => {
      updateTask.mutate(input);
    },
    [updateTask]
  );

  const handleDeleteTask = React.useCallback(
    (taskId: string) => {
      deleteTask.mutate(taskId);
      setSelectedTaskId(null);
    },
    [deleteTask]
  );

  // Table view state
  const [tableSort, setTableSort] = React.useState<TableSortOptions>({
    field: 'client',
    direction: 'asc',
  });
  const [tableColumns, setTableColumns] = React.useState<TableColumnConfig>({
    title: true,
    status: true,
    section: true,
    assignees: true,
    dueDate: true,
    source: true,
  });

  // All tasks flattened for table view
  const flatTasks = React.useMemo(() => {
    return filteredTasksByClient.flatMap((clientGroup) =>
      clientGroup.tasks.map((task) => ({
        ...task,
        clientName: clientGroup.client.name,
        clientColor: clientGroup.client.color,
        clientIcon: clientGroup.client.icon,
      }))
    );
  }, [filteredTasksByClient]);

  // Aggregate status and section options across all boards
  const allStatusOptions = React.useMemo(() => {
    const map = new Map<string, StatusOption>();
    boardGroups.forEach((g) => g.statusOptions.forEach((s) => map.set(s.id, s)));
    return Array.from(map.values());
  }, [boardGroups]);

  const allSectionOptions = React.useMemo(() => {
    const map = new Map<string, SectionOption>();
    boardGroups.forEach((g) => g.sectionOptions.forEach((s) => map.set(s.id, s)));
    return Array.from(map.values());
  }, [boardGroups]);

  // Transform and sort tasks for TaskTable
  const tableTasks = React.useMemo(() => {
    const tasks: TableTask[] = flatTasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      section: task.section,
      position: task.position,
      dueDate: task.dueDate,
      assignees: task.assignees.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        avatarUrl: a.avatarUrl,
      })),
      clientName: task.clientName,
      clientColor: task.clientColor,
      clientIcon: task.clientIcon,
      boardName: task.board.name,
      boardId: task.board.id,
      clientSlug: task.client.slug,
    }));

    // Sort
    tasks.sort((a, b) => {
      let comparison = 0;
      switch (tableSort.field) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'status': {
          const aPos = allStatusOptions.find((s) => s.id === a.status)?.position ?? 0;
          const bPos = allStatusOptions.find((s) => s.id === b.status)?.position ?? 0;
          comparison = aPos - bPos;
          break;
        }
        case 'dueDate': {
          const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          comparison = aDate - bDate;
          break;
        }
        case 'client':
          comparison = (a.clientName ?? '').localeCompare(b.clientName ?? '');
          break;
        default:
          comparison = a.position - b.position;
      }
      return tableSort.direction === 'asc' ? comparison : -comparison;
    });

    return tasks;
  }, [flatTasks, tableSort, allStatusOptions]);

  if (filteredTasksByClient.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <svg
            className="size-8 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">
          No tasks assigned to you
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          When you&apos;re assigned to tasks, they&apos;ll appear here organized by client.
        </p>
      </div>
    );
  }

  return (
    <>
      {viewMode === 'table' ? (
        <TaskTable
          tasks={tableTasks}
          statusOptions={allStatusOptions}
          sectionOptions={allSectionOptions}
          onTaskClick={setSelectedTaskId}
          onNavigateToSource={(task) => {
            if (task.clientSlug && task.boardId) {
              router.push(`/clients/${task.clientSlug}/boards/${task.boardId}`);
            }
          }}
          sort={tableSort}
          onSortChange={setTableSort}
          columns={tableColumns}
          onColumnsChange={setTableColumns}
          showSource
          emptyMessage="No tasks assigned to you"
        />
      ) : (
        // Swimlane view - grouped by Client + Board with status columns
        <div className="space-y-6">
            {boardGroups.map((group) => {
              const isCollapsed = isClientCollapsed(group.boardId);

              return (
                <MyWorkBoardSwimlane
                  key={group.boardId}
                  group={group}
                  isCollapsed={isCollapsed}
                  onToggleCollapse={() => toggleClient(group.boardId)}
                  onTaskClick={(task) => setSelectedTaskId(task.id)}
                  onSubtaskClick={setSelectedTaskId}
                  onNavigateToBoard={() => {
                    router.push(`/clients/${group.clientSlug}/boards/${group.boardId}`);
                  }}
                  onTaskStatusChange={(taskId, newStatus) => {
                    updateTask.mutate({ id: taskId, status: newStatus });
                  }}
                />
              );
            })}
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (() => {
        // Get board options — from MyTaskWithContext if available, or find from boardGroups
        const boardOpts = myTask
          ? { statusOptions: myTask.board.statusOptions, sectionOptions: myTask.board.sectionOptions }
          : boardGroups.find((g) => g.boardId === selectedTask.boardId);
        const clientSlug = myTask?.client.slug ?? boardGroups.find((g) => g.boardId === selectedTask.boardId)?.clientSlug;

        return (
          <TaskModal
            open={!!selectedTaskId}
            onOpenChange={(open) => !open && setSelectedTaskId(null)}
            task={selectedTask}
            statusOptions={boardOpts?.statusOptions ?? allStatusOptions}
            sectionOptions={boardOpts?.sectionOptions ?? allSectionOptions}
            assignableUsers={selectedTaskAssignableUsers}
            onUpdate={handleUpdateTask}
            onDelete={handleDeleteTask}
            mode="view"
            taskBasePath={clientSlug ? `/clients/${clientSlug}/boards/${selectedTask.boardId}` : undefined}
            onOpenSubtask={setSelectedTaskId}
          />
        );
      })()}
    </>
  );
}

// My Work Board Swimlane Component - displays a Client + Board with status columns
interface MyWorkBoardSwimlaneProps {
  group: BoardGroup;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onTaskClick: (task: MyTaskWithContext) => void;
  onSubtaskClick: (taskId: string) => void;
  onNavigateToBoard: () => void;
  onTaskStatusChange: (taskId: string, newStatus: string) => void;
}

function hexToSubtleBg(hex: string, opacity = 0.06): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function MyWorkBoardSwimlane({
  group,
  isCollapsed,
  onToggleCollapse,
  onTaskClick,
  onSubtaskClick,
  onNavigateToBoard,
  onTaskStatusChange,
}: MyWorkBoardSwimlaneProps) {
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

  // Sort status options by position
  const sortedStatusOptions = React.useMemo(
    () => [...group.statusOptions].sort((a, b) => a.position - b.position),
    [group.statusOptions]
  );

  // Group tasks by status within this board
  const tasksByStatus = React.useMemo(() => {
    const grouped: Record<string, MyTaskWithContext[]> = {};
    sortedStatusOptions.forEach((status) => {
      grouped[status.id] = [];
    });
    group.tasks.forEach((task) => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });
    return grouped;
  }, [group.tasks, sortedStatusOptions]);

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
      const isValidStatus = sortedStatusOptions.some((s) => s.id === targetStatus);
      if (!isValidStatus) return;

      // Only update if status changed
      if (task.status !== targetStatus) {
        onTaskStatusChange(taskId, targetStatus);
      }
    },
    [group.tasks, sortedStatusOptions, onTaskStatusChange]
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
            task={{
              ...task,
              boardId: task.board.id,
              boardName: task.board.name,
              clientId: group.clientId,
              clientName: group.clientName,
              clientSlug: group.clientSlug,
              clientColor: group.clientColor,
              clientIcon: group.clientIcon,
            }}
            sectionOptions={group.sectionOptions}
            assignableUsers={task.assignees}
            showClientBadge={false}
            variant="kanban"
          />
        </div>
      );
    },
    [group]
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
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{group.boardName}</span>
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
            {sortedStatusOptions.map((status) => {
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
                                task={{
                                  ...task,
                                  boardId: task.board.id,
                                  boardName: task.board.name,
                                  clientId: group.clientId,
                                  clientName: group.clientName,
                                  clientSlug: group.clientSlug,
                                  clientColor: group.clientColor,
                                  clientIcon: group.clientIcon,
                                }}
                                sectionOptions={group.sectionOptions}
                                assignableUsers={task.assignees}
                                onClick={() => onTaskClick(task)}
                                showClientBadge={false}
                                variant="kanban"
                                onToggleSubtasks={task.subtaskCount > 0 ? () => toggleExpanded(task.id) : undefined}
                                isExpanded={expandedParents.has(task.id)}
                              />
                            </SortableTask>
                            {expandedParents.has(task.id) && (
                              <ExpandedSubtasks
                                parentTaskId={task.id}
                                statusOptions={group.statusOptions}
                                sectionOptions={group.sectionOptions}
                                onTaskClick={onSubtaskClick}
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
