'use client';

import * as React from 'react';
import {
  CircleCheck,
  CircleDot,
  Lock,
  Plus,
  Trash2,
  Loader2,
  Calendar,
  GripVertical,
  Combine,
  Split,
  ListChecks,
  ListTree,
} from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AssigneeAvatars } from './AssigneePicker';
import { DateDisplay } from './DatePicker';
import { TaskActivityIndicators } from './TaskActivityIndicators';
import { useSubtasks, useCreateSubtask, useDeleteTask, useUpdateTaskPositions, taskKeys } from '@/lib/hooks/useTasks';
import { DeleteTaskDialog } from './DeleteTaskDialog';
import { MultiLinePasteDialog } from '@/components/quick-add/MultiLinePasteDialog';
import { parsePastedItems, type ParsedPasteItem } from '@/lib/utils/parse-pasted-items';
import { createTask as createTaskAction } from '@/lib/actions/tasks';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { StatusOption, SectionOption } from '@/lib/db/schema';
import type { TaskWithAssignees, UpdateTaskInput } from '@/lib/actions/tasks';

interface SubtasksTabProps {
  parentTaskId: string;
  boardId: string;
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
  onOpenSubtask?: (taskId: string) => void;
  parentTask?: Pick<TaskWithAssignees, 'subtasksBreakoutEnabled' | 'subtasksSequentialEnabled'>;
  onUpdateParent?: (updates: Partial<Pick<UpdateTaskInput, 'subtasksBreakoutEnabled' | 'subtasksSequentialEnabled'>>) => void;
}

type DependencyState = 'complete' | 'active' | 'waiting' | null;
type SubtaskFlowMode = 'subtasks' | 'task-list';
type SubtaskDisplayMode = 'combine' | 'individual';

interface SegmentedToggleOption<T extends string> {
  value: T;
  label: string;
  icon: React.ElementType;
  tooltip: string;
}

interface SegmentedToggleProps<T extends string> {
  value: T;
  options: SegmentedToggleOption<T>[];
  ariaLabel: string;
  onValueChange: (value: T) => void;
  disabled?: boolean;
}

const flowModeOptions: SegmentedToggleOption<SubtaskFlowMode>[] = [
  {
    value: 'subtasks',
    label: 'Subtasks',
    icon: ListTree,
    tooltip: 'All subtasks can be active at once.',
  },
  {
    value: 'task-list',
    label: 'Task List',
    icon: ListChecks,
    tooltip: 'Only the first incomplete subtask is active.',
  },
];

const displayModeOptions: SegmentedToggleOption<SubtaskDisplayMode>[] = [
  {
    value: 'combine',
    label: 'Combine',
    icon: Combine,
    tooltip: 'Keep subtasks grouped under their parent on the board.',
  },
  {
    value: 'individual',
    label: 'Individual',
    icon: Split,
    tooltip: 'Show subtasks as their own board cards.',
  },
];

function SegmentedToggle<T extends string>({
  value,
  options,
  ariaLabel,
  onValueChange,
  disabled,
}: SegmentedToggleProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex rounded-md border bg-muted p-0.5"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = value === option.value;

        return (
          <Tooltip key={option.value}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={isActive ? 'secondary' : 'ghost'}
                size="sm"
                aria-pressed={isActive}
                disabled={disabled}
                onClick={() => {
                  if (!isActive) {
                    onValueChange(option.value);
                  }
                }}
                className={cn(
                  'h-7 min-w-24 gap-1.5 px-2.5',
                  isActive && 'bg-background shadow-sm'
                )}
              >
                <Icon className="size-4" />
                <span>{option.label}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{option.tooltip}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

interface SortableSubtaskCardProps {
  subtask: TaskWithAssignees;
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
  onOpenSubtask?: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  dependencyState?: DependencyState;
}

function SortableSubtaskCard({
  subtask,
  statusOptions,
  sectionOptions,
  onOpenSubtask,
  onDelete,
  dependencyState,
}: SortableSubtaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtask.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const status = statusOptions.find((s) => s.id === subtask.status);
  const section = sectionOptions.find((s) => s.id === subtask.section);
  const isWaiting = dependencyState === 'waiting';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        'group relative flex items-start gap-2 rounded-lg border bg-background p-3 transition-all',
        'hover:border-primary/50 hover:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        dependencyState === 'active' && 'border-primary/50 bg-primary/5',
        isWaiting && 'border-dashed bg-muted/40 opacity-75',
        isDragging && 'opacity-50 shadow-lg z-50'
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      {/* Card body — clickable */}
      <div
        role="button"
        tabIndex={0}
        className="min-w-0 flex-1 cursor-pointer"
        onClick={() => onOpenSubtask?.(subtask.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenSubtask?.(subtask.id);
          }
        }}
      >
        {/* Section Badge */}
        {section && (
          <span
            className="mb-2 inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `${section.color}20`,
              color: section.color,
            }}
          >
            {section.label}
          </span>
        )}

        {/* Title */}
        <div className="flex min-w-0 items-center gap-2 pr-6">
          <p className="min-w-0 flex-1 font-medium text-sm leading-tight">{subtask.title}</p>
          {dependencyState === 'active' && (
            <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px]">
              <CircleDot className="size-3" />
              Active
            </Badge>
          )}
          {dependencyState === 'waiting' && (
            <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px] text-muted-foreground">
              <Lock className="size-3" />
              Waiting
            </Badge>
          )}
          {dependencyState === 'complete' && (
            <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px] text-muted-foreground">
              <CircleCheck className="size-3" />
              Done
            </Badge>
          )}
        </div>

        {/* Meta Row */}
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {/* Status badge */}
            {status && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: status.color }}
              >
                {status.label}
              </span>
            )}

            {/* Due Date */}
            {subtask.dueDate && (
              <div className="flex items-center gap-1">
                <Calendar className="size-3" />
                <DateDisplay
                  date={subtask.dueDate}
                  flexibility={subtask.dateFlexibility}
                />
              </div>
            )}
          </div>

          {/* Right side: activity indicators + assignees */}
          <div className="flex items-center gap-2">
            <TaskActivityIndicators
              commentCount={subtask.commentCount}
              attachmentCount={subtask.attachmentCount}
              hasNewComments={subtask.hasNewComments}
            />
            {subtask.assignees.length > 0 && (
              <AssigneeAvatars
                assignees={subtask.assignees}
                maxDisplay={3}
                size="sm"
              />
            )}
          </div>
        </div>
      </div>

      {/* Delete button - top right on hover */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-1.5 right-1.5 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive z-10"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(subtask.id);
        }}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

