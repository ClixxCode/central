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
  // Collapsed clients in personal view
  collapsedClients: string[];
  // View mode: swimlane (by board), date (by date), or table
  viewMode: 'swimlane' | 'date' | 'table';
  // Table column visibility
  tableColumns: TableColumnConfig;
  // Table sort
  tableSort: TableSortConfig;
  // Active tab: tasks, notifications, or personal
  activeTab: 'tasks' | 'notifications' | 'personal';
  // Personal list view mode
  personalListViewMode: 'kanban' | 'table';
  // Priority selection
  prioritySelectionMode: boolean;
  priorityFilterActive: boolean;

  // Actions
  toggleClient: (clientId: string) => void;
  isClientCollapsed: (clientId: string) => boolean;
  setAllClientsCollapsed: (clientIds: string[], collapsed: boolean) => void;
  areAllClientsCollapsed: (clientIds: string[]) => boolean;
  setViewMode: (mode: 'swimlane' | 'date' | 'table') => void;
  setTableColumns: (columns: TableColumnConfig) => void;
  toggleTableColumn: (column: keyof TableColumnConfig) => void;
  setTableSort: (sort: TableSortConfig) => void;
  setActiveTab: (tab: 'tasks' | 'notifications' | 'personal') => void;
  setPersonalListViewMode: (mode: 'kanban' | 'table') => void;
  setPrioritySelectionMode: (mode: boolean) => void;
  setPriorityFilterActive: (active: boolean) => void;
  togglePriorityFilter: () => void;
}

export const usePersonalRollupStore = create<PersonalRollupState>()(
  persist(
    (set, get) => ({
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
      personalListViewMode: 'kanban' as const,
      prioritySelectionMode: false,
      priorityFilterActive: false,

      toggleClient: (clientId) =>
        set((state) => ({
          collapsedClients: state.collapsedClients.includes(clientId)
            ? state.collapsedClients.filter((c) => c !== clientId)
            : [...state.collapsedClients, clientId],
        })),

      isClientCollapsed: (clientId) => get().collapsedClients.includes(clientId),

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
      setPersonalListViewMode: (mode) => set({ personalListViewMode: mode }),
      setPrioritySelectionMode: (mode) => set({ prioritySelectionMode: mode }),
      setPriorityFilterActive: (active) => set({ priorityFilterActive: active }),
      togglePriorityFilter: () => set((state) => ({ priorityFilterActive: !state.priorityFilterActive })),
    }),
    {
      name: 'clix-pm-personal-rollup',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    }
  )
);
