'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Edit3, Kanban, LayoutList, Plus, Settings, Trash2 } from 'lucide-react';
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
import { useTopShellActions } from '@/components/layout/top-shell-actions';
import { useTopShellContextOverride } from '@/components/layout/top-shell-override';
import type { TopShellContext } from '@/components/layout/shell-context';
import { cn } from '@/lib/utils';

interface TemplateEditorClientProps {
  templateId: string;
}

export function TemplateEditorClient({ templateId }: TemplateEditorClientProps) {
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
  const actions = React.useMemo(
    () =>
      template ? (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setApplyTasksOpen(true)}
            aria-label="Add tasks"
            className="text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-4" />
          </Button>
          {template.type === 'board_template' && (
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
              <Button variant="ghost" size="icon-sm" aria-label="Template settings">
                <Settings className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditingName(true)}>
                <Edit3 className="mr-2 size-4" />
                Rename template
              </DropdownMenuItem>
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
      ) : null,
    [template, viewMode]
  );

  const shellContext = React.useMemo<TopShellContext | null>(() => {
    if (!template) return null;

    const templateHref = `/templates/${templateId}`;
    const editHref = `${templateHref}/edit`;
    const templateTypeLabel = template.type === 'board_template' ? 'Board Template' : 'Task List';
    const crumbs = [
      { label: 'Central', href: '/my-tasks' },
      { label: 'Templates', href: '/templates' },
      { label: template.name, href: templateHref },
      { label: 'Edit', href: editHref },
    ];

    return {
      section: 'templates',
      activeNavItem: 'templates',
      title: template.name,
      subtitle: templateTypeLabel,
      crumbs,
      breadcrumbs: crumbs,
      actionsSlot: 'board',
      route: {
        pathname: editHref,
        segments: ['templates', templateId, 'edit'],
        templateId,
      },
      template: {
        id: templateId,
        name: template.name,
        href: templateHref,
      },
      isAdminRoute: false,
    };
  }, [template, templateId]);

  useTopShellContextOverride(shellContext);
  useTopShellActions(actions);

  if (isLoading || !template) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {editingName && (
        <div className="mb-4 max-w-sm">
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
            className="h-8 text-sm font-medium"
            placeholder="Template name"
            autoFocus
          />
        </div>
      )}

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