export function SubtasksTab({
  parentTaskId,
  boardId,
  statusOptions,
  sectionOptions,
  onOpenSubtask,
  parentTask,
  onUpdateParent,
}: SubtasksTabProps) {
  const { data: subtasks, isLoading } = useSubtasks(parentTaskId);
  const createSubtask = useCreateSubtask(parentTaskId, boardId);
  const deleteTask = useDeleteTask();
  const updatePositions = useUpdateTaskPositions();

  const queryClient = useQueryClient();

  const [newTitle, setNewTitle] = React.useState('');
  const [deleteSubtaskId, setDeleteSubtaskId] = React.useState<string | null>(null);
  const [orderedIds, setOrderedIds] = React.useState<string[]>([]);
  const [pasteItems, setPasteItems] = React.useState<ParsedPasteItem[] | null>(null);
  const [isBatchCreating, setIsBatchCreating] = React.useState(false);
  const [batchProgress, setBatchProgress] = React.useState<{ completed: number; total: number } | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Keep orderedIds in sync with server data
  React.useEffect(() => {
    if (subtasks) {
      setOrderedIds(subtasks.map((s) => s.id));
    }
  }, [subtasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const completeStatusIds = React.useMemo(
    () =>
      statusOptions
        .filter(
          (s) =>
            s.id === 'complete' ||
            s.id === 'done' ||
            s.label.toLowerCase().includes('complete') ||
            s.label.toLowerCase().includes('done')
        )
        .map((s) => s.id),
    [statusOptions]
  );

  const completedCount = subtasks?.filter((s) => completeStatusIds.includes(s.status)).length ?? 0;

  const totalCount = subtasks?.length ?? 0;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Build an ordered subtask list based on orderedIds
  const orderedSubtasks = React.useMemo(() => {
    if (!subtasks) return [];
    const map = new Map(subtasks.map((s) => [s.id, s]));
    return orderedIds.map((id) => map.get(id)).filter(Boolean) as TaskWithAssignees[];
  }, [subtasks, orderedIds]);

  const breakoutEnabled = parentTask?.subtasksBreakoutEnabled ?? false;
  const dependenciesEnabled = parentTask?.subtasksSequentialEnabled ?? false;
  const flowMode: SubtaskFlowMode = dependenciesEnabled ? 'task-list' : 'subtasks';
  const displayMode: SubtaskDisplayMode = breakoutEnabled ? 'individual' : 'combine';
  const activeSubtaskId = React.useMemo(
    () => orderedSubtasks.find((subtask) => !completeStatusIds.includes(subtask.status))?.id ?? null,
    [orderedSubtasks, completeStatusIds]
  );

  const getDependencyState = React.useCallback(
    (subtask: TaskWithAssignees): DependencyState => {
      if (!dependenciesEnabled) return null;
      if (completeStatusIds.includes(subtask.status)) return 'complete';
      return subtask.id === activeSubtaskId ? 'active' : 'waiting';
    },
    [activeSubtaskId, completeStatusIds, dependenciesEnabled]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedIds.indexOf(active.id as string);
    const newIndex = orderedIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(orderedIds, oldIndex, newIndex);
    setOrderedIds(newOrder);

    // Persist position updates
    const updates = newOrder.map((id, index) => ({
      id,
      position: index * 1000,
    }));
    updatePositions.mutate(updates);
  };

  const handleAdd = () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    createSubtask.mutate(
      {
        title: trimmed,
        status: statusOptions[0]?.id ?? '',
      },
      {
        onSuccess: () => {
          setNewTitle('');
          inputRef.current?.focus();
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = parsePastedItems(e.nativeEvent.clipboardData!);
    if (!items || (items.length < 2 && !(items.length === 1 && items[0].description))) return;

    e.preventDefault();
    setPasteItems(items);
    setNewTitle('');
  };

  const handleBatchCreate = React.useCallback(async () => {
    if (!pasteItems) return;

    const MAX_LINES = 50;
    const items = pasteItems.slice(0, MAX_LINES);
    const defaultStatus = statusOptions[0]?.id ?? '';

    setIsBatchCreating(true);
    setBatchProgress({ completed: 0, total: items.length });

    let successCount = 0;
    let failCount = 0;

    for (const item of items) {
      // Convert plain text description to TiptapContent JSON
      const descriptionJson = item.description
        ? JSON.stringify({
            type: 'doc',
            content: item.description.split('\n').map(line => ({
              type: 'paragraph',
              content: [{ type: 'text', text: line }],
            })),
          })
        : undefined;

      const result = await createTaskAction({
        boardId,
        title: item.title,
        status: defaultStatus,
        parentTaskId,
        descriptionJson,
      });

      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }

      setBatchProgress({ completed: successCount + failCount, total: items.length });
    }

    await queryClient.invalidateQueries({ queryKey: taskKeys.subtasks(parentTaskId) });
    await queryClient.invalidateQueries({ queryKey: taskKeys.detail(parentTaskId) });
    await queryClient.invalidateQueries({ queryKey: taskKeys.lists() });

    if (failCount === 0) {
      toast.success(`Created ${successCount} subtasks`);
    } else {
      toast.warning(`Created ${successCount} subtasks, ${failCount} failed`);
    }

    setPasteItems(null);
    setIsBatchCreating(false);
    setBatchProgress(null);
  }, [pasteItems, boardId, parentTaskId, statusOptions, queryClient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedToggle<SubtaskFlowMode>
          ariaLabel="Subtask flow mode"
          value={flowMode}
          disabled={!onUpdateParent}
          options={flowModeOptions}
          onValueChange={(value) => {
            onUpdateParent?.({ subtasksSequentialEnabled: value === 'task-list' });
          }}
        />

        <SegmentedToggle<SubtaskDisplayMode>
          ariaLabel="Subtask board display mode"
          value={displayMode}
          disabled={!onUpdateParent}
          options={displayModeOptions}
          onValueChange={(value) => {
            onUpdateParent?.({ subtasksBreakoutEnabled: value === 'individual' });
          }}
        />
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{completedCount}/{totalCount} completed</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Subtask cards with DnD */}
      {orderedSubtasks.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {orderedSubtasks.map((subtask) => (
                <SortableSubtaskCard
                  key={subtask.id}
                  subtask={subtask}
                  statusOptions={statusOptions}
                  sectionOptions={sectionOptions}
                  onOpenSubtask={onOpenSubtask}
                  onDelete={setDeleteSubtaskId}
                  dependencyState={getDependencyState(subtask)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Always-visible add subtask input */}
      <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2">
        <Plus className="size-4 shrink-0 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Add a subtask..."
          className="h-7 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
        />
        {newTitle.trim() && (
          <Button
            size="sm"
            className="h-7 px-3"
            onClick={handleAdd}
            disabled={createSubtask.isPending}
          >
            {createSubtask.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              'Add'
            )}
          </Button>
        )}
      </div>

      {/* Empty state hint */}
      {(!subtasks || subtasks.length === 0) && (
        <p className="text-center text-xs text-muted-foreground py-4">
          Break this task into smaller pieces. Click a subtask to open its full details.
        </p>
      )}

      <DeleteTaskDialog
        open={deleteSubtaskId !== null}
        onOpenChange={(open) => { if (!open) setDeleteSubtaskId(null); }}
        onConfirm={() => {
          if (deleteSubtaskId) deleteTask.mutate(deleteSubtaskId);
          setDeleteSubtaskId(null);
        }}
        isSubtask
      />

      <MultiLinePasteDialog
        open={!!pasteItems}
        onOpenChange={(open) => { if (!open) setPasteItems(null); }}
        items={pasteItems ?? []}
        onConfirm={handleBatchCreate}
        isCreating={isBatchCreating}
        progress={batchProgress}
        noun={{ singular: 'subtask', plural: 'subtasks' }}
      />
    </div>
  );
}
