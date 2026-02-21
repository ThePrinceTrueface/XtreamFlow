
import React from 'react';

export interface XtreamAccount {
  id: string;
  name: string;
  host: string;
  port: string;
  username: string;
  password: string;
  addedAt: number;
  status: 'active' | 'error' | 'untested';
  protocol: 'http' | 'https';
  isFavorite?: boolean;
  tags?: string[];
}

export interface SavedServer {
  id: string;
  alias: string; // Friendly name (e.g. "King IPTV Main")
  host: string;
  port: string;
  protocol: 'http' | 'https';
  tags: string[];
  description?: string;
  addedAt: number;
}

export interface AppBackup {
  version: string;
  timestamp: number;
  accounts: XtreamAccount[];
  servers: SavedServer[];
}

// --- User Preferences (Local Storage) ---

export interface StreamProgress {
  time: number;       // Current playback time in seconds
  duration: number;   // Total duration
  progress: number;   // 0.0 to 1.0
  lastWatched: number;// Unix timestamp
  finished: boolean;  // True if progress > 95%
}

export interface AccountPreferences {
  favorites: string[]; // Array of stream_id or series_id
  history: Record<string, StreamProgress>; // Key is stream_id/episode_id
}

export interface GlobalPreferences {
  [accountId: string]: AccountPreferences;
}

// --- API Response Types ---

export interface XtreamUserInfo {
  username: string;
  password: string;
  message: string;
  auth: number;
  status: string;
  exp_date: string; // Unix timestamp string
  is_trial: string;
  active_cons: string;
  created_at: string;
  max_connections: string;
  allowed_output_formats: string[];
}

export interface XtreamServerInfo {
  url: string;
  port: string;
  https_port: string;
  server_protocol: string;
  rtmp_port: string;
  timezone: string;
  timestamp_now: number;
  time_now: string;
  process: boolean;
}

export interface XtreamAuthResponse {
  user_info: XtreamUserInfo;
  server_info: XtreamServerInfo;
}

export interface XtreamCategory {
  category_id: string;
  category_name: string;
  parent_id: number;
}

// Unified interface for list items (Live Channel, VOD Movie, Series)
export interface XtreamStream {
  num: number;
  name: string;
  stream_type?: string;
  stream_id?: number; // Present in Live/VOD
  series_id?: number; // Present in Series
  stream_icon?: string; // Live/VOD
  cover?: string; // Series
  rating?: string;
  added?: string;
  category_id?: string;
  plot?: string;
  cast?: string;
  director?: string;
  releaseDate?: string;
  genre?: string;
}

// VOD Detail Types
export interface XtreamVodInfo {
  name: string;
  movie_image: string;
  description: string;
  plot: string;
  cast: string;
  director: string;
  genre: string;
  releasedate: string;
  duration: string;
  rating: string;
  youtube_trailer: string;
  backdrop_path?: string[];
}

export interface XtreamVodInfoResponse {
  info: XtreamVodInfo;
  movie_data: any;
}

// Series Detail Types
export interface XtreamEpisode {
  id: string;
  episode_num: number;
  title: string;
  container_extension: string;
  info: {
    duration: string;
    plot: string;
    rating: number;
    releasedate: string;
    movie_image: string;
  };
  season: number;
}

export interface XtreamSeriesInfoResponse {
  seasons: any[];
  info: {
    name?: string;
    cover?: string;
    plot?: string;
    cast?: string;
    director?: string;
    genre?: string;
    releaseDate?: string;
    rating?: string;
    backdrop_path?: string[];
  };
  episodes: { [key: string]: XtreamEpisode[] };
}

// --- Application Types ---

export interface SearchCriteria {
  query: string;
  onlyFavorites: boolean;
  tags: string[];
}

export type ViewState = 'dashboard' | 'add-account' | 'edit-account' | 'settings' | 'manage-accounts' | 'account-detail' | 'server-library';

export interface ValidationResult {
  isValid: boolean;
  message: string;
}

export type ModalType = 'success' | 'error' | 'warning' | 'confirm' | 'info';

export interface ModalConfig {
  isOpen: boolean;
  type: ModalType;
  title: string;
  message: React.ReactNode;
  onConfirm?: () => void;
  onCancel?: () => void; // Used for closing
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface XtreamEPGProgram {
  id: string;
  epg_id: string;
  title: string;
  lang: string;
  start: string; 
  end: string;
  description: string;
  channel_id: string;
  start_timestamp: number;
  stop_timestamp: number;
  now_playing?: number;
  has_archive?: number;
}

export interface XtreamEPGResponse {
  epg_listings: XtreamEPGProgram[];
}
