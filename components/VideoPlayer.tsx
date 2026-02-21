
import React, { useEffect, useRef, useState } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, X, 
  SkipBack, SkipForward, Settings, List, ChevronLeft, ChevronRight, Square,
  Expand, Shrink, RefreshCw, Clock, Info
} from 'lucide-react';
import Hls from 'hls.js';
import { XtreamStream, XtreamAccount } from '../types';
import { createProxyUrl } from '../utils';
import { useUserPreferences } from '../hooks/useUserPreferences';

interface VideoPlayerProps {
  url: string;
  title: string;
  type: 'live' | 'vod' | 'series';
  onClose: () => void;
  playlist?: XtreamStream[];
  currentItem?: XtreamStream;
  onChannelSelect?: (item: XtreamStream) => void;
  isEmbedded?: boolean;
  onToggleEmbed?: () => void;
  account?: XtreamAccount;
}

interface EpgItem {
  title: string;
  start_timestamp: number;
  stop_timestamp: number;
  description: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
    url, title, type, onClose, playlist, currentItem, onChannelSelect,
    isEmbedded = false, onToggleEmbed, account
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const epgIntervalRef = useRef<number | null>(null);
  
  // Hook for Preferences
  const { updateProgress, getProgress } = useUserPreferences(account?.id || 'guest');
  const saveIntervalRef = useRef<number | null>(null);

  // Player State
  const [isPlaying, setIsPlaying] = useState(true); // Auto-play
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  
  // Resume State
  const [resumePoint, setResumePoint] = useState<number | null>(null);
  const [hasResumed, setHasResumed] = useState(false);

  // Retry Logic State
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  
  // Live TV Specific State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  
  // EPG State
  const [epgNow, setEpgNow] = useState<EpgItem | null>(null);
  const [epgNext, setEpgNext] = useState<EpgItem | null>(null);
  const [epgProgress, setEpgProgress] = useState(0);

  const controlsTimeoutRef = useRef<number | null>(null);

  // Auto-scroll sidebar to active item
  useEffect(() => {
    if (isSidebarOpen && currentItem && sidebarRef.current) {
        const activeEl = document.getElementById(`channel-${currentItem.stream_id}`);
        if (activeEl) {
            activeEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }
  }, [isSidebarOpen, currentItem]);

  // EPG Fetch Logic
  useEffect(() => {
    // Reset EPG on channel change
    setEpgNow(null);
    setEpgNext(null);
    setEpgProgress(0);

    if (type !== 'live' || !account || !currentItem || !currentItem.stream_id) return;

    const fetchEPG = async () => {
        try {
            // Using get_short_epg for lighter payload
            const apiUrl = `${account.protocol}://${account.host}:${account.port}/player_api.php?username=${account.username}&password=${account.password}&action=get_short_epg&stream_id=${currentItem.stream_id}&limit=4`;
            const proxyUrl = createProxyUrl(apiUrl);
            
            const res = await fetch(proxyUrl);
            const data = await res.json();

            if (data && data.epg_listings && Array.isArray(data.epg_listings)) {
                updateEpgState(data.epg_listings);
            }
        } catch (e) {
            console.warn("EPG Fetch failed", e);
        }
    };

    const updateEpgState = (listings: any[]) => {
        const now = Date.now() / 1000; // Unix seconds
        let current: EpgItem | null = null;
        let next: EpgItem | null = null;

        const sorted = listings.sort((a, b) => a.start_timestamp - b.start_timestamp);

        for (let i = 0; i < sorted.length; i++) {
            const prog = sorted[i];
            const start = parseInt(prog.start_timestamp);
            const stop = parseInt(prog.stop_timestamp);

            if (now >= start && now < stop) {
                current = {
                    title: prog.title && isBase64(prog.title) ? atob(prog.title) : prog.title,
                    description: prog.description && isBase64(prog.description) ? atob(prog.description) : prog.description,
                    start_timestamp: start,
                    stop_timestamp: stop
                };
                if (i + 1 < sorted.length) {
                    const n = sorted[i+1];
                    next = {
                        title: n.title && isBase64(n.title) ? atob(n.title) : n.title,
                        description: n.description && isBase64(n.description) ? atob(n.description) : n.description,
                        start_timestamp: parseInt(n.start_timestamp),
                        stop_timestamp: parseInt(n.stop_timestamp)
                    };
                }
                break;
            }
        }
        
        setEpgNow(current);
        setEpgNext(next);
    };

    fetchEPG();
    
    if (epgIntervalRef.current) clearInterval(epgIntervalRef.current);
    epgIntervalRef.current = window.setInterval(() => {
        setEpgNow(prev => prev ? {...prev} : null); 
    }, 60000); 

    return () => {
        if (epgIntervalRef.current) clearInterval(epgIntervalRef.current);
    };
  }, [type, currentItem, account]);

  // Update EPG Progress Bar
  useEffect(() => {
      if (!epgNow) {
          setEpgProgress(0);
          return;
      }
      const now = Date.now() / 1000;
      const total = epgNow.stop_timestamp - epgNow.start_timestamp;
      const elapsed = now - epgNow.start_timestamp;
      const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
      setEpgProgress(pct);
  }, [epgNow, currentTime]);

  // Check for Resume Point
  useEffect(() => {
      if (type === 'live' || !currentItem) return;
      
      const id = currentItem.stream_id || currentItem.series_id || currentItem.num; // Use ID logic
      const saved = getProgress(id);

      if (saved && !saved.finished && saved.time > 10) {
          setResumePoint(saved.time);
      } else {
          setResumePoint(null);
      }
      setHasResumed(false);
  }, [currentItem, type]);

  // Save Progress Interval
  useEffect(() => {
    if (type === 'live' || !currentItem) return;
    
    // Clear any existing interval
    if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);

    saveIntervalRef.current = window.setInterval(() => {
        if (videoRef.current && !videoRef.current.paused && videoRef.current.currentTime > 0) {
            const id = currentItem.stream_id || currentItem.series_id || currentItem.num;
            updateProgress(id, videoRef.current.currentTime, videoRef.current.duration);
        }
    }, 10000); // Save every 10 seconds

    return () => {
        if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
    };
  }, [currentItem, type, updateProgress]);


