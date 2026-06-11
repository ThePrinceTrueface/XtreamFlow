import { create } from 'zustand';

interface LivePlayerState {
  // Dimensions & Resize Logic
  epgPlayerHeight: number;
  epgExpandedHeight: number;
  isResizingEpgPlayer: boolean;

  // Media Playback Controls
  volume: number; // 0 to 100
  isMuted: boolean;
  playbackSpeed: number;
  isPiPActive: boolean;
  isBuffering: boolean;
  quality: string; // 'auto', '1080p', '720p', etc.

  // Multi-Audio & Subtitles Tracks
  audioTracks: string[];
  activeAudioTrack: string | null;
  subtitleTracks: string[];
  activeSubtitleTrack: string | null;

  // Setters & Actions
  setEpgPlayerHeight: (height: number) => void;
  setEpgExpandedHeight: (height: number) => void;
  setIsResizingEpgPlayer: (isResizing: boolean) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (isMuted: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  setIsPiPActive: (isActive: boolean) => void;
  setIsBuffering: (isBuffering: boolean) => void;
  setQuality: (quality: string) => void;
  setAudioTracks: (tracks: string[]) => void;
  setActiveAudioTrack: (track: string | null) => void;
  setSubtitleTracks: (tracks: string[]) => void;
  setActiveSubtitleTrack: (track: string | null) => void;
  resetLivePlayer: () => void;
}

export const useLivePlayerStore = create<LivePlayerState>((set) => ({
  epgPlayerHeight: 220,
  epgExpandedHeight: 400,
  isResizingEpgPlayer: false,
  volume: 80,
  isMuted: false,
  playbackSpeed: 1,
  isPiPActive: false,
  isBuffering: false,
  quality: 'auto',
  audioTracks: [],
  activeAudioTrack: null,
  subtitleTracks: [],
  activeSubtitleTrack: null,

  setEpgPlayerHeight: (epgPlayerHeight) => set({ epgPlayerHeight }),
  setEpgExpandedHeight: (epgExpandedHeight) => set({ epgExpandedHeight }),
  setIsResizingEpgPlayer: (isResizingEpgPlayer) => set({ isResizingEpgPlayer }),
  setVolume: (volume) => set({ volume }),
  setIsMuted: (isMuted) => set({ isMuted }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setIsPiPActive: (isPiPActive) => set({ isPiPActive }),
  setIsBuffering: (isBuffering) => set({ isBuffering }),
  setQuality: (quality) => set({ quality }),
  setAudioTracks: (audioTracks) => set({ audioTracks }),
  setActiveAudioTrack: (activeAudioTrack) => set({ activeAudioTrack }),
  setSubtitleTracks: (subtitleTracks) => set({ subtitleTracks }),
  setActiveSubtitleTrack: (activeSubtitleTrack) => set({ activeSubtitleTrack }),
  resetLivePlayer: () => set({
    epgPlayerHeight: 220,
    epgExpandedHeight: 400,
    isResizingEpgPlayer: false,
    volume: 80,
    isMuted: false,
    playbackSpeed: 1,
    isPiPActive: false,
    isBuffering: false,
    quality: 'auto',
    audioTracks: [],
    activeAudioTrack: null,
    subtitleTracks: [],
    activeSubtitleTrack: null,
  }),
}));
