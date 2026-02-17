'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { StatusOption } from '@/lib/db/schema';

interface StatusOptionsEditorProps {
  options: StatusOption[];
  onChange: (options: StatusOption[]) => void;
  disabled?: boolean;
}

const DEFAULT_COLORS = [
  '#6B7280', // Gray
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
];

interface SortableStatusItemProps {
  option: StatusOption;
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

function SortableStatusItem({ option, onEdit, onDelete, disabled }: SortableStatusItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: option.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 border rounded-lg bg-card"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground/70 hover:text-muted-foreground disabled:opacity-50"
        disabled={disabled}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span
        className="w-4 h-4 rounded-full shrink-0"
        style={{ backgroundColor: option.color }}
      />
      <span className="flex-1 font-medium">{option.label}</span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onEdit}
          disabled={disabled}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive/80"
          onClick={onDelete}
          disabled={disabled}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface EditStatusFormProps {
  option?: StatusOption;
  onSave: (option: StatusOption) => void;
  onCancel: () => void;
  isNew?: boolean;
}

function EditStatusForm({ option, onSave, onCancel, isNew }: EditStatusFormProps) {
  const [label, setLabel] = useState(option?.label ?? '');
  const [color, setColor] = useState(option?.color ?? DEFAULT_COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    if (!label.trim()) {
      setError('Label is required');
      return;
    }

    onSave({
      id: option?.id ?? `status-${Date.now()}`,
      label: label.trim(),
      color,
      position: option?.position ?? 0,
    });
  };

  return (
    <div className="p-3 border rounded-lg bg-muted/50 space-y-3">
      <div className="flex items-center gap-3">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Status name"
          className="flex-1"
          autoFocus
        />
        <Button size="icon" variant="ghost" onClick={handleSave}>
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        {DEFAULT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className={`w-6 h-6 rounded-full transition-all ${
              color === c ? 'ring-2 ring-offset-2 ring-foreground' : ''
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}

export function StatusOptionsEditor({ options, onChange, disabled }: StatusOptionsEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = options.findIndex((o) => o.id === active.id);
      const newIndex = options.findIndex((o) => o.id === over.id);

      const newOptions = arrayMove(options, oldIndex, newIndex).map((o, i) => ({
        ...o,
        position: i,
      }));

      onChange(newOptions);
    }
  };

  const handleEdit = (option: StatusOption) => {
    setEditingId(option.id);
    setIsAddingNew(false);
  };

  const handleSaveEdit = (updatedOption: StatusOption) => {
    const newOptions = options.map((o) =>
      o.id === updatedOption.id ? updatedOption : o
    );
    onChange(newOptions);
    setEditingId(null);
  };

  const handleDelete = (optionId: string) => {
    const newOptions = options
      .filter((o) => o.id !== optionId)
      .map((o, i) => ({ ...o, position: i }));
    onChange(newOptions);
  };

  const handleAddNew = () => {
    setIsAddingNew(true);
    setEditingId(null);
  };

  const handleSaveNew = (newOption: StatusOption) => {
    const newOptions = [...options, { ...newOption, position: options.length }];
    onChange(newOptions);
    setIsAddingNew(false);
  };

  return (
    <div className="space-y-3">
      <DndContext
        id="status-options-dnd"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={options.map((o) => o.id)}
          strategy={verticalListSortingStrategy}
        >
          {options.map((option) =>
            editingId === option.id ? (
              <EditStatusForm
                key={option.id}
                option={option}
                onSave={handleSaveEdit}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <SortableStatusItem
                key={option.id}
                option={option}
                onEdit={() => handleEdit(option)}
                onDelete={() => handleDelete(option.id)}
                disabled={disabled}
              />
            )
          )}
        </SortableContext>
      </DndContext>

      {isAddingNew ? (
        <EditStatusForm
          onSave={handleSaveNew}
          onCancel={() => setIsAddingNew(false)}
          isNew
        />
      ) : (
        <Button
          variant="outline"
          className="w-full"
          onClick={handleAddNew}
          disabled={disabled}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Status
        </Button>
      )}
    </div>
  );
}
