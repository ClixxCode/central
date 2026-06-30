'use client';

import * as React from 'react';
import { Calendar, FolderKanban, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SortableTask } from '@/components/dnd';
import { DateDisplay } from './DatePicker';
import type { ProjectBoardItem } from '@/lib/actions/tasks';
import type { SectionOption } from '@/lib/db/schema';

interface ProjectCardProps {
  project: ProjectBoardItem;
  sectionOptions: SectionOption[];
  onClick?: (e: React.MouseEvent) => void;
  isOverlay?: boolean;
  hiddenItems?: Set<string>;
}

export function ProjectCard({
  project,
  sectionOptions,
  onClick,
  isOverlay,
  hiddenItems,
}: ProjectCardProps) {
  const section = sectionOptions.find((s) => s.id === project.section);
  const showSection = !hiddenItems?.has('section');
  const showDueDate = !hiddenItems?.has('dueDate');
  const completed = project.completedTaskCount;
  const total = project.taskCount;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const content = (
    <article
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`Project: ${project.title}`}
      className={cn(
        'rounded-lg border border-primary/25 bg-primary/[0.03] p-3 shadow-sm transition-all',
        'hover:border-primary/60 hover:bg-primary/[0.06] hover:shadow-md',
        onClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isOverlay && 'border-primary shadow-lg cursor-grabbing rotate-2'
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick(e as unknown as React.MouseEvent);
        }
      }}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <FolderKanban className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          {showSection && section && (
            <span
              className="mb-1 inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium"
              style={{ backgroundColor: `${section.color}20`, color: section.color }}
            >
              {section.label}
            </span>
          )}
          <p className="truncate text-sm font-semibold leading-tight" title={project.title}>
            {project.title}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {showDueDate && project.dueDate ? (
          <div className="flex min-w-0 items-center gap-1">
            <Calendar className="size-3 shrink-0" />
            <DateDisplay date={project.dueDate} flexibility="not_set" />
          </div>
        ) : (
          <div />
        )}
        <div className="flex shrink-0 items-center gap-1">
          <ListChecks className="size-3" />
          <span>{completed}/{total}</span>
        </div>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </article>
  );

  if (isOverlay) return content;

  return <SortableTask id={project.id}>{content}</SortableTask>;
}
