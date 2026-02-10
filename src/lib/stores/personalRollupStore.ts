import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface TableColumnConfig {
  title: boolean;
  status: boolean;
  section: boolean;
  assignees: boolean;
  dueDate: boolean;
  source?: boolean;
}

export interface TableSortConfig {
  field: 'title' | 'status' | 'dueDate' | 'position' | 'client';
  direction: 'asc' | 'desc';
}

interface PersonalRollupState {
  // Columns to hide in personal view (swimlane)
  hiddenColumns: string[];
  // Boards to hide in personal view
  hiddenBoards: string[];
  // Collapsed clients in personal view
  collapsedClients: string[];
  // View mode: swimlane or table
  viewMode: 'swimlane' | 'table';
  // Table column visibility
  tableColumns: TableColumnConfig;
  // Table sort
  tableSort: TableSortConfig;
  // Active tab: tasks or notifications
  activeTab: 'tasks' | 'notifications';

  // Actions
  toggleColumn: (column: string) => void;
  toggleBoard: (boardId: string) => void;
  toggleClient: (clientId: string) => void;
  isColumnHidden: (column: string) => boolean;
  isBoardHidden: (boardId: string) => boolean;
  isClientCollapsed: (clientId: string) => boolean;
  setHiddenColumns: (columns: string[]) => void;
  setHiddenBoards: (boardIds: string[]) => void;
  setAllClientsCollapsed: (clientIds: string[], collapsed: boolean) => void;
  areAllClientsCollapsed: (clientIds: string[]) => boolean;
  setViewMode: (mode: 'swimlane' | 'table') => void;
  setTableColumns: (columns: TableColumnConfig) => void;
  toggleTableColumn: (column: keyof TableColumnConfig) => void;
  setTableSort: (sort: TableSortConfig) => void;
  setActiveTab: (tab: 'tasks' | 'notifications') => void;
}

export const usePersonalRollupStore = create<PersonalRollupState>()(
  persist(
    (set, get) => ({
      hiddenColumns: [],
      hiddenBoards: [],
      collapsedClients: [],
      viewMode: 'swimlane' as const,
      tableColumns: {
        title: true,
        status: true,
        section: true,
        assignees: true,
        dueDate: true,
        source: true,
      },
      tableSort: {
        field: 'client' as const,
        direction: 'asc' as const,
      },
      activeTab: 'tasks' as const,

      toggleColumn: (column) =>
        set((state) => ({
          hiddenColumns: state.hiddenColumns.includes(column)
            ? state.hiddenColumns.filter((c) => c !== column)
            : [...state.hiddenColumns, column],
        })),

      toggleBoard: (boardId) =>
        set((state) => ({
          hiddenBoards: state.hiddenBoards.includes(boardId)
            ? state.hiddenBoards.filter((b) => b !== boardId)
            : [...state.hiddenBoards, boardId],
        })),

      toggleClient: (clientId) =>
        set((state) => ({
          collapsedClients: state.collapsedClients.includes(clientId)
            ? state.collapsedClients.filter((c) => c !== clientId)
            : [...state.collapsedClients, clientId],
        })),

      isColumnHidden: (column) => get().hiddenColumns.includes(column),
      isBoardHidden: (boardId) => get().hiddenBoards.includes(boardId),
      isClientCollapsed: (clientId) => get().collapsedClients.includes(clientId),

      setHiddenColumns: (columns) => set({ hiddenColumns: columns }),
      setHiddenBoards: (boardIds) => set({ hiddenBoards: boardIds }),

      setAllClientsCollapsed: (clientIds, collapsed) =>
        set({ collapsedClients: collapsed ? clientIds : [] }),

      areAllClientsCollapsed: (clientIds) => {
        const collapsed = get().collapsedClients;
        return clientIds.length > 0 && clientIds.every((id) => collapsed.includes(id));
      },

      setViewMode: (mode) => set({ viewMode: mode }),

      setTableColumns: (columns) => set({ tableColumns: columns }),

      toggleTableColumn: (column) =>
        set((state) => {
          const newColumns = { ...state.tableColumns, [column]: !state.tableColumns[column] };
          const visibleCount = Object.values(newColumns).filter(Boolean).length;
          if (visibleCount >= 1) {
            return { tableColumns: newColumns };
          }
          return state;
        }),

      setTableSort: (sort) => set({ tableSort: sort }),

      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    {
      name: 'clix-pm-personal-rollup',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    }
  )
);