  // Initialize Player (HLS or Native)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;
    setIsLoading(true);
    setIsRetrying(false);

    const isHls = url.includes('.m3u8');
    
    const attemptPlay = () => {
        if (!video) return;
        
        // Handle Resume
        if (resumePoint && !hasResumed) {
            video.currentTime = resumePoint;
            setHasResumed(true);
        }

        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                if (error.name !== 'AbortError') {
                    console.error("Auto-play blocked", error);
                }
            });
        }
    };

    if (isHls && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 3,
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 3,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 3,
      });

      hls.loadSource(url);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        setIsRetrying(false);
        attemptPlay();
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error("HLS Error", data);
        if (data.fatal) {
            switch (data.type) {
                case Hls.ErrorTypes.MEDIA_ERROR:
                    hls?.recoverMediaError();
                    break;
                case Hls.ErrorTypes.NETWORK_ERROR:
                default:
                    hls?.destroy();
                    setIsLoading(true);
                    setIsRetrying(true);
                    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
                    retryTimeoutRef.current = window.setTimeout(() => {
                        setRetryCount(prev => prev + 1);
                    }, 5000);
                    break;
            }
        }
      });
    } else {
      video.src = url;
      video.load();
      attemptPlay();
      
      video.onerror = () => {
          console.error("Native Video Error", video.error);
          setIsLoading(true);
          setIsRetrying(true);
          if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = window.setTimeout(() => {
               setRetryCount(prev => prev + 1);
          }, 5000);
      };
    }

    const updateTime = () => setCurrentTime(video.currentTime);
    const updateDuration = () => setDuration(video.duration);
    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => {
        setIsLoading(false);
        setIsRetrying(false);
        setIsPlaying(true);
    };
    const onPause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);

    return () => {
      // Save progress one last time on unmount
      if (video && type !== 'live' && currentItem) {
          const id = currentItem.stream_id || currentItem.series_id || currentItem.num;
          updateProgress(id, video.currentTime, video.duration);
      }

      if (hls) hls.destroy();
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
      
      if (video) {
        video.removeAttribute('src');
        video.load();
        video.removeEventListener('timeupdate', updateTime);
        video.removeEventListener('loadedmetadata', updateDuration);
        video.removeEventListener('waiting', onWaiting);
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('pause', onPause);
        video.onerror = null;
      }
    };
  }, [url, retryCount]); 

  // Handle Controls Visibility
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    if (!isSidebarOpen) {
        controlsTimeoutRef.current = window.setTimeout(() => {
            if (isPlaying && !isLoading) setShowControls(false);
        }, 3000);
    }
  };

  // Actions
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
    }
  };

  const handleStop = () => {
    if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) videoRef.current.currentTime = time;
  };

  const skip = (seconds: number) => {
    if (videoRef.current) videoRef.current.currentTime += seconds;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const changeChannel = (direction: 'next' | 'prev') => {
      if (!playlist || !currentItem || !onChannelSelect) return;
      
      const idx = playlist.findIndex(item => item.stream_id === currentItem.stream_id);
      if (idx === -1) return;

      let newIdx = direction === 'next' ? idx + 1 : idx - 1;
      if (newIdx >= playlist.length) newIdx = 0;
      if (newIdx < 0) newIdx = playlist.length - 1;

      onChannelSelect(playlist[newIdx]);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const isBase64 = (str: string) => {
      try { return btoa(atob(str)) === str; } catch (err) { return false; }
  };
  
  const formatEpgTime = (timestamp: number) => {
      return new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ' || e.key === 'k') togglePlay();
      if (e.key === 'f') toggleFullscreen();
      if (e.key === 's') handleStop();
      
      if (type !== 'live') {
        if (e.key === 'ArrowRight') skip(10);
        if (e.key === 'ArrowLeft') skip(-10);
      } else {
        if (e.key === 'ArrowRight') changeChannel('next');
        if (e.key === 'ArrowLeft') changeChannel('prev');
      }

      if (e.key === 'm') toggleMute();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isMuted, isFullscreen, type, playlist, currentItem]);

  const rootClasses = isEmbedded 
    ? "absolute inset-0 z-50 bg-black flex flex-col items-center justify-center animate-in fade-in duration-300 overflow-hidden"
    : "fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-in fade-in duration-300 overflow-hidden";

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={rootClasses}
    >
        {/* Resume Toast */}
        {resumePoint && !hasResumed && isLoading && (
             <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-fluent-accent/90 text-black px-4 py-2 rounded-full z-50 shadow-lg font-medium animate-in slide-in-from-top-4 fade-in">
                 Reprise de la lecture à {formatTime(resumePoint)}...
             </div>
        )}

        {/* Loading Spinner */}
        {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none bg-black/40 backdrop-blur-sm">
                <div className="w-16 h-16 border-4 border-fluent-accent border-t-transparent rounded-full animate-spin mb-4"></div>
                {isRetrying && (
                    <div className="text-white text-sm font-medium animate-pulse flex items-center gap-2">
                        <RefreshCw size={14} className="animate-spin" />
                        Connexion perdue. Reconnexion dans 5s...
                    </div>
                )}
            </div>
        )}

        {/* Video Element */}
        <video 
            ref={videoRef}
            className="w-full h-full object-contain"
            onClick={togglePlay}
            onDoubleClick={onToggleEmbed ? onToggleEmbed : toggleFullscreen}
        />

        {/* Live TV Sidebar Overlay */}
        {type === 'live' && playlist && (
            <div 
                ref={sidebarRef}
                className={`absolute top-0 right-0 bottom-16 w-80 bg-black/80 backdrop-blur-xl border-l border-white/10 transition-transform duration-300 ease-in-out z-20 flex flex-col
                    ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-white font-semibold">Chaînes</h3>
                    <button onClick={() => setIsSidebarOpen(false)} className="text-white/60 hover:text-white"><X size={18} /></button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {playlist.map((item, index) => {
                        const isActive = currentItem && item.stream_id === currentItem.stream_id;
                        return (
                            <div 
                                key={item.stream_id} 
                                id={`channel-${item.stream_id}`}
                                onClick={() => onChannelSelect && onChannelSelect(item)}
                                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors group
                                    ${isActive ? 'bg-fluent-accent/20 border border-fluent-accent/20' : 'hover:bg-white/10 border border-transparent'}`}
                            >
                                <div className="w-10 h-10 rounded bg-black/40 flex items-center justify-center shrink-0 overflow-hidden">
                                    {item.stream_icon ? (
                                        <img src={item.stream_icon} className="w-full h-full object-contain" loading="lazy" />
                                    ) : (
                                        <div className="text-white/20 text-xs">{index + 1}</div>
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className={`text-sm font-medium truncate ${isActive ? 'text-fluent-accent' : 'text-white/80 group-hover:text-white'}`}>
                                        {item.name}
                                    </p>
                                </div>
                                {isActive && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-fluent-accent ml-auto animate-pulse" />
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        )}

        {/* Top Bar (Title & Close) */}
        <div className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <span className="bg-fluent-accent text-black text-xs font-bold px-2 py-0.5 rounded uppercase">{type}</span>
                    <h2 className="text-white font-medium text-lg drop-shadow-md truncate max-w-2xl">{title}</h2>
                </div>
                <div className="flex items-center gap-2">
                    {onToggleEmbed && (
                        <button onClick={onToggleEmbed} className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors" title={isEmbedded ? "Agrandir" : "Réduire"}>
                             {isEmbedded ? <Expand size={20} /> : <Shrink size={20} />}
                        </button>
                    )}
                    <button onClick={onClose} className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors">
                        <X size={24} />
                    </button>
                </div>
            </div>
        </div>

        {/* Bottom Controls (VLC Style) */}
        <div className={`absolute bottom-0 left-0 right-0 bg-[#111111]/95 backdrop-blur-md border-t border-white/10 transition-transform duration-300 z-30 pb-2 ${showControls ? 'translate-y-0' : 'translate-y-full'}`}>
            
            {/* Live TV EPG Overlay */}
            {type === 'live' && epgNow && (
                <div className="px-4 pt-3 pb-1 border-b border-white/5 animate-in slide-in-from-bottom-2">
                    <div className="flex items-end justify-between mb-1">
                         <div className="min-w-0 flex-1 mr-4">
                             <div className="flex items-center gap-2 mb-1">
                                 <h3 className="text-white font-bold text-lg truncate leading-tight drop-shadow-sm">{epgNow.title}</h3>
                                 <span className="text-xs text-fluent-accent font-mono bg-fluent-accent/10 px-1.5 py-0.5 rounded border border-fluent-accent/20">
                                     {formatEpgTime(epgNow.start_timestamp)} - {formatEpgTime(epgNow.stop_timestamp)}
                                 </span>
                             </div>
                             {epgNext && (
                                 <div className="text-white/50 text-xs truncate flex items-center gap-1">
                                     <span className="uppercase font-bold tracking-wider text-[10px] opacity-70">À suivre :</span> 
                                     <span className="text-white/70">{epgNext.title}</span>
                                     <span className="opacity-50">({formatEpgTime(epgNext.start_timestamp)})</span>
                                 </div>
                             )}
                         </div>
                         <div className="text-xs font-mono text-fluent-accent/80 font-bold mb-1">
                             {Math.round(epgProgress)}%
                         </div>
                    </div>
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                        <div 
                           className="h-full bg-fluent-accent shadow-[0_0_8px_rgba(96,205,255,0.6)] transition-all duration-1000 ease-linear"
                           style={{ width: `${epgProgress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Row 1: Timeline (Seek Bar) - VOD Only */}
            {type !== 'live' ? (
                <div className="w-full relative h-1.5 bg-white/20 cursor-pointer group hover:h-3 transition-all">
                     <div 
                        className="absolute top-0 left-0 h-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]" 
                        style={{ width: `${(currentTime / duration) * 100}%` }} 
                    />
                    <input 
                        type="range" 
                        min="0" 
                        max={duration || 100} 
                        value={currentTime} 
                        onChange={handleSeek}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                </div>
            ) : !epgNow && (
                <div className="w-full h-[1px] bg-white/10 mb-1" />
            )}

            {/* Row 2: Control Buttons */}
            <div className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-4">
                    <button onClick={togglePlay} className="text-white hover:text-orange-400 transition-colors" title={isPlaying ? "Pause" : "Lecture"}>
                        {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                    </button>
                    
                    <button onClick={handleStop} className="text-white/70 hover:text-white transition-colors" title="Arrêter">
                        <Square size={18} fill="currentColor" />
                    </button>

                    <div className="flex items-center gap-1 mx-2">
                        {type === 'live' ? (
                            <>
                                <button onClick={() => changeChannel('prev')} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded" title="Chaîne précédente">
                                    <SkipBack size={18} />
                                </button>
                                <button onClick={() => changeChannel('next')} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded" title="Chaîne suivante">
                                    <SkipForward size={18} />
                                </button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => skip(-10)} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded" title="-10s">
                                    <SkipBack size={18} />
                                </button>
                                <button onClick={() => skip(10)} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded" title="+10s">
                                    <SkipForward size={18} />
                                </button>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-2 group">
                        <button onClick={toggleMute} className="text-white/80 hover:text-white" title="Volume">
                             {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                        </button>
                        <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.05" 
                            value={volume} 
                            onChange={handleVolumeChange}
                            className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-fluent-accent opacity-0 group-hover:opacity-100 transition-opacity" 
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {type !== 'live' && (
                        <div className="text-xs font-mono text-white/80 select-none">
                            <span>{formatTime(currentTime)}</span>
                            <span className="mx-1 text-white/40">/</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    )}
                    
                    {type === 'live' && (
                        <div className="flex items-center gap-2 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-[10px] font-bold uppercase tracking-widest animate-pulse select-none">
                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full" /> Live
                        </div>
                    )}

                    <div className="h-4 w-[1px] bg-white/10 mx-1" />

                    {type === 'live' && (
                        <button 
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                            className={`transition-colors ${isSidebarOpen ? 'text-fluent-accent' : 'text-white/70 hover:text-white'}`}
                            title="Liste des chaînes"
                        >
                            <List size={20} />
                        </button>
                    )}

  const [showInfo, setShowInfo] = useState(false);

  // ... (rest of state)

  // ... (inside return)
        {/* Info Overlay */}
        {showInfo && (
            <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-200" onClick={() => setShowInfo(false)}>
                <div className="max-w-2xl w-full bg-[#1e1e1e] border border-white/10 rounded-xl p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setShowInfo(false)} className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                    
                    <h2 className="text-2xl font-bold text-white mb-2">{epgNow?.title || title}</h2>
                    
                    {epgNow && (
                        <div className="flex items-center gap-3 text-sm text-fluent-accent font-mono mb-4">
                            <Clock size={16} />
                            <span>{formatEpgTime(epgNow.start_timestamp)} - {formatEpgTime(epgNow.stop_timestamp)}</span>
                        </div>
                    )}

                    <div className="text-white/80 leading-relaxed text-lg max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                        {epgNow?.description || (currentItem as any)?.plot || "Aucune description disponible."}
                    </div>

                    {epgNext && (
                        <div className="mt-6 pt-4 border-t border-white/10">
                            <h4 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-2">À suivre</h4>
                            <div className="flex justify-between items-center">
                                <span className="text-white font-medium">{epgNext.title}</span>
                                <span className="text-fluent-accent text-sm font-mono">{formatEpgTime(epgNext.start_timestamp)}</span>
                            </div>
                            {epgNext.description && (
                                <p className="text-white/50 text-sm mt-1 line-clamp-2">{epgNext.description}</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* ... (rest of JSX) */}

        {/* In Controls Bar */}
                    <button onClick={() => setShowInfo(!showInfo)} className={`transition-colors ${showInfo ? 'text-fluent-accent' : 'text-white/70 hover:text-white'}`} title="Informations">
                        <Info size={20} />
                    </button>

                    <button className="text-white/70 hover:text-white" title="Paramètres">
                        <Settings size={20} />
                    </button>
                    
                    {onToggleEmbed && (
                         <button onClick={onToggleEmbed} className="text-white/70 hover:text-white" title={isEmbedded ? "Agrandir" : "Réduire"}>
                            {isEmbedded ? <Expand size={20} /> : <Shrink size={20} />}
                        </button>
                    )}

                    <button onClick={toggleFullscreen} className="text-white/70 hover:text-white" title="Plein écran (Navigateur)">
                        {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};
