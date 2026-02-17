import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndProvider } from '@/components/dnd/DndProvider';
import { SortableTask } from '@/components/dnd/SortableTask';
import { DroppableContainer } from '@/components/dnd/DroppableContainer';

// Mock @dnd-kit modules
vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@dnd-kit/core');
  return {
    ...actual,
    DndContext: ({ children }: { children: React.ReactNode }) => <div data-testid="dnd-context">{children}</div>,
    DragOverlay: ({ children }: { children: React.ReactNode }) => <div data-testid="drag-overlay">{children}</div>,
    useDroppable: () => ({
      setNodeRef: vi.fn(),
      isOver: false,
    }),
    useSensor: vi.fn(),
    useSensors: vi.fn().mockReturnValue([]),
    PointerSensor: class {},
    TouchSensor: class {},
    KeyboardSensor: class {},
    closestCenter: vi.fn(),
    pointerWithin: vi.fn(),
    rectIntersection: vi.fn(),
    MeasuringStrategy: { Always: 'always' },
  };
});

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div data-testid="sortable-context">{children}</div>,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
    isOver: false,
    active: null,
  }),
  verticalListSortingStrategy: {},
  horizontalListSortingStrategy: {},
  sortableKeyboardCoordinates: vi.fn(),
}));

describe('DndProvider', () => {
  it('renders children within DndContext', () => {
    render(
      <DndProvider>
        <div data-testid="child">Child content</div>
      </DndProvider>
    );

    expect(screen.getByTestId('dnd-context')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders drag overlay', () => {
    render(
      <DndProvider renderOverlay={() => <div data-testid="overlay-content">Overlay</div>}>
        <div>Content</div>
      </DndProvider>
    );

    expect(screen.getByTestId('drag-overlay')).toBeInTheDocument();
  });
});

describe('SortableTask', () => {
  it('renders children', () => {
    render(
      <DndProvider>
        <SortableTask id="task-1">
          <div data-testid="task-content">Task Content</div>
        </SortableTask>
      </DndProvider>
    );

    expect(screen.getByTestId('task-content')).toBeInTheDocument();
  });

  it('applies touch-none class', () => {
    const { container } = render(
      <DndProvider>
        <SortableTask id="task-1">
          <div>Task Content</div>
        </SortableTask>
      </DndProvider>
    );

    const sortableDiv = container.querySelector('.touch-none');
    expect(sortableDiv).toBeInTheDocument();
  });
});

describe('DroppableContainer', () => {
  it('renders children within SortableContext', () => {
    render(
      <DndProvider>
        <DroppableContainer id="container-1" items={['item-1', 'item-2']}>
          <div data-testid="container-content">Content</div>
        </DroppableContainer>
      </DndProvider>
    );

    expect(screen.getByTestId('sortable-context')).toBeInTheDocument();
    expect(screen.getByTestId('container-content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <DndProvider>
        <DroppableContainer
          id="container-1"
          items={[]}
          className="custom-class"
        >
          <div>Content</div>
        </DroppableContainer>
      </DndProvider>
    );

    const droppableDiv = container.querySelector('.custom-class');
    expect(droppableDiv).toBeInTheDocument();
  });

  it('has minimum height', () => {
    const { container } = render(
      <DndProvider>
        <DroppableContainer id="container-1" items={[]}>
          <div>Content</div>
        </DroppableContainer>
      </DndProvider>
    );

    const droppableDiv = container.querySelector('.min-h-\\[100px\\]');
    expect(droppableDiv).toBeInTheDocument();
  });
});
