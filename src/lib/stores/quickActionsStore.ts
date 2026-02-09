import { create } from 'zustand';

interface QuickAddContext {
  boardId: string;
  statusId: string;
}

interface QuickActionsState {
  // Create task trigger - board pages subscribe to this
  createTaskTrigger: number;
  triggerCreateTask: () => void;
  resetCreateTaskTrigger: () => void;

  // Quick Add dialog state
  quickAddOpen: boolean;
  quickAddContext: QuickAddContext | null;
  openQuickAdd: () => void;
  openQuickAddWithContext: (boardId: string, statusId: string) => void;
  closeQuickAdd: () => void;
}

export const useQuickActionsStore = create<QuickActionsState>()((set) => ({
  createTaskTrigger: 0,
  triggerCreateTask: () => set((state) => ({ createTaskTrigger: state.createTaskTrigger + 1 })),
  resetCreateTaskTrigger: () => set({ createTaskTrigger: 0 }),

  quickAddOpen: false,
  quickAddContext: null,
  openQuickAdd: () => set({ quickAddOpen: true, quickAddContext: null }),
  openQuickAddWithContext: (boardId, statusId) =>
    set({ quickAddOpen: true, quickAddContext: { boardId, statusId } }),
  closeQuickAdd: () => set({ quickAddOpen: false, quickAddContext: null }),
}));
