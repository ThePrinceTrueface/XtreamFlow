import { create } from 'zustand';
import { GlobalPreferences, XtreamStream, StreamProgress, PlayerSettings, AccountPreferences } from '../types';

const STORAGE_KEY = 'xtream_user_prefs';

const loadInitialPrefs = (): GlobalPreferences => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as GlobalPreferences;
    
    // Migration & Structure Integrity
    Object.keys(parsed).forEach(accId => {
        const acc = parsed[accId];
        if (!acc.favoritesTable || Array.isArray(acc.favoritesTable)) {
            acc.favoritesTable = { live: [], vod: [], series: [] };
        }
        if ((acc as any).favorites) delete (acc as any).favorites;
        if (!acc.history) {
            acc.history = {};
        }
    });
    
    return parsed;
  } catch (e) {
    console.error("Failed to load user preferences", e);
    return {};
  }
};

interface PreferencesState {
  prefs: GlobalPreferences;
  toggleFavorite: (accountId: string, item: XtreamStream, type: 'live' | 'vod' | 'series') => void;
  updateProgress: (accountId: string, item: XtreamStream, time: number, duration: number) => void;
  clearProgress: (accountId: string, itemId: string | number | undefined) => void;
  addToHistory: (accountId: string, item: XtreamStream, streamType: 'live' | 'vod' | 'series') => void;
  clearHistory: (accountId: string, type?: 'live' | 'vod' | 'series') => void;
  updatePlayerSettings: (accountId: string, settings: Partial<PlayerSettings>) => void;
  toggleAutoPlayNavigation: (accountId: string, value: boolean) => void;
}

const savePrefsToLocalStorage = (newPrefs: GlobalPreferences) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs));
};

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  prefs: loadInitialPrefs(),

  toggleFavorite: (accountId, item, type) => {
    const itemId = item.stream_id || item.series_id;
    if (!itemId) return;
    const idStr = itemId.toString();

    set((state) => {
      const prev = state.prefs;
      const accountData = prev[accountId] || { favoritesTable: { live: [], vod: [], series: [] }, history: {} };
      const table = accountData.favoritesTable || { live: [], vod: [], series: [] };
      
      const typeFavs = table[type] || [];
      const isFav = typeFavs.some(f => (f.stream_id || f.series_id || "").toString() === idStr);

      const newTypeFavs = isFav
        ? typeFavs.filter(f => (f.stream_id || f.series_id || "").toString() !== idStr)
        : [...typeFavs, item];

      const updatedPrefs = {
        ...prev,
        [accountId]: {
          ...accountData,
          favoritesTable: {
            ...table,
            [type]: newTypeFavs
          }
        }
      };

      savePrefsToLocalStorage(updatedPrefs);
      return { prefs: updatedPrefs };
    });
  },

  updateProgress: (accountId, item, time, duration) => {
    const itemId = item.stream_id || item.series_id;
    if (!itemId || duration <= 0) return;
    const idStr = itemId.toString();
    const progress = time / duration;
    const finished = progress > 0.92;

    set((state) => {
      const prev = state.prefs;
      const accountData = prev[accountId] || { favoritesTable: { live: [], vod: [], series: [] }, history: {} };
      
      const updatedPrefs = {
        ...prev,
        [accountId]: {
          ...accountData,
          history: {
            ...(accountData.history || {}),
            [idStr]: {
              time,
              duration,
              progress,
              finished,
              lastWatched: Date.now(),
              item
            }
          }
        }
      };

      savePrefsToLocalStorage(updatedPrefs);
      return { prefs: updatedPrefs };
    });
  },

  clearProgress: (accountId, itemId) => {
    if (!itemId) return;
    const idStr = itemId.toString();

    set((state) => {
      const prev = state.prefs;
      const accountData = prev[accountId];
      if (!accountData) return state;

      const newHistory = { ...(accountData.history || {}) };
      delete newHistory[idStr];

      const updatedPrefs = {
        ...prev,
        [accountId]: { ...accountData, history: newHistory }
      };

      savePrefsToLocalStorage(updatedPrefs);
      return { prefs: updatedPrefs };
    });
  },

  addToHistory: (accountId, item, streamType) => {
    const itemId = item.stream_id || item.series_id;
    if (!itemId) return;
    const idStr = itemId.toString();

    set((state) => {
      const prev = state.prefs;
      const accountData = prev[accountId] || { favoritesTable: { live: [], vod: [], series: [] }, history: {} };
      const current = accountData.history?.[idStr];

      const updatedEntry: StreamProgress = {
        time: current?.time || 0,
        duration: current?.duration || 0,
        progress: current?.progress || 0,
        finished: current?.finished || false,
        lastWatched: Date.now(),
        item: {
          ...item,
          stream_type: streamType
        }
      };

      const updatedPrefs = {
        ...prev,
        [accountId]: {
          ...accountData,
          history: {
            ...(accountData.history || {}),
            [idStr]: updatedEntry
          }
        }
      };

      savePrefsToLocalStorage(updatedPrefs);
      return { prefs: updatedPrefs };
    });
  },

  clearHistory: (accountId, type) => {
    set((state) => {
      const prev = state.prefs;
      const accountData = prev[accountId];
      if (!accountData || !accountData.history) return state;

      const newHistory = { ...accountData.history };
      if (!type) {
        const updatedPrefs = {
          ...prev,
          [accountId]: { ...accountData, history: {} }
        };
        savePrefsToLocalStorage(updatedPrefs);
        return { prefs: updatedPrefs };
      }

      Object.keys(newHistory).forEach(key => {
        if (newHistory[key]?.item?.stream_type === type) {
          delete newHistory[key];
        }
      });

      const updatedPrefs = {
        ...prev,
        [accountId]: { ...accountData, history: newHistory }
      };

      savePrefsToLocalStorage(updatedPrefs);
      return { prefs: updatedPrefs };
    });
  },

  updatePlayerSettings: (accountId, settings) => {
    set((state) => {
      const prev = state.prefs;
      const accountData = prev[accountId] || { favoritesTable: { live: [], vod: [], series: [] }, history: {} };
      
      const updatedPrefs = {
        ...prev,
        [accountId]: {
          ...accountData,
          playerSettings: {
            ...(accountData.playerSettings || { reconnectDelay: 5000 as const }),
            ...settings
          }
        }
      };

      savePrefsToLocalStorage(updatedPrefs);
      return { prefs: updatedPrefs };
    });
  },

  toggleAutoPlayNavigation: (accountId, value) => {
    set((state) => {
      const prev = state.prefs;
      const accountData = prev[accountId] || { favoritesTable: { live: [], vod: [], series: [] }, history: {} };
      
      const updatedPrefs = {
        ...prev,
        [accountId]: {
          ...accountData,
          autoPlayNavigation: value
        }
      };

      savePrefsToLocalStorage(updatedPrefs);
      return { prefs: updatedPrefs };
    });
  }
}));

// Setup automatic fast cross-tab sync
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY && e.newValue) {
    try {
      const parsed = JSON.parse(e.newValue);
      usePreferencesStore.setState({ prefs: parsed });
    } catch (err) {
      console.error("Failed to parse storage update inside Zustand listener", err);
    }
  }
});
