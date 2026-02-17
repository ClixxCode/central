'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  MoreHorizontal,
  Plus,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  useAddTemplateTask,
  useDeleteTemplateTask,
  useBulkUpdateTemplateTasks,
} from '@/lib/hooks';
import { cn } from '@/lib/utils';
import type { TemplateDetail, TemplateTaskWithSubtasks } from '@/lib/actions/templates';
import { TemplateTaskSheet } from './TemplateTaskSheet';
import { TemplateQuickAddDialog } from './TemplateQuickAddDialog';
import { TemplateMultiSelectBar, type TemplateBulkEditPayload } from './TemplateMultiSelectBar';

interface TemplateBoardTableEditorProps {
  templateId: string;
  template: TemplateDetail;
}

export function TemplateBoardTableEditor({ templateId, template }: TemplateBoardTableEditorProps) {
  const addTask = useAddTemplateTask(templateId);
  const deleteTask = useDeleteTemplateTask(templateId);
  const bulkUpdate = useBulkUpdateTemplateTasks(templateId);

  const [expandedParents, setExpandedParents] = React.useState<Set<string>>(new Set());
  const [quickAddOpen, setQuickAddOpen] = React.useState(false);

  // Sheet state
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

  // Ordered top-level task IDs for range select
  const orderedTaskIds = React.useMemo(
    () => template.tasks.map((t) => t.id),
    [template.tasks]
  );

  const handleTaskMultiSelect = React.useCallback(
    (taskId: string, shiftKey: boolean) => {
      setSelectedTaskIds((prev) => {
        const next = new Set(prev);

        if (shiftKey && lastSelectedIdRef.current && prev.size > 0) {
          const lastIdx = orderedTaskIds.indexOf(lastSelectedIdRef.current);
          const currentIdx = orderedTaskIds.indexOf(taskId);
          if (lastIdx !== -1 && currentIdx !== -1) {
            const start = Math.min(lastIdx, currentIdx);
            const end = Math.max(lastIdx, currentIdx);
            for (let i = start; i <= end; i++) {
              next.add(orderedTaskIds[i]);
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
    [orderedTaskIds]
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

  const toggleExpanded = (taskId: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const openSheet = (task: TemplateTaskWithSubtasks) => {
    setSelectedTask(task);
    setSheetOpen(true);
  };

  const handleOpenSubtask = (sub: TemplateTaskWithSubtasks) => {
    setSelectedTask(sub);
  };

  const handleOpenParentTask = (parentId: string) => {
    const parent = template.tasks.find((t) => t.id === parentId);
    if (parent) setSelectedTask(parent);
  };

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

  const formatDueDays = (days: number | null) => {
    if (days == null) return null;
    if (days > 0) return `+${days}d`;
    if (days === 0) return '0d';
    return `${days}d`;
  };

  const getStatusDisplay = (statusId: string | null) => {
    if (!statusId) return null;
    return sortedStatusOptions.find((s) => s.id === statusId) ?? null;
  };

  const getSectionLabel = (sectionId: string | null) => {
    if (!sectionId) return null;
    return template.sectionOptions.find((s) => s.id === sectionId)?.label ?? null;
  };

  const handleRowClick = (e: React.MouseEvent, task: TemplateTaskWithSubtasks) => {
    if (e.shiftKey || isMultiSelectMode) {
      e.preventDefault();
      handleTaskMultiSelect(task.id, e.shiftKey);
    } else {
      openSheet(task);
    }
  };

  return (
    <>
      <div className="p-4 space-y-3">
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => setQuickAddOpen(true)}
            disabled={addTask.isPending}
          >
            <Plus className="mr-1 size-4" />
            New Task
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[700px] table-fixed">
            <colgroup>
              <col />
              <col style={{ width: 140 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 48 }} />
            </colgroup>
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left text-sm font-medium text-muted-foreground min-w-[200px] w-full">
                  Task
                </th>
                <th className="px-3 py-2 text-left text-sm font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-sm font-medium text-muted-foreground">
                  Section
                </th>
                <th className="px-3 py-2 text-left text-sm font-medium text-muted-foreground">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>Due Date</span>
                    </TooltipTrigger>
                    <TooltipContent>Relative</TooltipContent>
                  </Tooltip>
                </th>
                <th className="px-3 py-2 text-left text-sm font-medium text-muted-foreground">
                  Recurring
                </th>
                <th className="w-12 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {template.tasks.map((task) => {
                const status = getStatusDisplay(task.status);
                const section = getSectionLabel(task.section);
                const isSelected = selectedTaskIds.has(task.id);

                return (
                  <React.Fragment key={task.id}>
                    {/* Parent row */}
                    <tr
                      className={cn(
                        'group hover:bg-muted/30 cursor-pointer',
                        isSelected && 'bg-primary/5'
                      )}
                      onClick={(e) => handleRowClick(e, task)}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {task.subtasks.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpanded(task.id);
                              }}
                              className="shrink-0 text-muted-foreground hover:text-foreground"
                            >
                              {expandedParents.has(task.id) ? (
                                <ChevronDown className="size-3.5" />
                              ) : (
                                <ChevronRight className="size-3.5" />
                              )}
                            </button>
                          )}
                          <span className="text-sm truncate">{task.title}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {status && (
                          <span className="flex items-center gap-1.5 text-xs">
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: status.color }}
                            />
                            <span className="truncate text-muted-foreground">{status.label}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {section && (
                          <span className="text-xs text-muted-foreground truncate block">
                            {section}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {task.relativeDueDays != null && (
                          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                            <Calendar className="size-3" />
                            {formatDueDays(task.relativeDueDays)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {task.recurringConfig && (
                          <Check className="size-4 text-muted-foreground" />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div
                          className="opacity-0 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <MoreHorizontal className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openSheet(task)}>
                                Open details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => deleteTask.mutate(task.id)}
                              >
                                Delete task
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded subtask rows */}
                    {expandedParents.has(task.id) &&
                      task.subtasks.map((sub) => {
                        const subStatus = getStatusDisplay(sub.status);
                        const subSection = getSectionLabel(sub.section);

                        return (
                          <tr
                            key={sub.id}
                            className="group hover:bg-muted/30 bg-muted/10 cursor-pointer"
                            onClick={() => openSheet(sub)}
                          >
                            <td className="px-3 py-2 pl-10">
                              <div className="flex items-center gap-2 min-w-0">
                                <CornerDownRight className="size-3 shrink-0 text-muted-foreground" />
                                <span className="text-sm truncate">{sub.title}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              {subStatus && (
                                <span className="flex items-center gap-1.5 text-xs">
                                  <span
                                    className="size-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: subStatus.color }}
                                  />
                                  <span className="truncate text-muted-foreground">{subStatus.label}</span>
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {subSection && (
                                <span className="text-xs text-muted-foreground truncate block">
                                  {subSection}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {sub.relativeDueDays != null && (
                                <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                                  <Calendar className="size-3" />
                                  {formatDueDays(sub.relativeDueDays)}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2" />
                            <td className="px-3 py-2">
                              <div
                                className="opacity-0 group-hover:opacity-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                      <MoreHorizontal className="size-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openSheet(sub)}>
                                      Open details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => deleteTask.mutate(sub.id)}
                                    >
                                      Delete subtask
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })}

              {template.tasks.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-sm text-muted-foreground"
                  >
                    No tasks found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
        defaultStatus={null}
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
