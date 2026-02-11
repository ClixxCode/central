'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, LayoutTemplate, ListChecks, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTemplates } from '@/lib/hooks';
import { TemplateCard } from '@/components/templates/TemplateCard';
import { CreateTemplateDialog } from '@/components/templates/CreateTemplateDialog';
import { CreateTaskListDialog } from '@/components/templates/CreateTaskListDialog';
import { cn } from '@/lib/utils';

interface TemplatesPageClientProps {
  isAdmin: boolean;
}

type FilterTab = 'all' | 'board_template' | 'task_list';

export function TemplatesPageClient({ isAdmin }: TemplatesPageClientProps) {
  const router = useRouter();
  const [filterTab, setFilterTab] = React.useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [createTemplateOpen, setCreateTemplateOpen] = React.useState(false);
  const [createTaskListOpen, setCreateTaskListOpen] = React.useState(false);

  const typeFilter = filterTab === 'all' ? undefined : filterTab;
  const { data: templates = [], isLoading } = useTemplates(typeFilter);

  const filteredTemplates = React.useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const q = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
    );
  }, [templates, searchQuery]);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'board_template', label: 'Board Templates' },
    { key: 'task_list', label: 'Task Lists' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Templates</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage reusable board templates and task lists
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              New Template
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setCreateTemplateOpen(true)}>
              <LayoutTemplate className="mr-2 size-4" />
              Board Template
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCreateTaskListOpen(true)}>
              <ListChecks className="mr-2 size-4" />
              Task List
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center gap-4">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                filterTab === tab.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-40 animate-pulse bg-muted/50" />
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <LayoutTemplate className="size-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">
              {searchQuery ? 'No templates found' : 'No templates yet'}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
              {searchQuery
                ? 'Try a different search term'
                : 'Create a board template to save board configurations, or a task list to quickly add tasks to any board.'}
            </p>
            {!searchQuery && (
              <div className="mt-6 flex gap-2">
                <Button variant="outline" onClick={() => setCreateTemplateOpen(true)}>
                  <LayoutTemplate className="mr-2 size-4" />
                  Board Template
                </Button>
                <Button variant="outline" onClick={() => setCreateTaskListOpen(true)}>
                  <ListChecks className="mr-2 size-4" />
                  Task List
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onClick={() => router.push(`/templates/${template.id}/edit`)}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <CreateTemplateDialog
        open={createTemplateOpen}
        onOpenChange={setCreateTemplateOpen}
      />
      <CreateTaskListDialog
        open={createTaskListOpen}
        onOpenChange={setCreateTaskListOpen}
      />
    </div>
  );
}
