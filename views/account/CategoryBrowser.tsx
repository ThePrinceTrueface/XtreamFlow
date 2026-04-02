
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Tv, RefreshCw, ArrowLeft, Search, Folder, Layout, List, Film, Clapperboard, Columns, PanelLeftOpen, PanelLeftClose, Star } from 'lucide-react';
import { XtreamAccount, XtreamCategory, XtreamStream } from '../../types';
import { Button } from '../../components/Win11UI';
import { VideoPlayer } from '../../components/VideoPlayer';
import { createProxyUrl, createInlineWorker } from '../../utils';
import { XTREAM_WORKER_CODE } from '../../workers/xtream.worker';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { cacheService } from '../../services/cacheService';

// Sous-modules modularisés
import { HeroSection } from './components/HeroSection';
import { AdvancedSidebar } from './components/AdvancedSidebar';
import { ItemGrid, HorizontalRow } from './components/BrowsingViews';
import { ItemDetailView } from './components/ItemDetailView';
import { SkeletonLoader } from './components/SkeletonLoader';
import { StreamListSidebar } from './components/StreamListSidebar';
import { EPGView } from './components/EPGView';

const FAVORITES_CATEGORY: XtreamCategory = { category_id: 'favorites', category_name: 'Favoris', parent_id: 0 };

interface CategoryBrowserProps {
    account: XtreamAccount;
    type: 'live' | 'vod' | 'series';
    preselectedChannelId?: string;
    preselectedItemId?: string;
    preselectedItemType?: string;
    preselectedEpisodeId?: string;
    preselectedSeason?: string;
}

