'use client';

import { LayoutTemplate, ListChecks, ListTree, Columns3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { TemplateSummary } from '@/lib/actions/templates';
import { cn } from '@/lib/utils';

interface TemplateCardProps {
  template: TemplateSummary;
  onClick?: () => void;
}

export function TemplateCard({ template, onClick }: TemplateCardProps) {
  const isBoardTemplate = template.type === 'board_template';
  const initials = template.createdBy?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card
      className="h-full cursor-pointer transition-colors hover:border-primary/50"
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
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
        <div>
          <h3 className="font-semibold text-sm line-clamp-1">{template.name}</h3>
          {template.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {template.description}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <ListTree className="size-3.5" />
            {template.taskCount} {template.taskCount === 1 ? 'task' : 'tasks'}
          </span>
          {isBoardTemplate && (
            <>
              <span className="flex items-center gap-1">
                <Columns3 className="size-3.5" />
                {template.statusCount} {template.statusCount === 1 ? 'status' : 'statuses'}
              </span>
            </>
          )}
        </div>

        {/* Creator + date */}
        <div className="flex items-center justify-between pt-1 border-t">
          {template.createdBy ? (
            <div className="flex items-center gap-1.5">
              <Avatar className="size-5">
                {template.createdBy.avatarUrl && (
                  <AvatarImage src={template.createdBy.avatarUrl} />
                )}
                <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                {template.createdBy.name}
              </span>
            </div>
          ) : (
            <div />
          )}
          <span className="text-xs text-muted-foreground">
            {new Date(template.createdAt).toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
