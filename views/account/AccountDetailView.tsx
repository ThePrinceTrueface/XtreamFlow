
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RefreshCw, AlertCircle, Activity, Calendar, Users, Server, Info as InfoIcon, Play, Wrench, CheckCircle2, Film, Tv, Clapperboard, BarChart3, X, Wifi, Gauge, ArrowDown, Download, ShieldCheck, Database, LayoutGrid, Trash2 } from 'lucide-react';
import { XtreamAccount, XtreamAuthResponse } from '../../types';
import { Card, Button, Modal } from '../../components/Win11UI';
import { calculateDaysRemaining, formatDate, createProxyUrl } from '../../utils';
import { AccountSidebar } from '../../components/Sidebars';
import { CategoryBrowser } from './CategoryBrowser';
import { DownloadManager } from './components/DownloadManager';
import { cacheService } from '../../services/cacheService';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useUserPreferences } from '../../hooks/useUserPreferences';

interface RevisionResults {
  userInfo: any;
  serverInfo: any;
  live: { categories: number; streams: number };
  vod: { categories: number; streams: number };
  series: { categories: number; streams: number };
  timestamp: number;
}

interface SpeedTestMetrics {
    ping: number; // ms
    jitter: number; // ms
    downloadSpeed: number; // Mbps
    downloadedSize: number; // MB
    progress: number; // 0-100
    status: 'idle' | 'pinging' | 'downloading' | 'complete' | 'error';
    error?: string;
}

