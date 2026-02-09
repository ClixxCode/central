import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type ViewMode = 'table' | 'swimlane' | 'kanban';

interface BoardViewState {
  // Per-board view preferences
  boardViews: Record<string, ViewMode>;
  collapsedSwimlanes: Record<string, string[]>;

  // Actions
  getBoardView: (boardId: string, defaultView?: ViewMode) => ViewMode;
  setBoardView: (boardId: string, view: ViewMode) => void;
  toggleSwimlane: (boardId: string, status: string) => void;
  isSwimlaneCollapsed: (boardId: string, status: string) => boolean;
  setAllSwimlanesCollapsed: (boardId: string, swimlaneIds: string[], collapsed: boolean) => void;
  areAllSwimlanesCollapsed: (boardId: string, swimlaneIds: string[]) => boolean;
}

export const useBoardViewStore = create<BoardViewState>()(
  persist(
    (set, get) => ({
      boardViews: {},
      collapsedSwimlanes: {},

      getBoardView: (boardId, defaultView = 'swimlane') => get().boardViews[boardId] ?? defaultView,

      setBoardView: (boardId, view) =>
        set((state) => ({
          boardViews: { ...state.boardViews, [boardId]: view },
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
    }),
    {
      name: 'clix-pm-board-views',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
