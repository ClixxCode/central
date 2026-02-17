'use client';

import * as React from 'react';
import { useDebouncedCallback } from 'use-debounce';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TaskEditor, type TaskEditorRef } from '@/components/editor/TaskEditor';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { RecurringPicker } from '@/components/tasks/RecurringPicker';
import {
  Calendar,
  CornerDownRight,
  Loader2,
  Plus,
  Repeat,
  Trash2,
} from 'lucide-react';
import {
  useUpdateTemplateTask,
  useDeleteTemplateTask,
  useAddTemplateTask,
} from '@/lib/hooks';
import type { TemplateTaskWithSubtasks, TemplateDetail } from '@/lib/actions/templates';
import type { TiptapContent, RecurringConfig } from '@/lib/db/schema/tasks';
import type { StatusOption, SectionOption } from '@/lib/db/schema';
import { cn } from '@/lib/utils';

interface TemplateTaskSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TemplateTaskWithSubtasks | null;
  template: TemplateDetail;
  onOpenSubtask?: (task: TemplateTaskWithSubtasks) => void;
  /** Called when user navigates to parent task */
  onOpenParentTask?: (taskId: string) => void;
}

export function TemplateTaskSheet({
  open,
  onOpenChange,
  task,
  template,
  onOpenSubtask,
  onOpenParentTask,
}: TemplateTaskSheetProps) {
  const editorRef = React.useRef<TaskEditorRef>(null);
  const updateTask = useUpdateTemplateTask(template.id);
  const deleteTask = useDeleteTemplateTask(template.id);
  const addTask = useAddTemplateTask(template.id);

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState<TiptapContent | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [section, setSection] = React.useState<string | null>(null);
  const [relativeDueDays, setRelativeDueDays] = React.useState<string>('');
  const [recurringConfig, setRecurringConfig] = React.useState<RecurringConfig | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  const isBoardTemplate = template.type === 'board_template';
  const isSubtask = !!task?.parentTemplateTaskId;

  // Reset form state when task changes
  React.useEffect(() => {
    if (open && task) {
      setTitle(task.title);
      setDescription(task.description);
      setStatus(task.status);
      setSection(task.section);
      setRelativeDueDays(task.relativeDueDays != null ? String(task.relativeDueDays) : '');
      setRecurringConfig(task.recurringConfig);
    }
  }, [open, task?.id]);

  // Auto-save helper
  const autoSave = React.useCallback(
    (updates: Record<string, unknown>) => {
      if (!task) return;
      setIsSaving(true);
      updateTask.mutate(
        { taskId: task.id, ...updates } as any,
        { onSettled: () => setTimeout(() => setIsSaving(false), 400) }
      );
    },
    [task, updateTask]
  );

  const debouncedSaveTitle = useDebouncedCallback((newTitle: string) => {
    if (newTitle.trim()) {
      autoSave({ title: newTitle.trim() });
    }
  }, 500);

  const debouncedSaveDescription = useDebouncedCallback((content: TiptapContent | null) => {
    autoSave({ descriptionJson: content ? JSON.stringify(content) : null });
  }, 500);

  const handleDelete = () => {
    if (!task) return;
    deleteTask.mutate(task.id, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const handleAddSubtask = () => {
    if (!task || !newSubtaskTitle.trim()) return;
    addTask.mutate(
      {
        title: newSubtaskTitle.trim(),
        status: task.status,
        parentTemplateTaskId: task.id,
      },
      {
        onSuccess: () => setNewSubtaskTitle(''),
      }
    );
  };

  // Find parent task for subtask breadcrumb
  const parentTask = isSubtask
    ? template.tasks.find((t) => t.id === task?.parentTemplateTaskId)
    : null;

  // Find subtasks from template data (always fresh)
  const subtasks = task
    ? template.tasks.find((t) => t.id === task.id)?.subtasks ?? task.subtasks
    : [];

  if (!task) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="!w-full sm:!w-[80vw] lg:!w-[66vw] !max-w-none p-0 flex flex-col gap-0"
      >
        <SheetHeader className="border-b px-6 py-4 shrink-0">
          {/* Parent task breadcrumb for subtasks */}
          {isSubtask && parentTask && onOpenParentTask && (
            <button
              type="button"
              onClick={() => onOpenParentTask(parentTask.id)}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mb-1 -ml-2"
            >
              <CornerDownRight className="size-3" />
              <span>Subtask of: {parentTask.title}</span>
            </button>
          )}
          <div className="flex items-start gap-3">
            {/* Recurring indicator */}
            {recurringConfig && (
              <span className="mt-2 shrink-0 text-muted-foreground">
                <Repeat className="size-4" />
              </span>
            )}
            {/* Title - editable with auto-save */}
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                debouncedSaveTitle(e.target.value);
              }}
              placeholder="Task title"
              className="flex-1 border-0 bg-transparent p-0 text-lg font-semibold shadow-none focus-visible:ring-0"
            />
            {isSaving && (
              <Loader2 className="size-4 animate-spin text-muted-foreground mt-2" />
            )}
          </div>
          <SheetTitle className="sr-only">{title || 'Edit template task'}</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 overflow-hidden">
          <div className="space-y-6 px-6 py-4">
            {/* Metadata grid */}
            <div className={cn(
              'grid gap-4 rounded-lg border bg-muted/50 p-4',
              isBoardTemplate ? 'grid-cols-2' : 'grid-cols-2'
            )}>
              {/* Status - only for board templates */}
              {isBoardTemplate && template.statusOptions.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <Select
                    value={status ?? ''}
                    onValueChange={(v) => {
                      setStatus(v);
                      autoSave({ status: v });
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {template.statusOptions.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: opt.color }}
                            />
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Section - only for board templates */}
              {isBoardTemplate && template.sectionOptions.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Section</label>
                  <Select
                    value={section ?? '__none__'}
                    onValueChange={(v) => {
                      const newSection = v === '__none__' ? null : v;
                      setSection(newSection);
                      autoSave({ section: newSection });
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {template.sectionOptions.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Due Days */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  <Calendar className="mr-1 inline size-3" />
                  Due Days (relative)
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 7"
                  value={relativeDueDays}
                  onChange={(e) => setRelativeDueDays(e.target.value)}
                  onBlur={() => {
                    const days = relativeDueDays.trim() ? parseInt(relativeDueDays, 10) : null;
                    if (days !== task.relativeDueDays) {
                      autoSave({ relativeDueDays: days });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="h-9"
                />
              </div>

              {/* Recurring */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  <Repeat className="mr-1 inline size-3" />
                  Repeat
                </label>
                <RecurringPicker
                  value={recurringConfig}
                  onChange={(config) => {
                    setRecurringConfig(config);
                    autoSave({
                      recurringConfigJson: config ? JSON.stringify(config) : null,
                    });
                  }}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <div className="rounded-md border overflow-hidden">
                <EditorToolbar
                  editor={editorRef.current?.getEditor() ?? null}
                />
                <TaskEditor
                  ref={editorRef}
                  content={description}
                  placeholder="Add a description..."
                  editable
                  onChange={(content) => {
                    setDescription(content);
                    debouncedSaveDescription(content);
                  }}
                  minHeight="150px"
                />
              </div>
            </div>

            {/* Subtasks section - only for top-level tasks */}
            {!isSubtask && (
              <div className="space-y-3">
                <label className="text-sm font-medium">
                  Subtasks
                  {subtasks.length > 0 && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ({subtasks.length})
                    </span>
                  )}
                </label>

                {subtasks.length > 0 && (
                  <div className="space-y-1.5">
                    {subtasks.map((sub) => (
                      <div
                        key={sub.id}
                        className="group flex items-center gap-2 rounded-md border px-3 py-2 hover:bg-muted/50 cursor-pointer"
                        onClick={() => onOpenSubtask?.(sub)}
                      >
                        {isBoardTemplate && (
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{
                              backgroundColor:
                                template.statusOptions.find((s) => s.id === sub.status)?.color ??
                                '#6B7280',
                            }}
                          />
                        )}
                        <span className="flex-1 text-sm truncate">{sub.title}</span>
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
                        {sub.recurringConfig && (
                          <Repeat className="size-3 text-muted-foreground shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add subtask */}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Add a subtask..."
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddSubtask();
                    }}
                    className="h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0"
                    onClick={handleAddSubtask}
                    disabled={!newSubtaskTitle.trim() || addTask.isPending}
                  >
                    <Plus className="size-3.5 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t px-6 py-3 flex items-center justify-between shrink-0">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleteTask.isPending}
          >
            <Trash2 className="size-3.5 mr-1.5" />
            Delete task
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