export const AccountDetailView: React.FC<{ onBack: () => void; onPlayDownload?: (url: string, title: string, type: 'vod' | 'series') => void; onOpenSearch?: () => void; }> = ({ onBack, onPlayDownload, onOpenSearch }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { accountId } = useParams<{ accountId: string }>();
  const account = useLiveQuery(() => db.accounts.get(accountId!), [accountId]) || null;
  
  // Determine active tab and deeper navigation from URL
  const currentPath = location.pathname.split('/').filter(Boolean);
  // Path is /account/:accountId/:tab/:category/:item/:episode
  const tabFromUrl = currentPath.length > 2 ? currentPath[2] : 'info';
  const categoryIdFromUrl = currentPath.length > 3 ? currentPath[3] : undefined;
  const itemIdFromUrl = currentPath.length > 4 ? currentPath[4] : undefined;
  const episodeIdFromUrl = currentPath.length > 5 ? currentPath[5] : undefined;
  
  const searchParams = new URLSearchParams(location.search);
  const autoPlayFromUrl = searchParams.get('autoplay') === 'true';

  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set([tabFromUrl]));
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  const { getAutoPlayNavigation } = useUserPreferences(accountId || '');
  const autoPlayItem = autoPlayFromUrl || getAutoPlayNavigation();
  
  // -- PRELOAD STATE --
  const [showPreloadPrompt, setShowPreloadPrompt] = useState(false);
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadProgressData, setPreloadProgressData] = useState({ step: '', percent: 0 });

  // -- UPDATE STATE --
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateOptions, setUpdateOptions] = useState({ live: true, vod: true, series: true, epg: false });
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgressData, setUpdateProgressData] = useState({ step: '', percent: 0 });

  // -- DIALOG/POPUP STATE --
  const [infoModal, setInfoModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'info' | 'warning' }>({ isOpen: false, title: '', message: '', type: 'info' });
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; action: () => void; isWarning?: boolean }>({ isOpen: false, title: '', message: '', action: () => {}, isWarning: false });
  
  useEffect(() => {
    setActiveTab(tabFromUrl);
    setVisitedTabs(prev => new Set(prev).add(tabFromUrl));
  }, [tabFromUrl]);
  
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    navigate(`/account/${accountId}/${tab}`);
  };
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<XtreamAuthResponse | null>(null);

  // --- TOOLS STATE ---
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [revisionProgress, setRevisionProgress] = useState<{ step: string; percent: number; details?: string }>({ step: '', percent: 0 });
  const [revisionResults, setRevisionResults] = useState<RevisionResults | null>(null);

  // --- SPEED TEST STATE ---
  const [isSpeedModalOpen, setIsSpeedModalOpen] = useState(false);
  const [speedMetrics, setSpeedMetrics] = useState<SpeedTestMetrics>({
      ping: 0,
      jitter: 0,
      downloadSpeed: 0,
      downloadedSize: 0,
      progress: 0,
      status: 'idle'
  });
  
  // --- GLOBAL CACHE IMPLEMENTATION (PROMISE BASED) ---
  const globalCache = useRef<Map<string, Promise<any>>>(new Map());

  const fetchCached = useCallback((url: string): Promise<any> => {
      // Check if we already have an ongoing or finished request for this URL
      if (globalCache.current.has(url)) {
          return globalCache.current.get(url)!;
      }

      // Create a new promise for the request
      const fetchPromise = fetch(url)
          .then(async (response) => {
              if (!response.ok) {
                  throw new Error(`HTTP Error: ${response.status}`);
              }
              const json = await response.json();
              return json;
          })
          .catch((err) => {
              // On failure, remove the promise from the cache so it can be retried later
              globalCache.current.delete(url);
              throw err;
          });

      // Store the promise in the centralized cache
      globalCache.current.set(url, fetchPromise);
      return fetchPromise;
  }, []);
  
  // Track visited tabs
  useEffect(() => {
    setVisitedTabs(prev => {
        if (prev.has(activeTab)) return prev;
        return new Set(prev).add(activeTab);
    });
  }, [activeTab]);

  useEffect(() => {
    // Clear cache when switching accounts to avoid mixing data
    globalCache.current.clear();
    fetchAccountInfo();

    if (account && !account.preloadPreference) {
      setShowPreloadPrompt(true);
    }
  }, [account?.id]);

  const handlePreloadChoice = async (choice: 'full' | 'dynamic') => {
    if (!account) return;
    
    // Save preference to suppress popup in future
    await db.accounts.update(account.id, { preloadPreference: choice });
    
    if (choice === 'dynamic') {
      setShowPreloadPrompt(false);
    } else {
      setShowPreloadPrompt(false);
      setIsPreloading(true);
      try {
        await cacheService.prefetchCatalogue(account, (step, percent) => {
          setPreloadProgressData({ step, percent });
        });
        setInfoModal({ isOpen: true, title: 'Succès', message: 'Toutes les catégories et listes de flux ont été mises en cache avec succès pour une navigation hors-ligne !', type: 'success' });
      } catch (err) {
        console.error("Erreur de préchargement:", err);
        setInfoModal({ isOpen: true, title: 'Erreur', message: 'Une erreur est survenue lors du préchargement. Certaines données pourraient manquer.', type: 'error' });
      } finally {
        setIsPreloading(false);
      }
    }
  };

  const handleClearLocalCache = () => {
    if (!account) return;
    setConfirmModal({
        isOpen: true,
        title: 'Vider le cache',
        message: "Voulez-vous vraiment supprimer toutes les données de cette playlist du cache local (catégories, flux, EPG) ? Cela forcera l'application à les re-télécharger.",
        isWarning: true,
        action: async () => {
            try {
                await db.clearAccountCache(account.id);
                // Reset preload preference so the prompt shows up again if desired
                await db.accounts.update(account.id, { preloadPreference: undefined });
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                setInfoModal({ isOpen: true, title: 'Cache vidé', message: 'Le cache a été vidé avec succès !', type: 'success' });
            } catch (err) {
                console.error("Erreur vidage cache:", err);
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                setInfoModal({ isOpen: true, title: 'Erreur', message: 'Impossible de vider le cache.', type: 'error' });
            }
        }
    });
  };

  const handleUpdatePlaylist = async () => {
      if (!account) return;
      setIsUpdateModalOpen(false);
      setIsUpdating(true);
      try {
          await cacheService.updateCatalogue(account, updateOptions, (step, percent) => {
              setUpdateProgressData({ step, percent });
          });
          setInfoModal({ isOpen: true, title: 'Mise à jour réussie', message: 'Mise à jour complète et réussie !', type: 'success' });
      } catch (err) {
          console.error("Erreur de mise à jour:", err);
          setInfoModal({ isOpen: true, title: 'Erreur', message: 'Erreur lors de la mise à jour de la playlist.', type: 'error' });
      } finally {
          setIsUpdating(false);
      }
  };

  const buildApiUrl = (action: string) => {
    if (!account) return '';
    // Force http for Xtream API calls
    const targetUrl = `${account.protocol || 'http'}://${account.host}:${account.port}/player_api.php?username=${account.username}&password=${account.password}&action=${action}`;
    return createProxyUrl(targetUrl);
  };

  const fetchAccountInfo = async () => {
    if (!account) return;
    setLoading(true);
    setError(null);
    // Force http for Xtream API calls
    const targetUrl = `${account.protocol || 'http'}://${account.host}:${account.port}/player_api.php?username=${account.username}&password=${account.password}`;
    const url = createProxyUrl(targetUrl);

    try {
        let json = await fetchCached(url);
        if (Array.isArray(json) && json.length > 0) json = json[0];
        
        const authData = json as XtreamAuthResponse;
        if (!authData || (!authData.user_info && !authData.server_info)) {
             throw new Error("Invalid response format from server.");
        }

        if (authData.user_info && authData.user_info.auth === 0) {
            setError("Authentication failed: Access denied by server.");
        } else {
            setData(authData);
        }
    } catch (err: any) {
        console.error("Fetch error:", err);
        setError(err.message || "Failed to connect to server.");
    } finally {
        setLoading(false);
    }
  };

  // --- TOOL LOGIC: Complete Revision ---
  const runRevision = async () => {
      if (!account) return;
      setIsRevisionModalOpen(true);
      setRevisionResults(null);
      setRevisionProgress({ step: 'Initializing...', percent: 0 });

      const results: RevisionResults = {
          userInfo: null,
          serverInfo: null,
          live: { categories: 0, streams: 0 },
          vod: { categories: 0, streams: 0 },
          series: { categories: 0, streams: 0 },
          timestamp: Date.now()
      };

      try {
          // Step 1: Auth Info
          setRevisionProgress({ step: 'Authenticating...', percent: 5, details: 'Verifying credentials and fetching server metadata' });
          // Force http for Xtream API calls
          const authUrl = createProxyUrl(`${account.protocol || 'http'}://${account.host}:${account.port}/player_api.php?username=${account.username}&password=${account.password}`);
          const authData = await fetchCached(authUrl);
          results.userInfo = authData.user_info;
          results.serverInfo = authData.server_info;
          
          // Use cacheService for prefetching and counting
          await cacheService.prefetchCatalogue(account, (step, percent) => {
              setRevisionProgress({ step, percent: 5 + (percent * 0.9), details: 'Caching data to IndexedDB for offline access' });
          });

          // Fetch counts from DB
          const [liveCats, liveStreams, vodCats, vodStreams, seriesCats, seriesStreams] = await Promise.all([
              cacheService.getCategories(account, 'live'),
              cacheService.getStreams(account, 'live'),
              cacheService.getCategories(account, 'vod'),
              cacheService.getStreams(account, 'vod'),
              cacheService.getCategories(account, 'series'),
              cacheService.getStreams(account, 'series')
          ]);

          results.live.categories = liveCats.length;
          results.live.streams = liveStreams.length;
          results.vod.categories = vodCats.length;
          results.vod.streams = vodStreams.length;
          results.series.categories = seriesCats.length;
          results.series.streams = seriesStreams.length;

          // Finalize
          setRevisionProgress({ step: 'Complete', percent: 100, details: 'Analysis and caching finished successfully.' });
          setRevisionResults(results);

      } catch (e: any) {
          console.error("Error during revision:", e);
          setRevisionProgress({ step: 'Error Occurred', percent: 100, details: e.message || "Failed to complete revision." });
      }
  };

  // --- TOOL LOGIC: Bandwidth Test ---
  const runSpeedTest = async () => {
    if (!account) return;
    setIsSpeedModalOpen(true);
    setSpeedMetrics({
        ping: 0,
        jitter: 0,
        downloadSpeed: 0,
        downloadedSize: 0,
        progress: 0,
        status: 'pinging'
    });

    // Force http for Xtream API calls
    const targetUrl = createProxyUrl(`${account.protocol || 'http'}://${account.host}:${account.port}/player_api.php?username=${account.username}&password=${account.password}`);
    
    // Use a large request (live streams list) for bandwidth testing.
    // We append a timestamp to bypass cache for the speed test specifically.
    // Force http for Xtream API calls
    const downloadUrl = createProxyUrl(`${account.protocol || 'http'}://${account.host}:${account.port}/player_api.php?username=${account.username}&password=${account.password}&action=get_live_streams&_t=${Date.now()}`);

    try {
        // --- Phase 1: Ping & Jitter ---
        const pings: number[] = [];
        const pingCount = 5;

        for (let i = 0; i < pingCount; i++) {
            const start = performance.now();
            await fetch(targetUrl, { method: 'HEAD' }); // HEAD request is lighter
            const end = performance.now();
            pings.push(end - start);
            setSpeedMetrics(prev => ({ ...prev, progress: ((i + 1) / pingCount) * 20 })); // 0-20%
        }

        const avgPing = pings.reduce((a, b) => a + b, 0) / pings.length;
        // Calculate Jitter (average deviation from the mean)
        const jitter = pings.reduce((acc, curr) => acc + Math.abs(curr - avgPing), 0) / pings.length;

        setSpeedMetrics(prev => ({
            ...prev,
            ping: Math.round(avgPing),
            jitter: Math.round(jitter),
            status: 'downloading',
            progress: 20
        }));

        // --- Phase 2: Bandwidth ---
        const startTime = performance.now();
        const response = await fetch(downloadUrl);
        const reader = response.body?.getReader();

        if (!reader) throw new Error("Browser does not support stream reading.");

        let receivedLength = 0;
        const contentLengthHeader = response.headers.get('Content-Length');
        const totalLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 10 * 1024 * 1024; // estimate 10MB if unknown for visual bar

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            receivedLength += value.length;
            
            // Real-time speed update (every chunk)
            const now = performance.now();
            const durationSec = (now - startTime) / 1000;
            const bitsLoaded = receivedLength * 8;
            const speedMbps = (bitsLoaded / durationSec) / 1_000_000;
            
            setSpeedMetrics(prev => ({
                ...prev,
                downloadedSize: parseFloat((receivedLength / (1024 * 1024)).toFixed(2)),
                downloadSpeed: parseFloat(speedMbps.toFixed(2)),
                // Map remaining 80% of progress bar based on assumed size or just spin if unknown
                progress: 20 + Math.min(((receivedLength / totalLength) * 80), 80) 
            }));
        }

        setSpeedMetrics(prev => ({ ...prev, status: 'complete', progress: 100 }));

    } catch (e: any) {
        console.error("Error during speed test:", e);
        setSpeedMetrics(prev => ({ ...prev, status: 'error', error: e.message || "Connection failed during test." }));
    }
  };

  const speedStatus = useMemo(() => {
      const s = speedMetrics.downloadSpeed;
      if (s === 0) return { label: 'MEASURING...', color: 'bg-white/5 text-win-subtext border-white/10' };
      if (s < 5) return { label: 'READY FOR SD', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' };
      if (s < 15) return { label: 'READY FOR HD', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
      if (s < 30) return { label: 'READY FOR FULL HD', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
      return { label: 'READY FOR 4K UHD', color: 'bg-green-500/10 text-green-400 border-green-500/20' };
  }, [speedMetrics.downloadSpeed]);

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
         <AlertCircle size={48} className="text-fluent-danger mb-4" />
         <h3 className="text-xl font-semibold mb-2">Account Not Found</h3>
         <p className="text-fluent-subtext mb-6 max-w-md">The requested account could not be found.</p>
         <Button onClick={onBack}>Go Back</Button>
      </div>
    );
  }

  // --- RENDERERS ---

  const renderInfoTab = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <RefreshCw className="animate-spin mb-4 text-fluent-accent" size={32} />
          <p className="text-fluent-subtext">Connecting to {account?.host}...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
           <AlertCircle size={48} className="text-fluent-danger mb-4" />
           <h3 className="text-xl font-semibold mb-2">Connection Failed</h3>
           <p className="text-fluent-subtext mb-6 max-w-md">{error}</p>
           <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      );
    }

    if (!data) return null;

    const { user_info, server_info } = data;
    const expDate = user_info?.exp_date;
    const daysLeft = expDate ? calculateDaysRemaining(expDate) : 0;
    const isExpired = daysLeft <= 0;
    const activeCons = parseInt(user_info?.active_cons || '0');
    const maxCons = parseInt(user_info?.max_connections || '1');
    const usagePercent = Math.min((activeCons / maxCons) * 100, 100);

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 p-8 pb-32">
        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
           <Card className="bg-gradient-to-br from-green-900/20 to-green-600/10 border-green-500/20">
              <div className="flex justify-between items-start">
                 <div>
                    <p className="text-xs text-green-300/70 uppercase tracking-wider font-semibold">Status</p>
                    <p className="text-2xl font-bold text-green-100 mt-1">{user_info?.status || 'Unknown'}</p>
                 </div>
                 <Activity size={20} className="text-green-400" />
              </div>
           </Card>

           <Card className={`${isExpired ? 'bg-red-900/20 border-red-500/20' : 'bg-fluent-layer'}`}>
              <div className="flex justify-between items-start">
                 <div>
                    <p className="text-xs text-fluent-subtext uppercase tracking-wider font-semibold">Expiration</p>
                    <p className="text-2xl font-bold mt-1">{isExpired ? 'Expired' : `${daysLeft} Days`}</p>
                    <p className="text-[10px] text-fluent-subtext mt-1">{formatDate(expDate || '')}</p>
                 </div>
                 <Calendar size={20} className={isExpired ? "text-red-400" : "text-fluent-accent"} />
              </div>
           </Card>

           <Card>
              <div className="flex justify-between items-start mb-2">
                 <div>
                    <p className="text-xs text-fluent-subtext uppercase tracking-wider font-semibold">Connections</p>
                    <p className="text-2xl font-bold mt-1">{activeCons} / {maxCons}</p>
                 </div>
                 <Users size={20} className="text-blue-400" />
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                 <div className="h-full bg-blue-400 transition-all duration-500" style={{ width: `${usagePercent}%` }} />
              </div>
           </Card>

            <Card>
              <div className="flex justify-between items-start">
                 <div>
                    <p className="text-xs text-fluent-subtext uppercase tracking-wider font-semibold">Protocol</p>
                    <p className="text-2xl font-bold mt-1 uppercase">{server_info?.server_protocol || 'HTTP'}</p>
                    <p className="text-[10px] text-fluent-subtext mt-1">Port: {server_info?.port || '80'}</p>
                 </div>
                 <Server size={20} className="text-purple-400" />
              </div>
           </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           {/* Detailed Info */}
           <div className="lg:col-span-2 space-y-6">
              <div className="bg-fluent-layer border border-fluent-border rounded-window p-6 shadow-sm">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <InfoIcon size={18} className="text-fluent-accent" /> Account Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                      <div className="space-y-1">
                         <span className="text-xs text-fluent-subtext block">Username</span>
                         <span className="font-mono text-sm bg-black/20 px-2 py-1 rounded border border-white/5 block">{user_info?.username}</span>
                      </div>
                      <div className="space-y-1">
                         <span className="text-xs text-fluent-subtext block">Created At</span>
                         <span className="text-sm">{formatDate(user_info?.created_at || '')}</span>
                      </div>
                      <div className="space-y-1">
                         <span className="text-xs text-fluent-subtext block">Max Connections</span>
                         <span className="text-sm">{user_info?.max_connections} Device(s)</span>
                      </div>
                      <div className="space-y-1">
                         <span className="text-xs text-fluent-subtext block">Allowed Formats</span>
                         <div className="flex gap-2">
                            {user_info?.allowed_output_formats?.map(fmt => (
                              <span key={fmt} className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded uppercase">{fmt}</span>
                            ))}
                         </div>
                      </div>
                      <div className="space-y-1 md:col-span-2">
                         <span className="text-xs text-fluent-subtext block">Message from Server</span>
                         <p className="text-sm italic text-white/80 border-l-2 border-fluent-accent pl-3 py-1 bg-white/5 rounded-r">
                           {user_info?.message || "No message provided."}
                         </p>
                      </div>
                  </div>
              </div>
           </div>

           {/* Server Info Side */}
           <div className="space-y-6">
               <div className="bg-fluent-layer border border-fluent-border rounded-window p-6 shadow-sm">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Server size={18} className="text-purple-400" /> Server Info
                  </h3>
                  <ul className="space-y-3 text-sm">
                     <li className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-fluent-subtext">URL</span>
                        <span className="font-mono">{server_info?.url}</span>
                     </li>
                      <li className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-fluent-subtext">Port</span>
                        <span>{server_info?.port}</span>
                     </li>
                     <li className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-fluent-subtext">RTMP Port</span>
                        <span>{server_info?.rtmp_port}</span>
                     </li>
                     <li className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-fluent-subtext">Timezone</span>
                        <span>{server_info?.timezone}</span>
                     </li>
                     <li className="flex justify-between pt-1">
                        <span className="text-fluent-subtext">Server Time</span>
                        <span className="text-right">{server_info?.time_now}</span>
                     </li>
                  </ul>
               </div>
           </div>
        </div>
      </div>
    );
  };

  const renderToolsTab = () => (
      <div className="p-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="mb-6">
              <h2 className="text-2xl font-light mb-2">Account Tools</h2>
              <p className="text-fluent-subtext">Utilities to analyze and manage your Xtream connection.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="hover:bg-fluent-layerHover transition-colors border-l-4 border-l-fluent-accent">
                  <div className="flex items-start gap-4 mb-4">
                      <div className="p-3 bg-fluent-accent/10 rounded-lg text-fluent-accent">
                          <Activity size={24} />
                      </div>
                      <div>
                          <h3 className="text-lg font-medium">Complete Revision</h3>
                          <p className="text-sm text-fluent-subtext mt-1">
                              Scan the entire account to count streams, categories, and verify server integrity.
                          </p>
                      </div>
                  </div>
                  <Button onClick={runRevision} className="w-full mt-2">
                      <Play size={16} /> Run Analysis
                  </Button>
              </Card>

              <Card className="hover:bg-fluent-layerHover transition-colors border-l-4 border-l-green-400">
                  <div className="flex items-start gap-4 mb-4">
                      <div className="p-3 bg-green-500/10 rounded-lg text-green-400">
                          <BarChart3 size={24} />
                      </div>
                      <div>
                          <h3 className="text-lg font-medium">Bandwidth Test</h3>
                          <p className="text-sm text-fluent-subtext mt-1">
                              Check download speeds and latency from this specific server.
                          </p>
                      </div>
                  </div>
                  <Button onClick={runSpeedTest} variant="secondary" className="w-full mt-2 hover:bg-green-500/10 hover:text-green-300 hover:border-green-500/30">
                      <Wifi size={16} /> Start Speed Test
                  </Button>
              </Card>

              <Card className="hover:bg-fluent-layerHover transition-colors border-l-4 border-l-blue-400">
                  <div className="flex items-start gap-4 mb-4">
                      <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400">
                          <RefreshCw size={24} />
                      </div>
                      <div>
                          <h3 className="text-lg font-medium">Mettre à jour</h3>
                          <p className="text-sm text-fluent-subtext mt-1">
                              Téléchargez les derniers changements de la playlist (Nouveaux films, épisodes, modifications VOD/TV).
                          </p>
                      </div>
                  </div>
                  <Button onClick={() => setIsUpdateModalOpen(true)} className="w-full mt-2 bg-blue-500 text-white hover:bg-blue-600 border-none">
                      <RefreshCw size={16} /> Update Playlist
                  </Button>
              </Card>

              <Card className="hover:bg-fluent-layerHover transition-colors border-l-4 border-l-red-500">
                  <div className="flex items-start gap-4 mb-4">
                      <div className="p-3 bg-red-500/10 rounded-lg text-red-500">
                          <Database size={24} />
                      </div>
                      <div>
                          <h3 className="text-lg font-medium">Vider le Cache</h3>
                          <p className="text-sm text-fluent-subtext mt-1">
                              Supprime toutes les catégories, les listes de chaînes/VOD et l'EPG téléchargés en local pour forcer une réactualisation.
                          </p>
                      </div>
                  </div>
                  <Button onClick={handleClearLocalCache} variant="secondary" className="w-full mt-2 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/40">
                      <Trash2 size={16} /> Vider le Cache
                  </Button>
              </Card>
          </div>
      </div>
  );

  return (
    <div className="flex h-full w-full overflow-hidden">
      <AccountSidebar 
        activeTab={activeTab} 
        setTab={handleTabChange} 
        onBack={onBack}
        accountName={account?.name || ''}
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onOpenSearch={onOpenSearch}
      />
      
      {/* Main Content Area */}
      <div className="flex-1 bg-black/20 overflow-hidden relative transition-all duration-300">
         
         {visitedTabs.has('info') && (
             <div className="w-full h-full" style={{ display: activeTab === 'info' ? 'block' : 'none' }}>
                <div className="h-full overflow-y-auto custom-scrollbar">
                    {renderInfoTab()}
                </div>
             </div>
         )}
         
         {visitedTabs.has('tools') && (
             <div className="w-full h-full" style={{ display: activeTab === 'tools' ? 'block' : 'none' }}>
                 <div className="h-full overflow-y-auto custom-scrollbar">
                     {renderToolsTab()}
                 </div>
             </div>
         )}

         {/* Category Browsers */}
         {visitedTabs.has('live') && account && (
            <div className="w-full h-full" style={{ display: activeTab === 'live' ? 'block' : 'none' }}>
                <CategoryBrowser account={account} type="live" preselectedChannelId={categoryIdFromUrl} preselectedItemId={itemIdFromUrl} isActive={activeTab === 'live'} autoPlay={autoPlayItem} />
            </div>
         )}

         {visitedTabs.has('vod') && account && (
            <div className="w-full h-full" style={{ display: activeTab === 'vod' ? 'block' : 'none' }}>
                <CategoryBrowser account={account} type="vod" preselectedItemId={itemIdFromUrl} preselectedEpisodeId={episodeIdFromUrl} isActive={activeTab === 'vod'} autoPlay={autoPlayItem} />
            </div>
         )}

         {visitedTabs.has('series') && account && (
            <div className="w-full h-full" style={{ display: activeTab === 'series' ? 'block' : 'none' }}>
                <CategoryBrowser account={account} type="series" preselectedItemId={itemIdFromUrl} preselectedEpisodeId={episodeIdFromUrl} isActive={activeTab === 'series'} autoPlay={autoPlayItem} />
            </div>
         )}

         {visitedTabs.has('downloads') && account && (
            <div className="w-full h-full" style={{ display: activeTab === 'downloads' ? 'block' : 'none' }}>
                <DownloadManager accountId={account.id} onPlay={onPlayDownload} />
            </div>
         )}

         {/* Revision Modal */}
         {isRevisionModalOpen && (
             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
                 <div className="bg-[#1c1c1c] border border-fluent-border rounded-xl shadow-2xl w-full max-w-2xl p-0 relative animate-in zoom-in-95 overflow-hidden">
                     {/* Modal Header */}
                     <div className="flex items-center justify-between px-6 py-4 bg-white/5 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="text-fluent-accent" size={20} />
                            <h3 className="text-lg font-semibold">Xtream Account Revision</h3>
                        </div>
                        <button onClick={() => setIsRevisionModalOpen(false)} className="text-fluent-subtext hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                     </div>

                     <div className="p-8">
                         {!revisionResults ? (
                             // Loading State
                             <div className="text-center py-10">
                                 <div className="mb-8 relative w-20 h-20 mx-auto">
                                     <div className="absolute inset-0 border-4 border-fluent-accent/20 rounded-full"></div>
                                     <div className="absolute inset-0 border-4 border-fluent-accent border-t-transparent rounded-full animate-spin"></div>
                                     <div className="absolute inset-0 flex items-center justify-center">
                                         <span className="text-xs font-bold text-fluent-accent">{revisionProgress.percent}%</span>
                                     </div>
                                 </div>
                                 
                                 <h3 className="text-xl font-medium mb-2 text-white">Scanning Account...</h3>
                                 <p className="text-fluent-accent font-medium mb-4">{revisionProgress.step}</p>
                                 
                                 <div className="max-w-xs mx-auto text-xs text-fluent-subtext bg-white/5 p-3 rounded-lg border border-white/5 italic">
                                     {revisionProgress.details}
                                 </div>
                                 
                                 <div className="mt-8 w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                                     <div 
                                        className="h-full bg-fluent-accent transition-all duration-500 ease-out shadow-[0_0_10px_rgba(96,205,255,0.4)]" 
                                        style={{ width: `${revisionProgress.percent}%` }}
                                     />
                                 </div>
                             </div>
                         ) : (
                             // Results State
                             <div className="animate-in fade-in slide-in-from-bottom-4">
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                     {/* User & Server Status */}
                                     <div className="space-y-4">
                                         <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                             <div className="flex items-center gap-2 mb-3 text-fluent-subtext text-xs uppercase tracking-widest font-bold">
                                                 <Users size={14} /> User Verification
                                             </div>
                                             <div className="space-y-2">
                                                 <div className="flex justify-between text-sm">
                                                     <span className="text-fluent-subtext">Auth Status</span>
                                                     <span className="text-green-400 font-medium">Verified (Code {revisionResults.userInfo?.auth})</span>
                                                 </div>
                                                 <div className="flex justify-between text-sm">
                                                     <span className="text-fluent-subtext">Account Status</span>
                                                     <span className="text-white">{revisionResults.userInfo?.status}</span>
                                                 </div>
                                                 <div className="flex justify-between text-sm">
                                                     <span className="text-fluent-subtext">Active Cons</span>
                                                     <span className="text-white">{revisionResults.userInfo?.active_cons} / {revisionResults.userInfo?.max_connections}</span>
                                                 </div>
                                             </div>
                                         </div>

                                         <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                             <div className="flex items-center gap-2 mb-3 text-fluent-subtext text-xs uppercase tracking-widest font-bold">
                                                 <Server size={14} /> Server Metadata
                                             </div>
                                             <div className="space-y-2">
                                                 <div className="flex justify-between text-sm">
                                                     <span className="text-fluent-subtext">Protocol</span>
                                                     <span className="text-white uppercase">{revisionResults.serverInfo?.server_protocol}</span>
                                                 </div>
                                                 <div className="flex justify-between text-sm">
                                                     <span className="text-fluent-subtext">Server Time</span>
                                                     <span className="text-white">{revisionResults.serverInfo?.time_now}</span>
                                                 </div>
                                                 <div className="flex justify-between text-sm">
                                                     <span className="text-fluent-subtext">Timezone</span>
                                                     <span className="text-white">{revisionResults.serverInfo?.timezone}</span>
                                                 </div>
                                             </div>
                                         </div>
                                     </div>

                                     {/* Content Distribution */}
                                     <div className="bg-white/5 rounded-xl p-5 border border-white/5 flex flex-col h-full">
                                         <div className="flex items-center gap-2 mb-4 text-fluent-subtext text-xs uppercase tracking-widest font-bold">
                                             <Database size={14} /> Content Distribution
                                         </div>
                                         <div className="flex-1 flex flex-col gap-3 justify-center">
                                             <div className="flex items-center gap-3">
                                                 <div className="w-10 h-10 rounded-lg bg-fluent-accent/10 flex items-center justify-center text-fluent-accent">
                                                     <Tv size={20} />
                                                 </div>
                                                 <div className="flex-1">
                                                     <div className="flex justify-between text-xs mb-1">
                                                         <span>Live TV</span>
                                                         <span>{revisionResults.live.streams.toLocaleString()}</span>
                                                     </div>
                                                     <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                                         <div className="h-full bg-fluent-accent" style={{ width: `${Math.min(100, (revisionResults.live.streams / 20000) * 100)}%` }}></div>
                                                     </div>
                                                 </div>
                                             </div>
                                             <div className="flex items-center gap-3">
                                                 <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                                                     <Film size={20} />
                                                 </div>
                                                 <div className="flex-1">
                                                     <div className="flex justify-between text-xs mb-1">
                                                         <span>Movies</span>
                                                         <span>{revisionResults.vod.streams.toLocaleString()}</span>
                                                     </div>
                                                     <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                                         <div className="h-full bg-blue-400" style={{ width: `${Math.min(100, (revisionResults.vod.streams / 20000) * 100)}%` }}></div>
                                                     </div>
                                                 </div>
                                             </div>
                                             <div className="flex items-center gap-3">
                                                 <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                                                     <Clapperboard size={20} />
                                                 </div>
                                                 <div className="flex-1">
                                                     <div className="flex justify-between text-xs mb-1">
                                                         <span>Series</span>
                                                         <span>{revisionResults.series.streams.toLocaleString()}</span>
                                                     </div>
                                                     <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                                         <div className="h-full bg-purple-400" style={{ width: `${Math.min(100, (revisionResults.series.streams / 20000) * 100)}%` }}></div>
                                                     </div>
                                                 </div>
                                             </div>
                                         </div>
                                         <div className="mt-6 pt-4 border-t border-white/5 text-center">
                                             <p className="text-[10px] text-fluent-subtext uppercase tracking-widest mb-1">Total Assets Indexed</p>
                                             <p className="text-3xl font-bold text-white">{(revisionResults.live.streams + revisionResults.vod.streams + revisionResults.series.streams).toLocaleString()}</p>
                                         </div>
                                     </div>
                                 </div>

                                 <div className="grid grid-cols-3 gap-4 mb-8">
                                     <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-center">
                                         <p className="text-[10px] text-fluent-subtext mb-1 uppercase tracking-tighter">Live Cats</p>
                                         <p className="text-xl font-semibold">{revisionResults.live.categories}</p>
                                     </div>
                                     <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-center">
                                         <p className="text-[10px] text-fluent-subtext mb-1 uppercase tracking-tighter">Movie Cats</p>
                                         <p className="text-xl font-semibold">{revisionResults.vod.categories}</p>
                                     </div>
                                     <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-center">
                                         <p className="text-[10px] text-fluent-subtext mb-1 uppercase tracking-tighter">Series Cats</p>
                                         <p className="text-xl font-semibold">{revisionResults.series.categories}</p>
                                     </div>
                                 </div>

                                 <div className="flex justify-between items-center bg-fluent-accent/5 border border-fluent-accent/20 p-4 rounded-xl">
                                     <div className="flex items-center gap-3">
                                         <CheckCircle2 className="text-fluent-accent" size={24} />
                                         <div>
                                             <p className="text-sm font-medium text-white">Verification Complete</p>
                                             <p className="text-xs text-fluent-subtext">Scan date: {new Date(revisionResults.timestamp).toLocaleString()}</p>
                                         </div>
                                     </div>
                                     <Button onClick={() => setIsRevisionModalOpen(false)}>Close Summary</Button>
                                 </div>
                             </div>
                         )}
                     </div>
                 </div>
             </div>
         )}
         
         {/* Speed Test Modal */}
         {isSpeedModalOpen && (
             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
                 <div className="bg-[#1c1c1c] border border-fluent-border rounded-xl shadow-2xl w-full max-w-lg p-0 relative animate-in zoom-in-95 overflow-hidden">
                     <div className="flex justify-between items-center px-6 py-4 bg-white/5 border-b border-white/5">
                        <div className="flex items-center gap-3">
                             <Gauge size={20} className="text-green-400" />
                             <h3 className="text-lg font-semibold">Bandwidth Diagnostic</h3>
                        </div>
                        <button onClick={() => setIsSpeedModalOpen(false)} className="text-fluent-subtext hover:text-white transition-colors"><X size={20}/></button>
                     </div>

                     <div className="p-8">
                        {speedMetrics.status === 'error' ? (
                            <div className="text-center py-6 text-red-300 bg-red-500/10 rounded-lg border border-red-500/20">
                                <AlertCircle size={32} className="mx-auto mb-2" />
                                <p className="font-medium">Test Failed</p>
                                <p className="text-sm opacity-80 mt-1">{speedMetrics.error}</p>
                                <Button variant="secondary" onClick={runSpeedTest} className="mt-4 mx-auto">Retry</Button>
                            </div>
                        ) : (
                            <div className="space-y-10">
                                {/* Main Speed Display */}
                                <div className="text-center py-4">
                                    <div className="relative inline-block">
                                        <div className="text-7xl font-light tabular-nums tracking-tighter text-white">
                                            {speedMetrics.downloadSpeed.toFixed(1)}
                                        </div>
                                        <span className="absolute -right-10 bottom-2 text-sm text-fluent-subtext uppercase font-bold tracking-widest">Mbps</span>
                                    </div>
                                    
                                    {/* Progress Bar under speed */}
                                    {speedMetrics.status !== 'complete' ? (
                                        <div className="mt-8 max-w-xs mx-auto h-1.5 bg-white/10 rounded-full overflow-hidden">
                                            <div className="h-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)] transition-all duration-200" style={{ width: `${speedMetrics.progress}%` }} />
                                        </div>
                                    ) : (
                                        <div className="mt-8 flex justify-center gap-2">
                                             <div className={`px-3 py-1 ${speedStatus.color} text-xs font-bold rounded-full border`}>
                                                 {speedStatus.label}
                                             </div>
                                        </div>
                                    )}
                                </div>

                                {/* Metrics Grid */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-white/5 rounded-xl p-4 text-center border border-white/5">
                                        <div className="text-[10px] text-fluent-subtext uppercase tracking-widest font-bold mb-2">Latency</div>
                                        <div className="text-2xl font-semibold tabular-nums">{speedMetrics.ping} <span className="text-xs font-normal opacity-40">ms</span></div>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-4 text-center border border-white/5">
                                        <div className="text-[10px] text-fluent-subtext uppercase tracking-widest font-bold mb-2">Jitter</div>
                                        <div className="text-2xl font-semibold tabular-nums">{speedMetrics.jitter} <span className="text-xs font-normal opacity-40">ms</span></div>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-4 text-center border border-white/5">
                                        <div className="text-[10px] text-fluent-subtext uppercase tracking-widest font-bold mb-2">Payload</div>
                                        <div className="text-2xl font-semibold tabular-nums">{speedMetrics.downloadedSize.toFixed(1)} <span className="text-xs font-normal opacity-40">MB</span></div>
                                    </div>
                                </div>
                                
                                <div className="flex justify-center pt-2 gap-3">
                                    {speedMetrics.status === 'complete' && (
                                        <Button onClick={runSpeedTest} variant="secondary">
                                            <RefreshCw size={14} /> Retest
                                        </Button>
                                    )}
                                    <Button variant={speedMetrics.status === 'complete' ? 'primary' : 'secondary'} onClick={() => setIsSpeedModalOpen(false)}>
                                        {speedMetrics.status === 'complete' ? 'Done' : 'Cancel'}
                                    </Button>
                                </div>
                                
                                {speedMetrics.status !== 'complete' && (
                                    <div className="text-center text-[10px] uppercase tracking-widest text-fluent-subtext animate-pulse">
                                        {speedMetrics.status === 'pinging' ? 'Analyzing latency samples...' : 'Measuring downlink throughput...'}
                                    </div>
                                )}
                            </div>
                        )}
                     </div>
                 </div>
             </div>
         )}
         
         {/* PRELOAD PROMPT MODAL */}
         {showPreloadPrompt && (
             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in">
                 <div className="bg-[#1c1c1c] border border-fluent-border rounded-xl shadow-2xl w-full max-w-2xl p-8 relative animate-in zoom-in-95 overflow-hidden">
                     <div className="text-center p-4">
                         <div className="mx-auto w-16 h-16 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mb-6">
                             <Database size={32} />
                         </div>
                         <h2 className="text-2xl font-bold mb-4">Préchargement de la Playlist</h2>
                         <p className="text-fluent-subtext mb-8 max-w-lg mx-auto">
                             Voulez-vous télécharger toutes les catégories et listes de chaînes/films pour une navigation instantanée (sans chargements) et une utilisation hors-ligne, ou préférez-vous charger les éléments dynamiquement (économise les données et la mémoire) ?
                         </p>
            
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <button 
                                onClick={() => handlePreloadChoice('full')}
                                className="flex flex-col items-center p-6 border border-white/10 rounded-xl hover:border-blue-500 hover:bg-blue-500/10 transition-all group"
                             >
                                 <Database className="text-blue-400 mb-3 group-hover:scale-110 transition-transform" size={32} />
                                 <h3 className="font-semibold text-lg mb-2">Préchargement Complet</h3>
                                 <p className="text-sm text-fluent-subtext text-center">Télécharge le catalogue pour une fluidité maximale et la recherche globale.</p>
                             </button>
            
                             <button 
                                onClick={() => handlePreloadChoice('dynamic')}
                                className="flex flex-col items-center p-6 border border-white/10 rounded-xl hover:border-green-500 hover:bg-green-500/10 transition-all group"
                             >
                                 <Wifi className="text-green-400 mb-3 group-hover:scale-110 transition-transform" size={32} />
                                 <h3 className="font-semibold text-lg mb-2">Navigation Dynamique</h3>
                                 <p className="text-sm text-fluent-subtext text-center">Charge à la volée. Idéal pour les appareils limités ou pour économiser de la data.</p>
                             </button>
                         </div>
                     </div>
                 </div>
             </div>
         )}
    
         {/* PRELOADING PROGRESS MODAL */}
         {isPreloading && (
             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in">
                 <div className="bg-[#1c1c1c] border border-fluent-border rounded-xl shadow-2xl w-full max-w-lg p-8 relative animate-in zoom-in-95 overflow-hidden">
                      <div className="p-4 text-center">
                           <h3 className="text-xl font-semibold mb-2">Préchargement en cours...</h3>
                           <p className="text-fluent-subtext text-sm mb-6">Le catalogue (Live, VOD, Séries) est en cours d'enregistrement dans votre navigateur.</p>
                           
                           <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden mb-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]">
                               <div 
                                   className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 relative"
                                   style={{ width: `${Math.max(5, preloadProgressData.percent)}%` }}
                               >
                                    <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:20px_20px] animate-[pulse_2s_linear_infinite]" />
                               </div>
                           </div>
                           
                           <div className="flex justify-between items-center text-xs">
                               <span className="text-fluent-accent font-medium">{preloadProgressData.step}</span>
                               <span className="font-bold text-white max-w-[50%] truncate text-right">
                                    {Math.round(preloadProgressData.percent)}%
                               </span>
                           </div>
                      </div>
                 </div>
             </div>
         )}
         {/* UPDATE PROGRESS MODAL */}
         {isUpdating && (
             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in">
                 <div className="bg-[#1c1c1c] border border-fluent-border rounded-xl shadow-2xl w-full max-w-lg p-8 relative animate-in zoom-in-95 overflow-hidden">
                      <div className="p-4 text-center">
                           <h3 className="text-xl font-semibold mb-2">Mise à jour en cours...</h3>
                           <p className="text-fluent-subtext text-sm mb-6">L'application télécharge les dernières nouveautés de votre playlist.</p>
                           
                           <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden mb-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]">
                               <div 
                                   className="h-full bg-blue-400 transition-all duration-300 relative"
                                   style={{ width: `${Math.max(5, updateProgressData.percent)}%` }}
                               >
                                    <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:20px_20px] animate-[pulse_2s_linear_infinite]" />
                               </div>
                           </div>
                           
                           <div className="flex justify-between items-center text-xs">
                               <span className="text-blue-300 font-medium">{updateProgressData.step}</span>
                               <span className="font-bold text-white max-w-[50%] truncate text-right">
                                    {Math.round(updateProgressData.percent)}%
                               </span>
                           </div>
                      </div>
                 </div>
             </div>
         )}
         
         {/* UPDATE OPTIONS MODAL */}
         <Modal isOpen={isUpdateModalOpen} onCancel={() => setIsUpdateModalOpen(false)} title="Options de mise à jour" type="info">
              <div className="space-y-4 pt-2 pb-4">
                  <p className="text-sm text-fluent-subtext mb-4">Sélectionnez les contenus que vous souhaitez actualiser avec les serveurs distants.</p>
                  
                  <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 cursor-pointer">
                      <input type="checkbox" checked={updateOptions.live} onChange={(e) => setUpdateOptions({...updateOptions, live: e.target.checked})} className="w-5 h-5 accent-fluent-accent" />
                      <div className="flex flex-col">
                          <span className="font-medium">Chaines TV (Live)</span>
                          <span className="text-xs text-fluent-subtext">Actualise la liste des chaines et catégories directes.</span>
                      </div>
                  </label>
                  
                  <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 cursor-pointer">
                      <input type="checkbox" checked={updateOptions.vod} onChange={(e) => setUpdateOptions({...updateOptions, vod: e.target.checked})} className="w-5 h-5 accent-fluent-accent" />
                      <div className="flex flex-col">
                          <span className="font-medium">Films (VOD)</span>
                          <span className="text-xs text-fluent-subtext">Télécharge les nouveautés films du catalogue.</span>
                      </div>
                  </label>
                  
                  <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 cursor-pointer">
                      <input type="checkbox" checked={updateOptions.series} onChange={(e) => setUpdateOptions({...updateOptions, series: e.target.checked})} className="w-5 h-5 accent-fluent-accent" />
                      <div className="flex flex-col">
                          <span className="font-medium">Séries</span>
                          <span className="text-xs text-fluent-subtext">Met à jour les séries et les nouveaux épisodes.</span>
                      </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 cursor-pointer">
                      <input type="checkbox" checked={updateOptions.epg} onChange={(e) => setUpdateOptions({...updateOptions, epg: e.target.checked})} className="w-5 h-5 accent-fluent-accent" />
                      <div className="flex flex-col">
                          <span className="font-medium">Guide EPG (Cache local)</span>
                          <span className="text-xs text-fluent-subtext">Vide les programmes conservés permettant le re-téléchargement instantané.</span>
                      </div>
                  </label>
                  
                  <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/10">
                      <Button variant="secondary" onClick={() => setIsUpdateModalOpen(false)}>Annuler</Button>
                      <Button onClick={handleUpdatePlaylist} disabled={!updateOptions.live && !updateOptions.vod && !updateOptions.series && !updateOptions.epg}>Démarrer la mise à jour</Button>
                  </div>
              </div>
         </Modal>

         {/* CUSTOM INFO MODAL */}
         <Modal 
            isOpen={infoModal.isOpen} 
            onCancel={() => setInfoModal({ ...infoModal, isOpen: false })} 
            title={infoModal.title} 
            type={infoModal.type as any}
         >
            <p>{infoModal.message}</p>
         </Modal>

         {/* CUSTOM CONFIRM MODAL */}
         <Modal 
            isOpen={confirmModal.isOpen} 
            onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })} 
            onConfirm={confirmModal.action}
            title={confirmModal.title} 
            type={confirmModal.isWarning ? 'warning' : 'confirm'}
            confirmLabel="Oui, continuer"
            cancelLabel="Annuler"
         >
            <p>{confirmModal.message}</p>
         </Modal>

      </div>
    </div>
  );
};
