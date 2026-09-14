import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  isOnline: boolean;
  activeBranchId: string | null;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setIsOnline: (online: boolean) => void;
  setActiveBranchId: (branchId: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  activeBranchId: null,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setIsOnline: (online) => set({ isOnline: online }),
  setActiveBranchId: (branchId) => set({ activeBranchId: branchId }),
}));
