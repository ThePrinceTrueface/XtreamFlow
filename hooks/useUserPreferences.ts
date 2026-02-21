
import { useState, useEffect, useCallback, useRef } from 'react';
import { GlobalPreferences, StreamProgress } from '../types';

const STORAGE_KEY = 'xtream_user_prefs';

export const useUserPreferences = (accountId: string) => {
  // Load initial state safely
  const loadPrefs = (): GlobalPreferences => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
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

  const isFavorite = useCallback((itemId: string | number | undefined): boolean => {
    if (!itemId) return false;
    const idStr = itemId.toString();
    const accountPrefs = prefs[accountId];
    return accountPrefs?.favorites?.includes(idStr) || false;
  }, [prefs, accountId]);

  const toggleFavorite = useCallback((itemId: string | number | undefined) => {
    if (!itemId) return;
    const idStr = itemId.toString();
    
    setPrefs(prev => {
      const accountData = prev[accountId] || { favorites: [], history: {} };
      const currentFavs = accountData.favorites || [];
      
      const newFavs = currentFavs.includes(idStr)
        ? currentFavs.filter(id => id !== idStr)
        : [...currentFavs, idStr];

      return {
        ...prev,
        [accountId]: {
          ...accountData,
          favorites: newFavs
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

  const updateProgress = useCallback((itemId: string | number | undefined, time: number, duration: number) => {
    if (!itemId || duration <= 0) return;
    const idStr = itemId.toString();
    const progress = time / duration;
    const finished = progress > 0.92; // Mark as finished if > 92% watched

    setPrefs(prev => {
      const accountData = prev[accountId] || { favorites: [], history: {} };
      
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
              lastWatched: Date.now()
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

  return {
    isFavorite,
    toggleFavorite,
    getProgress,
    updateProgress,
    clearProgress
  };
};
