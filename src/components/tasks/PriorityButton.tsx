'use client';

import { Star, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PriorityButtonProps {
  priorityCount: number;
  isSelectionMode: boolean;
  isFilterActive: boolean;
  onEnterSelectionMode: () => void;
  onExitSelectionMode: () => void;
  onToggleFilter: () => void;
  onClear: () => void;
}

export function PriorityButton({
  priorityCount,
  isSelectionMode,
  isFilterActive,
  onEnterSelectionMode,
  onExitSelectionMode,
  onToggleFilter,
  onClear,
}: PriorityButtonProps) {
  // Selection mode → "Done" button
  if (isSelectionMode) {
    return (
      <Button
        size="sm"
        onClick={onExitSelectionMode}
        className="gap-1.5"
      >
        <Check className="size-4" />
        Done selecting
      </Button>
    );
  }

  // Has priorities → toggle filter + clear
  if (priorityCount > 0) {
    return (
      <div className="flex items-center gap-0.5">
        <Button
          variant={isFilterActive ? 'default' : 'outline'}
          size="sm"
          onClick={onToggleFilter}
          className={cn(
            'gap-1.5 rounded-r-none',
            isFilterActive && 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
          )}
        >
          <Star className={cn('size-3.5', isFilterActive && 'fill-current')} />
          Priority ({priorityCount})
        </Button>
        <Button
          variant={isFilterActive ? 'default' : 'outline'}
          size="sm"
          onClick={onClear}
          className={cn(
            'rounded-l-none border-l-0 px-1.5',
            isFilterActive && 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
          )}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    );
  }

  // No priorities → outline button to enter selection mode
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onEnterSelectionMode}
      className="gap-1.5"
    >
      <Star className="size-3.5" />
      Priority
    </Button>
  );
}
