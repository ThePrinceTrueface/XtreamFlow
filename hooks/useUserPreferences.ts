import { useCallback, useMemo } from 'react';
import { usePreferencesStore } from '../store/usePreferencesStore';
import { XtreamStream, StreamProgress, PlayerSettings } from '../types';

export const useUserPreferences = (accountId: string) => {
  // Select the specific account's preferences from the reactive Zustand store.
  // This hook call guarantees that whenever this specific account's preferences update,
  // the component invoking useUserPreferences(accountId) re-renders automatically!
  const accountPrefs = usePreferencesStore(state => state.prefs[accountId]);

  // Actions from the store
  const toggleFavoriteAction = usePreferencesStore(state => state.toggleFavorite);
  const updateProgressAction = usePreferencesStore(state => state.updateProgress);
  const clearProgressAction = usePreferencesStore(state => state.clearProgress);
  const addToHistoryAction = usePreferencesStore(state => state.addToHistory);
  const clearHistoryAction = usePreferencesStore(state => state.clearHistory);
  const updatePlayerSettingsAction = usePreferencesStore(state => state.updatePlayerSettings);
  const toggleAutoPlayNavigationAction = usePreferencesStore(state => state.toggleAutoPlayNavigation);

  const favoritesTable = accountPrefs?.favoritesTable;
  const history = accountPrefs?.history;

  const getFavorites = useCallback((type: 'live' | 'vod' | 'series'): XtreamStream[] => {
    return favoritesTable?.[type] || [];
  }, [favoritesTable]);

  // Memoize sets of favorite IDs for O(1) lookups during render
  const favoriteIds = useMemo(() => {
     const sets = {
         live: new Set<string>(),
         vod: new Set<string>(),
         series: new Set<string>(),
         all: new Set<string>()
     };
     if (!favoritesTable) return sets;

     const addIds = (arr: XtreamStream[] | undefined, set: Set<string>) => {
         if (!arr) return;
         for (const item of arr) {
             const id = (item.stream_id || item.series_id || "").toString();
             if (id) {
                 set.add(id);
                 sets.all.add(id);
             }
         }
     };

     addIds(favoritesTable.live, sets.live);
     addIds(favoritesTable.vod, sets.vod);
     addIds(favoritesTable.series, sets.series);

     return sets;
  }, [favoritesTable]);

  const isFavorite = useCallback((itemId: string | number | undefined, type?: 'live' | 'vod' | 'series'): boolean => {
    if (!itemId) return false;
    const idStr = itemId.toString();
    
    if (type) {
        return favoriteIds[type].has(idStr);
    }
    return favoriteIds.all.has(idStr);
  }, [favoriteIds]);

  const toggleFavorite = useCallback((item: XtreamStream, type: 'live' | 'vod' | 'series') => {
    toggleFavoriteAction(accountId, item, type);
  }, [accountId, toggleFavoriteAction]);

  const getProgress = useCallback((itemId: string | number | undefined): StreamProgress | null => {
    if (!itemId) return null;
    const idStr = itemId.toString();
    return history?.[idStr] || null;
  }, [history]);

  const updateProgress = useCallback((item: XtreamStream, time: number, duration: number) => {
    updateProgressAction(accountId, item, time, duration);
  }, [accountId, updateProgressAction]);

  const clearProgress = useCallback((itemId: string | number | undefined) => {
    clearProgressAction(accountId, itemId);
  }, [accountId, clearProgressAction]);

  const addToHistory = useCallback((item: XtreamStream, streamType: 'live' | 'vod' | 'series') => {
    addToHistoryAction(accountId, item, streamType);
  }, [accountId, addToHistoryAction]);

  const getHistory = useCallback((type?: 'live' | 'vod' | 'series'): XtreamStream[] => {
    const historyMap = history || {};
    return Object.values(historyMap)
      .filter((h: any) => {
        if (!h.item) return false;
        if (!type) return true;
        const itemType = h.item.stream_type;
        return itemType === type;
      })
      .sort((a, b) => b.lastWatched - a.lastWatched)
      .map(h => h.item as XtreamStream);
  }, [history]);

  const clearHistory = useCallback((type?: 'live' | 'vod' | 'series') => {
    clearHistoryAction(accountId, type);
  }, [accountId, clearHistoryAction]);

  const getPlayerSettings = useCallback(() => {
    return accountPrefs?.playerSettings || { reconnectDelay: 5000 as const };
  }, [accountPrefs]);

  const updatePlayerSettings = useCallback((settings: Partial<PlayerSettings>) => {
    updatePlayerSettingsAction(accountId, settings);
  }, [accountId, updatePlayerSettingsAction]);

  const getAutoPlayNavigation = useCallback(() => {
    return accountPrefs?.autoPlayNavigation ?? false;
  }, [accountPrefs]);

  const toggleAutoPlayNavigation = useCallback((value: boolean) => {
    toggleAutoPlayNavigationAction(accountId, value);
  }, [accountId, toggleAutoPlayNavigationAction]);

  return {
    isFavorite,
    toggleFavorite,
    getFavorites,
    getProgress,
    updateProgress,
    clearProgress,
    addToHistory,
    getHistory,
    clearHistory,
    getPlayerSettings,
    updatePlayerSettings,
    getAutoPlayNavigation,
    toggleAutoPlayNavigation
  };
};
