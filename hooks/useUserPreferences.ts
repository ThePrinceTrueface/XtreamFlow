
import { useState, useEffect, useCallback, useRef } from 'react';
import { GlobalPreferences, StreamProgress, XtreamStream, AccountPreferences } from '../types';

const STORAGE_KEY = 'xtream_user_prefs';

export const useUserPreferences = (accountId: string) => {
  // Load initial state safely
  const loadPrefs = (): GlobalPreferences => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return {};
      const parsed = JSON.parse(stored) as GlobalPreferences;
      
      // Migration & Structure Integrity
      Object.keys(parsed).forEach(accId => {
          const acc = parsed[accId];
          // If old favorites exist (array or old object), reset or migrate
          if (!acc.favoritesTable || Array.isArray(acc.favoritesTable)) {
              acc.favoritesTable = { live: [], vod: [], series: [] };
          }
          // Clean up old key if exists
          if ((acc as any).favorites) delete (acc as any).favorites;
      });
      
      return parsed;
    } catch (e) {
      console.error("Failed to load user preferences", e);
      return {};
    }
  };

  // Internal state for UI reactivity
  const [prefs, setPrefs] = useState<GlobalPreferences>(loadPrefs);

  // Sync to local storage whenever prefs change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  // --- Favorites Logic ---

  const getFavorites = useCallback((type: 'live' | 'vod' | 'series'): XtreamStream[] => {
    return prefs[accountId]?.favoritesTable?.[type] || [];
  }, [prefs, accountId]);

  const isFavorite = useCallback((itemId: string | number | undefined, type?: 'live' | 'vod' | 'series'): boolean => {
    if (!itemId) return false;
    const idStr = itemId.toString();
    const table = prefs[accountId]?.favoritesTable;
    if (!table) return false;

    if (type) {
        return table[type]?.some(item => (item.stream_id || item.series_id || "").toString() === idStr) || false;
    }

    return (
        table.live?.some(item => (item.stream_id || "").toString() === idStr) ||
        table.vod?.some(item => (item.stream_id || "").toString() === idStr) ||
        table.series?.some(item => (item.series_id || "").toString() === idStr) ||
        false
    );
  }, [prefs, accountId]);

  const toggleFavorite = useCallback((item: XtreamStream, type: 'live' | 'vod' | 'series') => {
    const itemId = item.stream_id || item.series_id;
    if (!itemId) return;
    const idStr = itemId.toString();
    
    setPrefs(prev => {
      const accountData = prev[accountId] || { favoritesTable: { live: [], vod: [], series: [] }, history: {} };
      const table = accountData.favoritesTable || { live: [], vod: [], series: [] };
      
      const typeFavs = table[type] || [];
      const isFav = typeFavs.some(f => (f.stream_id || f.series_id || "").toString() === idStr);

      const newTypeFavs = isFav
        ? typeFavs.filter(f => (f.stream_id || f.series_id || "").toString() !== idStr)
        : [...typeFavs, item];

      return {
        ...prev,
        [accountId]: {
          ...accountData,
          favoritesTable: {
            ...table,
            [type]: newTypeFavs
          }
        }
      };
    });
  }, [accountId]);

  // --- History / Progress Logic ---

  const getProgress = useCallback((itemId: string | number | undefined): StreamProgress | null => {
    if (!itemId) return null;
    const idStr = itemId.toString();
    return prefs[accountId]?.history?.[idStr] || null;
  }, [prefs, accountId]);

  const updateProgress = useCallback((item: XtreamStream, time: number, duration: number) => {
    const itemId = item.stream_id || item.series_id;
    if (!itemId || duration <= 0) return;
    const idStr = itemId.toString();
    const progress = time / duration;
    const finished = progress > 0.92; // Mark as finished if > 92% watched

    setPrefs(prev => {
      const accountData = prev[accountId] || { favoritesTable: { live: [], vod: [], series: [] }, history: {} } as AccountPreferences;
      
      return {
        ...prev,
        [accountId]: {
          ...accountData,
          history: {
            ...accountData.history,
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
    });
  }, [accountId]);

  const clearProgress = useCallback((itemId: string | number | undefined) => {
     if (!itemId) return;
     const idStr = itemId.toString();
     setPrefs(prev => {
        const accountData = prev[accountId];
        if (!accountData) return prev;

        const newHistory = { ...accountData.history };
        delete newHistory[idStr];

        return {
            ...prev,
            [accountId]: { ...accountData, history: newHistory }
        };
     });
  }, [accountId]);

  // --- Player Settings Logic ---

  const getPlayerSettings = useCallback(() => {
    return prefs[accountId]?.playerSettings || { reconnectDelay: 5000 as const };
  }, [prefs, accountId]);

  const updatePlayerSettings = useCallback((settings: Partial<import('../types').PlayerSettings>) => {
    setPrefs(prev => {
      const accountData = prev[accountId] || { favoritesTable: { live: [], vod: [], series: [] }, history: {} } as AccountPreferences;
      return {
        ...prev,
        [accountId]: {
          ...accountData,
          playerSettings: {
            ...(accountData.playerSettings || { reconnectDelay: 5000 as const }),
            ...settings
          }
        }
      };
    });
  }, [accountId]);

  return {
    isFavorite,
    toggleFavorite,
    getFavorites,
    getProgress,
    updateProgress,
    clearProgress,
    getPlayerSettings,
    updatePlayerSettings
  };
};
