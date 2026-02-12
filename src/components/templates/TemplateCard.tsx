'use client';

import { LayoutTemplate, ListChecks, ListTree } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { TemplateSummary } from '@/lib/actions/templates';
import { cn } from '@/lib/utils';

interface TemplateCardProps {
  template: TemplateSummary;
  onClick?: () => void;
}

export function TemplateCard({ template, onClick }: TemplateCardProps) {
  const isBoardTemplate = template.type === 'board_template';

  return (
    <Card
      className="h-full py-2 cursor-pointer transition-colors hover:border-primary/50"
      onClick={onClick}
    >
      <CardContent className="p-4 flex flex-col h-full">
        {/* Type badge + icon */}
        <div className="flex items-start justify-between">
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

        {/* Name + description */}
        <div className="mt-4">
          <h3 className="font-semibold text-sm line-clamp-1">{template.name}</h3>
          {template.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {template.description}
            </p>
          )}
        </div>

        {/* Task count + date pushed to bottom */}
        <div className="mt-8 pt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <ListTree className="size-3.5" />
            {template.taskCount} {template.taskCount === 1 ? 'task' : 'tasks'}
          </span>
          <span>
            {new Date(template.createdAt).toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
