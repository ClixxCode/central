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
  onLongPress?: () => void;
}

export function SubtaskIndicator({
  subtaskCount,
  subtaskCompletedCount,
  className,
  onClick,
  onToggle,
  onLongPress,
}: SubtaskIndicatorProps) {
  const longPressTimerRef = React.useRef<number | null>(null);
  const longPressFiredRef = React.useRef(false);

  const clearLongPressTimer = React.useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => clearLongPressTimer, [clearLongPressTimer]);

  if (subtaskCount === 0) return null;

  const handleClick = onClick ?? onToggle;
  const isInteractive = handleClick || onLongPress;
  const label = `${subtaskCompletedCount}/${subtaskCount} subtasks`;
  const sharedClassName = cn(
    'inline-flex items-center gap-1 text-xs text-muted-foreground',
    isInteractive && 'hover:text-foreground transition-colors',
    className
  );

  if (!isInteractive) {
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
        if (longPressFiredRef.current) {
          e.preventDefault();
          longPressFiredRef.current = false;
          return;
        }
        handleClick?.(e);
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (!onLongPress) return;

        clearLongPressTimer();
        longPressFiredRef.current = false;
        longPressTimerRef.current = window.setTimeout(() => {
          longPressTimerRef.current = null;
          longPressFiredRef.current = true;
          onLongPress();
        }, 550);
      }}
      onPointerUp={clearLongPressTimer}
      onPointerLeave={clearLongPressTimer}
      onPointerCancel={clearLongPressTimer}
      onContextMenu={(e) => {
        if (!onLongPress) return;
        e.preventDefault();
      }}
      className={sharedClassName}
      aria-label={onLongPress ? `Open ${label}. Long press to show only these subtasks.` : `Open ${label}`}
    >
      <ListTree className="size-3" />
      <span>{label}</span>
    </button>
  );
}
