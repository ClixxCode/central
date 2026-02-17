'use client';

import * as React from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  MeasuringStrategy,
  UniqueIdentifier,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  CollisionDetection,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

interface DndState {
  activeId: UniqueIdentifier | null;
  overId: UniqueIdentifier | null;
}

interface DndContextValue extends DndState {
  setActiveId: (id: UniqueIdentifier | null) => void;
}

const DndStateContext = React.createContext<DndContextValue | null>(null);

export function useDndState() {
  const context = React.useContext(DndStateContext);
  if (!context) {
    throw new Error('useDndState must be used within a DndProvider');
  }
  return context;
}

interface DndProviderProps {
  children: React.ReactNode;
  onDragStart?: (event: DragStartEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  renderOverlay?: (activeId: UniqueIdentifier | null) => React.ReactNode;
}

// Custom collision detection that prefers dropping on items over containers
const collisionDetectionStrategy: CollisionDetection = (args) => {
  // First, try to find any droppable intersecting with the pointer
  const pointerCollisions = pointerWithin(args);

  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }

  // Fall back to rectangle intersection
  const rectCollisions = rectIntersection(args);

  if (rectCollisions.length > 0) {
    return rectCollisions;
  }

  // Finally, use closest center
  return closestCenter(args);
};

export function DndProvider({
  children,
  onDragStart,
  onDragOver,
  onDragEnd,
  renderOverlay,
}: DndProviderProps) {
  const [dndState, setDndState] = React.useState<DndState>({
    activeId: null,
    overId: null,
  });

  // Configure sensors for mouse, touch, and keyboard support
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // Require movement before starting drag (prevents accidental drags)
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        // Delay before starting drag on touch devices
        delay: 200,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = React.useCallback(
    (event: DragStartEvent) => {
      setDndState((prev) => ({ ...prev, activeId: event.active.id }));

      // Add dragging class to body for global styling
      document.body.classList.add('is-dragging');

      onDragStart?.(event);
    },
    [onDragStart]
  );

  const handleDragOver = React.useCallback(
    (event: DragOverEvent) => {
      setDndState((prev) => ({ ...prev, overId: event.over?.id ?? null }));
      onDragOver?.(event);
    },
    [onDragOver]
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      setDndState({ activeId: null, overId: null });

      // Remove dragging class from body
      document.body.classList.remove('is-dragging');

      onDragEnd?.(event);
    },
    [onDragEnd]
  );

  const handleDragCancel = React.useCallback(() => {
    setDndState({ activeId: null, overId: null });
    document.body.classList.remove('is-dragging');
  }, []);

  const contextValue = React.useMemo<DndContextValue>(
    () => ({
      ...dndState,
      setActiveId: (id) => setDndState((prev) => ({ ...prev, activeId: id })),
    }),
    [dndState]
  );

  return (
    <DndStateContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetectionStrategy}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        measuring={{
          droppable: {
            strategy: MeasuringStrategy.Always,
          },
        }}
        autoScroll={{
          enabled: true,
          threshold: {
            x: 0.2,
            y: 0.2,
          },
          acceleration: 15,
          interval: 10,
        }}
      >
        {children}
        <DragOverlay
          dropAnimation={{
            duration: 200,
            easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
          }}
          zIndex={1000}
        >
          {renderOverlay?.(dndState.activeId)}
        </DragOverlay>
      </DndContext>
    </DndStateContext.Provider>
  );
}

export type { DragStartEvent, DragEndEvent, DragOverEvent, UniqueIdentifier };
