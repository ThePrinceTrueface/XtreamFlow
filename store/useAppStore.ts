import { create } from 'zustand';
import { XtreamAccount, SavedServer, ModalConfig, ModalType } from '../types';

const accentLocalStorageKey = 'xtream_accent_color';
const themeModeLocalStorageKey = 'xtream_theme_mode';
const sidebarCollapsedLocalStorageKey = 'sidebar_collapsed';

const initialAccentColor = localStorage.getItem(accentLocalStorageKey) || '#FF0080';
const initialThemeMode = (localStorage.getItem(themeModeLocalStorageKey) as 'dark' | 'light') || 'dark';

// Initial side-effect to set initial styling and avoid blank pages or flickering
const root = document.documentElement;
root.style.setProperty('--fluent-accent', initialAccentColor);
root.style.setProperty('--fluent-accent-hover', initialAccentColor + 'CC');
if (initialThemeMode === 'light') {
  root.classList.add('light');
  root.classList.remove('dark');
} else {
  root.classList.add('dark');
  root.classList.remove('light');
}

interface AppState {
  isSidebarCollapsed: boolean;
  playingDownload: { url: string; title: string; type: 'live' | 'vod' | 'series' } | null;
  editingAccount: XtreamAccount | null;
  serverToPrefill: SavedServer | null;
  initialSearchQuery: string;
  accentColor: string;
  themeMode: 'dark' | 'light';
  modal: ModalConfig;
  toast: { message: string; show: boolean };
  isGlobalSearchOpen: boolean;
  isShortcutsModalOpen: boolean;

  setSidebarCollapsed: (collapsed: boolean) => void;
  setPlayingDownload: (download: { url: string; title: string; type: 'live' | 'vod' | 'series' } | null) => void;
  setEditingAccount: (account: XtreamAccount | null) => void;
  setServerToPrefill: (server: SavedServer | null) => void;
  setInitialSearchQuery: (query: string) => void;
  setAccentColor: (color: string) => void;
  setThemeMode: (mode: 'dark' | 'light') => void;
  setModal: (modal: ModalConfig) => void;
  setToast: (toast: { message: string; show: boolean }) => void;
  setIsGlobalSearchOpen: (isOpen: boolean) => void;
  setIsShortcutsModalOpen: (isOpen: boolean) => void;

  showModal: (
    type: ModalType,
    title: string,
    message: any,
    onConfirm?: () => void,
    confirmLabel?: string,
    cancelLabel?: string
  ) => void;
  closeModal: () => void;
  showToast: (message: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  isSidebarCollapsed: localStorage.getItem(sidebarCollapsedLocalStorageKey) === 'true',
  playingDownload: null,
  editingAccount: null,
  serverToPrefill: null,
  initialSearchQuery: '',
  accentColor: initialAccentColor,
  themeMode: initialThemeMode,
  modal: {
    isOpen: false,
    type: 'info',
    title: '',
    message: null,
  },
  toast: { message: '', show: false },
  isGlobalSearchOpen: false,
  isShortcutsModalOpen: false,

  setSidebarCollapsed: (collapsed) => {
    localStorage.setItem(sidebarCollapsedLocalStorageKey, collapsed.toString());
    set({ isSidebarCollapsed: collapsed });
  },
  setPlayingDownload: (playingDownload) => set({ playingDownload }),
  setEditingAccount: (editingAccount) => set({ editingAccount }),
  setServerToPrefill: (serverToPrefill) => set({ serverToPrefill }),
  setInitialSearchQuery: (initialSearchQuery) => set({ initialSearchQuery }),
  setAccentColor: (accentColor) => {
    localStorage.setItem(accentLocalStorageKey, accentColor);
    const root = document.documentElement;
    root.style.setProperty('--fluent-accent', accentColor);
    root.style.setProperty('--fluent-accent-hover', accentColor + 'CC');
    set({ accentColor });
  },
  setThemeMode: (themeMode) => {
    localStorage.setItem(themeModeLocalStorageKey, themeMode);
    if (themeMode === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
    set({ themeMode });
  },
  setModal: (modal) => set({ modal }),
  setToast: (toast) => set({ toast }),
  setIsGlobalSearchOpen: (isGlobalSearchOpen) => set({ isGlobalSearchOpen }),
  setIsShortcutsModalOpen: (isShortcutsModalOpen) => set({ isShortcutsModalOpen }),

  showModal: (type, title, message, onConfirm, confirmLabel = 'Confirm', cancelLabel = 'Cancel') => {
    set({
      modal: {
        isOpen: true,
        type,
        title,
        message,
        onConfirm: onConfirm ? () => {
          onConfirm();
          get().closeModal();
        } : undefined,
        onCancel: () => get().closeModal(),
        confirmLabel,
        cancelLabel,
      }
    });
  },
  closeModal: () => {
    set((state) => ({
      modal: { ...state.modal, isOpen: false }
    }));
  },
  showToast: (message) => {
    set({ toast: { message, show: true } });
    setTimeout(() => {
      set((state) => {
        // Only turn off if the active toast has the same message
        if (state.toast.message === message) {
          return { toast: { ...state.toast, show: false } };
        }
        return {};
      });
    }, 3000);
  }
}));
