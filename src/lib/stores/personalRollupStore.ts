import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface PersonalRollupState {
  // Columns to hide in personal view
  hiddenColumns: string[];
  // Boards to hide in personal view
  hiddenBoards: string[];
  // Collapsed clients in personal view
  collapsedClients: string[];

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
}

export const usePersonalRollupStore = create<PersonalRollupState>()(
  persist(
    (set, get) => ({
      hiddenColumns: [],
      hiddenBoards: [],
      collapsedClients: [],

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
    }),
    {
      name: 'clix-pm-personal-rollup',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
