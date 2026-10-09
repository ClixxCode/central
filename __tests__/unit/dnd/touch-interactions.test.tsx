import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import { DndProvider, useDndState } from '@/components/dnd/DndProvider';
import { DroppableContainer } from '@/components/dnd/DroppableContainer';
import { SortableTask } from '@/components/dnd/SortableTask';

// Use the real dnd-kit sensors: mocking them would hide touch/pointer conflicts.
function DragStatus() {
  const { activeId } = useDndState();
  return <output data-testid="active-task">{activeId ?? 'idle'}</output>;
}

function renderBoard() {
  const onDragStart = vi.fn();
  const onDragEnd = vi.fn();
  const onClick = vi.fn();
  render(
    <DndProvider onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <DroppableContainer id="column" items={['task-1']}>
        <SortableTask id="task-1">
          <button onClick={onClick}>Open task</button>
        </SortableTask>
      </DroppableContainer>
      <DragStatus />
    </DndProvider>
  );
  const card = screen.getByText('Open task').parentElement!;
  return { card, onDragStart, onDragEnd, onClick };
}

function touchStart(card: HTMLElement) {
  // Browsers send pointerdown before touchstart for the same finger.
  fireEvent.pointerDown(card, { pointerType: 'touch', isPrimary: true, button: 0, clientX: 40, clientY: 40 });
  fireEvent.touchStart(card, {
    touches: [{ identifier: 1, clientX: 40, clientY: 40, target: card }],
  });
}

function touchMove(card: HTMLElement, clientX: number, clientY: number) {
  const event = createEvent.touchMove(card, {
    touches: [{ identifier: 1, clientX, clientY, target: card }],
  });
  fireEvent(card, event);
  return event;
}

describe('task drag gestures', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(async () => {
    // Let sensor listener teardown and overlay animation promises settle.
    await act(async () => { vi.advanceTimersByTime(100); });
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
    document.body.classList.remove('is-dragging');
  });

  it.each([
    ['vertical', 40, 90],
    ['horizontal', 90, 40],
  ])('leaves a %s swipe available for scrolling without dragging', (_, x, y) => {
    const { card, onDragStart, onDragEnd } = renderBoard();
    touchStart(card);
    act(() => vi.advanceTimersByTime(100));
    fireEvent.pointerMove(card, { pointerType: 'touch', clientX: x, clientY: y });
    expect(touchMove(card, x, y).defaultPrevented).toBe(false);
    act(() => vi.advanceTimersByTime(400));
    fireEvent.touchEnd(card, { touches: [] });
    expect(onDragStart).not.toHaveBeenCalled();
    expect(onDragEnd).not.toHaveBeenCalled();
    expect(screen.getByTestId('active-task')).toHaveTextContent('idle');
    expect(document.body).not.toHaveClass('is-dragging');
  });

  it('activates after a hold, then handles the drop and clears dragging state', async () => {
    const { card, onDragStart, onDragEnd } = renderBoard();
    touchStart(card);
    act(() => vi.advanceTimersByTime(299));
    expect(onDragStart).not.toHaveBeenCalled();
    // Small finger movement during the hold should not cancel it.
    touchMove(card, 42, 42);
    act(() => vi.advanceTimersByTime(1));
    expect(onDragStart).toHaveBeenCalledOnce();
    expect(screen.getByTestId('active-task')).toHaveTextContent('task-1');
    expect(document.body).toHaveClass('is-dragging');
    expect(touchMove(card, 40, 90).defaultPrevented).toBe(true);
    await act(async () => { fireEvent.touchEnd(card, { touches: [] }); });
    expect(onDragEnd).toHaveBeenCalledOnce();
    expect(screen.getByTestId('active-task')).toHaveTextContent('idle');
    expect(document.body).not.toHaveClass('is-dragging');
  });

  it('clears dragging state when an active touch drag is cancelled', async () => {
    const { card, onDragStart, onDragEnd } = renderBoard();
    touchStart(card);
    act(() => vi.advanceTimersByTime(300));
    expect(onDragStart).toHaveBeenCalledOnce();
    await act(async () => { fireEvent.touchCancel(card, { touches: [] }); });
    expect(onDragEnd).not.toHaveBeenCalled();
    expect(screen.getByTestId('active-task')).toHaveTextContent('idle');
    expect(document.body).not.toHaveClass('is-dragging');
  });

  it('allows a short tap to open a task without dragging', () => {
    const { card, onDragStart, onClick } = renderBoard();
    touchStart(card);
    act(() => vi.advanceTimersByTime(100));
    fireEvent.touchEnd(card, { touches: [] });
    fireEvent.click(screen.getByText('Open task'));
    act(() => vi.advanceTimersByTime(400));
    expect(onClick).toHaveBeenCalledOnce();
    expect(onDragStart).not.toHaveBeenCalled();
  });

  it('retains the mouse movement threshold', async () => {
    const { card, onDragStart, onDragEnd } = renderBoard();
    fireEvent.mouseDown(card, { button: 0, clientX: 40, clientY: 40 });
    fireEvent.mouseMove(document, { clientX: 40, clientY: 47 });
    expect(onDragStart).not.toHaveBeenCalled();
    fireEvent.mouseMove(document, { clientX: 40, clientY: 49 });
    expect(onDragStart).toHaveBeenCalledOnce();
    await act(async () => { fireEvent.mouseUp(document); });
    expect(onDragEnd).toHaveBeenCalledOnce();
    expect(document.body).not.toHaveClass('is-dragging');
  });

  it('retains keyboard activation and cancellation', async () => {
    const { card, onDragStart, onDragEnd } = renderBoard();
    card.focus();
    fireEvent.keyDown(card, { code: 'Space' });
    expect(onDragStart).toHaveBeenCalledOnce();
    // KeyboardSensor attaches its document listener on the next timer tick.
    act(() => vi.advanceTimersByTime(1));
    await act(async () => { fireEvent.keyDown(document, { code: 'Escape' }); });
    expect(onDragEnd).not.toHaveBeenCalled();
    expect(screen.getByTestId('active-task')).toHaveTextContent('idle');
    expect(document.body).not.toHaveClass('is-dragging');
  });
});
