import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UIState {
  // Sidebar state
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  expandedClients: string[];

  // Actions
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  toggleSidebarCollapse: () => void;
  toggleClientExpanded: (clientId: string) => void;
  setExpandedClients: (clientIds: string[]) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Initial state
      sidebarOpen: false,
      sidebarCollapsed: false,
      expandedClients: [],

      // Actions
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      toggleSidebarCollapse: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      toggleClientExpanded: (clientId) =>
        set((state) => ({
          expandedClients: state.expandedClients.includes(clientId)
            ? state.expandedClients.filter((id) => id !== clientId)
            : [...state.expandedClients, clientId],
        })),

      setExpandedClients: (clientIds) =>
        set({ expandedClients: clientIds }),
    }),
    {
      name: 'clix-pm-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        expandedClients: state.expandedClients,
      }),
    }
  )
);
