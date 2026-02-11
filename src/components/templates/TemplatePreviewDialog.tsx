'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutTemplate,
  ListChecks,
  ChevronRight,
  Calendar,
  Pencil,
  Trash2,
  Plus as PlusIcon,
  ListTree,
} from 'lucide-react';
import { useTemplate, useDeleteTemplate } from '@/lib/hooks';
import type { TemplateTaskWithSubtasks } from '@/lib/actions/templates';
import { CreateBoardFromTemplateDialog } from './CreateBoardFromTemplateDialog';
import { ApplyTemplateTasksDialog } from './ApplyTemplateTasksDialog';
import { cn } from '@/lib/utils';

interface TemplatePreviewDialogProps {
  templateId: string;
  isAdmin: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplatePreviewDialog({
  templateId,
  isAdmin,
  open,
  onOpenChange,
}: TemplatePreviewDialogProps) {
  const router = useRouter();
  const { data: template, isLoading } = useTemplate(templateId, { enabled: open });
  const deleteTemplate = useDeleteTemplate();

  const [createBoardOpen, setCreateBoardOpen] = React.useState(false);
  const [applyTasksOpen, setApplyTasksOpen] = React.useState(false);

  const isBoardTemplate = template?.type === 'board_template';

  const handleDelete = () => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    deleteTemplate.mutate(templateId, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          {isLoading || !template ? (
            <div className="space-y-4 py-4">
              <DialogHeader>
                <DialogTitle className="sr-only">Loading template</DialogTitle>
              </DialogHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-xs',
                      isBoardTemplate
                        ? 'bg-blue-500/10 text-blue-600'
                        : 'bg-green-500/10 text-green-600'
                    )}
                  >
                    {isBoardTemplate ? (
                      <LayoutTemplate className="mr-1 size-3" />
                    ) : (
                      <ListChecks className="mr-1 size-3" />
                    )}
                    {isBoardTemplate ? 'Board Template' : 'Task List'}
                  </Badge>
                </div>
                <DialogTitle className="text-xl">{template.name}</DialogTitle>
                {template.description && (
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                )}
              </DialogHeader>

              <div className="space-y-4">
                {/* Status badges */}
                {isBoardTemplate && template.statusOptions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Statuses</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {template.statusOptions
                        .sort((a, b) => a.position - b.position)
                        .map((status) => (
                          <Badge
                            key={status.id}
                            variant="secondary"
                            className="border-0 font-medium text-xs"
                            style={{
                              backgroundColor: `${status.color}20`,
                              color: status.color,
                            }}
                          >
                            <span
                              className="size-2 rounded-full mr-1"
                              style={{ backgroundColor: status.color }}
                            />
                            {status.label}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}

                {/* Section badges */}
                {isBoardTemplate && template.sectionOptions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Sections</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {template.sectionOptions
                        .sort((a, b) => a.position - b.position)
                        .map((section) => (
                          <Badge
                            key={section.id}
                            variant="secondary"
                            className="border-0 font-medium text-xs"
                            style={{
                              backgroundColor: `${section.color}20`,
                              color: section.color,
                            }}
                          >
                            {section.label}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}

                {/* Task tree */}
                {template.tasks.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-1.5">
                      <ListTree className="size-4" />
                      Tasks ({template.tasks.length})
                    </h4>
                    <ScrollArea className="max-h-64">
                      <div className="space-y-1">
                        {template.tasks.map((task) => (
                          <TaskTreeItem
                            key={task.id}
                            task={task}
                            statusOptions={template.statusOptions}
                            isBoardTemplate={isBoardTemplate}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {template.tasks.length === 0 && (
                  <p className="text-sm text-muted-foreground italic py-2">
                    No tasks in this template yet. Click Edit to add tasks.
                  </p>
                )}
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      router.push(`/templates/${templateId}/edit`);
                    }}
                  >
                    <Pencil className="mr-1.5 size-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleteTemplate.isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-1.5 size-3.5" />
                    Delete
                  </Button>
                </div>
                <div className="flex gap-2 sm:ml-auto">
                  {isBoardTemplate && isAdmin && (
                    <Button variant="outline" size="sm" onClick={() => setCreateBoardOpen(true)}>
                      <PlusIcon className="mr-1.5 size-3.5" />
                      Create Board
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setApplyTasksOpen(true)}>
                    <PlusIcon className="mr-1.5 size-3.5" />
                    Add Tasks to Board
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Sub-dialogs */}
      {template && isBoardTemplate && (
        <CreateBoardFromTemplateDialog
          open={createBoardOpen}
          onOpenChange={setCreateBoardOpen}
          templateId={template.id}
          templateName={template.name}
        />
      )}
      {template && (
        <ApplyTemplateTasksDialog
          open={applyTasksOpen}
          onOpenChange={setApplyTasksOpen}
          template={template}
        />
      )}
    </>
  );
}

function TaskTreeItem({
  task,
  statusOptions,
  isBoardTemplate,
  isSubtask = false,
}: {
  task: TemplateTaskWithSubtasks;
  statusOptions: { id: string; label: string; color: string }[];
  isBoardTemplate: boolean;
  isSubtask?: boolean;
}) {
  const status = statusOptions.find((s) => s.id === task.status);

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
          isSubtask && 'ml-6'
        )}
      >
        {isBoardTemplate && status && (
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: status.color }}
          />
        )}
        {!isBoardTemplate && <ChevronRight className="size-3 shrink-0 text-muted-foreground" />}
        <span className="flex-1 truncate">{task.title}</span>
        {task.relativeDueDays != null && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <Calendar className="size-3" />
            {task.relativeDueDays > 0 ? `+${task.relativeDueDays}d` : task.relativeDueDays === 0 ? 'same day' : `${task.relativeDueDays}d`}
          </span>
        )}
      </div>
      {task.subtasks?.map((sub) => (
        <TaskTreeItem
          key={sub.id}
          task={sub}
          statusOptions={statusOptions}
          isBoardTemplate={isBoardTemplate}
          isSubtask
        />
      ))}
    </div>
  );
}
