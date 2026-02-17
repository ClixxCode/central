import { describe, it, expect, beforeEach } from 'vitest';
import { useBoardViewStore } from './boardViewStore';

describe('useBoardViewStore', () => {
  beforeEach(() => {
    // Reset the store state before each test
    useBoardViewStore.setState({
      boardViews: {},
      collapsedSwimlanes: {},
    });
  });

  describe('swimlane collapse state', () => {
    it('should return false for uncollapsed swimlanes', () => {
      const isCollapsed = useBoardViewStore.getState().isSwimlaneCollapsed('board-1', 'todo');
      expect(isCollapsed).toBe(false);
    });

    it('should toggle swimlane to collapsed state', () => {
      const store = useBoardViewStore.getState();

      // Initially not collapsed
      expect(store.isSwimlaneCollapsed('board-1', 'todo')).toBe(false);

      // Toggle to collapsed
      store.toggleSwimlane('board-1', 'todo');

      // Now should be collapsed
      expect(useBoardViewStore.getState().isSwimlaneCollapsed('board-1', 'todo')).toBe(true);
    });

    it('should toggle swimlane back to expanded state', () => {
      const store = useBoardViewStore.getState();

      // Toggle twice
      store.toggleSwimlane('board-1', 'todo');
      expect(useBoardViewStore.getState().isSwimlaneCollapsed('board-1', 'todo')).toBe(true);

      useBoardViewStore.getState().toggleSwimlane('board-1', 'todo');
      expect(useBoardViewStore.getState().isSwimlaneCollapsed('board-1', 'todo')).toBe(false);
    });

    it('should maintain separate collapse state for different boards', () => {
      const store = useBoardViewStore.getState();

      // Collapse 'todo' on board-1
      store.toggleSwimlane('board-1', 'todo');

      // board-1 should be collapsed
      expect(useBoardViewStore.getState().isSwimlaneCollapsed('board-1', 'todo')).toBe(true);

      // board-2 should not be affected
      expect(useBoardViewStore.getState().isSwimlaneCollapsed('board-2', 'todo')).toBe(false);
    });

    it('should maintain separate collapse state for different statuses on same board', () => {
      const store = useBoardViewStore.getState();

      // Collapse 'todo' on board-1
      store.toggleSwimlane('board-1', 'todo');

      // Only 'todo' should be collapsed
      expect(useBoardViewStore.getState().isSwimlaneCollapsed('board-1', 'todo')).toBe(true);
      expect(useBoardViewStore.getState().isSwimlaneCollapsed('board-1', 'in-progress')).toBe(false);
      expect(useBoardViewStore.getState().isSwimlaneCollapsed('board-1', 'complete')).toBe(false);
    });

    it('should allow multiple swimlanes to be collapsed on same board', () => {
      const store = useBoardViewStore.getState();

      // Collapse multiple swimlanes
      store.toggleSwimlane('board-1', 'todo');
      useBoardViewStore.getState().toggleSwimlane('board-1', 'complete');

      expect(useBoardViewStore.getState().isSwimlaneCollapsed('board-1', 'todo')).toBe(true);
      expect(useBoardViewStore.getState().isSwimlaneCollapsed('board-1', 'in-progress')).toBe(false);
      expect(useBoardViewStore.getState().isSwimlaneCollapsed('board-1', 'complete')).toBe(true);
    });

    it('should store collapsed swimlanes in collapsedSwimlanes record', () => {
      const store = useBoardViewStore.getState();

      store.toggleSwimlane('board-1', 'todo');
      store.toggleSwimlane('board-1', 'complete');

      const state = useBoardViewStore.getState();
      expect(state.collapsedSwimlanes['board-1']).toEqual(['todo', 'complete']);
    });
  });

  describe('board view preferences', () => {
    it('should default to swimlane view for new boards', () => {
      const view = useBoardViewStore.getState().getBoardView('board-1');
      expect(view).toBe('swimlane');
    });

    it('should set and get board view preference', () => {
      const store = useBoardViewStore.getState();

      store.setBoardView('board-1', 'kanban');

      expect(useBoardViewStore.getState().getBoardView('board-1')).toBe('kanban');
    });

    it('should maintain separate view preferences per board', () => {
      const store = useBoardViewStore.getState();

      store.setBoardView('board-1', 'kanban');
      store.setBoardView('board-2', 'table');

      expect(useBoardViewStore.getState().getBoardView('board-1')).toBe('kanban');
      expect(useBoardViewStore.getState().getBoardView('board-2')).toBe('table');
    });
  });
});
