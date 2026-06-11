import { create } from 'zustand';
import { XtreamCategory, XtreamStream } from '../types';

interface PlayerState {
  url: string;
  title: string;
  type: 'live' | 'vod' | 'series';
  currentItem?: XtreamStream;
  currentEpisode?: any;
}

interface MediaState {
  // Navigation & UI Mode State
  uiMode: 'normal' | 'flow';
  viewMode: 'grid' | 'epg';
  currentLevel: 'categories' | 'items' | 'detail';
  selectedCategory: XtreamCategory | null;
  
  // Selection / Detail Stack State
  selectedItem: XtreamStream | null;
  historyStack: XtreamStream[];
  detailData: any | null;

  // Active Player State
  player: PlayerState | null;
  isPlayerExpanded: boolean;
  isPlayerFullWindow: boolean;
  showStreamList: boolean;
  
  // Audio & Hero Mute State
  isTrailerMuted: boolean;

  // Search State
  mediaSearchQuery: string;

  // Loading / Error
  isMediaLoading: boolean;
  mediaError: string | null;

  // Actions
  setUiMode: (uiMode: 'normal' | 'flow') => void;
  setViewMode: (viewMode: 'grid' | 'epg') => void;
  setCurrentLevel: (currentLevel: 'categories' | 'items' | 'detail') => void;
  setSelectedCategory: (category: XtreamCategory | null) => void;
  setSelectedItem: (item: XtreamStream | null) => void;
  pushToHistoryStack: (item: XtreamStream) => void;
  popHistoryStack: () => void;
  clearHistoryStack: () => void;
  setHistoryStack: (historyStack: XtreamStream[]) => void;
  setDetailData: (detailData: any | null) => void;
  setPlayer: (player: PlayerState | null) => void;
  setIsPlayerExpanded: (isExpanded: boolean) => void;
  setIsPlayerFullWindow: (isFullWindow: boolean) => void;
  setShowStreamList: (show: boolean) => void;
  setIsTrailerMuted: (isMuted: boolean) => void;
  setMediaSearchQuery: (query: string) => void;
  setIsMediaLoading: (isLoading: boolean) => void;
  setMediaError: (error: string | null) => void;
  resetMediaStore: () => void;
}

const getInitialUiMode = (): 'normal' | 'flow' => {
  return (localStorage.getItem('category_ui_mode') as 'normal' | 'flow') || 'normal';
};

export const useMediaStore = create<MediaState>((set, get) => ({
  uiMode: getInitialUiMode(),
  viewMode: 'grid',
  currentLevel: 'categories',
  selectedCategory: null,
  selectedItem: null,
  historyStack: [],
  detailData: null,
  player: null,
  isPlayerExpanded: false,
  isPlayerFullWindow: false,
  showStreamList: true,
  isTrailerMuted: true,
  mediaSearchQuery: '',
  isMediaLoading: false,
  mediaError: null,

  setUiMode: (uiMode) => {
    localStorage.setItem('category_ui_mode', uiMode);
    set({ uiMode });
  },
  setViewMode: (viewMode) => set({ viewMode }),
  setCurrentLevel: (currentLevel) => set({ currentLevel }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  setSelectedItem: (selectedItem) => set({ selectedItem }),
  pushToHistoryStack: (item) => set((state) => ({ historyStack: [...state.historyStack, item] })),
  popHistoryStack: () => set((state) => {
    const nextStack = [...state.historyStack];
    const item = nextStack.pop() || null;
    return { historyStack: nextStack, selectedItem: item };
  }),
  clearHistoryStack: () => set({ historyStack: [] }),
  setHistoryStack: (historyStack) => set({ historyStack }),
  setDetailData: (detailData) => set({ detailData }),
  setPlayer: (player) => set({ player }),
  setIsPlayerExpanded: (isPlayerExpanded) => set({ isPlayerExpanded }),
  setIsPlayerFullWindow: (isPlayerFullWindow) => set({ isPlayerFullWindow }),
  setShowStreamList: (showStreamList) => set({ showStreamList }),
  setIsTrailerMuted: (isTrailerMuted) => set({ isTrailerMuted }),
  setMediaSearchQuery: (mediaSearchQuery) => set({ mediaSearchQuery }),
  setIsMediaLoading: (isMediaLoading) => set({ isMediaLoading }),
  setMediaError: (mediaError) => set({ mediaError }),
  resetMediaStore: () => set({
    viewMode: 'grid',
    currentLevel: 'categories',
    selectedCategory: null,
    selectedItem: null,
    historyStack: [],
    detailData: null,
    player: null,
    isPlayerExpanded: false,
    isPlayerFullWindow: false,
    showStreamList: true,
    isTrailerMuted: true,
    mediaSearchQuery: '',
    isMediaLoading: false,
    mediaError: null,
  }),
}));
