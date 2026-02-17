'use client';

import * as React from 'react';
import { ListTree, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubtaskIndicatorProps {
  subtaskCount: number;
  subtaskCompletedCount: number;
  isExpanded?: boolean;
  onToggle?: (e: React.MouseEvent) => void;
}

export function SubtaskIndicator({
  subtaskCount,
  subtaskCompletedCount,
  isExpanded,
  onToggle,
}: SubtaskIndicatorProps) {
  if (subtaskCount === 0) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle?.(e);
      }}
      className={cn(
        'flex items-center gap-1 text-xs text-muted-foreground',
        onToggle && 'hover:text-foreground transition-colors'
      )}
    >
      {onToggle ? (
        isExpanded ? (
          <ChevronDown className="size-3" />
        ) : (
          <ChevronRight className="size-3" />
        )
      ) : (
        <ListTree className="size-3" />
      )}
      <span>
        {subtaskCompletedCount}/{subtaskCount}
      </span>
    </button>
  );
}
