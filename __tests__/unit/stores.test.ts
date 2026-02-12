import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '@/lib/stores/uiStore';
import { useBoardViewStore } from '@/lib/stores/boardViewStore';
import { usePersonalRollupStore } from '@/lib/stores/personalRollupStore';

describe('UI Store', () => {
  beforeEach(() => {
    // Reset store state between tests
    useUIStore.setState({
      sidebarOpen: true,
      sidebarCollapsed: false,
      expandedClients: [],
    });
  });

  it('toggles sidebar open state', () => {
    const store = useUIStore.getState();

    expect(store.sidebarOpen).toBe(true);

    store.toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(false);

    store.toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(true);
  });

  it('sets sidebar open state directly', () => {
    const store = useUIStore.getState();

    store.setSidebarOpen(false);
    expect(useUIStore.getState().sidebarOpen).toBe(false);

    store.setSidebarOpen(true);
    expect(useUIStore.getState().sidebarOpen).toBe(true);
  });

  it('toggles sidebar collapsed state', () => {
    const store = useUIStore.getState();

    expect(store.sidebarCollapsed).toBe(false);

    store.toggleSidebarCollapse();
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
  });

  it('toggles client expanded state', () => {
    const store = useUIStore.getState();
    const clientId = 'client-1';

    expect(store.expandedClients).not.toContain(clientId);

    store.toggleClientExpanded(clientId);
    expect(useUIStore.getState().expandedClients).toContain(clientId);

    store.toggleClientExpanded(clientId);
    expect(useUIStore.getState().expandedClients).not.toContain(clientId);
  });

  it('sets expanded clients', () => {
    const store = useUIStore.getState();
    const clients = ['client-1', 'client-2'];

    store.setExpandedClients(clients);
    expect(useUIStore.getState().expandedClients).toEqual(clients);
  });
});

describe('Board View Store', () => {
  beforeEach(() => {
    useBoardViewStore.setState({
      boardViews: {},
      collapsedSwimlanes: {},
    });
  });

  it('returns swimlane as default view', () => {
    const store = useBoardViewStore.getState();

    expect(store.getBoardView('board-1')).toBe('swimlane');
  });

  it('sets board view', () => {
    const store = useBoardViewStore.getState();

    store.setBoardView('board-1', 'kanban');
    expect(useBoardViewStore.getState().getBoardView('board-1')).toBe('kanban');

    store.setBoardView('board-1', 'table');
    expect(useBoardViewStore.getState().getBoardView('board-1')).toBe('table');

    store.setBoardView('board-1', 'swimlane');
    expect(useBoardViewStore.getState().getBoardView('board-1')).toBe('swimlane');
  });

  it('tracks different views per board', () => {
    const store = useBoardViewStore.getState();

    store.setBoardView('board-1', 'kanban');
    store.setBoardView('board-2', 'table');
    store.setBoardView('board-3', 'swimlane');

    expect(useBoardViewStore.getState().getBoardView('board-1')).toBe('kanban');
    expect(useBoardViewStore.getState().getBoardView('board-2')).toBe('table');
    expect(useBoardViewStore.getState().getBoardView('board-3')).toBe('swimlane');
  });

  it('toggles swimlane collapsed state', () => {
    const store = useBoardViewStore.getState();

    expect(store.isSwimlaneCollapsed('board-1', 'todo')).toBe(false);

    store.toggleSwimlane('board-1', 'todo');
    expect(useBoardViewStore.getState().isSwimlaneCollapsed('board-1', 'todo')).toBe(true);

    store.toggleSwimlane('board-1', 'todo');
    expect(useBoardViewStore.getState().isSwimlaneCollapsed('board-1', 'todo')).toBe(false);
  });

  it('tracks swimlane state per board', () => {
    const store = useBoardViewStore.getState();

    store.toggleSwimlane('board-1', 'todo');
    store.toggleSwimlane('board-2', 'in-progress');

    expect(useBoardViewStore.getState().isSwimlaneCollapsed('board-1', 'todo')).toBe(true);
    expect(useBoardViewStore.getState().isSwimlaneCollapsed('board-1', 'in-progress')).toBe(false);
    expect(useBoardViewStore.getState().isSwimlaneCollapsed('board-2', 'todo')).toBe(false);
    expect(useBoardViewStore.getState().isSwimlaneCollapsed('board-2', 'in-progress')).toBe(true);
  });
});

describe('Personal Rollup Store', () => {
  beforeEach(() => {
    usePersonalRollupStore.setState({
      collapsedClients: [],
    });
  });

  it('toggles client collapsed state', () => {
    const store = usePersonalRollupStore.getState();

    expect(store.isClientCollapsed('client-1')).toBe(false);

    store.toggleClient('client-1');
    expect(usePersonalRollupStore.getState().isClientCollapsed('client-1')).toBe(true);

    store.toggleClient('client-1');
    expect(usePersonalRollupStore.getState().isClientCollapsed('client-1')).toBe(false);
  });
});
