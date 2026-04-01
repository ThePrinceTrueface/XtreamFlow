import { db } from '../../db';
import { XtreamAccount, XtreamCategory, XtreamStream, XtreamEPGProgram } from '../../types';
import { createProxyUrl, decodeBase64 } from '../../utils';

export class CacheService {
  private static instance: CacheService;

  private constructor() {}

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  private buildApiUrl(account: XtreamAccount, action: string, params: Record<string, string> = {}) {
    const baseUrl = `${account.protocol}://${account.host}:${account.port}/player_api.php`;
    const queryParams = new URLSearchParams({ 
      username: account.username, 
      password: account.password, 
      action, 
      ...params 
    });
    return createProxyUrl(`${baseUrl}?${queryParams.toString()}`);
  }

  async getCategories(account: XtreamAccount, type: 'live' | 'vod' | 'series', forceRefresh = false): Promise<XtreamCategory[]> {
    if (!forceRefresh) {
      const cached = await db.categories
        .where('[accountId+type]')
        .equals([account.id, type])
        .toArray();
      
      if (cached.length > 0) {
        return cached;
      }
    }

    const action = type === 'live' ? 'get_live_categories' : type === 'vod' ? 'get_vod_categories' : 'get_series_categories';
    const url = this.buildApiUrl(account, action);
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch categories: ${response.statusText}`);
      const data = await response.json();

      if (Array.isArray(data)) {
        // Clear old categories for this type
        await db.categories
          .where('[accountId+type]')
          .equals([account.id, type])
          .delete();

        const toCache = data.map(cat => ({
          ...cat,
          accountId: account.id,
          type
        }));
        
        await db.categories.bulkAdd(toCache);
        return toCache;
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      // Fallback to cache if fetch fails even on forceRefresh
      const cached = await db.categories
        .where('[accountId+type]')
        .equals([account.id, type])
        .toArray();
      if (cached.length > 0) return cached;
      throw error;
    }

    return [];
  }

  async getStreams(account: XtreamAccount, type: 'live' | 'vod' | 'series', categoryId?: string, forceRefresh = false): Promise<XtreamStream[]> {
    if (!forceRefresh) {
      let query;
      if (categoryId) {
        query = db.streams.where('[accountId+type+category_id]').equals([account.id, type, categoryId]);
      } else {
        query = db.streams.where('[accountId+type]').equals([account.id, type]);
      }
      
      const cached = await query.toArray();
      if (cached.length > 0) {
        return cached;
      }
    }

    const action = type === 'live' ? 'get_live_streams' : type === 'vod' ? 'get_vod_streams' : 'get_series';
    const params: Record<string, string> = {};
    if (categoryId) params.category_id = categoryId;
    
    const url = this.buildApiUrl(account, action, params);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch streams: ${response.statusText}`);
      const data = await response.json();

      if (Array.isArray(data)) {
        // If we fetched a specific category, only clear that category
        if (categoryId) {
          await db.streams
            .where('[accountId+type+category_id]')
            .equals([account.id, type, categoryId])
            .delete();
        } else {
          // If we fetched all, clear all for this type
          await db.streams
            .where('[accountId+type]')
            .equals([account.id, type])
            .delete();
        }

        const toCache = data.map(stream => ({
          ...stream,
          accountId: account.id,
          type: type === 'live' ? 'live' : type === 'vod' ? 'movie' : 'series'
        }));
        
        await db.streams.bulkAdd(toCache);
        return toCache;
      }
    } catch (error) {
      console.error('Error fetching streams:', error);
      // Fallback to cache if fetch fails
      let query;
      if (categoryId) {
        query = db.streams.where('[accountId+type+category_id]').equals([account.id, type, categoryId]);
      } else {
        query = db.streams.where('[accountId+type]').equals([account.id, type]);
      }
      const cached = await query.toArray();
      if (cached.length > 0) return cached;
      throw error;
    }

    return [];
  }

  async getEPG(account: XtreamAccount, streamId: string, forceRefresh = false): Promise<XtreamEPGProgram[]> {
    if (!forceRefresh) {
      const now = Date.now();
      const cached = await db.epg
        .where('[accountId+channel_id]')
        .equals([account.id, streamId])
        .filter(p => p.stop_timestamp > now)
        .toArray();
      
      if (cached.length > 0) {
        return cached.sort((a, b) => a.start_timestamp - b.start_timestamp);
      }
    }

    const url = this.buildApiUrl(account, 'get_short_epg', { stream_id: streamId, limit: '10' });
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch EPG: ${response.statusText}`);
      const data = await response.json();

      if (data && data.epg_listings && Array.isArray(data.epg_listings)) {
        const decodedListings = data.epg_listings.map((p: any) => {
          let start = p.start_timestamp;
          let end = p.stop_timestamp;
          if (start < 10000000000) start *= 1000;
          if (end < 10000000000) end *= 1000;

          return {
            ...p,
            accountId: account.id,
            channel_id: streamId,
            title: decodeBase64(p.title),
            description: decodeBase64(p.description),
            start_timestamp: start,
            stop_timestamp: end
          };
        });

        // Clear old EPG for this channel
        await db.epg
          .where('[accountId+channel_id]')
          .equals([account.id, streamId])
          .delete();

        await db.epg.bulkAdd(decodedListings);
        return decodedListings.sort((a: any, b: any) => a.start_timestamp - b.start_timestamp);
      }
    } catch (error) {
      console.error('Error fetching EPG:', error);
      // Fallback to cache if fetch fails
      const now = Date.now();
      const cached = await db.epg
        .where('[accountId+channel_id]')
        .equals([account.id, streamId])
        .filter(p => p.stop_timestamp > now)
        .toArray();
      if (cached.length > 0) return cached.sort((a, b) => a.start_timestamp - b.start_timestamp);
      // Don't throw for EPG, just return empty to not break the UI
      return [];
    }

    return [];
  }

  async getStreamInfo(account: XtreamAccount, type: 'vod' | 'series', id: string | number): Promise<any> {
    const action = type === 'vod' ? 'get_vod_info' : 'get_series_info';
    const paramKey = type === 'vod' ? 'vod_id' : 'series_id';
    const url = this.buildApiUrl(account, action, { [paramKey]: id.toString() });
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch stream info: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching stream info:', error);
      throw error;
    }
  }

  async prefetchCatalogue(account: XtreamAccount, onProgress?: (step: string, percent: number) => void) {
    try {
      const steps = ['live', 'vod', 'series'];
      for (let i = 0; i < steps.length; i++) {
        const type = steps[i] as 'live' | 'vod' | 'series';
        if (onProgress) onProgress(`Caching ${type} categories...`, (i * 33) + 5);
        await this.getCategories(account, type, true);
        
        if (onProgress) onProgress(`Caching ${type} streams...`, (i * 33) + 20);
        await this.getStreams(account, type, undefined, true);
      }
      if (onProgress) onProgress('Catalogue cached successfully', 100);
    } catch (error) {
      console.error('Error prefetching catalogue:', error);
      if (onProgress) onProgress('Error caching catalogue', 100);
      throw error;
    }
  }
}

export const cacheService = CacheService.getInstance();
