'use client';

import * as React from 'react';
import { ListTree } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubtaskIndicatorProps {
  subtaskCount: number;
  subtaskCompletedCount: number;
  className?: string;
  isExpanded?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onToggle?: (e: React.MouseEvent) => void;
}

export function SubtaskIndicator({
  subtaskCount,
  subtaskCompletedCount,
  className,
  onClick,
  onToggle,
}: SubtaskIndicatorProps) {
  if (subtaskCount === 0) return null;

  const handleClick = onClick ?? onToggle;
  const label = `${subtaskCompletedCount}/${subtaskCount} subtasks`;
  const sharedClassName = cn(
    'inline-flex items-center gap-1 text-xs text-muted-foreground',
    handleClick && 'hover:text-foreground transition-colors',
    className
  );

  if (!handleClick) {
    return (
      <span className={sharedClassName} aria-label={label}>
        <ListTree className="size-3" />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        handleClick(e);
      }}
      className={sharedClassName}
      aria-label={`Open ${label}`}
    >
      <ListTree className="size-3" />
      <span>{label}</span>
    </button>
  );
}
