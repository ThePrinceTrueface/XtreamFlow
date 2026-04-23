
import React, { useEffect, useRef, useState } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, X, 
  SkipBack, SkipForward, Settings, List, ListVideo, ChevronLeft, ChevronRight, Square,
  Expand, Shrink, RefreshCw, Clock, Info, Columns, AudioLines, Captions,
  ChevronUp, ChevronDown, Search, MonitorPlay, Tv, PictureInPicture,
  RotateCcw, RotateCw, Film, Link, Check
} from 'lucide-react';
import shaka from 'shaka-player';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import { XtreamStream, XtreamAccount } from '../types';
import { createProxyUrl, decodeBase64 } from '../utils';
import { useUserPreferences } from '../hooks/useUserPreferences';

interface VideoPlayerProps {
  url: string;
  title: string;
  type: 'live' | 'vod' | 'series';
  onClose: () => void;
  playlist?: any[];
  currentItem?: XtreamStream;
  onChannelSelect?: (item: any) => void;
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
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [activeMenu, setActiveMenu] = useState<'none' | 'channels' | 'audio' | 'subtitles' | 'settings'>('none');
  const [currentTimeString, setCurrentTimeString] = useState('');

  // Clock Update
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTimeString(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 10000);
    return () => clearInterval(interval);
  }, []);
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [autoPlayBlocked, setAutoPlayBlocked] = useState(false);
  
  // Resume State
  const [resumePoint, setResumePoint] = useState<number | null>(null);
  const [hasResumed, setHasResumed] = useState(false);

  // Retry Logic State
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  
  // Live TV Specific State
  const [showInfo, setShowInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // EPG State
  const [epgNow, setEpgNow] = useState<EpgItem | null>(null);
  const [epgNext, setEpgNext] = useState<EpgItem | null>(null);
  const [epgProgress, setEpgProgress] = useState(0);

  // Audio Tracks State
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<mpegts.Player | null>(null);
  const shakaRef = useRef<any>(null); // Shaka Player instance for MKV
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [audioTracks, setAudioTracks] = useState<{id: number, name: string, lang: string}[]>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState<number>(-1);
  const [showAudioMenu, setShowAudioMenu] = useState(false);

  const [subtitleTracks, setSubtitleTracks] = useState<{id: number, name: string, lang: string}[]>([]);
  const [currentSubtitleTrack, setCurrentSubtitleTrack] = useState<number>(-1); // -1 means disabled
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  
  const [activeUrl, setActiveUrl] = useState(url);
  useEffect(() => {
     setActiveUrl(url);
     setRetryCount(0);
  }, [url]);

  const controlsTimeoutRef = useRef<number | null>(null);

  // Auto-scroll to active item in channel list
  useEffect(() => {
    if (activeMenu === 'channels') {
        let activeId = '';
        if ((type === 'live' || type === 'vod') && currentItem) {
            activeId = `channel-${currentItem.stream_id}`;
        } else if (type === 'series' && url) {
            // Extract episode ID from URL for series
            const match = url.match(/\/(\d+)\.[a-zA-Z0-9]+$/);
            if (match && match[1]) {
                activeId = `episode-${match[1]}`;
            }
        }

        if (activeId) {
            const activeEl = document.getElementById(activeId);
            if (activeEl) {
                // Use setTimeout to ensure the list is rendered before scrolling
                setTimeout(() => {
                    activeEl.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
                }, 100);
            }
        }
    }
  }, [activeMenu, currentItem, type, url]);

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
            const apiUrl = `${account.protocol || 'http'}://${account.host}:${account.port}/player_api.php?username=${account.username}&password=${account.password}&action=get_short_epg&stream_id=${currentItem.stream_id}&limit=4`;
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


  // Initialize Player (HLS or Native)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    // Enable CORS for proxied streams
    video.crossOrigin = "anonymous";

    setIsLoading(true);
    setIsRetrying(false);

    const isM3U8 = activeUrl.toLowerCase().includes('.m3u8');
    const isTS = activeUrl.toLowerCase().includes('.ts') || activeUrl.toLowerCase().includes('.m2ts');
    const isMKV = activeUrl.toLowerCase().includes('.mkv');
    
    // In Xtream, if it doesn't have .m3u8, it's likely MPEG-TS even for live
    const isHls = isM3U8 || (type === 'live' && !isTS && !isMKV);
    const isMpegTs = isTS && !isM3U8 && !isMKV;

    // Do not use proxy for direct stream URLs as per user request (Xtream servers may block proxy IP)
    const finalUrl = activeUrl;
    
    // Reset audio and subtitle tracks on new video
    setAudioTracks([]);
    setCurrentAudioTrack(-1);
    setShowAudioMenu(false);
    setSubtitleTracks([]);
    setCurrentSubtitleTrack(-1);
    setShowSubtitleMenu(false);
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

    if (isMKV && shaka.Player.isBrowserSupported()) {
        const player = new shaka.Player(video);
        shakaRef.current = player;
        
        player.addEventListener('error', (event: any) => {
             console.error("Shaka MKV Error", event.detail);
             setError("Erreur de décodage MKV via Shaka Player.");
             setIsLoading(true);
             setIsRetrying(true);
             if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
             const delay = getRetryDelay();
             retryTimeoutRef.current = window.setTimeout(() => {
                 setRetryCount(prev => prev + 1);
             }, delay);
        });

        player.load(finalUrl).then(() => {
             setIsLoading(false);
             setIsRetrying(false);
             setError(null);
             attemptPlay();
             
             // Extract tracks if available
             const tracks = player.getVariantTracks();
             const audioMap = new Map();
             tracks.forEach(t => {
                if (t.language && !audioMap.has(t.language)) {
                    audioMap.set(t.language, { id: t.id, name: t.roles?.join(', ') || `Piste`, lang: t.language });
                }
             });
             setAudioTracks(Array.from(audioMap.values()));
             
             const textTracks = player.getTextTracks();
             if (textTracks && textTracks.length > 0) {
                 const subs = textTracks.map(t => ({ id: t.id, name: t.roles?.join(', ') || 'Sous-titre', lang: t.language }));
                 setSubtitleTracks(subs);
             }
        }).catch((e: any) => {
             console.error("Shaka Player load failed", e);
             // Fallback to native if Shaka fails to demux this specific MKV
             video.src = finalUrl;
             video.load();
             attemptPlay();
        });
        
    } else if (isHls && Hls.isSupported()) {
      // Determine buffer settings based on user preference and stream type
      let maxBufferLength = 30;
      let maxMaxBufferLength = 600;
      let backBufferLength = 90;

      if (type === 'live') {
          maxBufferLength = 10;
          maxMaxBufferLength = 20;
          backBufferLength = 30;
      }

      const bufferPref = playerSettings.bufferSize || 'normal';
      if (bufferPref === 'small') {
          maxBufferLength = Math.max(5, maxBufferLength / 2);
          maxMaxBufferLength = Math.max(10, maxMaxBufferLength / 2);
      } else if (bufferPref === 'large') {
          maxBufferLength = maxBufferLength * 2;
          maxMaxBufferLength = maxMaxBufferLength * 2;
      }

      hlsRef.current = new Hls({
        enableWorker: true,
        lowLatencyMode: type === 'live',
        maxBufferLength,
        maxMaxBufferLength,
        backBufferLength,
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 3,
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 3,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 3
      });

      const hls = hlsRef.current;
      hls.loadSource(finalUrl);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        setIsRetrying(false);
        setError(null);
        attemptPlay();
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (event, data) => {
        if (data.audioTracks && data.audioTracks.length > 0) {
            const tracks = data.audioTracks.map((t, index) => ({
                id: index,
                name: t.name || `Piste ${index + 1}`,
                lang: t.lang || ''
            }));
            setAudioTracks(tracks);
            
            // Auto-select preferred language
            const prefLang = playerSettings.preferredAudioLanguage?.toLowerCase();
            if (prefLang && prefLang !== 'original') {
                const matchIndex = tracks.findIndex(t => 
                    t.lang.toLowerCase().includes(prefLang) || 
                    t.name.toLowerCase().includes(prefLang)
                );
                if (matchIndex !== -1 && hls.audioTrack !== matchIndex) {
                    hls.audioTrack = matchIndex;
                    setCurrentAudioTrack(matchIndex);
                } else {
                    setCurrentAudioTrack(hls.audioTrack);
                }
            } else {
                setCurrentAudioTrack(hls.audioTrack);
            }
        }
      });

      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (event, data) => {
          setCurrentAudioTrack(data.id);
      });

      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (event, data) => {
        if (data.subtitleTracks && data.subtitleTracks.length > 0) {
            const tracks = data.subtitleTracks.map((t, index) => ({
                id: index,
                name: t.name || `Sous-titre ${index + 1}`,
                lang: t.lang || ''
            }));
            setSubtitleTracks(tracks);
            setCurrentSubtitleTrack(hls.subtitleTrack);
        }
      });

      hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (event, data) => {
          setCurrentSubtitleTrack(data.id);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error("HLS Error", data);
        if (data.fatal) {
            switch (data.type) {
                case Hls.ErrorTypes.MEDIA_ERROR:
                    hls?.recoverMediaError();
                    break;
                case Hls.ErrorTypes.NETWORK_ERROR:
                    if ((data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR || data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT || (data as any).response?.code === 404 || (data as any).response?.code === 500) && activeUrl.endsWith('.m3u8') && type === 'live') {
                        console.warn("HLS Error: Manifest load failed. Server might not support .m3u8 for this live stream. Falling back to .ts ...");
                        hls?.destroy();
                        setActiveUrl(prevUrl => prevUrl.replace('.m3u8', '.ts'));
                        return; // Exit and wait for the useEffect to re-trigger with .ts
                    }
                default:
                    hls?.destroy();
                    setIsLoading(true);
                    setIsRetrying(true);
                    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
                    const delay = getRetryDelay();
                    retryTimeoutRef.current = window.setTimeout(() => {
                        setRetryCount(prev => prev + 1);
                    }, delay);
                    break;
            }
        }
      });
    } else if (isMpegTs && mpegts.getFeatureList().mseLivePlayback) {
        mpegtsRef.current = mpegts.createPlayer({
            type: 'mse',
            isLive: false, // Narrowed type excludes 'live' here
            url: finalUrl
        }, {
            enableWorker: true,
            stashInitialSize: 128,
            enableStashBuffer: true
        });
        
        const mplayer = mpegtsRef.current;
        mplayer.attachMediaElement(video);
        mplayer.load();
        
        mplayer.on(mpegts.Events.ERROR, (type, detail, info) => {
            console.error("MPEGTS Error", type, detail, info);
            setError(`Erreur de lecture TS: ${type}`);
            setIsLoading(true);
            setIsRetrying(true);
            if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
            const delay = getRetryDelay();
            retryTimeoutRef.current = window.setTimeout(() => {
                setRetryCount(prev => prev + 1);
            }, delay);
        });

        mplayer.on(mpegts.Events.METADATA_ARRIVED, () => {
            setIsLoading(false);
            setIsRetrying(false);
            setError(null);
            attemptPlay();
        });

        // Some servers don't trigger METADATA_ARRIVED correctly for VOD
        const checkLoad = setTimeout(() => {
            setIsLoading(false);
            attemptPlay();
        }, 1000);
        return () => clearTimeout(checkLoad);

    } else {
      video.src = finalUrl;
      video.load();
      attemptPlay();
      
      const extractNativeTracks = () => {
          const v = video as any;
          if (v.audioTracks && v.audioTracks.length > 0) {
              const aTracks = [];
              for(let i = 0; i < v.audioTracks.length; i++) {
                 const t = v.audioTracks[i];
                 aTracks.push({ id: i, name: t.label || `Piste ${i+1}`, lang: t.language || '' });
              }
              setAudioTracks(aTracks);
              for(let i = 0; i < v.audioTracks.length; i++) {
                 if (v.audioTracks[i].enabled) setCurrentAudioTrack(i);
              }
          }
          if (video.textTracks && video.textTracks.length > 0) {
              const sTracks = [];
              for(let i = 0; i < video.textTracks.length; i++) {
                 const t = video.textTracks[i];
                 sTracks.push({ id: i, name: t.label || `Sous-titre ${i+1}`, lang: t.language || '' });
                 if (t.mode === 'showing') setCurrentSubtitleTrack(i);
              }
              setSubtitleTracks(sTracks);
          }
      };
      
      (window as any).__extractNativeTracks = extractNativeTracks;
      video.addEventListener('loadedmetadata', extractNativeTracks);
      
      video.onerror = () => {
          const err = video.error;
          let msg = "Erreur de lecture.";
          if (err?.code === 4) msg = "Format non supporté ou erreur CORS.";
          else if (err?.code === 3) msg = "Erreur de décodage.";
          else if (err?.code === 2) msg = "Erreur réseau (vérifiez votre connexion).";
          
          console.error("Native Video Error", err);
          setError(msg);
          setIsLoading(true);
          setIsRetrying(true);
          if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
          const delay = getRetryDelay();
          retryTimeoutRef.current = window.setTimeout(() => {
               setRetryCount(prev => prev + 1);
          }, delay);
      };
    }

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

      if (shakaRef.current) {
          shakaRef.current.destroy();
          shakaRef.current = null;
      }
      if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
      }
      if (mpegtsRef.current) {
          mpegtsRef.current.destroy();
          mpegtsRef.current = null;
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
        // Cast video to any to ignore the specific listener signature
        (video as any).removeEventListener('loadedmetadata', (window as any).__extractNativeTracks);
        video.onerror = null;
      }
    };
  }, [url, activeUrl, retryCount, playerSettings.bufferSize]); 

  // Handle Controls Visibility
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    if (activeMenu === 'none') {
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

  const handleManualScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
        const scrollAmount = direction === 'left' ? -400 : 400;
        scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
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
      if (e.key === 'ArrowDown') setShowAdvancedControls(prev => !prev);
      
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

        {/* Top Bar (Title & Close) */}
        {!isMini && (
            <div className={`absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-40 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                <div className="text-white font-medium text-lg drop-shadow-md">
                    {type === 'live' ? 'LIVE TV' : 'VOD'} | {decodeBase64(title)}
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-white font-medium text-lg drop-shadow-md">
                        {currentTimeString}
                    </div>
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
        )}

        {/* Mini Top Bar (Close only) */}
        {isMini && (
            <div className={`absolute top-0 right-0 p-2 z-30 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                <button onClick={onClose} className="text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/20 transition-colors bg-black/40 backdrop-blur-sm">
                    <X size={18} />
                </button>
            </div>
        )}

        {/* Bottom Controls Container */}
        <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0f1115] via-[#0f1115]/95 to-transparent transition-transform duration-300 z-30 pt-32 pb-6 px-8 ${showControls ? 'translate-y-0' : 'translate-y-full'}`}>
            
            {/* Info Section (Live TV) */}
            {!isMini && type === 'live' && (
                <div className="flex items-start gap-6 mb-8">
                    <div className="w-32 h-32 bg-black/40 rounded-xl flex items-center justify-center p-2 shrink-0 shadow-lg">
                        {currentItem?.stream_icon ? <img src={currentItem.stream_icon} className="max-w-full max-h-full object-contain" /> : <Tv size={48} className="text-white/20" />}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center h-32">
                        <h2 className="text-3xl font-bold text-white mb-2 truncate drop-shadow-md">{epgNow?.title || decodeBase64(title)}</h2>
                        {epgNow && (
                            <div className="flex items-center gap-3 text-sm text-white/70 font-medium mb-2">
                                <span>{formatEpgTime(epgNow.start_timestamp)} - {formatEpgTime(epgNow.stop_timestamp)}</span>
                                <span className="w-1 h-1 rounded-full bg-white/50" />
                                <span>{Math.round((epgNow.stop_timestamp - epgNow.start_timestamp) / 60)} min</span>
                                {currentItem?.num && (
                                    <>
                                        <span className="w-1 h-1 rounded-full bg-white/50" />
                                        <span className="text-white font-bold">{currentItem.num}</span>
                                    </>
                                )}
                            </div>
                        )}
                        <p className="text-white/60 text-sm line-clamp-2 mb-2">{epgNow?.description || (currentItem as any)?.plot || "Aucune information disponible"}</p>
                        {epgNext && (
                            <div className="text-white/50 text-sm truncate flex items-center gap-2">
                                <span>{formatEpgTime(epgNext.start_timestamp)} - {formatEpgTime(epgNext.stop_timestamp)}</span>
                                <span className="text-white/80">{epgNext.title}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Info Section (VOD/Series) */}
            {!isMini && type !== 'live' && (
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-white mb-2 truncate drop-shadow-md">{decodeBase64(title)}</h2>
                    <div className="text-white/70 text-sm font-medium">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </div>
                </div>
            )}

            {/* Timeline */}
            <div className="relative h-1.5 bg-white/20 rounded-full mb-6 cursor-pointer group">
                <div 
                    className="absolute top-0 left-0 h-full bg-[#2196f3] rounded-full" 
                    style={{ width: `${type === 'live' ? epgProgress : (currentTime / duration) * 100}%` }} 
                />
                <div 
                    className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" 
                    style={{ left: `${type === 'live' ? epgProgress : (currentTime / duration) * 100}%`, transform: 'translate(-50%, -50%)' }} 
                />
                {type !== 'live' && (
                    <input 
                        type="range" 
                        min="0" 
                        max={duration || 100} 
                        value={currentTime} 
                        onChange={handleSeek}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                )}
            </div>

            {/* Channels/VOD/Episodes List (Layer 2) */}
            {!isMini && activeMenu === 'channels' && playlist && (
                <div className="relative group items-center mb-2 animate-in slide-in-from-bottom-4">
                    {/* Scroll Buttons */}
                    <button 
                        onClick={() => handleManualScroll('left')}
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-50 bg-black/60 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/90 -ml-4 shadow-xl border border-white/10"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    
                    <button 
                        onClick={() => handleManualScroll('right')}
                        className="absolute right-0 top-1/2 -translate-y-1/2 z-50 bg-black/60 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/90 -mr-4 shadow-xl border border-white/10"
                    >
                        <ChevronRight size={24} />
                    </button>

                    <div 
                        ref={scrollContainerRef}
                        className="flex overflow-x-auto gap-3 pb-6 custom-scrollbar scroll-smooth"
                    >
                        {type === 'live' && (
                            <div className="w-40 h-28 shrink-0 bg-[#1e2228] hover:bg-[#2a2f38] rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors border border-transparent shadow-lg">
                                <ListVideo size={36} className="text-white/80 mb-2" />
                                <span className="text-white/90 text-sm font-medium">TV guide</span>
                            </div>
                        )}
                        {playlist.map((item, index) => {
                        let isActive = false;
                        let title = '';
                        let subtitle = '';
                        let id = '';
                        let numberText = '';
                        let imageSrc = '';

                        if (type === 'live' || type === 'vod') {
                            isActive = currentItem ? item.stream_id === currentItem.stream_id : false;
                            title = decodeBase64(item.name);
                            id = `channel-${item.stream_id}`;
                            numberText = `${index + 1}`;
                            imageSrc = item.stream_icon;
                            if (type === 'live') {
                                subtitle = isActive && epgNow ? epgNow.title : "Programme en cours";
                            }
                        } else if (type === 'series') {
                            isActive = url.includes(`/${item.id}.`);
                            title = item.title ? decodeBase64(item.title) : `Épisode ${item.episode_num}`;
                            id = `episode-${item.id}`;
                            numberText = `E${item.episode_num}`;
                            imageSrc = item.info?.movie_image || currentItem?.cover;
                        }

                        const finalImageSrc = imageSrc ? createProxyUrl(imageSrc) : '';

                        return (
                            <div 
                                key={id}
                                id={id}
                                onClick={() => onChannelSelect && onChannelSelect(item)}
                                className={`w-48 h-28 shrink-0 rounded-lg flex flex-col cursor-pointer transition-all border shadow-lg overflow-hidden relative group ${isActive ? 'border-[#2196f3] ring-2 ring-[#2196f3]' : 'border-transparent hover:border-white/20'}`}
                            >
                                {finalImageSrc ? (
                                    <>
                                        <div className="absolute inset-0 bg-[#1e2228]" />
                                        <img 
                                            src={finalImageSrc} 
                                            alt={title} 
                                            referrerPolicy="no-referrer"
                                            className={`absolute inset-0 w-full h-full ${type === 'live' ? 'object-contain p-4 opacity-40' : 'object-cover opacity-60'} group-hover:opacity-80 transition-opacity`} 
                                            loading="lazy" 
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />
                                        <div className="relative z-10 flex flex-col h-full p-3 justify-end pointer-events-none">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-white/90 text-[10px] font-bold bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm">{numberText}</span>
                                            </div>
                                            <span className="text-white text-xs font-bold line-clamp-1 leading-tight drop-shadow-md mb-0.5">{title}</span>
                                            {subtitle && (
                                                <div className="text-fluent-accent text-[10px] font-medium line-clamp-1 group-hover:text-white transition-colors">
                                                    {subtitle}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className={`w-full h-full flex flex-col p-3 ${isActive ? 'bg-[#1565c0]' : 'bg-[#1e2228] group-hover:bg-[#2a2f38]'}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-white/60 text-xs font-bold">{numberText}</span>
                                            <span className="text-white text-sm font-bold truncate flex-1">{title}</span>
                                        </div>
                                        {subtitle && (
                                            <div className="text-white/70 text-xs line-clamp-2 mt-auto leading-tight">
                                                {subtitle}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                    </div>
                </div>
            )}

            {/* Base Controls (Layer 1) */}
            <div className="grid grid-cols-3 items-start">
                {/* Left Controls */}
                <div className="flex items-center justify-start gap-6 mt-2">
                    <button onClick={() => setActiveMenu(activeMenu === 'channels' ? 'none' : 'channels')} className={`flex flex-col items-center gap-1.5 transition-colors ${activeMenu === 'channels' ? 'text-[#2196f3]' : 'text-white/70 hover:text-white'}`}>
                        {type === 'live' ? <ListVideo size={24} /> : type === 'vod' ? <Film size={24} /> : <Tv size={24} />}
                        <span className="text-[10px] font-medium">
                            {type === 'live' ? 'Liste des Chaînes' : type === 'vod' ? 'Liste des Films' : 'Épisodes'}
                        </span>
                    </button>
                </div>

                {/* Center Controls (Play/Pause & Advanced Toggle) */}
                <div className="flex flex-col items-center justify-center">
                    <div className="flex items-center gap-6">
                        {type !== 'live' ? (
                            <>
                                <button onClick={() => skip(-10)} className="text-white/70 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors relative group" title="Reculer de 10s">
                                    <RotateCcw size={24} />
                                    <span className="absolute text-[8px] font-bold top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-[1px]">10</span>
                                </button>
                                <button onClick={togglePlay} className="text-white hover:text-[#2196f3] p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                                    {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" />}
                                </button>
                                <button onClick={() => skip(10)} className="text-white/70 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors relative group" title="Avancer de 10s">
                                    <RotateCw size={24} />
                                    <span className="absolute text-[8px] font-bold top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-[1px]">10</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => changeChannel('prev')} className="text-white/70 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors" title="Chaîne précédente">
                                    <SkipBack size={24} />
                                </button>
                                <button onClick={togglePlay} className="text-white hover:text-[#2196f3] p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                                    {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" />}
                                </button>
                                <button onClick={() => changeChannel('next')} className="text-white/70 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors" title="Chaîne suivante">
                                    <SkipForward size={24} />
                                </button>
                            </>
                        )}
                    </div>
                    <button onClick={() => setShowAdvancedControls(!showAdvancedControls)} className={`mt-2 text-white/50 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10`}>
                        <ChevronDown size={20} className={`transition-transform duration-300 ${showAdvancedControls ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {/* Right Controls (Volume & Stop) */}
                <div className="flex items-center justify-end gap-6 mt-2">
                    <button onClick={handleStop} className="flex flex-col items-center gap-1.5 transition-colors text-white/70 hover:text-white" title="Arrêter">
                        <Square size={20} fill="currentColor" />
                        <span className="text-[10px] font-medium">Arrêter</span>
                    </button>
                    <div className="flex items-center gap-2 group">
                        <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
                            {isMuted || volume === 0 ? <VolumeX size={24} /> : <Volume2 size={24} />}
                        </button>
                        <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.05" 
                            value={isMuted ? 0 : volume} 
                            onChange={handleVolumeChange}
                            className="w-0 group-hover:w-20 transition-all duration-300 opacity-0 group-hover:opacity-100 cursor-pointer accent-[#2196f3]"
                        />
                    </div>
                </div>
            </div>

            {/* Advanced Controls (Layer 2) */}
            {showAdvancedControls && (
                <div className="flex items-center justify-center gap-8 mt-6 pt-6 border-t border-white/5 animate-in slide-in-from-top-2">
                    <button className="flex flex-col items-center gap-1.5 transition-colors text-white/70 hover:text-white">
                        <Search size={24} />
                        <span className="text-[10px] font-medium">Rechercher</span>
                    </button>
                    <button className="flex flex-col items-center gap-1.5 transition-colors text-white/70 hover:text-white">
                        <MonitorPlay size={24} />
                        <span className="text-[10px] font-medium">Multi-Vue</span>
                    </button>
                    <button className="flex flex-col items-center gap-1.5 transition-colors text-white/70 hover:text-white">
                        <PictureInPicture size={24} />
                        <span className="text-[10px] font-medium">PiP</span>
                    </button>
                    
                    <button 
                        onClick={async () => {
                            try {
                                await navigator.clipboard.writeText(url);
                                const span = document.getElementById('copy-url-text');
                                if (span) {
                                    span.innerText = "Copié !";
                                    setTimeout(() => { span.innerText = "Copier URL" }, 2000);
                                }
                            } catch (e) {
                                console.error("Failed to copy URL", e);
                            }
                        }} 
                        className="flex flex-col items-center gap-1.5 transition-colors text-white/70 hover:text-white"
                        title="Copier le lien source du flux"
                    >
                        <Link size={24} />
                        <span id="copy-url-text" className="text-[10px] font-medium">Copier URL</span>
                    </button>
                    
                    <div className="relative flex flex-col items-center">
                        <button onClick={() => setActiveMenu(activeMenu === 'audio' ? 'none' : 'audio')} className={`flex flex-col items-center gap-1.5 transition-colors ${activeMenu === 'audio' ? 'text-[#2196f3]' : 'text-white/70 hover:text-white'}`}>
                            <AudioLines size={24} />
                            <span className="text-[10px] font-medium">{audioTracks.length > 0 && currentAudioTrack !== -1 ? audioTracks.find(t => t.id === currentAudioTrack)?.lang || 'Audio' : 'Audio'}</span>
                        </button>
                        {activeMenu === 'audio' && (
                            <div className="absolute bottom-full right-0 mb-4 w-48 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl p-4 z-50 animate-in slide-in-from-bottom-2">
                                <h4 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3">Pistes Audio</h4>
                                <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                                    {audioTracks.length === 0 ? (
                                        <div className="text-sm text-white/50 px-3 py-2">Aucune piste détectée</div>
                                    ) : audioTracks.map((track) => {
                                        const isSelected = currentAudioTrack === track.id || (currentAudioTrack === -1 && track.id === 0);
                                        return (
                                            <button
                                                key={track.id}
                                                onClick={() => {
                                                    if (hlsRef.current) {
                                                        hlsRef.current.audioTrack = track.id;
                                                    } else if (shakaRef.current) {
                                                        const tracks = shakaRef.current.getVariantTracks();
                                                        const selected = tracks.find((t: any) => t.id === track.id);
                                                        if (selected) shakaRef.current.selectVariantTrack(selected, true);
                                                    } else if (videoRef.current) {
                                                        const v = videoRef.current as any;
                                                        if (v.audioTracks) {
                                                            for(let i = 0; i < v.audioTracks.length; i++) {
                                                                v.audioTracks[i].enabled = (i === track.id);
                                                            }
                                                        }
                                                    }
                                                    setCurrentAudioTrack(track.id);
                                                    setActiveMenu('none');
                                                }}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between
                                                    ${isSelected ? 'bg-[#2196f3] text-white font-bold' : 'text-white/80 hover:bg-white/5'}`}
                                            >
                                                <span className="truncate">{track.name || track.lang || `Piste ${track.id + 1}`}</span>
                                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white shrink-0 ml-2" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="relative flex flex-col items-center">
                        <button onClick={() => setActiveMenu(activeMenu === 'subtitles' ? 'none' : 'subtitles')} className={`flex flex-col items-center gap-1.5 transition-colors ${activeMenu === 'subtitles' ? 'text-[#2196f3]' : 'text-white/70 hover:text-white'}`}>
                            <Captions size={24} />
                            <span className="text-[10px] font-medium">{currentSubtitleTrack === -1 ? 'Off' : subtitleTracks.find(t => t.id === currentSubtitleTrack)?.lang || 'CC'}</span>
                        </button>
                        {activeMenu === 'subtitles' && (
                            <div className="absolute bottom-full right-0 mb-4 w-48 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl p-4 z-50 animate-in slide-in-from-bottom-2">
                                <h4 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3">Sous-titres</h4>
                                <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                                    <button
                                        onClick={() => {
                                            if (hlsRef.current) {
                                                hlsRef.current.subtitleTrack = -1;
                                            } else if (shakaRef.current) {
                                                shakaRef.current.setTextTrackVisibility(false);
                                            } else if (videoRef.current) {
                                                const v = videoRef.current;
                                                if (v.textTracks) {
                                                    for(let i = 0; i < v.textTracks.length; i++) {
                                                        v.textTracks[i].mode = 'hidden';
                                                    }
                                                }
                                            }
                                            setCurrentSubtitleTrack(-1);
                                            setActiveMenu('none');
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between
                                            ${currentSubtitleTrack === -1 ? 'bg-[#2196f3] text-white font-bold' : 'text-white/80 hover:bg-white/5'}`}
                                    >
                                        <span>Désactivés</span>
                                        {currentSubtitleTrack === -1 && <div className="w-1.5 h-1.5 rounded-full bg-white shrink-0 ml-2" />}
                                    </button>
                                    
                                    {subtitleTracks.map((track) => {
                                        const isSelected = currentSubtitleTrack === track.id;
                                        return (
                                            <button
                                                key={track.id}
                                                onClick={() => {
                                                    if (hlsRef.current) {
                                                        hlsRef.current.subtitleTrack = track.id;
                                                    } else if (shakaRef.current) {
                                                        const tracks = shakaRef.current.getTextTracks();
                                                        const selected = tracks.find((t: any) => t.id === track.id);
                                                        if (selected) {
                                                            shakaRef.current.selectTextTrack(selected);
                                                            shakaRef.current.setTextTrackVisibility(true);
                                                        }
                                                    } else if (videoRef.current) {
                                                        const v = videoRef.current;
                                                        if (v.textTracks) {
                                                            for(let i = 0; i < v.textTracks.length; i++) {
                                                                v.textTracks[i].mode = (i === track.id) ? 'showing' : 'hidden';
                                                            }
                                                        }
                                                    }
                                                    setCurrentSubtitleTrack(track.id);
                                                    setActiveMenu('none');
                                                }}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between
                                                    ${isSelected ? 'bg-[#2196f3] text-white font-bold' : 'text-white/80 hover:bg-white/5'}`}
                                            >
                                                <span className="truncate">{track.name || track.lang || `Piste ${track.id + 1}`}</span>
                                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white shrink-0 ml-2" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="relative flex flex-col items-center">
                        <button onClick={() => setActiveMenu(activeMenu === 'settings' ? 'none' : 'settings')} className={`flex flex-col items-center gap-1.5 transition-colors ${activeMenu === 'settings' ? 'text-[#2196f3]' : 'text-white/70 hover:text-white'}`}>
                            <Settings size={24} />
                            <span className="text-[10px] font-medium">Réglages</span>
                        </button>
                        {activeMenu === 'settings' && (
                            <div className="absolute bottom-full right-0 mb-4 w-64 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl p-4 z-50 animate-in slide-in-from-bottom-2">
                                <h4 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3 text-center border-b border-white/5 pb-2">Options de lecture</h4>
                                
                                <div className="space-y-4 mt-3">
                                    <div>
                                        <p className="text-[10px] font-bold text-white/30 uppercase mb-2 ml-1">Mémoire tampon (Buffer)</p>
                                        <div className="grid grid-cols-1 gap-1">
                                            {[
                                                { id: 'small', label: 'Petite', desc: 'Latence faible, risques de coupures' },
                                                { id: 'normal', label: 'Normale', desc: 'Équilibre recommandé (30s)' },
                                                { id: 'large', label: 'Grande', desc: 'Stabilité maximale, long délai' }
                                            ].map((opt) => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => {
                                                        updatePlayerSettings({ bufferSize: opt.id as any });
                                                    }}
                                                    className={`w-full text-left px-3 py-2 rounded-lg transition-all flex flex-col
                                                        ${(playerSettings.bufferSize === opt.id || (!playerSettings.bufferSize && opt.id === 'normal')) 
                                                            ? 'bg-[#2196f3] text-white shadow-lg' 
                                                            : 'text-white/80 hover:bg-white/5'}`}
                                                >
                                                    <span className="text-sm font-bold">{opt.label}</span>
                                                    <span className={`text-[10px] ${(playerSettings.bufferSize === opt.id || (!playerSettings.bufferSize && opt.id === 'normal')) ? 'text-white/70' : 'text-white/40'}`}>
                                                        {opt.desc}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[10px] font-bold text-white/30 uppercase mb-2 ml-1">Reconnexion auto</p>
                                        <div className="grid grid-cols-2 gap-1">
                                            {[
                                                { id: 2000, label: 'Rapide (2s)' },
                                                { id: 5000, label: 'Directe (5s)' },
                                                { id: 'progressive', label: 'Progressive' }
                                            ].map((opt) => (
                                                <button
                                                    key={opt.id.toString()}
                                                    onClick={() => {
                                                        updatePlayerSettings({ reconnectDelay: opt.id as any });
                                                    }}
                                                    className={`text-center px-2 py-1.5 rounded-lg text-[10px] transition-colors h-10 flex items-center justify-center
                                                        ${playerSettings.reconnectDelay === opt.id ? 'bg-white/10 text-white font-bold border border-white/20' : 'text-white/50 hover:bg-white/5 border border-transparent'}`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <button onClick={toggleFullscreen} className="flex flex-col items-center gap-1.5 transition-colors text-white/70 hover:text-white">
                        {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
                        <span className="text-[10px] font-medium">Plein écran</span>
                    </button>
                </div>
            )}
        </div>
    </div>
  );
};
