'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Kanban, LayoutList, LayoutTemplate, ListChecks, Plus, Settings, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTemplate, useUpdateTemplate, useDeleteTemplate } from '@/lib/hooks';
import { TemplateKanbanEditor } from '@/components/templates/TemplateKanbanEditor';
import { TemplateBoardTableEditor } from '@/components/templates/TemplateBoardTableEditor';
import { TemplateTableEditor } from '@/components/templates/TemplateTableEditor';
import { ApplyTemplateTasksDialog } from '@/components/templates/ApplyTemplateTasksDialog';
import { cn } from '@/lib/utils';

interface TemplateEditorClientProps {
  templateId: string;
  isAdmin: boolean;
}

export function TemplateEditorClient({ templateId, isAdmin }: TemplateEditorClientProps) {
  const router = useRouter();
  const { data: template, isLoading } = useTemplate(templateId);
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const [name, setName] = React.useState('');
  const [editingName, setEditingName] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'kanban' | 'table'>('kanban');
  const [applyTasksOpen, setApplyTasksOpen] = React.useState(false);

  React.useEffect(() => {
    if (template) {
      setName(template.name);
    }
  }, [template]);

  const handleSaveName = () => {
    setEditingName(false);
    if (!name.trim() || name.trim() === template?.name) {
      setName(template?.name ?? '');
      return;
    }
    updateTemplate.mutate({
      id: templateId,
      name: name.trim(),
    });
  };

  const handleDelete = () => {
    deleteTemplate.mutate(templateId, {
      onSuccess: () => router.push('/templates'),
    });
  };

  const isBoardTemplate = template?.type === 'board_template';

  if (isLoading || !template) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="border-b px-6 py-4">
        <div className="flex items-start gap-4">
          <Link href="/templates">
            <Button variant="ghost" size="icon" className="mt-0.5 shrink-0">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div className="flex-1 space-y-1">
            <span className={cn(
              'flex items-center gap-1 text-xs',
              isBoardTemplate ? 'text-blue-600' : 'text-green-600'
            )}>
              {isBoardTemplate ? (
                <LayoutTemplate className="size-3" />
              ) : (
                <ListChecks className="size-3" />
              )}
              {isBoardTemplate ? 'Board Template' : 'Task List'}
            </span>
            {editingName ? (
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') {
                    setName(template.name);
                    setEditingName(false);
                  }
                }}
                className="h-8 max-w-sm text-lg font-semibold"
                placeholder="Template name"
                autoFocus
              />
            ) : (
              <h1
                className="text-lg font-semibold cursor-pointer rounded px-1 -ml-1 hover:bg-muted/50"
                onClick={() => setEditingName(true)}
              >
                {template.name}
              </h1>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setApplyTasksOpen(true)}>
              <Plus className="mr-1.5 size-3.5" />
              Add Tasks to Board
            </Button>
            {isBoardTemplate && (
              <div className="inline-flex rounded-md border bg-muted p-0.5">
                <Button
                  variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn('h-7 gap-1.5 px-2', viewMode === 'kanban' && 'bg-background shadow-sm')}
                  onClick={() => setViewMode('kanban')}
                >
                  <Kanban className="size-4" />
                  <span className="hidden sm:inline">Kanban</span>
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn('h-7 gap-1.5 px-2', viewMode === 'table' && 'bg-background shadow-sm')}
                  onClick={() => setViewMode('table')}
                >
                  <LayoutList className="size-4" />
                  <span className="hidden sm:inline">Table</span>
                </Button>
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete template
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Editor */}
      <div className="flex-1 overflow-auto">
        {isBoardTemplate ? (
          viewMode === 'kanban' ? (
            <TemplateKanbanEditor
              templateId={templateId}
              template={template}
            />
          ) : (
            <TemplateBoardTableEditor
              templateId={templateId}
              template={template}
            />
          )
        ) : (
          <TemplateTableEditor
            templateId={templateId}
            template={template}
          />
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{template.name}</strong>? This will
              delete all tasks in this template. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteTemplate.isPending}
              className="bg-destructive hover:bg-destructive/90 focus:ring-destructive"
            >
              {deleteTemplate.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
            <AlertDialogCancel disabled={deleteTemplate.isPending}>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Apply tasks to existing board */}
      <ApplyTemplateTasksDialog
        open={applyTasksOpen}
        onOpenChange={setApplyTasksOpen}
        template={template}
      />
    </div>
  );
}
