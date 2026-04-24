import Dexie, { Table } from 'dexie';
import { XtreamAccount, XtreamStream, XtreamCategory, XtreamEPGProgram, StreamProgress, SavedServer, DownloadItem } from './types';

export interface CachedStream extends XtreamStream {
  accountId: string;
  type: 'live' | 'movie' | 'series';
}

export interface CachedCategory extends XtreamCategory {
  accountId: string;
  type: 'live' | 'movie' | 'series';
}

export interface CachedEPG extends XtreamEPGProgram {
  accountId: string;
}

export interface CachedHistory extends StreamProgress {
  dbId: string; // composite key: accountId + stream_id/series_id
  accountId: string;
  streamId?: number;
  seriesId?: number;
}

export class AppDatabase extends Dexie {
  accounts!: Table<XtreamAccount>;
  servers!: Table<SavedServer>;
  streams!: Table<CachedStream>;
  categories!: Table<CachedCategory>;
  epg!: Table<CachedEPG>;
  history!: Table<CachedHistory>;
  downloads!: Table<DownloadItem>;
  streamDetails!: Table<any>;

  constructor() {
    super('XtreamFlowDB');
    this.version(3).stores({
      accounts: 'id, name, addedAt',
      servers: 'id, alias, host',
      streams: '++id, accountId, type, category_id, stream_id, series_id, [accountId+type], [accountId+type+category_id]',
      categories: '++id, accountId, type, category_id, [accountId+type]',
      epg: '++id, accountId, channel_id, start_timestamp, stop_timestamp, [accountId+channel_id]',
      history: 'dbId, accountId, lastWatched',
      downloads: 'id, accountId, status, addedAt',
      streamDetails: 'dbId, accountId, type, streamId'
    });
  }

  // Helper to clear account cache (metadata)
  async clearAccountCache(accountId: string) {
    await Promise.all([
      this.streams.where('accountId').equals(accountId).delete(),
      this.categories.where('accountId').equals(accountId).delete(),
      this.epg.where('accountId').equals(accountId).delete(),
      this.streamDetails.where('accountId').equals(accountId).delete()
    ]);
  }

  // Helper to delete ALL account data including history and downloads
  async deleteAccountData(accountId: string) {
    await Promise.all([
      this.clearAccountCache(accountId),
      this.history.where('accountId').equals(accountId).delete(),
      this.downloads.where('accountId').equals(accountId).delete()
    ]);
  }
}

export const db = new AppDatabase();
