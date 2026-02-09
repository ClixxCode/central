'use client';

import { useState } from 'react';
import { Plus, GripVertical, Trash2, Pencil, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  useStatuses,
  useCreateStatus,
  useUpdateStatus,
  useDeleteStatus,
  useReorderStatuses,
  useSeedDefaultStatuses,
  useSections,
  useCreateSection,
  useUpdateSection,
  useDeleteSection,
  useReorderSections,
  useSeedDefaultSections,
} from '@/lib/hooks';
import type { Status } from '@/lib/actions/statuses';
import type { Section } from '@/lib/actions/sections';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

// Color presets for quick selection
const COLOR_PRESETS = [
  '#6B7280', // Gray
  '#EF4444', // Red
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#06B6D4', // Cyan
];

interface SortableItemProps {
  id: string;
  label: string;
  color: string;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableItem({ id, label, color, onEdit, onDelete }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card p-3',
        isDragging && 'opacity-50'
      )}
    >
      <button
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div
        className="h-4 w-4 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="flex-1 font-medium">{label}</span>
      <Button variant="ghost" size="icon" onClick={onEdit}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onDelete}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

interface ItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialLabel?: string;
  initialColor?: string;
  onSubmit: (label: string, color: string) => void;
  isLoading: boolean;
}

function ItemFormDialog({
  open,
  onOpenChange,
  title,
  initialLabel = '',
  initialColor = '#3B82F6',
  onSubmit,
  isLoading,
}: ItemFormDialogProps) {
  const [label, setLabel] = useState(initialLabel);
  const [color, setColor] = useState(initialColor);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (label.trim()) {
      onSubmit(label.trim(), color);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Enter label..."
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_PRESETS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  className={cn(
                    'h-8 w-8 rounded-full border-2',
                    color === presetColor ? 'border-foreground' : 'border-transparent'
                  )}
                  style={{ backgroundColor: presetColor }}
                  onClick={() => setColor(presetColor)}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#3B82F6"
                className="flex-1"
                pattern="^#[0-9A-Fa-f]{6}$"
              />
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-8 cursor-pointer rounded border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !label.trim()}>
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StatusesSectionsPageClient() {
  const { data: statuses, isLoading: statusesLoading } = useStatuses();
  const { data: sections, isLoading: sectionsLoading } = useSections();
  
  const createStatus = useCreateStatus();
  const updateStatus = useUpdateStatus();
  const deleteStatus = useDeleteStatus();
  const reorderStatuses = useReorderStatuses();
  const seedDefaultStatuses = useSeedDefaultStatuses();
  
  const createSection = useCreateSection();
  const updateSection = useUpdateSection();
  const deleteSection = useDeleteSection();
  const reorderSections = useReorderSections();
  const seedDefaultSections = useSeedDefaultSections();

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<{ id: string; label: string; color: string } | null>(null);
  const [editingSection, setEditingSection] = useState<{ id: string; label: string; color: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleStatusDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && statuses) {
      const oldIndex = statuses.findIndex((s) => s.id === active.id);
      const newIndex = statuses.findIndex((s) => s.id === over.id);
      const newOrder = [...statuses];
      const [removed] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, removed);
      reorderStatuses.mutate(newOrder.map((s) => s.id));
    }
  };

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && sections) {
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);
      const newOrder = [...sections];
      const [removed] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, removed);
      reorderSections.mutate(newOrder.map((s) => s.id));
    }
  };

  const handleCreateStatus = (label: string, color: string) => {
    createStatus.mutate({ label, color }, {
      onSuccess: () => setStatusDialogOpen(false),
    });
  };

  const handleUpdateStatus = (label: string, color: string) => {
    if (editingStatus) {
      updateStatus.mutate(
        { statusId: editingStatus.id, data: { label, color } },
        { onSuccess: () => setEditingStatus(null) }
      );
    }
  };

  const handleDeleteStatus = (statusId: string) => {
    if (confirm('Are you sure you want to delete this status?')) {
      deleteStatus.mutate(statusId);
    }
  };

  const handleCreateSection = (label: string, color: string) => {
    createSection.mutate({ label, color }, {
      onSuccess: () => setSectionDialogOpen(false),
    });
  };

  const handleUpdateSection = (label: string, color: string) => {
    if (editingSection) {
      updateSection.mutate(
        { sectionId: editingSection.id, data: { label, color } },
        { onSuccess: () => setEditingSection(null) }
      );
    }
  };

  const handleDeleteSection = (sectionId: string) => {
    if (confirm('Are you sure you want to delete this section?')) {
      deleteSection.mutate(sectionId);
    }
  };

  if (statusesLoading || sectionsLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-4 w-64 bg-muted animate-pulse rounded" />
        <div className="h-32 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Statuses & Sections</h1>
        <p className="text-muted-foreground">
          Manage global statuses and sections used across all boards
        </p>
      </div>

      <Tabs defaultValue="statuses">
        <TabsList>
          <TabsTrigger value="statuses">Statuses</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
        </TabsList>

        <TabsContent value="statuses" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Statuses</CardTitle>
                  <CardDescription>
                    Configure task statuses. Drag to reorder.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {(!statuses || statuses.length === 0) && (
                    <Button
                      variant="outline"
                      onClick={() => seedDefaultStatuses.mutate()}
                      disabled={seedDefaultStatuses.isPending}
                    >
                      Load Defaults
                    </Button>
                  )}
                  <Button onClick={() => setStatusDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Status
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {statuses && statuses.length > 0 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleStatusDragEnd}
                >
                  <SortableContext
                    items={statuses.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {statuses.map((status) => (
                        <SortableItem
                          key={status.id}
                          id={status.id}
                          label={status.label}
                          color={status.color}
                          onEdit={() =>
                            setEditingStatus({
                              id: status.id,
                              label: status.label,
                              color: status.color,
                            })
                          }
                          onDelete={() => handleDeleteStatus(status.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No statuses configured. Click "Load Defaults" to get started.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sections" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sections</CardTitle>
                  <CardDescription>
                    Configure task sections for workflow stages. Drag to reorder.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {(!sections || sections.length === 0) && (
                    <Button
                      variant="outline"
                      onClick={() => seedDefaultSections.mutate()}
                      disabled={seedDefaultSections.isPending}
                    >
                      Load Defaults
                    </Button>
                  )}
                  <Button onClick={() => setSectionDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Section
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {sections && sections.length > 0 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleSectionDragEnd}
                >
                  <SortableContext
                    items={sections.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {sections.map((section) => (
                        <SortableItem
                          key={section.id}
                          id={section.id}
                          label={section.label}
                          color={section.color}
                          onEdit={() =>
                            setEditingSection({
                              id: section.id,
                              label: section.label,
                              color: section.color,
                            })
                          }
                          onDelete={() => handleDeleteSection(section.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No sections configured. Click "Load Defaults" to get started.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Status Dialog */}
      <ItemFormDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        title="Create Status"
        onSubmit={handleCreateStatus}
        isLoading={createStatus.isPending}
      />

      {/* Edit Status Dialog */}
      <ItemFormDialog
        open={!!editingStatus}
        onOpenChange={(open) => !open && setEditingStatus(null)}
        title="Edit Status"
        initialLabel={editingStatus?.label}
        initialColor={editingStatus?.color}
        onSubmit={handleUpdateStatus}
        isLoading={updateStatus.isPending}
      />

      {/* Create Section Dialog */}
      <ItemFormDialog
        open={sectionDialogOpen}
        onOpenChange={setSectionDialogOpen}
        title="Create Section"
        onSubmit={handleCreateSection}
        isLoading={createSection.isPending}
      />

      {/* Edit Section Dialog */}
      <ItemFormDialog
        open={!!editingSection}
        onOpenChange={(open) => !open && setEditingSection(null)}
        title="Edit Section"
        initialLabel={editingSection?.label}
        initialColor={editingSection?.color}
        onSubmit={handleUpdateSection}
        isLoading={updateSection.isPending}
      />
    </div>
  );
}
