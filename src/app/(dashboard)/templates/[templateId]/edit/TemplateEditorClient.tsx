'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LayoutTemplate, ListChecks, Plus, Settings, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { TemplateTableEditor } from '@/components/templates/TemplateTableEditor';
import { CreateBoardFromTemplateDialog } from '@/components/templates/CreateBoardFromTemplateDialog';
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
  const [description, setDescription] = React.useState('');
  const [hasChanges, setHasChanges] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [createBoardOpen, setCreateBoardOpen] = React.useState(false);
  const [applyTasksOpen, setApplyTasksOpen] = React.useState(false);

  React.useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description ?? '');
      setHasChanges(false);
    }
  }, [template]);

  const handleSaveDetails = () => {
    if (!name.trim()) return;
    updateTemplate.mutate(
      {
        id: templateId,
        name: name.trim(),
        description: description.trim() || null,
      },
      { onSuccess: () => setHasChanges(false) }
    );
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
          <div className="flex-1 space-y-3">
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
            <div className="flex items-center gap-3">
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setHasChanges(true);
                }}
                className="h-9 max-w-sm text-lg font-semibold"
                placeholder="Template name"
              />
              <Input
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setHasChanges(true);
                }}
                className="h-9 max-w-sm text-sm"
                placeholder="Description (optional)"
              />
              {hasChanges && (
                <Button
                  size="sm"
                  onClick={handleSaveDetails}
                  disabled={!name.trim() || updateTemplate.isPending}
                >
                  {updateTemplate.isPending ? 'Saving...' : 'Save'}
                </Button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {isBoardTemplate && isAdmin && (
              <Button variant="outline" size="sm" onClick={() => setCreateBoardOpen(true)}>
                <Plus className="mr-1.5 size-3.5" />
                Create Board
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setApplyTasksOpen(true)}>
              <Plus className="mr-1.5 size-3.5" />
              Add Tasks to Board
            </Button>
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
          <TemplateKanbanEditor
            templateId={templateId}
            template={template}
          />
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

      {/* Create board from template */}
      {isBoardTemplate && (
        <CreateBoardFromTemplateDialog
          open={createBoardOpen}
          onOpenChange={setCreateBoardOpen}
          templateId={templateId}
          templateName={template.name}
        />
      )}

      {/* Apply tasks to existing board */}
      <ApplyTemplateTasksDialog
        open={applyTasksOpen}
        onOpenChange={setApplyTasksOpen}
        template={template}
      />
    </div>
  );
}
