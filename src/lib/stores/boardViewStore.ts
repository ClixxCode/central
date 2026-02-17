import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type ViewMode = 'table' | 'swimlane' | 'kanban';

export interface BoardTableColumns {
  title: boolean;
  status: boolean;
  section: boolean;
  assignees: boolean;
  dueDate: boolean;
  source?: boolean;
}

const defaultBoardTableColumns: BoardTableColumns = {
  title: true,
  status: true,
  section: true,
  assignees: true,
  dueDate: true,
};

export interface SwimlaneCardItems {
  section: boolean;
  dueDate: boolean;
  assignees: boolean;
}

export interface SwimlaneSortConfig {
  field: 'position' | 'dueDate' | 'createdAt' | 'title' | 'status';
  direction: 'asc' | 'desc';
}

const defaultSwimlaneCardItems: SwimlaneCardItems = {
  section: true,
  dueDate: true,
  assignees: true,
};

export type GroupBy = 'status' | 'date' | 'section';

interface BoardViewState {
  // Per-board view preferences
  boardViews: Record<string, ViewMode>;
  collapsedSwimlanes: Record<string, string[]>;
  // Per-board table column visibility
  boardTableColumns: Record<string, BoardTableColumns>;
  // Per-board swimlane card item visibility
  swimlaneCardItems: Record<string, SwimlaneCardItems>;
  // Per-board grouping mode (status columns vs date buckets)
  boardGroupBy: Record<string, GroupBy>;
  // Per-board swimlane sort
  swimlaneSort: Record<string, SwimlaneSortConfig>;
  // Transient: which rollup is actively in review mode (not persisted)
  activeReviewBoardId: string | null;

  // Actions
  getBoardView: (boardId: string, defaultView?: ViewMode) => ViewMode;
  setBoardView: (boardId: string, view: ViewMode) => void;
  getGroupBy: (boardId: string) => GroupBy;
  setGroupBy: (boardId: string, groupBy: GroupBy) => void;
  toggleSwimlane: (boardId: string, status: string) => void;
  isSwimlaneCollapsed: (boardId: string, status: string) => boolean;
  setAllSwimlanesCollapsed: (boardId: string, swimlaneIds: string[], collapsed: boolean) => void;
  areAllSwimlanesCollapsed: (boardId: string, swimlaneIds: string[]) => boolean;
  getBoardTableColumns: (boardId: string, defaults?: BoardTableColumns) => BoardTableColumns;
  setBoardTableColumns: (boardId: string, columns: BoardTableColumns) => void;
  toggleBoardTableColumn: (boardId: string, column: keyof BoardTableColumns) => void;
  getSwimlaneCardItems: (boardId: string) => SwimlaneCardItems;
  toggleSwimlaneCardItem: (boardId: string, item: keyof SwimlaneCardItems) => void;
  getSwimlaneSortConfig: (boardId: string) => SwimlaneSortConfig;
  setSwimlaneSortConfig: (boardId: string, sort: SwimlaneSortConfig) => void;
  setActiveReviewBoardId: (boardId: string | null) => void;
}

export const useBoardViewStore = create<BoardViewState>()(
  persist(
    (set, get) => ({
      boardViews: {},
      collapsedSwimlanes: {},
      boardTableColumns: {},
      swimlaneCardItems: {},
      boardGroupBy: {},
      swimlaneSort: {},
      activeReviewBoardId: null,

      getBoardView: (boardId, defaultView = 'swimlane') => get().boardViews[boardId] ?? defaultView,

      setBoardView: (boardId, view) =>
        set((state) => ({
          boardViews: { ...state.boardViews, [boardId]: view },
        })),

      getGroupBy: (boardId) => get().boardGroupBy[boardId] ?? 'status',

      setGroupBy: (boardId, groupBy) =>
        set((state) => ({
          boardGroupBy: { ...state.boardGroupBy, [boardId]: groupBy },
        })),

      toggleSwimlane: (boardId, status) =>
        set((state) => {
          const current = state.collapsedSwimlanes[boardId] ?? [];
          const isCollapsed = current.includes(status);

          return {
            collapsedSwimlanes: {
              ...state.collapsedSwimlanes,
              [boardId]: isCollapsed
                ? current.filter((s) => s !== status)
                : [...current, status],
            },
          };
        }),

      isSwimlaneCollapsed: (boardId, status) => {
        const collapsed = get().collapsedSwimlanes[boardId] ?? [];
        return collapsed.includes(status);
      },

      setAllSwimlanesCollapsed: (boardId, swimlaneIds, collapsed) =>
        set((state) => ({
          collapsedSwimlanes: {
            ...state.collapsedSwimlanes,
            [boardId]: collapsed ? swimlaneIds : [],
          },
        })),

      areAllSwimlanesCollapsed: (boardId, swimlaneIds) => {
        const collapsed = get().collapsedSwimlanes[boardId] ?? [];
        return swimlaneIds.length > 0 && swimlaneIds.every((id) => collapsed.includes(id));
      },

      getBoardTableColumns: (boardId, defaults = defaultBoardTableColumns) =>
        get().boardTableColumns[boardId] ?? defaults,

      setBoardTableColumns: (boardId, columns) =>
        set((state) => ({
          boardTableColumns: { ...state.boardTableColumns, [boardId]: columns },
        })),

      toggleBoardTableColumn: (boardId, column) =>
        set((state) => {
          const current = state.boardTableColumns[boardId] ?? defaultBoardTableColumns;
          const newColumns = { ...current, [column]: !current[column] };
          const visibleCount = Object.values(newColumns).filter(Boolean).length;
          if (visibleCount < 1) return state;
          return {
            boardTableColumns: { ...state.boardTableColumns, [boardId]: newColumns },
          };
        }),

      getSwimlaneCardItems: (boardId) =>
        get().swimlaneCardItems[boardId] ?? defaultSwimlaneCardItems,

      toggleSwimlaneCardItem: (boardId, item) =>
        set((state) => {
          const current = state.swimlaneCardItems[boardId] ?? defaultSwimlaneCardItems;
          return {
            swimlaneCardItems: { ...state.swimlaneCardItems, [boardId]: { ...current, [item]: !current[item] } },
          };
        }),

      getSwimlaneSortConfig: (boardId) =>
        get().swimlaneSort[boardId] ?? { field: 'position', direction: 'asc' },

      setSwimlaneSortConfig: (boardId, sort) =>
        set((state) => ({
          swimlaneSort: { ...state.swimlaneSort, [boardId]: sort },
        })),

      setActiveReviewBoardId: (boardId) =>
        set({ activeReviewBoardId: boardId }),
    }),
    {
      name: 'clix-pm-board-views',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        boardViews: state.boardViews,
        collapsedSwimlanes: state.collapsedSwimlanes,
        boardTableColumns: state.boardTableColumns,
        swimlaneCardItems: state.swimlaneCardItems,
        boardGroupBy: state.boardGroupBy,
        swimlaneSort: state.swimlaneSort,
      }),
    }
  )
);
