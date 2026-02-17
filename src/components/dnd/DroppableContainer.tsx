'use client';

import * as React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';

interface DroppableContainerProps {
  id: string;
  children: React.ReactNode;
  items: string[];
  disabled?: boolean;
  className?: string;
  direction?: 'vertical' | 'horizontal';
}

export function DroppableContainer({
  id,
  children,
  items,
  disabled = false,
  className,
  direction = 'vertical',
}: DroppableContainerProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    disabled,
  });

  const strategy = direction === 'vertical'
    ? verticalListSortingStrategy
    : horizontalListSortingStrategy;

  return (
    <SortableContext items={items} strategy={strategy}>
      <div
        ref={setNodeRef}
        className={cn(
          'min-h-[100px] transition-colors duration-200',
          isOver && 'bg-primary/5 ring-2 ring-primary/20 ring-inset',
          className
        )}
      >
        {children}
      </div>
    </SortableContext>
  );
}
