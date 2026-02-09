'use client';

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

interface SortableTaskProps {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export function SortableTask({ id, children, disabled = false }: SortableTaskProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
    active,
  } = useSortable({
    id,
    disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 50 : 'auto',
  };

  // Show drop indicator when another task is being dragged over this one
  const showDropIndicator = isOver && active?.id !== id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'touch-none relative',
        isDragging && 'cursor-grabbing',
        !isDragging && !disabled && 'cursor-grab'
      )}
      {...attributes}
      {...listeners}
    >
      {/* Drop indicator line */}
      {showDropIndicator && (
        <div className="absolute -top-1 left-0 right-0 h-0.5 bg-primary rounded-full z-10" />
      )}
      {children}
    </div>
  );
}

interface SortableTableRowProps {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export function SortableTableRow({
  id,
  children,
  disabled = false,
  className,
}: SortableTableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
    active,
  } = useSortable({
    id,
    disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const showDropIndicator = isOver && active?.id !== id;

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        'touch-none relative',
        isDragging && 'opacity-40 bg-muted',
        showDropIndicator && 'border-t-2 border-t-primary',
        className
      )}
      {...attributes}
      {...listeners}
    >
      {children}
    </tr>
  );
}
