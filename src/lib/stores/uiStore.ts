import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UIState {
  // Sidebar state
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  expandedClients: string[];
  collapsedSections: string[];

  // Actions
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  toggleSidebarCollapse: () => void;
  toggleClientExpanded: (clientId: string) => void;
  setExpandedClients: (clientIds: string[]) => void;
  toggleSection: (section: string) => void;
  isSectionCollapsed: (section: string) => boolean;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Initial state
      sidebarOpen: false,
      sidebarCollapsed: false,
      expandedClients: [],
      collapsedSections: [],

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

      toggleSection: (section) =>
        set((state) => ({
          collapsedSections: state.collapsedSections.includes(section)
            ? state.collapsedSections.filter((s) => s !== section)
            : [...state.collapsedSections, section],
        })),

      isSectionCollapsed: (section) => get().collapsedSections.includes(section),
    }),
    {
      name: 'clix-pm-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        expandedClients: state.expandedClients,
        collapsedSections: state.collapsedSections,
      }),
    }
  )
);