export const CategoryBrowser: React.FC<CategoryBrowserProps> = ({ account, type, preselectedChannelId, preselectedItemId, preselectedItemType, preselectedEpisodeId, preselectedSeason }) => {
  // ...
  
  const navigate = useNavigate();
  
  // Navigation & UI State
  const [uiMode, setUiMode] = useState<'normal' | 'flow'>(() => (localStorage.getItem('category_ui_mode') as 'normal' | 'flow') || 'normal');
  const [viewMode, setViewMode] = useState<'grid' | 'epg'>('grid'); // New state for EPG toggle
  const [currentLevel, setCurrentLevel] = useState<'categories' | 'items' | 'detail'>('categories');
  const [selectedCategory, setSelectedCategory] = useState<XtreamCategory | null>(null);
  
  // Detail Navigation Stack
  const [selectedItem, setSelectedItem] = useState<XtreamStream | null>(null);
  const [historyStack, setHistoryStack] = useState<XtreamStream[]>([]); // To track deep navigation
  
  // Data State
  const [categories, setCategories] = useState<XtreamCategory[]>([]);
  const [fullData, setFullData] = useState<any[]>([]); 
  const [displayData, setDisplayData] = useState<any[]>([]); 
  const [categoryPreviews, setCategoryPreviews] = useState<Record<string, XtreamStream[]>>({});

  // Hero Logic State
  const [heroIndex, setHeroIndex] = useState<number>(-1);
  const [heroDetail, setHeroDetail] = useState<any>(null);
  const [heroPhase, setHeroPhase] = useState<'backdrop' | 'trailer'>('backdrop');
  const [isHeroFading, setIsHeroFading] = useState(false);
  const [isTrailerMuted, setIsTrailerMuted] = useState(true); // Default muted for autoplay
  
  // Player & Expansion State
  const [player, setPlayer] = useState<{ 
      url: string; 
      title: string; 
      type: 'live' | 'vod' | 'series';
      currentItem?: XtreamStream;
  } | null>(null);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [isPlayerFullWindow, setIsPlayerFullWindow] = useState(false);
  const [showStreamList, setShowStreamList] = useState(true); // Toggle for side-by-side stream list
  const [epgPlayerHeight, setEpgPlayerHeight] = useState(220);
  const [epgExpandedHeight, setEpgExpandedHeight] = useState(400);
  const [isResizingEpgPlayer, setIsResizingEpgPlayer] = useState(false);
  const resizeState = useRef({ startY: 0, startHeight: 0 });

  // Refs
  const heroTimeoutRef = useRef<number | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const classicScrollRef = useRef<HTMLDivElement>(null); // Ref for Classic Mode Scroll Container
  const heroContainerRef = useRef<HTMLDivElement>(null); // Ref for Visibility Detection
  const ytContainerId = useMemo(() => `yt-player-${Math.random().toString(36).substr(2, 9)}`, []);
  const workerRef = useRef<Worker | null>(null);
  
  // Ref for detail synchronization and Mute persistence without re-triggering effects
  const heroDetailRef = useRef<any>(null);
  const isTrailerMutedRef = useRef(true);
  const preselectionHandledRef = useRef<string | null>(null);

  const { isFavorite, getFavorites } = useUserPreferences(account.id);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [detailData, setDetailData] = useState<any | null>(null); 

  // Computed display data to handle favorites reactivity and search
  const itemsToDisplay = useMemo(() => {
    if (selectedCategory?.category_id === 'favorites') {
        const favs = getFavorites(type);
        if (!searchQuery) return favs;
        const q = searchQuery.toLowerCase();
        return favs.filter(item => (item.name || "").toLowerCase().includes(q));
    }

    const base = displayData;
    if (!searchQuery) return base;

    const q = searchQuery.toLowerCase();
    return base.filter(item => 
        (item.name || "").toLowerCase().includes(q)
    );
  }, [displayData, selectedCategory, searchQuery, getFavorites, type]);

  // MEMOIZED CONFIGURATION TO PREVENT INFINITE LOOPS
  const currentConfig = useMemo(() => {
    const config = {
        live: { catAction: 'get_live_categories', listAction: 'get_live_streams', icon: Tv, label: 'Live TV' },
        vod: { catAction: 'get_vod_categories', listAction: 'get_vod_streams', icon: Film, label: 'Films' },
        series: { catAction: 'get_series_categories', listAction: 'get_series', icon: Clapperboard, label: 'Séries' }
    };
    return config[type];
  }, [type]);

  // Init Worker
  useEffect(() => {
      try {
          workerRef.current = createInlineWorker(XTREAM_WORKER_CODE);
          workerRef.current.onmessage = (e) => {
              const { type, data, error } = e.data;
              if (type === 'SUCCESS') {
                  setFullData(data.full);
                  setCategoryPreviews(data.grouped);
                  setHeroIndex(data.full.length > 0 ? Math.floor(Math.random() * Math.min(data.full.length, 100)) : -1);
                  
                  // In Flow mode, displayData is the full set
                  if (uiMode === 'flow') {
                      setDisplayData(data.full);
                  }
                  
                  setLoading(false);
              } else if (type === 'ERROR') {
                  console.error("Worker Error:", error);
                  setLoading(false);
              } else if (type === 'FILTER_RESULT') {
                  setDisplayData(data);
              }
          };
      } catch (e) {
          console.error("Worker Init Failed", e);
      }
      return () => workerRef.current?.terminate();
  }, []);

  // Sync ref with state
  useEffect(() => { heroDetailRef.current = heroDetail; }, [heroDetail]);
  useEffect(() => { isTrailerMutedRef.current = isTrailerMuted; }, [isTrailerMuted]);

  const fetchAndSetDetail = useCallback((item: XtreamStream) => {
      const id = item.stream_id || item.series_id;
      if (!id || type === 'live' || !account) return;

      setLoading(true);
      setError(null);
      cacheService.getStreamInfo(account, type as 'vod' | 'series', id).then(res => {
          setDetailData(Array.isArray(res) ? res[0] : res);
          setLoading(false);
      }).catch((err) => {
          console.error("Error fetching stream info:", err);
          setError("Erreur lors du chargement des détails.");
          setLoading(false);
      });
  }, [account?.id, type]); // Use account.id to stabilize the callback

  // Handle deep linking/preselection
  useEffect(() => {
    if (loading || fullData.length === 0) return;

    // 1. Handle Category Preselection
    if (preselectedChannelId) {
      const isFav = preselectedChannelId === 'favorites';
      const currentCatId = selectedCategory?.category_id;
      
      if (isFav && currentCatId !== 'favorites') {
        setSelectedCategory(FAVORITES_CATEGORY);
        setCurrentLevel('items');
      } else if (!isFav && preselectedChannelId !== 'all' && currentCatId !== preselectedChannelId) {
        const category = categories.find(c => c.category_id === preselectedChannelId);
        if (category) {
          setSelectedCategory(category);
          setCurrentLevel('items');
        }
      }
    }
    
    // 2. Handle Item Preselection
    if (preselectedItemId) {
      // Check if we already handled this specific item preselection
      if (preselectionHandledRef.current === preselectedItemId) return;

      const item = fullData.find(i => i.stream_id?.toString() === preselectedItemId || i.series_id?.toString() === preselectedItemId);
      if (item) {
        // Mark as handled BEFORE calling state updates to prevent loop
        preselectionHandledRef.current = preselectedItemId;
        
        setSelectedItem(item);
        setCurrentLevel('detail');
        fetchAndSetDetail(item);
      }
    } else {
        // Reset handled ref if no preselected item is present
        preselectionHandledRef.current = null;
    }
  }, [loading, fullData, categories, preselectedChannelId, preselectedItemId, fetchAndSetDetail, selectedCategory]);

  // Reset player expansion when player closes
  const handleClosePlayer = useCallback(() => {
      setPlayer(null);
      setIsPlayerExpanded(false); // Reset to embedded for next time in flow mode
      setIsPlayerFullWindow(false);
      setShowStreamList(true); // Reset list visibility
  }, []);

  // Load YouTube API Script Global
  useEffect(() => {
    if (!document.getElementById('youtube-api-script')) {
      const tag = document.createElement('script');
      tag.id = 'youtube-api-script';
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // SCROLL RESET FOR CLASSIC MODE
  useEffect(() => {
    if (uiMode === 'normal' && classicScrollRef.current) {
        classicScrollRef.current.scrollTop = 0;
    }
  }, [currentLevel, selectedCategory, uiMode]);

  // --- TRAILER VISIBILITY OBSERVER ---
  useEffect(() => {
    const observer = new IntersectionObserver(
        ([entry]) => {
            if (!ytPlayerRef.current || typeof ytPlayerRef.current.mute !== 'function') return;
            if (entry.isIntersecting) {
                if (!isTrailerMutedRef.current) ytPlayerRef.current.unMute();
            } else {
                ytPlayerRef.current.mute();
            }
        },
        { threshold: 0.15 }
    );
    const el = heroContainerRef.current;
    if (el) observer.observe(el);
    return () => {
        if (el) observer.unobserve(el);
        observer.disconnect();
    };
  }, [heroPhase, heroIndex, uiMode]);

  const buildApiUrl = useCallback((action: string, params: Record<string, string> = {}) => {
    // Force http for Xtream API calls
    const baseUrl = `http://${account.host}:${account.port}/player_api.php`;
    const queryParams = new URLSearchParams({ username: account.username, password: account.password, action, ...params });
    return createProxyUrl(`${baseUrl}?${queryParams.toString()}`);
  }, [account]);

  // Next Hero Logic
  const handleNextHero = useCallback(() => {
    if (displayData.length <= 1) return;
    setIsHeroFading(true);
    if (heroTimeoutRef.current) window.clearTimeout(heroTimeoutRef.current);
    if (ytPlayerRef.current) { try { ytPlayerRef.current.destroy(); } catch(e) {} ytPlayerRef.current = null; }
    
    setTimeout(() => {
        setHeroDetail(null);
        setHeroPhase('backdrop');
        setHeroIndex(prev => {
           const maxPool = Math.min(displayData.length, 100);
           let next = Math.floor(Math.random() * maxPool);
           return next === prev ? (next + 1) % displayData.length : next;
        });
        setTimeout(() => setIsHeroFading(false), 50);
    }, 500);
  }, [displayData]);

  // Trailer Mute Toggle
  const toggleTrailerMute = useCallback(() => {
    if (ytPlayerRef.current && typeof ytPlayerRef.current.isMuted === 'function') {
        if (ytPlayerRef.current.isMuted()) {
            ytPlayerRef.current.unMute();
            setIsTrailerMuted(false);
        } else {
            ytPlayerRef.current.mute();
            setIsTrailerMuted(true);
        }
    }
  }, []);

  // Projector Cycle
  useEffect(() => {
    if (player) {
        if (heroTimeoutRef.current) window.clearTimeout(heroTimeoutRef.current);
        return;
    }
    if (heroPhase === 'backdrop' && heroIndex !== -1) {
        if (heroTimeoutRef.current) window.clearTimeout(heroTimeoutRef.current);
        heroTimeoutRef.current = window.setTimeout(() => {
            if (heroDetailRef.current?.info?.youtube_trailer) {
                setHeroPhase('trailer');
            } else {
                handleNextHero();
            }
        }, 8000);
    }
    return () => { if (heroTimeoutRef.current) window.clearTimeout(heroTimeoutRef.current); };
  }, [heroPhase, heroIndex, handleNextHero, player]);

  // Trailer Player Management
  useEffect(() => {
    let checkInterval: number | null = null;
    if (player) {
        if (ytPlayerRef.current) { try { ytPlayerRef.current.destroy(); } catch(e) {} ytPlayerRef.current = null; }
        return;
    }
    if (heroPhase === 'trailer') {
        const trailerUrl = heroDetail?.info?.youtube_trailer;
        if (!trailerUrl) { handleNextHero(); return; }

        const getYoutubeId = (url: string) => {
            if (!url) return null;
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
            const match = url.match(regExp);
            return (match && match[2].length === 11) ? match[2] : url; 
        };
        const videoId = getYoutubeId(trailerUrl);
        if (!videoId) { handleNextHero(); return; }

        const initPlayer = () => {
             if (ytPlayerRef.current) { try { ytPlayerRef.current.destroy(); } catch(e) {} }
             try {
                ytPlayerRef.current = new (window as any).YT.Player(ytContainerId, {
                    videoId: videoId,
                    playerVars: { autoplay: 1, controls: 0, mute: 1, modestbranding: 1, rel: 0, start: 10, origin: window.location.origin },
                    events: {
                        onReady: (e: any) => {
                            e.target.playVideo();
                            if (!isTrailerMutedRef.current) e.target.unMute();
                        },
                        onStateChange: (e: any) => { if (e.data === (window as any).YT.PlayerState.ENDED) handleNextHero(); },
                        onError: (e: any) => handleNextHero()
                    }
                });
            } catch (e) { handleNextHero(); }
        };

        if ((window as any).YT && (window as any).YT.Player) {
            initPlayer();
        } else {
            let attempts = 0;
            checkInterval = window.setInterval(() => {
                attempts++;
                if ((window as any).YT && (window as any).YT.Player) {
                    if (checkInterval) clearInterval(checkInterval);
                    initPlayer();
                } else if (attempts > 30) { 
                     if (checkInterval) clearInterval(checkInterval);
                     handleNextHero();
                }
            }, 100);
        }
    }
    return () => { if (checkInterval) clearInterval(checkInterval); };
  }, [heroPhase, heroDetail, ytContainerId, handleNextHero, player]);

  useEffect(() => {
    if (!isResizingEpgPlayer) return;
    const handleMouseMove = (e: MouseEvent) => {
        const delta = e.clientY - resizeState.current.startY;
        const newHeight = resizeState.current.startHeight + delta;
        if (isPlayerExpanded) {
            setEpgExpandedHeight(Math.max(200, Math.min(newHeight, window.innerHeight - 100)));
        } else {
            setEpgPlayerHeight(Math.max(120, Math.min(newHeight, 600)));
        }
    };
    const handleMouseUp = () => setIsResizingEpgPlayer(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingEpgPlayer, isPlayerExpanded]);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
        const catData = await cacheService.getCategories(account, type);
        if (Array.isArray(catData)) setCategories(catData);

        if (uiMode === 'flow') {
            const listData = await cacheService.getStreams(account, type);
            if (workerRef.current) {
                // Use worker to group data
                workerRef.current.postMessage({ 
                    type: 'GROUP_DATA', 
                    payload: { data: listData, limit: 20 },
                    id: Date.now()
                });
            } else {
                // Fallback
                if (Array.isArray(listData)) {
                    setFullData(listData);
                    setDisplayData(listData);
                    setHeroIndex(listData.length > 0 ? Math.floor(Math.random() * Math.min(listData.length, 100)) : -1);
                }
                setLoading(false);
            }
        } else {
            setLoading(false);
        }
    } catch (e) { 
        console.error("Error loading categories:", e);
        setError("Erreur lors du chargement des catégories et des flux."); 
        setLoading(false);
    }
  }, [account, type, uiMode]);

  useEffect(() => { 
    loadCategories(); 
  }, [loadCategories]);

  // Reset navigation when type changes
  useEffect(() => {
    setCurrentLevel('categories');
    setSelectedCategory(null);
    setSelectedItem(null);
    setHistoryStack([]);
    setSearchQuery('');
    setFullData([]);
    setDisplayData([]);
  }, [type]);

  // FILTERED CATEGORIES (For Classic Mode Search)
  const filteredCategories = useMemo(() => {
    if (!searchQuery || currentLevel !== 'categories') return categories;
    return categories.filter(c => c.category_name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [categories, searchQuery, currentLevel]);

  const handleCategorySelect = async (cat: XtreamCategory | null | 'favorites') => {
    setSearchQuery('');
    
    if (cat === 'favorites') {
        setSelectedCategory(FAVORITES_CATEGORY);
        setCurrentLevel('items');
        setHistoryStack([]);
        setSelectedItem(null);
        setHeroIndex(-1);
        navigate(`/account/${account.id}/${type}/favorites`);
        return;
    }

    setSelectedCategory(cat);
    setCurrentLevel('items');
    setHistoryStack([]);
    setSelectedItem(null);
    
    if (cat) {
        navigate(`/account/${account.id}/${type}/${cat.category_id}`);
    } else {
        navigate(`/account/${account.id}/${type}`);
    }
    
    // Reset Data contexts
    setDisplayData([]);
    setHeroIndex(-1);
    
    if (cat === null) {
        // Mode Flow: Returning to 'All' implies loading all items back into fullData for global search
        if (uiMode === 'flow') {
             setLoading(true);
             const listData = await cacheService.getStreams(account, type);
             if (workerRef.current) {
                 workerRef.current.postMessage({ 
                     type: 'GROUP_DATA', 
                     payload: { data: listData, limit: 20 },
                     id: Date.now() 
                 });
             }
        } else {
             // Classic Mode: 'All' means back to category list, so no items data needed
             setFullData([]);
        }
    } else {
        setLoading(true); 
        try {
            const d = await cacheService.getStreams(account, type, cat.category_id);
            if (Array.isArray(d)) {
                setFullData(d); // Update fullData context for search
                setDisplayData(d);
                setHeroIndex(d.length > 0 ? Math.floor(Math.random() * Math.min(d.length, 50)) : -1);
            }
        } catch (err) {
            console.error("Error filtering category:", err);
            setError("Erreur lors du chargement de la catégorie.");
        } finally {
            setLoading(false);
        }
    }
  };

  // --- ACTIONS ---


  const handleDetail = useCallback((item: XtreamStream) => {
        if (currentLevel === 'detail' && selectedItem) {
            setHistoryStack(prev => [...prev, selectedItem]);
        } else {
            setHistoryStack([]);
        }
        
        const itemId = (item.stream_id || item.series_id)?.toString();
        if (itemId) {
            preselectionHandledRef.current = itemId;
        }
        
        setSelectedItem(item);
        setCurrentLevel('detail');
        fetchAndSetDetail(item);
        
        if (selectedCategory) {
            navigate(`/account/${account.id}/${type}/${selectedCategory.category_id}/${itemId}`);
        } else {
            navigate(`/account/${account.id}/${type}/all/${itemId}`);
        }
  }, [currentLevel, selectedItem, fetchAndSetDetail, account.id, type, selectedCategory, navigate]);

  const handlePlay = useCallback((item: XtreamStream) => {
    // Force http for Xtream streams
    const baseUrl = `http://${account.host}:${account.port}`;
    if (type === 'live') {
        setPlayer({ 
            url: createProxyUrl(`${baseUrl}/live/${account.username}/${account.password}/${item.stream_id}.m3u8`), 
            title: item.name, 
            type: 'live',
            currentItem: item
        });
    } else if (type === 'vod') {
        const ext = (item as any).container_extension || 'mp4';
        setPlayer({ 
            url: createProxyUrl(`${baseUrl}/movie/${account.username}/${account.password}/${item.stream_id}.${ext}`), 
            title: item.name, 
            type: 'vod',
            currentItem: item
        });
    } else if (type === 'series') {
        if (currentLevel === 'detail' && detailData && detailData.episodes) {
             const seasons = Object.keys(detailData.episodes).sort((a,b) => parseInt(a)-parseInt(b));
             if (seasons.length > 0) {
                 const firstSeason = detailData.episodes[seasons[0]];
                 if (firstSeason && firstSeason.length > 0) {
                     const ep = firstSeason[0];
                     const ext = ep.container_extension || 'mp4';
                     setPlayer({
                         url: createProxyUrl(`${baseUrl}/series/${account.username}/${account.password}/${ep.id}.${ext}`),
                         title: `${item.name} - S${seasons[0]}E${ep.episode_num}`,
                         type: 'series',
                         currentItem: item
                     });
                     return;
                 }
             }
         }
         handleDetail(item);
    }
  }, [account, type, currentLevel, detailData]);

  const handlePlayEpisode = useCallback((episode: any) => {
      // Force http for Xtream streams
      const baseUrl = `http://${account.host}:${account.port}`;
      const ext = episode.container_extension || 'mp4';
      setPlayer({
          url: createProxyUrl(`${baseUrl}/series/${account.username}/${account.password}/${episode.id}.${ext}`),
          title: `${selectedItem?.name || 'Série'} - S${episode.season}E${episode.episode_num} - ${episode.title}`,
          type: 'series',
          currentItem: selectedItem || undefined
      });
  }, [account, selectedItem]);



  const handleNavigateBack = useCallback(() => {
      if (historyStack.length > 0) {
          const newHistory = [...historyStack];
          const previousItem = newHistory.pop();
          setHistoryStack(newHistory);
          if (previousItem) {
              const itemId = (previousItem.stream_id || previousItem.series_id)?.toString();
              if (itemId) {
                  preselectionHandledRef.current = itemId;
              }
              
              setSelectedItem(previousItem);
              fetchAndSetDetail(previousItem);
              
              if (selectedCategory) {
                  navigate(`/account/${account.id}/${type}/${selectedCategory.category_id}/${itemId}`);
              } else {
                  navigate(`/account/${account.id}/${type}/all/${itemId}`);
              }
          }
      } else {
          preselectionHandledRef.current = null;
          setCurrentLevel('items');
          setSelectedItem(null);
          setHistoryStack([]);
          if (selectedCategory) {
              navigate(`/account/${account.id}/${type}/${selectedCategory.category_id}`);
          } else {
              navigate(`/account/${account.id}/${type}`);
          }
      }
  }, [historyStack, fetchAndSetDetail, account.id, type, selectedCategory, navigate]);

  const handleGoBack = useCallback(() => {
      if (currentLevel === 'detail') {
          preselectionHandledRef.current = null;
          setCurrentLevel('items');
          setSelectedItem(null);
          setHistoryStack([]);
          if (selectedCategory) {
              navigate(`/account/${account.id}/${type}/${selectedCategory.category_id}`);
          } else {
              navigate(`/account/${account.id}/${type}`);
          }
      } else if (currentLevel === 'items') {
          setCurrentLevel('categories');
          setSelectedCategory(null);
          setSearchQuery('');
          navigate(`/account/${account.id}/${type}`);
      }
  }, [currentLevel, selectedCategory, account.id, type, navigate]);

  const handleGridClick = (item: XtreamStream) => {
      if (type === 'live') handlePlay(item);
      else handleDetail(item);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const q = query.toLowerCase().trim();
    if (workerRef.current && uiMode === 'flow') {
         workerRef.current.postMessage({ type: 'FILTER', payload: { query: q }, id: Date.now() });
    } else {
        if (!q) {
            setDisplayData(fullData);
        } else {
            setDisplayData(fullData.filter(i => (i.name || '').toLowerCase().includes(q)));
        }
    }
  };

  const heroItem = useMemo(() => {
     return heroIndex !== -1 && heroIndex < displayData.length ? displayData[heroIndex] : null;
  }, [heroIndex, displayData]);

  useEffect(() => {
    let isMounted = true;
    if (heroItem && currentLevel === 'items' && type !== 'live') {
      const id = heroItem.stream_id || heroItem.series_id;
      cacheService.getStreamInfo(account, type as 'vod' | 'series', id).then(data => {
        if (isMounted) setHeroDetail(Array.isArray(data) ? data[0] : data);
      });
    }
    return () => { isMounted = false; };
  }, [account, heroItem, currentLevel, type]);

  return (
    <div className="h-full flex flex-col bg-transparent relative">
        <style>{`
          @keyframes heroProgress { from { transform: scaleX(0); } to { transform: scaleX(1); } } 
          .no-scrollbar::-webkit-scrollbar { display: none; }
        `}</style>

        {/* Global Player for Full Window Mode or Normal Mode */}
        {player && (isPlayerFullWindow || (uiMode === 'normal' && viewMode !== 'epg')) && (
            <VideoPlayer 
                url={player.url} 
                title={player.title} 
                type={player.type} 
                onClose={handleClosePlayer}
                playlist={type === 'live' ? itemsToDisplay : undefined}
                currentItem={player.currentItem}
                onChannelSelect={handlePlay}
                isEmbedded={false}
                onToggleEmbed={() => setIsPlayerFullWindow(false)}
                onRestore={uiMode === 'flow' ? () => { setIsPlayerFullWindow(false); setViewMode('grid'); } : undefined}
                account={account}
            />
        )}

        <div className="flex-none flex items-center justify-between bg-[#1e1e1e]/90 backdrop-blur-xl py-4 px-8 border-b border-white/5 shadow-sm z-30">
            <div className="flex items-center gap-4">
                {(currentLevel !== 'categories' && uiMode === 'normal') && <Button variant="ghost" onClick={handleGoBack} className="!px-2 hover:bg-white/5"><ArrowLeft size={20} /></Button>}
                <h2 className="text-xl font-semibold flex items-center gap-3">
                    <currentConfig.icon size={24} className="text-fluent-accent" />
                    <span>
                        {uiMode === 'flow' ? currentConfig.label : (selectedCategory?.category_name || currentConfig.label)}
                    </span>
                </h2>
            </div>
            <div className="flex items-center gap-4">
                <div className="relative group w-72">
                    <input className="w-full bg-black/40 border border-white/10 rounded-control pl-9 pr-4 py-2 text-[13px] text-white focus:border-fluent-accent focus:bg-black/60 transition-all placeholder:text-fluent-subtext/40 font-normal"
                        placeholder={`Chercher dans ${currentConfig.label}...`} value={searchQuery} onChange={(e) => handleSearch(e.target.value)} />
                    <Search size={15} className="absolute left-3 top-2.5 text-fluent-subtext/50" />
                </div>
                
                {type === 'live' && (
                    <Button variant="secondary" onClick={() => setViewMode(prev => prev === 'grid' ? 'epg' : 'grid')} className="!px-4 h-9 flex items-center gap-2 border-white/10 bg-white/5 hover:bg-white/10 transition-all">
                        {viewMode === 'grid' ? <Layout size={18} /> : <List size={18} />}
                        <span className="text-[11px] font-bold uppercase tracking-wider">{viewMode === 'grid' ? 'Guide TV' : 'Liste'}</span>
                    </Button>
                )}

                <Button variant="secondary" onClick={() => { const nm = uiMode === 'normal' ? 'flow' : 'normal'; setUiMode(nm); localStorage.setItem('category_ui_mode', nm); }} className="!px-4 h-9 flex items-center gap-2 border-white/10 bg-white/5 hover:bg-white/10 transition-all">
                    {uiMode === 'normal' ? <Columns size={18} /> : <List size={18} />}
                    <span className="text-[11px] font-bold uppercase tracking-wider">{uiMode === 'normal' ? 'Flow' : 'Classique'}</span>
                </Button>
            </div>
        </div>

        <div className="flex-1 overflow-hidden relative">
            {uiMode === 'flow' ? (
                <div className="flex h-full overflow-hidden">
                    {/* Pane 1: Categories */}
                    <AdvancedSidebar categories={categories} selectedCategoryId={selectedCategory?.category_id || null} onSelectCategory={handleCategorySelect} />
                    
                    {/* Pane 2 & 3: Content or (Stream List + Player) */}
                    <div className="flex-1 flex overflow-hidden relative h-full">
                        {/* Player Active Layout */}
                        {player && viewMode !== 'epg' ? (
                            <>
                                {/* Pane 2: Stream List Sidebar (Collapsible) */}
                                {showStreamList && (
                                    <StreamListSidebar 
                                        items={itemsToDisplay} 
                                        selectedItem={player.currentItem || null} 
                                        onSelect={handlePlay} 
                                        onClose={() => setShowStreamList(false)}
                                        title={selectedCategory?.category_name || "Chaînes"}
                                    />
                                )}
                                
                                {/* Pane 3: Player & Expand Button */}
                                <div className="flex-1 flex flex-col relative h-full bg-black">
                                    {!showStreamList && (
                                        <button 
                                            onClick={() => setShowStreamList(true)}
                                            className="absolute left-0 top-1/2 -translate-y-1/2 z-[60] p-3 bg-black/60 rounded-r-xl text-white hover:bg-fluent-accent hover:text-black transition-all border-y border-r border-white/10 backdrop-blur-md shadow-lg transform hover:scale-110 active:scale-95"
                                            title="Afficher la liste"
                                        >
                                            <PanelLeftOpen size={20} />
                                        </button>
                                    )}
                                    {!isPlayerFullWindow && (
                                        <VideoPlayer 
                                            url={player.url} 
                                            title={player.title} 
                                            type={player.type} 
                                            onClose={handleClosePlayer}
                                            playlist={type === 'live' ? itemsToDisplay : undefined}
                                            currentItem={player.currentItem}
                                            onChannelSelect={handlePlay}
                                            isEmbedded={true}
                                            onToggleEmbed={() => setIsPlayerFullWindow(true)}
                                            account={account}
                                        />
                                    )}
                                </div>
                            </>
                        ) : (
                            // Browse Layout (Hero + Grids)
                            <div className="flex-1 overflow-y-auto custom-scrollbar relative h-full">
                                <AnimatePresence mode="wait">
                                    {loading ? (
                                        <motion.div 
                                            key="loading"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className={currentLevel === 'detail' ? "" : "px-10 pt-8"}
                                        >
                                            <SkeletonLoader type={type} mode={currentLevel === 'detail' ? 'detail' : 'grid'} />
                                        </motion.div>
                                    ) : currentLevel === 'detail' && selectedItem ? (
                                        <motion.div
                                            key={`detail-${selectedItem.stream_id || selectedItem.series_id}`}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="h-full"
                                        >
                                            <ItemDetailView 
                                                item={selectedItem} 
                                                detail={detailData} 
                                                loading={loading} 
                                                type={type} 
                                                onBack={handleNavigateBack}
                                                onClose={handleGoBack} 
                                                onPlay={handlePlay} 
                                                onPlayEpisode={handlePlayEpisode}
                                                account={account}
                                                siblingItems={displayData}
                                                onSwitchItem={handleDetail}
                                            />
                                        </motion.div>
                                    ) : viewMode === 'epg' && type === 'live' ? (
                                        <motion.div 
                                            key="epg"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="relative h-full flex flex-col overflow-hidden w-full"
                                        >
                                            {player && !isPlayerFullWindow && (
                                                <div 
                                                    className={`absolute z-40 bg-black shadow-2xl border-b border-white/10 transition-all duration-300
                                                        ${isPlayerExpanded ? 'inset-x-0 top-0' : 'top-[40px] left-0 w-[220px]'}
                                                    `}
                                                    style={{ height: isPlayerExpanded ? epgExpandedHeight : epgPlayerHeight }}
                                                >
                                                    <VideoPlayer 
                                                        url={player.url} 
                                                        title={player.title} 
                                                        type={player.type} 
                                                        onClose={handleClosePlayer}
                                                        playlist={type === 'live' ? displayData : undefined}
                                                        currentItem={player.currentItem}
                                                        onChannelSelect={handlePlay}
                                                        isEmbedded={true}
                                                        isMini={!isPlayerExpanded}
                                                        onToggleEmbed={() => setIsPlayerExpanded(!isPlayerExpanded)}
                                                        onFullWindow={() => setIsPlayerFullWindow(true)}
                                                        onRestore={() => setViewMode('grid')}
                                                        account={account}
                                                    />
                                                    <div 
                                                        className="absolute bottom-0 inset-x-0 h-1 cursor-ns-resize bg-white/10 hover:bg-fluent-accent transition-colors z-50"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            resizeState.current = { startY: e.clientY, startHeight: isPlayerExpanded ? epgExpandedHeight : epgPlayerHeight };
                                                            setIsResizingEpgPlayer(true);
                                                        }}
                                                    />
                                                </div>
                                            )}
                                            <div className="flex-1 overflow-hidden">
                                                <EPGView 
                                                    channels={itemsToDisplay} 
                                                    account={account} 
                                                    onChannelClick={handlePlay}
                                                    preselectedChannelId={preselectedChannelId}
                                                />
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <motion.div 
                                            key={`grid-${selectedCategory?.category_id || 'all'}`}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="px-10"
                                        >
                                            {heroItem && (
                                                <div ref={heroContainerRef}>
                                                    <HeroSection item={heroItem} detail={heroDetail} phase={heroPhase} isFading={isHeroFading} ytContainerId={ytContainerId} onNext={handleNextHero} onPlay={handlePlay} onInfo={handleDetail} isMuted={isTrailerMuted} onToggleMute={toggleTrailerMute} />
                                                </div>
                                            )}
                                            {selectedCategory === null && !searchQuery ? (
                                                Object.entries(categoryPreviews).map(([id, items]) => (
                                                    <HorizontalRow 
                                                        key={id} 
                                                        categoryId={id} 
                                                        name={categories.find(c => c.category_id === id)?.category_name || "Catégorie"} 
                                                        items={items} 
                                                        type={type}
                                                        onItemClick={handleGridClick} 
                                                        onExplore={(cid) => handleCategorySelect(categories.find(c => c.category_id === cid) || null)} 
                                                    />
                                                ))
                                            ) : (
                                                <ItemGrid items={itemsToDisplay} type={type} onItemClick={handleGridClick} accountId={account.id} />
                                            )}
                                            <div className="h-24" />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                // CLASSIC MODE (Existing Layout)
                <div ref={classicScrollRef} className={`h-full overflow-y-auto custom-scrollbar relative ${viewMode === 'epg' && type === 'live' ? 'px-0' : 'px-10'}`}>
                    <AnimatePresence mode="wait">
                        {currentLevel === 'categories' ? (
                            <motion.div 
                                key="categories"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 py-8"
                            >
                                <div onClick={() => handleCategorySelect('favorites')}
                                    className="bg-yellow-500/5 hover:bg-yellow-500/10 border border-yellow-500/20 p-5 rounded-window cursor-pointer transition-all flex items-center gap-4 group shadow-sm">
                                    <Star className="text-yellow-500 group-hover:scale-110 transition-transform" /> <span className="font-bold text-sm text-yellow-500">Favoris</span>
                                </div>
                                {filteredCategories.map((cat, index) => (
                                    <div key={`${cat.category_id}-${index}`} onClick={() => handleCategorySelect(cat)}
                                        className="bg-fluent-layer hover:bg-fluent-layerHover border border-fluent-border p-5 rounded-window cursor-pointer transition-all flex items-center gap-4 group shadow-sm">
                                        <Folder className="text-fluent-accent group-hover:scale-110 transition-transform" /> <span className="font-semibold text-sm">{cat.category_name}</span>
                                    </div>
                                ))}
                            </motion.div>
                        ) : currentLevel === 'detail' && selectedItem ? (
                            <motion.div
                                key={`detail-${selectedItem.stream_id || selectedItem.series_id}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="h-full"
                            >
                                {loading ? (
                                    <SkeletonLoader type={type} mode="detail" />
                                ) : (
                                    <ItemDetailView 
                                        item={selectedItem} 
                                        detail={detailData} 
                                        loading={loading} 
                                        type={type} 
                                        onBack={handleNavigateBack}
                                        onClose={handleGoBack}
                                        onPlay={handlePlay} 
                                        onPlayEpisode={handlePlayEpisode}
                                        account={account}
                                        siblingItems={displayData}
                                        onSwitchItem={handleDetail}
                                    />
                                )}
                            </motion.div>
                        ) : viewMode === 'epg' && type === 'live' ? (
                            <motion.div 
                                key="epg"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="relative h-full flex flex-col overflow-hidden w-full min-h-[600px]"
                            >
                                {player && !isPlayerFullWindow && (
                                    <div 
                                        className={`absolute z-40 bg-black shadow-2xl border-b border-white/10 transition-all duration-300
                                            ${isPlayerExpanded ? 'inset-x-0 top-0' : 'top-[40px] left-0 w-[220px]'}
                                        `}
                                        style={{ height: isPlayerExpanded ? epgExpandedHeight : epgPlayerHeight }}
                                    >
                                        <VideoPlayer 
                                            url={player.url} 
                                            title={player.title} 
                                            type={player.type} 
                                            onClose={handleClosePlayer}
                                            playlist={type === 'live' ? displayData : undefined}
                                            currentItem={player.currentItem}
                                            onChannelSelect={handlePlay}
                                            isEmbedded={true}
                                            isMini={!isPlayerExpanded}
                                            onToggleEmbed={() => setIsPlayerExpanded(!isPlayerExpanded)}
                                            onFullWindow={() => setIsPlayerFullWindow(true)}
                                            onRestore={undefined}
                                            account={account}
                                        />
                                        <div 
                                            className="absolute bottom-0 inset-x-0 h-1 cursor-ns-resize bg-white/10 hover:bg-fluent-accent transition-colors z-50"
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                resizeState.current = { startY: e.clientY, startHeight: isPlayerExpanded ? epgExpandedHeight : epgPlayerHeight };
                                                setIsResizingEpgPlayer(true);
                                            }}
                                        />
                                    </div>
                                )}
                                <div className="flex-1 overflow-hidden">
                                    <EPGView 
                                        channels={itemsToDisplay} 
                                        account={account} 
                                        onChannelClick={handlePlay} 
                                    />
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div 
                                key={`grid-${selectedCategory?.category_id || 'all'}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="pt-8 pb-20 relative min-h-[500px]"
                            >
                                {loading ? <SkeletonLoader type={type} mode="grid" /> : 
                                <div>
                                    {heroItem && (
                                        <div ref={heroContainerRef}>
                                            <HeroSection item={heroItem} detail={heroDetail} phase={heroPhase} isFading={isHeroFading} ytContainerId={ytContainerId} onNext={handleNextHero} onPlay={handlePlay} onInfo={handleDetail} isMuted={isTrailerMuted} onToggleMute={toggleTrailerMute} />
                                        </div>
                                    )}
                                    <ItemGrid items={itemsToDisplay} type={type} onItemClick={handleGridClick} accountId={account.id} />
                                </div>}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </div>
    </div>
  );
};
