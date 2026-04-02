
import React, { useEffect, useRef, useState } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, X, 
  SkipBack, SkipForward, Settings, List, ChevronLeft, ChevronRight, Square,
  Expand, Shrink, RefreshCw, Clock, Info, Columns, AudioLines, Captions, Activity,
  PictureInPicture, Camera, Lock, Unlock
} from 'lucide-react';
import shaka from 'shaka-player/dist/shaka-player.compiled';
import { XtreamStream, XtreamAccount } from '../types';
import { createProxyUrl, decodeBase64 } from '../utils';
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
  isMini?: boolean;
  onToggleEmbed?: () => void;
  onMaximize?: () => void;
  onFullWindow?: () => void;
  onRestore?: () => void;
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
    isEmbedded = false, isMini = false, onToggleEmbed, onMaximize, onFullWindow, onRestore, account
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const epgIntervalRef = useRef<number | null>(null);
  
  // Hook for Preferences
  const { updateProgress, getProgress, getPlayerSettings, updatePlayerSettings } = useUserPreferences(account?.id || 'guest');
  const playerSettings = getPlayerSettings();
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [autoPlayBlocked, setAutoPlayBlocked] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  
  // Resume State
  const [resumePoint, setResumePoint] = useState<number | null>(null);
  const [hasResumed, setHasResumed] = useState(false);

  // Retry Logic State
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  
  // Live TV Specific State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // EPG State
  const [epgNow, setEpgNow] = useState<EpgItem | null>(null);
  const [epgNext, setEpgNext] = useState<EpgItem | null>(null);
  const [epgProgress, setEpgProgress] = useState(0);

  // Audio Tracks State
  const shakaPlayerRef = useRef<any>(null);
  const [audioTracks, setAudioTracks] = useState<{id: number, name: string, lang: string}[]>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState<number>(-1);
  const [showAudioMenu, setShowAudioMenu] = useState(false);

  const [subtitleTracks, setSubtitleTracks] = useState<{id: string, name: string, lang: string}[]>([]);
  const [currentSubtitleTrack, setCurrentSubtitleTrack] = useState<string>(''); // empty string means disabled
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);

  // Quality State
  const [qualityTracks, setQualityTracks] = useState<{id: number, height: number, bitrate: number}[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 means Auto
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  // Stats for Nerds State
  const [showStats, setShowStats] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [stats, setStats] = useState({
    bandwidth: 0,
    droppedFrames: 0,
    decodedFrames: 0,
    bufferHealth: 0,
    resolution: '',
    bitrate: 0
  });

  const controlsTimeoutRef = useRef<number | null>(null);

  // Picture-in-Picture Event Listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnterPiP = () => setIsPiP(true);
    const onLeavePiP = () => setIsPiP(false);

    video.addEventListener('enterpictureinpicture', onEnterPiP);
    video.addEventListener('leavepictureinpicture', onLeavePiP);

    return () => {
      video.removeEventListener('enterpictureinpicture', onEnterPiP);
      video.removeEventListener('leavepictureinpicture', onLeavePiP);
    };
  }, []);

  // Update Stats for Nerds
  useEffect(() => {
    if (!showStats || !shakaPlayerRef.current || !videoRef.current) return;

    const interval = setInterval(() => {
      const player = shakaPlayerRef.current;
      const video = videoRef.current;
      if (!player || !video) return;

      const statsInfo = player.getStats();
      const buffered = video.buffered;
      let bufferHealth = 0;
      
      if (buffered.length > 0) {
        for (let i = 0; i < buffered.length; i++) {
          if (video.currentTime >= buffered.start(i) && video.currentTime <= buffered.end(i)) {
            bufferHealth = buffered.end(i) - video.currentTime;
            break;
          }
        }
      }

      setStats({
        bandwidth: Math.round(player.getStats().estimatedBandwidth / 1000), // kbps
        droppedFrames: statsInfo.droppedFrames,
        decodedFrames: statsInfo.decodedFrames,
        bufferHealth: parseFloat(bufferHealth.toFixed(2)),
        resolution: `${statsInfo.width}x${statsInfo.height}`,
        bitrate: Math.round(statsInfo.streamBandwidth / 1000) // kbps
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showStats]);

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
            // Force http for Xtream API calls
            const apiUrl = `http://${account.host}:${account.port}/player_api.php?username=${account.username}&password=${account.password}&action=get_short_epg&stream_id=${currentItem.stream_id}&limit=4`;
            const proxyUrl = createProxyUrl(apiUrl);
            
            const res = await fetch(proxyUrl);
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
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
                    title: decodeBase64(prog.title),
                    description: decodeBase64(prog.description),
                    start_timestamp: start,
                    stop_timestamp: stop
                };
                if (i + 1 < sorted.length) {
                    const n = sorted[i+1];
                    next = {
                        title: decodeBase64(n.title),
                        description: decodeBase64(n.description),
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
            updateProgress(currentItem, videoRef.current.currentTime, videoRef.current.duration);
        }
    }, 10000); // Save every 10 seconds

    return () => {
        if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
    };
  }, [currentItem, type, updateProgress]);


  // Initialize Player (Shaka Player)
  useEffect(() => {
    shaka.polyfill.installAll();
    
    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    setIsRetrying(false);

    const finalUrl = url;
    
    // Reset tracks on new video
    setAudioTracks([]);
    setCurrentAudioTrack(-1);
    setShowAudioMenu(false);
    setSubtitleTracks([]);
    setCurrentSubtitleTrack('');
    setShowSubtitleMenu(false);
    setQualityTracks([]);
    setCurrentQuality(-1);
    setShowQualityMenu(false);
    setAutoPlayBlocked(false);
    setError(null);
    
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
                if (error.name === 'NotAllowedError') {
                    console.warn("Auto-play blocked, trying muted...");
                    video.muted = true;
                    setIsMuted(true);
                    video.play().catch(e => {
                        console.error("Muted auto-play also blocked", e);
                        setIsPlaying(false);
                        setIsLoading(false);
                        setAutoPlayBlocked(true);
                    });
                } else if (error.name !== 'AbortError') {
                    console.error("Playback error", error);
                    setIsPlaying(false);
                }
            });
        }
    };

    const getRetryDelay = () => {
        if (playerSettings.reconnectDelay === 'progressive') {
            return Math.min(1000 * Math.pow(2, retryCount), 10000);
        }
        return playerSettings.reconnectDelay;
    };

    const initPlayer = async () => {
        const player = new shaka.Player(video);
        shakaPlayerRef.current = player;

        // Apply Network Request Filter (User-Agent spoofing)
        player.getNetworkingEngine().registerRequestFilter((type: number, request: any) => {
            const customUA = account?.userAgent || playerSettings.userAgent;
            if (customUA) {
                // Note: Browsers may block setting the 'User-Agent' header.
                // We set it anyway, and also add a custom header as some providers check it.
                request.headers['User-Agent'] = customUA;
                request.headers['X-User-Agent'] = customUA;
            }
        });

        // Listen for error events.
        player.addEventListener('error', (event: any) => {
            console.error('Shaka Error', event.detail);
            const error = event.detail;
            
            if (error.severity === shaka.util.Error.Severity.CRITICAL) {
                setIsLoading(true);
                setIsRetrying(true);
                if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
                const delay = getRetryDelay();
                retryTimeoutRef.current = window.setTimeout(() => {
                    setRetryCount(prev => prev + 1);
                }, delay);
            }
        });

        // Listen for track changes
        player.addEventListener('variantchanged', () => {
            const tracks = player.getVariantTracks();
            const audioSet = new Set<string>();
            const audioList: {id: number, name: string, lang: string}[] = [];
            
            tracks.forEach((t, index) => {
                const key = `${t.language}-${t.label}`;
                if (!audioSet.has(key)) {
                    audioSet.add(key);
                    audioList.push({
                        id: index,
                        name: t.label || t.language || `Piste ${audioList.length + 1}`,
                        lang: t.language
                    });
                }
            });
            setAudioTracks(audioList);

            // Quality tracks
            const qualities = tracks
                .filter(t => t.height)
                .map(t => ({
                    id: t.id,
                    height: t.height!,
                    bitrate: t.bandwidth
                }))
                .sort((a, b) => b.height - a.height);
            
            // Deduplicate by height
            const uniqueQualities: typeof qualities = [];
            const seenHeights = new Set();
            qualities.forEach(q => {
                if (!seenHeights.has(q.height)) {
                    seenHeights.add(q.height);
                    uniqueQualities.push(q);
                }
            });
            setQualityTracks(uniqueQualities);
        });

        player.addEventListener('texttrackvisibility', () => {
            const tracks = player.getTextTracks();
            const subtitleList = tracks.map((t) => ({
                id: t.language + t.label,
                name: t.label || t.language || `Sous-titre`,
                lang: t.language
            }));
            setSubtitleTracks(subtitleList);
        });

        try {
            await player.load(finalUrl);
            setIsLoading(false);
            setIsRetrying(false);
            setError(null);
            attemptPlay();

            // Initial track setup
            const tracks = player.getVariantTracks();
            // ... (rest of track logic handled by event listeners)
        } catch (e) {
            console.error("Shaka Load Error", e);
            setIsLoading(true);
            setIsRetrying(true);
            if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
            const delay = getRetryDelay();
            retryTimeoutRef.current = window.setTimeout(() => {
                setRetryCount(prev => prev + 1);
            }, delay);
        }
    };

    initPlayer();

    const updateTime = () => setCurrentTime(video.currentTime);
    const updateDuration = () => setDuration(video.duration);
    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => {
        setIsLoading(false);
        setIsRetrying(false);
        setIsPlaying(true);
        setError(null);
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
          updateProgress(currentItem, video.currentTime, video.duration);
      }

      if (shakaPlayerRef.current) {
          shakaPlayerRef.current.destroy();
          shakaPlayerRef.current = null;
      }
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
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(err => {
        console.error(`Error attempting to exit fullscreen: ${err.message}`);
      });
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

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        if (videoRef.current.readyState >= 2) {
          await videoRef.current.requestPictureInPicture();
        }
      }
    } catch (error) {
      console.error("PiP error:", error);
    }
  };

  const takeScreenshot = () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `screenshot-${decodeBase64(title)}-${new Date().getTime()}.png`;
        link.click();
      }
    } catch (e) {
      console.error("Screenshot failed", e);
    }
  };

  const rootClasses = isEmbedded 
    ? "absolute inset-0 z-50 bg-black flex flex-col items-center justify-center animate-in fade-in duration-300 overflow-hidden"
    : "fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-in fade-in duration-300 overflow-hidden";

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={rootClasses}
    >
        {/* Lock Overlay */}
        {isLocked && (
            <div className="absolute inset-0 z-[70] flex items-center justify-center pointer-events-none">
                <div className="bg-black/40 backdrop-blur-sm p-6 rounded-full animate-in fade-in zoom-in duration-300">
                    <Lock size={48} className="text-white/20" />
                </div>
                <button 
                    onClick={() => setIsLocked(false)}
                    className="absolute bottom-10 left-1/2 -translate-x-1/2 pointer-events-auto bg-fluent-accent text-black px-6 py-3 rounded-full font-bold flex items-center gap-2 shadow-2xl hover:scale-105 active:scale-95 transition-all"
                >
                    <Unlock size={20} /> Déverrouiller les contrôles
                </button>
            </div>
        )}

        {/* Stats for Nerds Overlay */}
        {showStats && (
            <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md border border-white/10 p-4 rounded-xl z-[60] text-[10px] font-mono text-white/90 min-w-[200px] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
                    <span className="text-fluent-accent font-bold uppercase tracking-widest">Stats for Nerds</span>
                    <button onClick={() => setShowStats(false)} className="hover:text-white transition-colors">
                        <X size={12} />
                    </button>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between gap-4">
                        <span className="text-white/50">Résolution:</span>
                        <span className="text-white">{stats.resolution}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span className="text-white/50">Débit estimé:</span>
                        <span className="text-white">{stats.bandwidth} kbps</span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span className="text-white/50">Débit flux:</span>
                        <span className="text-white">{stats.bitrate} kbps</span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span className="text-white/50">Buffer:</span>
                        <span className={`font-bold ${stats.bufferHealth < 5 ? 'text-red-400' : stats.bufferHealth < 15 ? 'text-yellow-400' : 'text-green-400'}`}>
                            {stats.bufferHealth}s
                        </span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span className="text-white/50">Images perdues:</span>
                        <span className="text-white">{stats.droppedFrames} / {stats.decodedFrames}</span>
                    </div>
                </div>
            </div>
        )}

        {/* Resume Toast */}
        {resumePoint && !hasResumed && isLoading && (
             <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-fluent-accent/90 text-black px-4 py-2 rounded-full z-50 shadow-lg font-medium animate-in slide-in-from-top-4 fade-in">
                 Reprise de la lecture à {formatTime(resumePoint)}...
             </div>
        )}

        {/* Error Overlay */}
        {error && isRetrying && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-lg z-50 shadow-lg font-medium animate-in slide-in-from-top-4 fade-in flex items-center gap-2">
                <Info size={16} />
                {error}
            </div>
        )}

        {/* Loading Spinner */}
        {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none bg-black/40 backdrop-blur-sm">
                <div className="w-16 h-16 border-4 border-fluent-accent border-t-transparent rounded-full animate-spin mb-4"></div>
                {isRetrying && (
                    <div className="text-white text-sm font-medium animate-pulse flex flex-col items-center gap-2">
                        <div className="flex items-center gap-2">
                            <RefreshCw size={14} className="animate-spin" />
                            Connexion perdue.
                        </div>
                        <div className="text-[10px] opacity-70 uppercase tracking-widest">
                            Reconnexion {playerSettings.reconnectDelay === 'progressive' ? 'progressive' : `dans ${playerSettings.reconnectDelay / 1000}s`}...
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* Auto-play Blocked Overlay */}
        {autoPlayBlocked && !isPlaying && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/60 backdrop-blur-sm">
                <button 
                    onClick={() => {
                        if (videoRef.current) {
                            videoRef.current.muted = false;
                            setIsMuted(false);
                            videoRef.current.play();
                            setAutoPlayBlocked(false);
                            setIsPlaying(true);
                        }
                    }}
                    className="w-20 h-20 bg-fluent-accent text-black rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"
                >
                    <Play size={40} fill="currentColor" />
                </button>
                <p className="text-white mt-4 font-medium">Cliquer pour lancer la lecture</p>
            </div>
        )}

        {/* Video Element */}
        <video 
            ref={videoRef}
            className="w-full h-full object-contain"
            onClick={togglePlay}
            onDoubleClick={onToggleEmbed ? onToggleEmbed : toggleFullscreen}
        />

        {/* Info Overlay */}
        {showInfo && (
            <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-200" onClick={() => setShowInfo(false)}>
                <div className="max-w-2xl w-full bg-[#1e1e1e] border border-white/10 rounded-xl p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setShowInfo(false)} className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                    
                    <h2 className="text-2xl font-bold text-white mb-2">{epgNow?.title || decodeBase64(title)}</h2>
                    
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
                                        {decodeBase64(item.name)}
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
        {!isMini && (
            <div className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 z-30 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="bg-fluent-accent text-black text-xs font-bold px-2 py-0.5 rounded uppercase">{type}</span>
                        <h2 className="text-white font-medium text-lg drop-shadow-md truncate max-w-2xl">{decodeBase64(title)}</h2>
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
        )}

        {/* Mini Top Bar (Close only) */}
        {isMini && (
            <div className={`absolute top-0 right-0 p-2 z-30 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                <button onClick={onClose} className="text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/20 transition-colors bg-black/40 backdrop-blur-sm">
                    <X size={18} />
                </button>
            </div>
        )}

        {/* Bottom Controls (VLC Style) */}
        {!isLocked && (
            <div className={`absolute bottom-0 left-0 right-0 bg-[#111111]/95 backdrop-blur-md border-t border-white/10 transition-transform duration-300 z-30 pb-2 ${showControls ? 'translate-y-0' : 'translate-y-full'}`}>
            
            {/* Live TV EPG Overlay */}
            {type === 'live' && epgNow && (
                <div className={`px-4 pt-3 pb-1 border-b border-white/5 animate-in slide-in-from-bottom-2 ${isMini ? 'pt-1 pb-0 px-2' : ''}`}>
                    <div className="flex items-end justify-between mb-1">
                         <div className="min-w-0 flex-1 mr-4">
                             {!isMini && (
                                 <div className="flex items-center gap-2 mb-1">
                                     <h3 className="text-white font-bold text-lg truncate leading-tight drop-shadow-sm">{epgNow.title}</h3>
                                     <span className="text-xs text-fluent-accent font-mono bg-fluent-accent/10 px-1.5 py-0.5 rounded border border-fluent-accent/20">
                                         {formatEpgTime(epgNow.start_timestamp)} - {formatEpgTime(epgNow.stop_timestamp)}
                                     </span>
                                 </div>
                             )}
                             {isMini && (
                                 <div className="text-[10px] text-white font-bold truncate mb-0.5">{epgNow.title}</div>
                             )}
                             {!isMini && epgNext && (
                                 <div className="text-white/50 text-xs truncate flex items-center gap-1">
                                     <span className="uppercase font-bold tracking-wider text-[10px] opacity-70">À suivre :</span> 
                                     <span className="text-white/70">{epgNext.title}</span>
                                     <span className="opacity-50">({formatEpgTime(epgNext.start_timestamp)})</span>
                                 </div>
                             )}
                         </div>
                         <div className={`text-xs font-mono text-fluent-accent/80 font-bold mb-1 ${isMini ? 'text-[9px] mb-0' : ''}`}>
                             {Math.round(epgProgress)}%
                         </div>
                    </div>
                    <div className={`w-full h-1 bg-white/10 rounded-full overflow-hidden ${isMini ? 'h-0.5' : ''}`}>
                        <div 
                           className="h-full bg-fluent-accent shadow-[0_0_8px_rgba(96,205,255,0.6)] transition-all duration-1000 ease-linear"
                           style={{ width: `${epgProgress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Row 1: Timeline (Seek Bar) - VOD Only */}
            {type !== 'live' ? (
                <div className={`w-full relative h-1.5 bg-white/20 cursor-pointer group hover:h-3 transition-all ${isMini ? 'h-1' : ''}`}>
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
            <div className={`flex items-center justify-between px-4 py-2 ${isMini ? 'px-2 py-1 gap-1' : ''}`}>
                <div className="flex items-center gap-4">
                    <button onClick={togglePlay} className="text-white hover:text-orange-400 transition-colors" title={isPlaying ? "Pause" : "Lecture"}>
                        {isPlaying ? <Pause size={isMini ? 18 : 24} fill="currentColor" /> : <Play size={isMini ? 18 : 24} fill="currentColor" />}
                    </button>
                    
                    {!isMini && (
                        <button onClick={handleStop} className="text-white/70 hover:text-white transition-colors" title="Arrêter">
                            <Square size={18} fill="currentColor" />
                        </button>
                    )}

                    <div className={`flex items-center gap-1 ${isMini ? 'gap-0.5' : 'mx-2'}`}>
                        {type === 'live' ? (
                            <>
                                <button onClick={() => changeChannel('prev')} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded" title="Chaîne précédente">
                                    <SkipBack size={isMini ? 14 : 18} />
                                </button>
                                <button onClick={() => changeChannel('next')} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded" title="Chaîne suivante">
                                    <SkipForward size={isMini ? 14 : 18} />
                                </button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => skip(-10)} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded" title="-10s">
                                    <SkipBack size={isMini ? 14 : 18} />
                                </button>
                                <button onClick={() => skip(10)} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded" title="+10s">
                                    <SkipForward size={isMini ? 14 : 18} />
                                </button>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-2 group">
                        <button onClick={toggleMute} className="text-white/80 hover:text-white" title="Volume">
                             {isMuted ? <VolumeX size={isMini ? 16 : 20} /> : <Volume2 size={isMini ? 16 : 20} />}
                        </button>
                        {!isMini && (
                            <input 
                                type="range" 
                                min="0" 
                                max="1" 
                                step="0.05" 
                                value={volume} 
                                onChange={handleVolumeChange}
                                className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-fluent-accent opacity-0 group-hover:opacity-100 transition-opacity" 
                            />
                        )}
                    </div>
                </div>

                <div className={`flex items-center gap-4 ${isMini ? 'gap-1' : ''}`}>
                    {!isMini && type !== 'live' && (
                        <div className="text-xs font-mono text-white/80 select-none">
                            <span>{formatTime(currentTime)}</span>
                            <span className="mx-1 text-white/40">/</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    )}
                    
                    {!isMini && type === 'live' && (
                        <div className="flex items-center gap-2 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-[10px] font-bold uppercase tracking-widest animate-pulse select-none">
                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full" /> Live
                        </div>
                    )}

                    {!isMini && <div className="h-4 w-[1px] bg-white/10 mx-1" />}

                    {!isMini && type === 'live' && (
                        <button 
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                            className={`transition-colors ${isSidebarOpen ? 'text-fluent-accent' : 'text-white/70 hover:text-white'}`}
                            title="Liste des chaînes"
                        >
                            <List size={20} />
                        </button>
                    )}

                    {!isMini && (
                        <button 
                            onClick={() => setShowStats(!showStats)} 
                            className={`transition-colors ${showStats ? 'text-fluent-accent' : 'text-white/70 hover:text-white'}`} 
                            title="Statistiques techniques"
                        >
                            <Activity size={20} />
                        </button>
                    )}

                    {!isMini && (
                        <button onClick={() => setShowInfo(!showInfo)} className={`transition-colors ${showInfo ? 'text-fluent-accent' : 'text-white/70 hover:text-white'}`} title="Informations">
                            <Info size={20} />
                        </button>
                    )}

                    {!isMini && (
                        <button 
                            onClick={takeScreenshot} 
                            className="text-white/70 hover:text-white transition-colors" 
                            title="Capture d'écran"
                        >
                            <Camera size={20} />
                        </button>
                    )}

                    {!isMini && (
                        <button 
                            onClick={togglePiP} 
                            className={`transition-colors ${isPiP ? 'text-fluent-accent' : 'text-white/70 hover:text-white'}`}
                            title="Picture-in-Picture"
                        >
                            <PictureInPicture size={20} />
                        </button>
                    )}

                    {!isMini && (
                        <button 
                            onClick={() => setIsLocked(true)} 
                            className="text-white/70 hover:text-white transition-colors" 
                            title="Verrouiller les contrôles"
                        >
                            <Lock size={20} />
                        </button>
                    )}

                    {!isMini && audioTracks.length > 1 && (
                        <div className="relative">
                            <button 
                                onClick={() => {
                                    setShowAudioMenu(!showAudioMenu);
                                    setShowSubtitleMenu(false);
                                    setShowQualityMenu(false);
                                    setIsSettingsOpen(false);
                                }} 
                                className={`transition-colors ${showAudioMenu ? 'text-fluent-accent' : 'text-white/70 hover:text-white'}`} 
                                title="Pistes Audio"
                            >
                                <AudioLines size={20} />
                            </button>

                            {showAudioMenu && (
                                <div className="absolute bottom-full right-0 mb-4 w-48 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl p-4 z-50 animate-in slide-in-from-bottom-2">
                                    <h4 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3">Pistes Audio</h4>
                                    <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                                        {audioTracks.map((track) => {
                                            const isSelected = currentAudioTrack === track.id || (currentAudioTrack === -1 && track.id === 0);
                                            return (
                                                <button
                                                    key={track.id}
                                                    onClick={() => {
                                                        if (shakaPlayerRef.current) {
                                                            shakaPlayerRef.current.selectAudioLanguage(track.lang);
                                                            setCurrentAudioTrack(track.id);
                                                        }
                                                        setShowAudioMenu(false);
                                                    }}
                                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between
                                                        ${isSelected 
                                                            ? 'bg-fluent-accent text-black font-bold' 
                                                            : 'text-white/80 hover:bg-white/5'}`}
                                                >
                                                    <span className="truncate">{track.name || track.lang || `Piste ${track.id + 1}`}</span>
                                                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-black shrink-0 ml-2" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {!isMini && subtitleTracks.length > 0 && (
                        <div className="relative">
                            <button 
                                onClick={() => {
                                    setShowSubtitleMenu(!showSubtitleMenu);
                                    setShowAudioMenu(false);
                                    setShowQualityMenu(false);
                                    setIsSettingsOpen(false);
                                }} 
                                className={`transition-colors ${showSubtitleMenu ? 'text-fluent-accent' : 'text-white/70 hover:text-white'}`} 
                                title="Sous-titres"
                            >
                                <Captions size={20} />
                            </button>

                            {showSubtitleMenu && (
                                <div className="absolute bottom-full right-0 mb-4 w-48 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl p-4 z-50 animate-in slide-in-from-bottom-2">
                                    <h4 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3">Sous-titres</h4>
                                    <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                                        <button
                                            onClick={() => {
                                                if (shakaPlayerRef.current) {
                                                    shakaPlayerRef.current.setTextTrackVisibility(false);
                                                    setCurrentSubtitleTrack('');
                                                }
                                                setShowSubtitleMenu(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between
                                                ${currentSubtitleTrack === '' 
                                                    ? 'bg-fluent-accent text-black font-bold' 
                                                    : 'text-white/80 hover:bg-white/5'}`}
                                        >
                                            <span>Désactivés</span>
                                            {currentSubtitleTrack === '' && <div className="w-1.5 h-1.5 rounded-full bg-black shrink-0 ml-2" />}
                                        </button>
                                        
                                        {subtitleTracks.map((track) => {
                                            const isSelected = currentSubtitleTrack === track.id;
                                            return (
                                                <button
                                                    key={track.id}
                                                    onClick={() => {
                                                        if (shakaPlayerRef.current) {
                                                            shakaPlayerRef.current.selectTextLanguage(track.lang);
                                                            shakaPlayerRef.current.setTextTrackVisibility(true);
                                                            setCurrentSubtitleTrack(track.id);
                                                        }
                                                        setShowSubtitleMenu(false);
                                                    }}
                                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between
                                                        ${isSelected 
                                                            ? 'bg-fluent-accent text-black font-bold' 
                                                            : 'text-white/80 hover:bg-white/5'}`}
                                                >
                                                    <span className="truncate">{track.name || track.lang || `Piste ${track.id + 1}`}</span>
                                                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-black shrink-0 ml-2" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {!isMini && qualityTracks.length > 1 && (
                        <div className="relative">
                            <button 
                                onClick={() => {
                                    setShowQualityMenu(!showQualityMenu);
                                    setShowAudioMenu(false);
                                    setShowSubtitleMenu(false);
                                    setIsSettingsOpen(false);
                                }} 
                                className={`transition-colors ${showQualityMenu ? 'text-fluent-accent' : 'text-white/70 hover:text-white'}`} 
                                title="Qualité Vidéo"
                            >
                                <Settings size={20} />
                            </button>

                            {showQualityMenu && (
                                <div className="absolute bottom-full right-0 mb-4 w-48 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl p-4 z-50 animate-in slide-in-from-bottom-2">
                                    <h4 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3">Qualité</h4>
                                    <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                                        <button
                                            onClick={() => {
                                                if (shakaPlayerRef.current) {
                                                    shakaPlayerRef.current.configure({ abr: { enabled: true } });
                                                    setCurrentQuality(-1);
                                                }
                                                setShowQualityMenu(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between
                                                ${currentQuality === -1 
                                                    ? 'bg-fluent-accent text-black font-bold' 
                                                    : 'text-white/80 hover:bg-white/5'}`}
                                        >
                                            <span>Automatique</span>
                                            {currentQuality === -1 && <div className="w-1.5 h-1.5 rounded-full bg-black shrink-0 ml-2" />}
                                        </button>
                                        
                                        {qualityTracks.map((track) => {
                                            const isSelected = currentQuality === track.id;
                                            return (
                                                <button
                                                    key={track.id}
                                                    onClick={() => {
                                                        if (shakaPlayerRef.current) {
                                                            shakaPlayerRef.current.configure({ abr: { enabled: false } });
                                                            const variants = shakaPlayerRef.current.getVariantTracks();
                                                            const target = variants.find(v => v.id === track.id);
                                                            if (target) {
                                                                shakaPlayerRef.current.selectVariantTrack(target, true);
                                                                setCurrentQuality(track.id);
                                                            }
                                                        }
                                                        setShowQualityMenu(false);
                                                    }}
                                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between
                                                        ${isSelected 
                                                            ? 'bg-fluent-accent text-black font-bold' 
                                                            : 'text-white/80 hover:bg-white/5'}`}
                                                >
                                                    <span>{track.height}p</span>
                                                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-black shrink-0 ml-2" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {!isMini && (
                        <div className="relative">
                            <button 
                                onClick={() => {
                                    setIsSettingsOpen(!isSettingsOpen);
                                    setShowAudioMenu(false);
                                    setShowSubtitleMenu(false);
                                }} 
                                className={`transition-colors ${isSettingsOpen ? 'text-fluent-accent' : 'text-white/70 hover:text-white'}`} 
                                title="Paramètres"
                            >
                                <Settings size={20} />
                            </button>

                            {isSettingsOpen && (
                                <div className="absolute bottom-full right-0 mb-4 w-64 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl p-4 z-50 animate-in slide-in-from-bottom-2">
                                    <h4 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3">Reconnexion auto</h4>
                                    <div className="space-y-1">
                                        {[
                                            { label: 'Progressive', value: 'progressive' },
                                            { label: '2 secondes', value: 2000 },
                                            { label: '3 secondes', value: 3000 },
                                            { label: '5 secondes', value: 5000 }
                                        ].map((opt) => (
                                            <button
                                                key={opt.label}
                                                onClick={() => {
                                                    updatePlayerSettings({ reconnectDelay: opt.value as any });
                                                    setIsSettingsOpen(false);
                                                }}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between
                                                    ${playerSettings.reconnectDelay === opt.value 
                                                        ? 'bg-fluent-accent text-black font-bold' 
                                                        : 'text-white/80 hover:bg-white/5'}`}
                                            >
                                                {opt.label}
                                                {playerSettings.reconnectDelay === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-white/5 text-[10px] text-white/40 leading-tight">
                                        Définit le délai avant de tenter une reconnexion en cas de perte de signal.
                                    </div>

                                    <h4 className="text-xs font-bold text-white/50 uppercase tracking-widest mt-4 mb-3">User-Agent (Spoofing)</h4>
                                    <div className="space-y-2">
                                        <input 
                                            type="text"
                                            placeholder="Ex: Samsung Smart TV"
                                            value={playerSettings.userAgent || ''}
                                            onChange={(e) => updatePlayerSettings({ userAgent: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-fluent-accent transition-colors"
                                        />
                                        <div className="flex flex-wrap gap-1">
                                            {[
                                                { name: 'VLC', ua: 'VLC/3.0.18 LibVLC/3.0.18' },
                                                { name: 'Mag', ua: 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200' },
                                                { name: 'Samsung', ua: 'Mozilla/5.0 (SmartHub; SMART-TV; Linux; Tizen 2.4) AppleWebkit/538.1' }
                                            ].map(preset => (
                                                <button 
                                                    key={preset.name}
                                                    onClick={() => updatePlayerSettings({ userAgent: preset.ua })}
                                                    className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[9px] text-white/60 transition-colors"
                                                >
                                                    {preset.name}
                                                </button>
                                            ))}
                                            <button 
                                                onClick={() => updatePlayerSettings({ userAgent: '' })}
                                                className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[9px] text-red-400/60 transition-colors"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-[9px] text-white/30 leading-tight italic">
                                        Certains fournisseurs exigent un User-Agent spécifique pour autoriser la lecture.
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {isMini && onToggleEmbed && (
                         <button onClick={onToggleEmbed} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded" title="Élargir dans l'EPG">
                            <Expand size={16} />
                        </button>
                    )}

                    {(isMini || isEmbedded) && onFullWindow && (
                         <button onClick={onFullWindow} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded" title="Plein écran (Fenêtre)">
                            <Maximize size={isMini ? 16 : 20} />
                        </button>
                    )}

                    {onRestore && (
                         <button onClick={onRestore} className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded" title="Retour à la vue section">
                            <Columns size={isMini ? 16 : 20} />
                        </button>
                    )}
                    
                    {!isMini && onToggleEmbed && (
                         <button onClick={onToggleEmbed} className="text-white/70 hover:text-white" title={isEmbedded ? (onFullWindow ? "Réduire dans l'EPG" : "Plein écran (Fenêtre)") : "Réduire"}>
                            {isEmbedded ? (onFullWindow ? <Shrink size={20} /> : <Expand size={20} />) : <Shrink size={20} />}
                        </button>
                    )}

                    {!isMini && (
                        <button onClick={toggleFullscreen} className="text-white/70 hover:text-white" title="Plein écran (Navigateur)">
                            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                        </button>
                    )}
                </div>
            </div>
        </div>
        )}
    </div>
  );
};
