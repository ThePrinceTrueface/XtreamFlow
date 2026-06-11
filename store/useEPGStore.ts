import { create } from 'zustand';
import { XtreamEPGProgram, XtreamAccount } from '../types';
import { cacheService } from '../services/cacheService';

interface EPGState {
  epgData: Record<string, XtreamEPGProgram[]>;
  loading: Record<string, boolean>;
  lastFetched: Record<string, number>; // timestamp in ms

  // Actions
  setEpgData: (streamId: string, listings: XtreamEPGProgram[]) => void;
  setLoading: (streamId: string, isLoading: boolean) => void;
  fetchEPGForChannel: (account: XtreamAccount, streamId: string) => Promise<XtreamEPGProgram[]>;
  fetchEPGForMultipleChannels: (account: XtreamAccount, streamIds: string[]) => Promise<void>;
  clearEPGCache: () => void;
}

export const useEPGStore = create<EPGState>((set, get) => ({
  epgData: {},
  loading: {},
  lastFetched: {},

  setEpgData: (streamId, listings) => set((state) => ({
    epgData: { ...state.epgData, [streamId]: listings },
    lastFetched: { ...state.lastFetched, [streamId]: Date.now() }
  })),

  setLoading: (streamId, isLoading) => set((state) => ({
    loading: { ...state.loading, [streamId]: isLoading }
  })),

  fetchEPGForChannel: async (account, streamId) => {
    const { epgData, loading, lastFetched, setEpgData, setLoading } = get();

    // Max cash age: 10 minutes to avoid redundant checks during active screen sessions
    const cacheAgeLimit = 10 * 60 * 1000;
    if (epgData[streamId] && lastFetched[streamId] && (Date.now() - lastFetched[streamId] < cacheAgeLimit)) {
      return epgData[streamId];
    }

    if (loading[streamId]) {
      // Wait or return existing
      return epgData[streamId] || [];
    }

    setLoading(streamId, true);

    try {
      const data = await cacheService.getEPG(account, streamId);
      let sanitizedListings: XtreamEPGProgram[] = [];

      if (Array.isArray(data)) {
        // 1. Normalize timestamps first
        const normalizedListings = data.map((p: any) => {
          let start = p.start_timestamp;
          let end = p.stop_timestamp;
          // Heuristic for seconds vs ms
          if (start < 10000000000) start *= 1000;
          if (end < 10000000000) end *= 1000;
          return { ...p, start_timestamp: start, stop_timestamp: end };
        });

        // 2. Sort by start time ASC, then duration DESC (to keep longest program in case of same start)
        normalizedListings.sort((a: any, b: any) => {
          if (a.start_timestamp !== b.start_timestamp) {
            return a.start_timestamp - b.start_timestamp;
          }
          return (b.stop_timestamp - b.start_timestamp) - (a.stop_timestamp - a.start_timestamp);
        });

        // 3. Sanitize overlaps
        let lastProgram: any = null;

        for (const prog of normalizedListings) {
          // Skip invalid duration
          if (prog.stop_timestamp <= prog.start_timestamp) continue;

          if (!lastProgram) {
            sanitizedListings.push(prog);
            lastProgram = prog;
            continue;
          }

          // Check for overlap
          if (prog.start_timestamp < lastProgram.stop_timestamp) {
            // If current program is fully contained within the last one, skip it
            if (prog.stop_timestamp <= lastProgram.stop_timestamp) {
              continue;
            }
            
            // If it's a partial overlap, cut previous one short
            lastProgram.stop_timestamp = prog.start_timestamp;
            
            // If clamping made the last program invalid, remove it
            if (lastProgram.stop_timestamp <= lastProgram.start_timestamp) {
              sanitizedListings.pop();
              lastProgram = sanitizedListings.length > 0 ? sanitizedListings[sanitizedListings.length - 1] : null;
            }
          }

          sanitizedListings.push(prog);
          lastProgram = prog;
        }
      }

      setEpgData(streamId, sanitizedListings);
      return sanitizedListings;
    } catch (e) {
      console.error(`Failed to fetch EPG for ${streamId}`, e);
      setEpgData(streamId, []);
      return [];
    } finally {
      setLoading(streamId, false);
    }
  },

  fetchEPGForMultipleChannels: async (account, streamIds) => {
    const { fetchEPGForChannel } = get();
    // Fetch in parallel for the batch
    await Promise.all(streamIds.map(id => fetchEPGForChannel(account, id)));
  },

  clearEPGCache: () => set({
    epgData: {},
    loading: {},
    lastFetched: {}
  })
}));
