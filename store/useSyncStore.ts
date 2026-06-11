import { create } from 'zustand';

interface PreloadProgress {
  step: string;
  percent: number;
}

interface UpdateProgress {
  step: string;
  percent: number;
}

interface UpdateOptions {
  live: boolean;
  vod: boolean;
  series: boolean;
  epg: boolean;
}

interface SyncState {
  // Preload States
  showPreloadPrompt: boolean;
  isPreloading: boolean;
  preloadProgressData: PreloadProgress;

  // Update States
  isUpdateModalOpen: boolean;
  isUpdating: boolean;
  updateProgressData: UpdateProgress;
  updateOptions: UpdateOptions;

  // Global Network/Sync State
  isOnline: boolean;
  syncError: string | null;

  // Actions
  setShowPreloadPrompt: (show: boolean) => void;
  setIsPreloading: (isPreloading: boolean) => void;
  setPreloadProgressData: (data: Partial<PreloadProgress>) => void;
  setIsUpdateModalOpen: (isOpen: boolean) => void;
  setIsUpdating: (isUpdating: boolean) => void;
  setUpdateProgressData: (data: Partial<UpdateProgress>) => void;
  setUpdateOptions: (options: Partial<UpdateOptions>) => void;
  setIsOnline: (isOnline: boolean) => void;
  setSyncError: (error: string | null) => void;
  resetSyncStore: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  showPreloadPrompt: false,
  isPreloading: false,
  preloadProgressData: { step: '', percent: 0 },

  isUpdateModalOpen: false,
  isUpdating: false,
  updateProgressData: { step: '', percent: 0 },
  updateOptions: { live: true, vod: true, series: true, epg: false },

  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  syncError: null,

  setShowPreloadPrompt: (showPreloadPrompt) => set({ showPreloadPrompt }),
  setIsPreloading: (isPreloading) => set({ isPreloading }),
  setPreloadProgressData: (data) => set((state) => ({
    preloadProgressData: { ...state.preloadProgressData, ...data }
  })),
  setIsUpdateModalOpen: (isUpdateModalOpen) => set({ isUpdateModalOpen }),
  setIsUpdating: (isUpdating) => set({ isUpdating }),
  setUpdateProgressData: (data) => set((state) => ({
    updateProgressData: { ...state.updateProgressData, ...data }
  })),
  setUpdateOptions: (options) => set((state) => ({
    updateOptions: { ...state.updateOptions, ...options }
  })),
  setIsOnline: (isOnline) => set({ isOnline }),
  setSyncError: (syncError) => set({ syncError }),
  resetSyncStore: () => set({
    showPreloadPrompt: false,
    isPreloading: false,
    preloadProgressData: { step: '', percent: 0 },
    isUpdateModalOpen: false,
    isUpdating: false,
    updateProgressData: { step: '', percent: 0 },
    updateOptions: { live: true, vod: true, series: true, epg: false },
    syncError: null,
  })
}));

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => useSyncStore.getState().setIsOnline(true));
  window.addEventListener('offline', () => useSyncStore.getState().setIsOnline(false));
}
