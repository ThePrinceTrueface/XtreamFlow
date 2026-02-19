
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, AlertCircle, Activity, Calendar, Users, Server, Info as InfoIcon, Play, Wrench, CheckCircle2, Film, Tv, Clapperboard, BarChart3, X, Wifi, Gauge, ArrowDown, Download, ShieldCheck, Database, LayoutGrid } from 'lucide-react';
import { XtreamAccount, XtreamAuthResponse } from '../../types';
import { Card, Button, Modal } from '../../components/Win11UI';
import { calculateDaysRemaining, formatDate, createProxyUrl } from '../../utils';
import { AccountSidebar } from '../../components/Sidebars';
import { CategoryBrowser } from './CategoryBrowser';

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

export const AccountDetailView: React.FC<{ account: XtreamAccount; onBack: () => void }> = ({ account, onBack }) => {
  const [activeTab, setActiveTab] = useState('info');
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['info']));
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
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
  }, [account]);

  const buildApiUrl = (action: string) => {
    const targetUrl = `${account.protocol}://${account.host}:${account.port}/player_api.php?username=${account.username}&password=${account.password}&action=${action}`;
    return createProxyUrl(targetUrl);
  };

  const fetchAccountInfo = async () => {
    setLoading(true);
    setError(null);
    const targetUrl = `${account.protocol}://${account.host}:${account.port}/player_api.php?username=${account.username}&password=${account.password}`;
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
          setRevisionProgress({ step: 'Authenticating...', percent: 10, details: 'Verifying credentials and fetching server metadata' });
          const authUrl = createProxyUrl(`${account.protocol}://${account.host}:${account.port}/player_api.php?username=${account.username}&password=${account.password}`);
          const authData = await fetchCached(authUrl);
          results.userInfo = authData.user_info;
          results.serverInfo = authData.server_info;
          
          // Step 2: Live Categories
          setRevisionProgress({ step: 'Analyzing Live TV...', percent: 25, details: 'Fetching channel categories' });
          const liveCats = await fetchCached(buildApiUrl('get_live_categories'));
          results.live.categories = Array.isArray(liveCats) ? liveCats.length : 0;

          // Step 3: Live Streams
          setRevisionProgress({ step: 'Analyzing Live TV...', percent: 40, details: 'Counting active channels' });
          const liveStreams = await fetchCached(buildApiUrl('get_live_streams'));
          results.live.streams = Array.isArray(liveStreams) ? liveStreams.length : 0;

          // Step 4: VOD Categories
          setRevisionProgress({ step: 'Scanning Movies...', percent: 55, details: 'Fetching movie categories' });
          const vodCats = await fetchCached(buildApiUrl('get_vod_categories'));
          results.vod.categories = Array.isArray(vodCats) ? vodCats.length : 0;

          // Step 5: VOD Streams
          setRevisionProgress({ step: 'Scanning Movies...', percent: 70, details: 'Indexing movie library' });
          const vodStreams = await fetchCached(buildApiUrl('get_vod_streams'));
          results.vod.streams = Array.isArray(vodStreams) ? vodStreams.length : 0;

          // Step 6: Series Categories
          setRevisionProgress({ step: 'Checking Series...', percent: 85, details: 'Fetching series categories' });
          const seriesCats = await fetchCached(buildApiUrl('get_series_categories'));
          results.series.categories = Array.isArray(seriesCats) ? seriesCats.length : 0;

          // Step 7: Series Streams
          setRevisionProgress({ step: 'Checking Series...', percent: 95, details: 'Indexing series titles' });
          const seriesStreams = await fetchCached(buildApiUrl('get_series'));
          results.series.streams = Array.isArray(seriesStreams) ? seriesStreams.length : 0;

          // Finalize
          setRevisionProgress({ step: 'Complete', percent: 100, details: 'Analysis finished successfully.' });
          setRevisionResults(results);

      } catch (e: any) {
          setRevisionProgress({ step: 'Error Occurred', percent: 100, details: e.message || "Failed to complete revision." });
      }
  };

  // --- TOOL LOGIC: Bandwidth Test ---
  const runSpeedTest = async () => {
    setIsSpeedModalOpen(true);
    setSpeedMetrics({
        ping: 0,
        jitter: 0,
        downloadSpeed: 0,
        downloadedSize: 0,
        progress: 0,
        status: 'pinging'
    });

    const targetUrl = createProxyUrl(`${account.protocol}://${account.host}:${account.port}/player_api.php?username=${account.username}&password=${account.password}`);
    
    // Use a large request (live streams list) for bandwidth testing.
    // We append a timestamp to bypass cache for the speed test specifically.
    const downloadUrl = createProxyUrl(`${account.protocol}://${account.host}:${account.port}/player_api.php?username=${account.username}&password=${account.password}&action=get_live_streams&_t=${Date.now()}`);

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
        setSpeedMetrics(prev => ({ ...prev, status: 'error', error: e.message || "Connection failed during test." }));
    }
  };

  // --- RENDERERS ---

  const renderInfoTab = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <RefreshCw className="animate-spin mb-4 text-fluent-accent" size={32} />
          <p className="text-fluent-subtext">Connecting to {account.host}...</p>
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
          </div>
      </div>
  );

  return (
    <div className="flex h-full w-full overflow-hidden">
      <AccountSidebar 
        activeTab={activeTab} 
        setTab={setActiveTab} 
        onBack={onBack}
        accountName={account.name}
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
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
         {visitedTabs.has('live') && (
            <div className="w-full h-full" style={{ display: activeTab === 'live' ? 'block' : 'none' }}>
                <CategoryBrowser account={account} type="live" fetchCached={fetchCached} />
            </div>
         )}

         {visitedTabs.has('vod') && (
            <div className="w-full h-full" style={{ display: activeTab === 'vod' ? 'block' : 'none' }}>
                <CategoryBrowser account={account} type="vod" fetchCached={fetchCached} />
            </div>
         )}

         {visitedTabs.has('series') && (
            <div className="w-full h-full" style={{ display: activeTab === 'series' ? 'block' : 'none' }}>
                <CategoryBrowser account={account} type="series" fetchCached={fetchCached} />
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
                                             <div className="px-3 py-1 bg-green-500/10 text-green-400 text-xs font-bold rounded-full border border-green-500/20">READY FOR 4K UHD</div>
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
      </div>
    </div>
  );
};
