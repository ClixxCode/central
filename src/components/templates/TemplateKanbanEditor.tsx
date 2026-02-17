'use client';

import * as React from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import {
  DndProvider,
  SortableTask,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@/components/dnd';
import { KanbanColumn } from '@/components/tasks/KanbanColumn';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronDown, ChevronRight, CornerDownRight, Plus, Repeat, Trash2 } from 'lucide-react';
import {
  useAddTemplateTask,
  useUpdateTemplateTask,
  useDeleteTemplateTask,
  useUpdateTemplateTaskPositions,
  useBulkUpdateTemplateTasks,
} from '@/lib/hooks';
import type { TemplateDetail, TemplateTaskWithSubtasks } from '@/lib/actions/templates';
import type { StatusOption } from '@/lib/db/schema';
import { cn } from '@/lib/utils';
import { TemplateTaskSheet } from './TemplateTaskSheet';
import { TemplateQuickAddDialog } from './TemplateQuickAddDialog';
import { TemplateMultiSelectBar, type TemplateBulkEditPayload } from './TemplateMultiSelectBar';

interface TemplateKanbanEditorProps {
  templateId: string;
  template: TemplateDetail;
}

export function TemplateKanbanEditor({ templateId, template }: TemplateKanbanEditorProps) {
  const addTask = useAddTemplateTask(templateId);
  const updateTask = useUpdateTemplateTask(templateId);
  const deleteTask = useDeleteTemplateTask(templateId);
  const updatePositions = useUpdateTemplateTaskPositions(templateId);
  const bulkUpdate = useBulkUpdateTemplateTasks(templateId);

  const [expandedParents, setExpandedParents] = React.useState<Set<string>>(new Set());
  const [quickAddOpen, setQuickAddOpen] = React.useState(false);
  const [quickAddStatus, setQuickAddStatus] = React.useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [selectedTask, setSelectedTask] = React.useState<TemplateTaskWithSubtasks | null>(null);

  // Multi-select state
  const [selectedTaskIds, setSelectedTaskIds] = React.useState<Set<string>>(new Set());
  const lastSelectedIdRef = React.useRef<string | null>(null);
  const isMultiSelectMode = selectedTaskIds.size > 0;

  const clearSelection = React.useCallback(() => {
    setSelectedTaskIds(new Set());
    lastSelectedIdRef.current = null;
  }, []);

  // Escape key clears selection
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMultiSelectMode) {
        clearSelection();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMultiSelectMode, clearSelection]);

  const handleTaskMultiSelect = React.useCallback(
    (taskId: string, shiftKey: boolean, columnTaskIds: string[]) => {
      setSelectedTaskIds((prev) => {
        const next = new Set(prev);

        if (shiftKey && lastSelectedIdRef.current && prev.size > 0) {
          const lastIdx = columnTaskIds.indexOf(lastSelectedIdRef.current);
          const currentIdx = columnTaskIds.indexOf(taskId);
          if (lastIdx !== -1 && currentIdx !== -1) {
            const start = Math.min(lastIdx, currentIdx);
            const end = Math.max(lastIdx, currentIdx);
            for (let i = start; i <= end; i++) {
              next.add(columnTaskIds[i]);
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

  const handleBulkApply = React.useCallback(
    (updates: TemplateBulkEditPayload) => {
      bulkUpdate.mutate(
        { taskIds: Array.from(selectedTaskIds), ...updates },
        { onSuccess: () => clearSelection() }
      );
    },
    [selectedTaskIds, bulkUpdate, clearSelection]
  );

  const sortedStatusOptions = React.useMemo(
    () => [...template.statusOptions].sort((a, b) => a.position - b.position),
    [template.statusOptions]
  );

  // Group top-level tasks by status
  const tasksByStatus = React.useMemo(() => {
    const grouped: Record<string, TemplateTaskWithSubtasks[]> = {};
    sortedStatusOptions.forEach((s) => {
      grouped[s.id] = [];
    });
    template.tasks.forEach((task) => {
      const statusId = task.status ?? sortedStatusOptions[0]?.id;
      if (statusId && grouped[statusId]) {
        grouped[statusId].push(task);
      }
    });
    Object.keys(grouped).forEach((status) => {
      grouped[status].sort((a, b) => a.position - b.position);
    });
    return grouped;
  }, [template.tasks, sortedStatusOptions]);

  const toggleExpanded = React.useCallback((taskId: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const openSheet = React.useCallback((task: TemplateTaskWithSubtasks) => {
    setSelectedTask(task);
    setSheetOpen(true);
  }, []);

  const handleOpenSubtask = React.useCallback((sub: TemplateTaskWithSubtasks) => {
    setSelectedTask(sub);
  }, []);

  const handleOpenParentTask = React.useCallback((parentId: string) => {
    const parent = template.tasks.find((t) => t.id === parentId);
    if (parent) setSelectedTask(parent);
  }, [template.tasks]);

  // Keep selected task fresh from template data
  const freshSelectedTask = React.useMemo(() => {
    if (!selectedTask) return null;
    for (const t of template.tasks) {
      if (t.id === selectedTask.id) return t;
      for (const sub of t.subtasks) {
        if (sub.id === selectedTask.id) return sub;
      }
    }
    return null;
  }, [template.tasks, selectedTask?.id]);

  const handleAddTask = (statusId: string) => {
    setQuickAddStatus(statusId);
    setQuickAddOpen(true);
  };

  const handleQuickAddSubmit = (data: {
    title: string;
    description?: string;
    status: string | null;
    section: string | null;
    relativeDueDays: number | null;
  }) => {
    addTask.mutate(
      {
        title: data.title,
        descriptionJson: data.description
          ? JSON.stringify({
              type: 'doc',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: data.description }] }],
            })
          : undefined,
        status: data.status,
        section: data.section,
        relativeDueDays: data.relativeDueDays,
      },
      {
        onSuccess: () => {
          setQuickAddOpen(false);
        },
      }
    );
  };

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      // Find the dragged task from template.tasks
      const activeTask = template.tasks.find((t) => t.id === activeId);
      if (!activeTask) return;

      // Determine target status
      let targetStatus = overId;
      const overTask = template.tasks.find((t) => t.id === overId);
      if (overTask) {
        targetStatus = overTask.status ?? sortedStatusOptions[0]?.id ?? '';
      }

      const isValidStatus = sortedStatusOptions.some((s) => s.id === targetStatus);
      if (!isValidStatus && !overTask) return;

      const sourceStatus = activeTask.status ?? sortedStatusOptions[0]?.id ?? '';
      const newStatus = overTask
        ? (overTask.status ?? sortedStatusOptions[0]?.id ?? '')
        : targetStatus;

      const sourceTasks = [...(tasksByStatus[sourceStatus] ?? [])];
      const targetTasks =
        sourceStatus === newStatus ? sourceTasks : [...(tasksByStatus[newStatus] ?? [])];

      const activeIndex = sourceTasks.findIndex((t) => t.id === activeId);

      if (sourceStatus === newStatus) {
        // Reorder within same column
        const overIndex = overTask
          ? targetTasks.findIndex((t) => t.id === overId)
          : targetTasks.length;
        if (activeIndex === overIndex) return;

        const reordered = arrayMove(sourceTasks, activeIndex, overIndex);
        const updates = reordered.map((task, index) => ({
          id: task.id,
          position: index * 1000,
        }));
        updatePositions.mutate(updates);
      } else {
        // Move between columns
        sourceTasks.splice(activeIndex, 1);
        const overIndex = overTask
          ? targetTasks.findIndex((t) => t.id === overId)
          : targetTasks.length;

        const updates: { id: string; position: number; status?: string }[] = [];
        updates.push({
          id: activeId,
          position: overIndex * 1000,
          status: newStatus,
        });
        targetTasks.forEach((task, index) => {
          if (index >= overIndex) {
            updates.push({
              id: task.id,
              position: (index + 1) * 1000,
            });
          }
        });
        updatePositions.mutate(updates);
      }
    },
    [template.tasks, sortedStatusOptions, tasksByStatus, updatePositions]
  );

  const renderOverlay = React.useCallback(
    (activeId: UniqueIdentifier | null) => {
      if (!activeId) return null;
      const task = template.tasks.find((t) => t.id === activeId);
      if (!task) return null;
      return (
        <TemplateTaskCard
          task={task}
          statusOptions={sortedStatusOptions}
          isOverlay
        />
      );
    },
    [template.tasks, sortedStatusOptions]
  );

  return (
    <>
    <DndProvider onDragEnd={handleDragEnd} renderOverlay={renderOverlay}>
      <div className="flex h-full gap-4 overflow-x-auto p-4">
        {sortedStatusOptions.map((status) => {
          const columnTasks = tasksByStatus[status.id] || [];
          const taskIds = columnTasks.map((t) => t.id);

          return (
            <KanbanColumn
              key={status.id}
              status={status}
              taskCount={columnTasks.length}
              taskIds={taskIds}
              onAddTask={() => handleAddTask(status.id)}
            >
              {columnTasks.map((task) => (
                <React.Fragment key={task.id}>
                  <SortableTask id={task.id}>
                    <TemplateTaskCard
                      task={task}
                      statusOptions={sortedStatusOptions}
                      isSelected={selectedTaskIds.has(task.id)}
                      onClick={(e) => {
                        if (e.shiftKey || isMultiSelectMode) {
                          e.preventDefault();
                          e.stopPropagation();
                          handleTaskMultiSelect(task.id, e.shiftKey, taskIds);
                        } else {
                          openSheet(task);
                        }
                      }}
                      onUpdateTitle={(title) =>
                        updateTask.mutate({ taskId: task.id, title })
                      }
                      onUpdateDueDays={(days) =>
                        updateTask.mutate({ taskId: task.id, relativeDueDays: days })
                      }
                      onDelete={() => deleteTask.mutate(task.id)}
                      onToggleExpand={
                        task.subtasks.length > 0
                          ? () => toggleExpanded(task.id)
                          : undefined
                      }
                      isExpanded={expandedParents.has(task.id)}
                      onAddSubtask={() => {
                        setExpandedParents((prev) => new Set(prev).add(task.id));
                      }}
                    />
                  </SortableTask>
                  {expandedParents.has(task.id) && (
                    <ExpandedTemplateSubtasks
                      parentTask={task}
                      templateId={templateId}
                      statusOptions={sortedStatusOptions}
                      onOpenSheet={openSheet}
                    />
                  )}
                </React.Fragment>
              ))}

            </KanbanColumn>
          );
        })}
      </div>
    </DndProvider>

    {isMultiSelectMode && (
      <TemplateMultiSelectBar
        selectedCount={selectedTaskIds.size}
        sectionOptions={template.sectionOptions}
        onApply={handleBulkApply}
        onCancel={clearSelection}
        isPending={bulkUpdate.isPending}
      />
    )}

    <TemplateQuickAddDialog
      open={quickAddOpen}
      onOpenChange={setQuickAddOpen}
      statusOptions={sortedStatusOptions}
      sectionOptions={template.sectionOptions}
      defaultStatus={quickAddStatus}
      isPending={addTask.isPending}
      onSubmit={handleQuickAddSubmit}
    />

    <TemplateTaskSheet
      open={sheetOpen}
      onOpenChange={setSheetOpen}
      task={freshSelectedTask}
      template={template}
      onOpenSubtask={handleOpenSubtask}
      onOpenParentTask={handleOpenParentTask}
    />
    </>
  );
}

// --- Template Task Card ---

interface TemplateTaskCardProps {
  task: TemplateTaskWithSubtasks;
  statusOptions: StatusOption[];
  isOverlay?: boolean;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onUpdateTitle?: (title: string) => void;
  onUpdateDueDays?: (days: number | null) => void;
  onDelete?: () => void;
  onToggleExpand?: () => void;
  isExpanded?: boolean;
  onAddSubtask?: () => void;
}

function TemplateTaskCard({
  task,
  statusOptions,
  isOverlay,
  isSelected,
  onClick,
  onUpdateTitle,
  onUpdateDueDays,
  onDelete,
  onToggleExpand,
  isExpanded,
  onAddSubtask,
}: TemplateTaskCardProps) {
  const [editing, setEditing] = React.useState(false);
  const [title, setTitle] = React.useState(task.title);

  React.useEffect(() => {
    setTitle(task.title);
  }, [task.title]);

  const handleTitleSave = () => {
    if (title.trim() && title.trim() !== task.title) {
      onUpdateTitle?.(title.trim());
    }
    setEditing(false);
  };

  return (
    <div
      className={cn(
        'group rounded-lg border bg-card p-3 shadow-sm transition-shadow cursor-pointer',
        isOverlay && 'shadow-lg ring-2 ring-primary/20',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={(e) => !isOverlay && !editing && onClick?.(e)}
    >
      {/* Title */}
      <div className="flex items-start gap-1.5">
        {onToggleExpand && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </button>
        )}
        {editing ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleSave();
              if (e.key === 'Escape') {
                setTitle(task.title);
                setEditing(false);
              }
            }}
            className="h-6 flex-1 border-0 bg-transparent p-0 text-sm font-medium"
            autoFocus
          />
        ) : (
          <span
            className="flex-1 text-sm font-medium cursor-pointer leading-snug"
            onClick={(e) => {
              if (!isOverlay) {
                e.stopPropagation();
                setEditing(true);
              }
            }}
          >
            {task.title}
          </span>
        )}
      </div>

      {/* Meta row */}
      <div className="mt-2 flex items-center gap-2">
        {task.recurringConfig && (
          <Repeat className="size-3 text-muted-foreground" />
        )}
        {task.relativeDueDays != null && (
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
            <Calendar className="size-3" />
            {task.relativeDueDays > 0
              ? `+${task.relativeDueDays}d`
              : task.relativeDueDays === 0
                ? '0d'
                : `${task.relativeDueDays}d`}
          </span>
        )}
        {task.subtasks.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {task.subtasks.length} subtask{task.subtasks.length !== 1 ? 's' : ''}
          </span>
        )}

        {/* Actions (visible on hover) */}
        {!isOverlay && (
          <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
            {onAddSubtask && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddSubtask();
                }}
                title="Add subtask"
              >
                <Plus className="size-3" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                title="Delete"
              >
                <Trash2 className="size-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Expanded Subtasks ---

interface ExpandedTemplateSubtasksProps {
  parentTask: TemplateTaskWithSubtasks;
  templateId: string;
  statusOptions: StatusOption[];
  onOpenSheet?: (task: TemplateTaskWithSubtasks) => void;
}

function ExpandedTemplateSubtasks({
  parentTask,
  templateId,
  statusOptions,
  onOpenSheet,
}: ExpandedTemplateSubtasksProps) {
  const addTask = useAddTemplateTask(templateId);
  const updateTask = useUpdateTemplateTask(templateId);
  const deleteTask = useDeleteTemplateTask(templateId);

  const [addingSubtask, setAddingSubtask] = React.useState(false);
  const [subtaskTitle, setSubtaskTitle] = React.useState('');

  const handleAddSubtask = () => {
    if (!subtaskTitle.trim()) return;
    addTask.mutate(
      {
        title: subtaskTitle.trim(),
        status: parentTask.status,
        parentTemplateTaskId: parentTask.id,
      },
      {
        onSuccess: () => {
          setSubtaskTitle('');
          setAddingSubtask(false);
        },
      }
    );
  };

  return (
    <div className="ml-4 space-y-1.5 border-l-2 border-primary/20 pl-2">
      {parentTask.subtasks.map((sub) => (
        <div
          key={sub.id}
          className="group/sub flex items-center gap-2 rounded-md border bg-card/50 px-2.5 py-1.5 cursor-pointer hover:bg-muted/30"
          onClick={() => onOpenSheet?.(sub)}
        >
          <CornerDownRight className="size-3 shrink-0 text-muted-foreground" />
          {statusOptions.length > 0 && (
            <span
              className="size-2 shrink-0 rounded-full"
              style={{
                backgroundColor:
                  statusOptions.find((s) => s.id === sub.status)?.color ?? '#6B7280',
              }}
            />
          )}
          <SubtaskInlineTitle
            title={sub.title}
            onSave={(title) => updateTask.mutate({ taskId: sub.id, title })}
          />
          {sub.relativeDueDays != null && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
              <Calendar className="size-3" />
              {sub.relativeDueDays > 0
                ? `+${sub.relativeDueDays}d`
                : sub.relativeDueDays === 0
                  ? '0d'
                  : `${sub.relativeDueDays}d`}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 ml-auto opacity-0 group-hover/sub:opacity-100 text-destructive hover:text-destructive"
            onClick={() => deleteTask.mutate(sub.id)}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      ))}

      {/* Add subtask */}
      {addingSubtask ? (
        <div className="flex items-center gap-1.5 px-1">
          <Input
            placeholder="Subtask title..."
            value={subtaskTitle}
            onChange={(e) => setSubtaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddSubtask();
              if (e.key === 'Escape') setAddingSubtask(false);
            }}
            className="h-7 text-sm"
            autoFocus
          />
          <Button
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleAddSubtask}
            disabled={!subtaskTitle.trim() || addTask.isPending}
          >
            Add
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setAddingSubtask(false)}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddingSubtask(true)}
          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50"
        >
          <Plus className="size-3" />
          Add subtask
        </button>
      )}
    </div>
  );
}

function SubtaskInlineTitle({
  title,
  onSave,
}: {
  title: string;
  onSave: (title: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(title);

  React.useEffect(() => {
    setValue(title);
  }, [title]);

  const handleSave = () => {
    if (value.trim() && value.trim() !== title) {
      onSave(value.trim());
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') {
            setValue(title);
            setEditing(false);
          }
        }}
        className="h-5 flex-1 border-0 bg-transparent p-0 text-xs"
        autoFocus
      />
    );
  }

  return (
    <span
      className="flex-1 text-xs truncate cursor-pointer"
      onClick={() => setEditing(true)}
    >
      {title}
    </span>
  );
}
