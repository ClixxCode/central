'use client';

import * as React from 'react';
import { Plus, Trash2, Loader2, Calendar, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AssigneeAvatars } from './AssigneePicker';
import { DateDisplay } from './DatePicker';
import { TaskActivityIndicators } from './TaskActivityIndicators';
import { useSubtasks, useCreateSubtask, useDeleteTask, useUpdateTaskPositions } from '@/lib/hooks/useTasks';
import { DeleteTaskDialog } from './DeleteTaskDialog';
import type { StatusOption, SectionOption } from '@/lib/db/schema';
import type { TaskWithAssignees } from '@/lib/actions/tasks';

interface SubtasksTabProps {
  parentTaskId: string;
  boardId: string;
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
  onOpenSubtask?: (taskId: string) => void;
}

interface SortableSubtaskCardProps {
  subtask: TaskWithAssignees;
  statusOptions: StatusOption[];
  sectionOptions: SectionOption[];
  onOpenSubtask?: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}

function SortableSubtaskCard({
  subtask,
  statusOptions,
  sectionOptions,
  onOpenSubtask,
  onDelete,
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        'group relative flex items-start gap-2 rounded-lg border bg-background p-3 transition-all',
        'hover:border-primary/50 hover:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
        <p className="font-medium text-sm leading-tight pr-6">{subtask.title}</p>

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
}: SubtasksTabProps) {
  const { data: subtasks, isLoading } = useSubtasks(parentTaskId);
  const createSubtask = useCreateSubtask(parentTaskId, boardId);
  const deleteTask = useDeleteTask();
  const updatePositions = useUpdateTaskPositions();

  const [newTitle, setNewTitle] = React.useState('');
  const [deleteSubtaskId, setDeleteSubtaskId] = React.useState<string | null>(null);
  const [orderedIds, setOrderedIds] = React.useState<string[]>([]);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
    </div>
  );
}
