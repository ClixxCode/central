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
} from '@/lib/hooks';
import type { TemplateDetail, TemplateTaskWithSubtasks } from '@/lib/actions/templates';
import { TemplateTaskSheet } from './TemplateTaskSheet';

interface TemplateTableEditorProps {
  templateId: string;
  template: TemplateDetail;
}

export function TemplateTableEditor({ templateId, template }: TemplateTableEditorProps) {
  const addTask = useAddTemplateTask(templateId);
  const deleteTask = useDeleteTemplateTask(templateId);

  const [expandedParents, setExpandedParents] = React.useState<Set<string>>(new Set());

  // Sheet state
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [selectedTask, setSelectedTask] = React.useState<TemplateTaskWithSubtasks | null>(null);

  const toggleExpanded = (taskId: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const handleNewTask = () => {
    addTask.mutate(
      { title: 'New task', relativeDueDays: null },
      {
        onSuccess: (result) => {
          if (result?.id) {
            setSelectedTask({
              id: result.id,
              templateId,
              title: 'New task',
              description: null,
              status: null,
              section: null,
              relativeDueDays: null,
              recurringConfig: null,
              position: 0,
              parentTemplateTaskId: null,
              subtasks: [],
            });
            setSheetOpen(true);
          }
        },
      }
    );
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
    // Check top-level tasks
    for (const t of template.tasks) {
      if (t.id === selectedTask.id) return t;
      for (const sub of t.subtasks) {
        if (sub.id === selectedTask.id) return sub;
      }
    }
    return null;
  }, [template.tasks, selectedTask?.id]);

  const formatDueDays = (days: number | null) => {
    if (days == null) return null;
    if (days > 0) return `+${days}d`;
    if (days === 0) return '0d';
    return `${days}d`;
  };

  return (
    <>
      <div className="p-4 space-y-3">
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleNewTask}
            disabled={addTask.isPending}
          >
            <Plus className="mr-1 size-4" />
            New Task
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[500px] table-fixed">
            <colgroup>
              <col />
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
              {template.tasks.map((task) => (
                <React.Fragment key={task.id}>
                  {/* Parent row */}
                  <tr
                    className="group hover:bg-muted/30 cursor-pointer"
                    onClick={() => openSheet(task)}
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
                    task.subtasks.map((sub) => (
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
                    ))}
                </React.Fragment>
              ))}

              {template.tasks.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
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
