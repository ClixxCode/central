'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, LayoutTemplate, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTemplate, useUpdateTemplate } from '@/lib/hooks';
import { TemplateKanbanEditor } from '@/components/templates/TemplateKanbanEditor';
import { TemplateTableEditor } from '@/components/templates/TemplateTableEditor';
import { cn } from '@/lib/utils';

interface TemplateEditorClientProps {
  templateId: string;
  isAdmin: boolean;
}

export function TemplateEditorClient({ templateId, isAdmin }: TemplateEditorClientProps) {
  const { data: template, isLoading } = useTemplate(templateId);
  const updateTemplate = useUpdateTemplate();

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [hasChanges, setHasChanges] = React.useState(false);

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
        </div>
      </header>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
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
    </div>
  );
}
