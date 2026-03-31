import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Play, Loader2 } from 'lucide-react';
import { XtreamStream, XtreamEPGProgram, XtreamAccount } from '../../../types';
import { createProxyUrl, decodeBase64 } from '../../../utils';
import { cacheService } from '../../../src/services/cacheService';

// Forward ref to support scrollTo
const List = React.forwardRef((props: any, ref: any) => {
    const listRef = useRef<HTMLDivElement>(null);
    
    React.useImperativeHandle(ref, () => ({
        scrollTo: (scrollTop: number) => {
            if (listRef.current) {
                listRef.current.scrollTop = scrollTop;
            }
        }
    }));

    return (
        <div
            ref={listRef}
            className={props.className}
            style={{ ...props.style, height: props.height, width: props.width, overflowY: 'auto', position: 'relative' }}
            onScroll={(e) => {
                if (props.onScroll) {
                    props.onScroll({
                        scrollLeft: e.currentTarget.scrollLeft,
                        scrollTop: e.currentTarget.scrollTop,
                    });
                }
            }}
        >
             <VirtualListContent {...props} scrollRef={listRef} />
        </div>
    );
});

const VirtualListContent = ({ height, itemCount, itemSize, children, onItemsRendered, scrollRef }: any) => {
    const [scrollTop, setScrollTop] = useState(0);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const onScroll = () => setScrollTop(el.scrollTop);
        el.addEventListener('scroll', onScroll);
        // Initial set
        setScrollTop(el.scrollTop);
        return () => el.removeEventListener('scroll', onScroll);
    }, [scrollRef]);

    const totalHeight = itemCount * itemSize;
    const startIndex = Math.floor(scrollTop / itemSize);
    const endIndex = Math.min(itemCount - 1, Math.floor((scrollTop + height) / itemSize) + 2); // +2 buffer

    const lastRenderedRef = useRef({ start: -1, end: -1 });

    useEffect(() => {
        if (onItemsRendered && (lastRenderedRef.current.start !== startIndex || lastRenderedRef.current.end !== endIndex)) {
            lastRenderedRef.current = { start: startIndex, end: endIndex };
            onItemsRendered({
                visibleStartIndex: startIndex,
                visibleStopIndex: endIndex,
            });
        }
    }, [startIndex, endIndex, onItemsRendered]);

    const items = [];
    for (let i = startIndex; i <= endIndex; i++) {
        items.push(
            <React.Fragment key={i}>
                {children({
                    index: i,
                    style: {
                        position: 'absolute',
                        top: i * itemSize,
                        left: 0,
                        width: '100%',
                        height: itemSize,
                    },
                })}
            </React.Fragment>
        );
    }

    return (
        <div style={{ height: totalHeight, width: '100%', position: 'relative' }}>
            {items}
        </div>
    );
};

type ListChildComponentProps = any;

// Simple AutoSizer replacement to avoid build issues
const AutoSizer = ({ children }: { children: (size: { width: number, height: number }) => React.ReactNode }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!ref.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
            }
        });
        resizeObserver.observe(ref.current);
        return () => resizeObserver.disconnect();
    }, []);

    return (
        <div ref={ref} className="w-full h-full overflow-hidden">
            {size.width > 0 && size.height > 0 && children(size)}
        </div>
    );
};

interface EPGViewProps {
  channels: XtreamStream[];
  account: XtreamAccount;
  onChannelClick: (channel: XtreamStream) => void;
}

const HOUR_WIDTH = 300; // Pixels per hour
const HEADER_HEIGHT = 40;
const ROW_HEIGHT = 60;
const SIDEBAR_WIDTH = 220;
const BATCH_SIZE = 10; // Fetch EPG for 10 channels at a time

export const EPGView: React.FC<EPGViewProps> = ({ channels, account, onChannelClick }) => {
  const [epgData, setEpgData] = useState<Record<string, XtreamEPGProgram[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const gridListRef = useRef<any>(null);
  const sidebarListRef = useRef<any>(null);

  // Time window: Start 2 hours ago, end 24 hours from now
  const startTime = useMemo(() => {
      const d = new Date();
      d.setHours(d.getHours() - 2, 0, 0, 0);
      return d.getTime();
  }, []);
  
  const endTime = useMemo(() => {
      const d = new Date();
      d.setHours(d.getHours() + 24, 0, 0, 0);
      return d.getTime();
  }, []);

  const totalWidth = ((endTime - startTime) / 3600000) * HOUR_WIDTH;

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Initial Scroll to "Now"
  useEffect(() => {
    if (headerScrollRef.current) {
      const nowOffset = ((Date.now() - startTime) / 3600000) * HOUR_WIDTH;
      headerScrollRef.current.scrollLeft = nowOffset - (window.innerWidth / 2) + SIDEBAR_WIDTH;
    }
  }, [startTime]);

  const epgDataRef = useRef<Record<string, XtreamEPGProgram[]>>({});
  const loadingRef = useRef<Record<string, boolean>>({});

  // Batch Fetch EPG Logic
  const fetchEPGBatch = useCallback(async (channelIds: string[]) => {
      // Filter out channels already fetched or loading
      const toFetch = channelIds.filter(id => !epgDataRef.current[id] && !loadingRef.current[id]);
      if (toFetch.length === 0) return;

      // Mark as loading
      toFetch.forEach(id => loadingRef.current[id] = true);
      setLoading(prev => {
          const next = { ...prev };
          toFetch.forEach(id => next[id] = true);
          return next;
      });

      // Fetch individually (Xtream doesn't always support batch EPG well, or it's heavy)
      // Optimization: We could use Promise.all but with concurrency limit.
      // For now, simple parallel fetch for the batch.
      
      const promises = toFetch.map(async (streamId) => {
          try {
            const data = await cacheService.getEPG(account, streamId);
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
                const sanitizedListings: any[] = [];
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

                return { streamId, listings: sanitizedListings };
            }
          } catch (e) {
            console.error(`Failed to fetch EPG for ${streamId}`, e);
          }
          return { streamId, listings: [] };
      });

      const results = await Promise.all(promises);
      
      const newEpgData: Record<string, XtreamEPGProgram[]> = {};
      results.forEach(r => {
          // Store result regardless of length to prevent re-fetching empty EPGs
          newEpgData[r.streamId] = r.listings;
          epgDataRef.current[r.streamId] = r.listings;
          loadingRef.current[r.streamId] = false;
      });

      setEpgData(prev => ({ ...prev, ...newEpgData }));
      setLoading(prev => {
          const next = { ...prev };
          toFetch.forEach(id => next[id] = false);
          return next;
      });

  }, [account]); // Removed epgData and loading dependencies

  // Detect visible rows and trigger fetch
  const onItemsRendered = useCallback(({ visibleStartIndex, visibleStopIndex }: any) => {
      const visibleChannels = channels.slice(visibleStartIndex, visibleStopIndex + 1);
      const idsToFetch = visibleChannels
          .map(c => c.stream_id?.toString())
          .filter(Boolean) as string[];
      
      // Debounce or just call? react-window calls this often.
      // We'll rely on the internal check in fetchEPGBatch to skip duplicates.
      if (idsToFetch.length > 0) {
          fetchEPGBatch(idsToFetch);
      }
  }, [channels, fetchEPGBatch]);

  // Generate Time Headers
  const timeHeaders = useMemo(() => {
    const headers = [];
    let time = startTime;
    while (time < endTime) {
      headers.push(time);
      time += 1800000; // 30 mins
    }
    return headers;
  }, [startTime, endTime]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const nowPosition = ((currentTime - startTime) / 3600000) * HOUR_WIDTH;

  // --- RENDERERS ---

  const SidebarRow = ({ index, style }: ListChildComponentProps) => {
      const channel = channels[index];
      return (
        <div style={style} 
             onClick={() => onChannelClick(channel)}
             className="flex items-center gap-3 px-4 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors group bg-[#1e1e1e]">
            <div className="w-10 h-10 rounded bg-black/30 flex items-center justify-center overflow-hidden shrink-0">
                {channel.stream_icon ? (
                    <img src={channel.stream_icon} className="w-full h-full object-contain p-1" alt={channel.name} />
                ) : (
                    <span className="text-xs font-bold text-white/20">TV</span>
                )}
            </div>
            <div className="min-w-0">
                <div className="text-sm font-medium truncate text-white/90 group-hover:text-fluent-accent">{channel.name}</div>
            </div>
        </div>
      );
  };

  const GridRow = ({ index, style }: ListChildComponentProps) => {
      const channel = channels[index];
      const programs = epgData[channel.stream_id!] || [];
      const isLoading = loading[channel.stream_id!];

      return (
          <div style={style} className="border-b border-white/5 bg-[#151515] relative overflow-hidden">
             {/* Time Grid Lines (Background for this row) */}
             {timeHeaders.map(t => (
                 <div key={`line-${t}`} className="absolute top-0 bottom-0 border-l border-white/5 pointer-events-none"
                      style={{ left: ((t - startTime) / 3600000) * HOUR_WIDTH }} />
             ))}

             {/* Current Time Line */}
             <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/50 z-0 pointer-events-none" style={{ left: nowPosition }} />

             {/* Programs */}
             {programs.length > 0 ? programs.map((prog, pIdx) => {
                 let start = prog.start_timestamp;
                 let end = prog.stop_timestamp;
                 
                 // Heuristic for seconds vs ms
                 if (start < 10000000000) start *= 1000;
                 if (end < 10000000000) end *= 1000;

                 if (end < startTime || start > endTime) return null;

                 const left = ((start - startTime) / 3600000) * HOUR_WIDTH;
                 const width = ((end - start) / 3600000) * HOUR_WIDTH;
                 const isNow = currentTime >= start && currentTime < end;
                 const hoverTitle = `${prog.title}\n${new Date(start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - ${new Date(end).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}\n\n${prog.description || "Pas de description."}`;

                 return (
                     <div key={pIdx} 
                          onClick={() => {
                              // Pass the clicked program as the current context for the player
                              const channelWithInfo = { 
                                  ...channel, 
                                  plot: prog.description, // Use plot for description in player
                                  currentProgram: prog // Optional: pass full program object if player supports it
                              };
                              onChannelClick(channelWithInfo);
                          }}
                          className={`absolute top-1 bottom-1 rounded-md border border-white/5 px-3 py-1 overflow-hidden whitespace-nowrap flex flex-col justify-center cursor-pointer group/program
                              ${isNow ? 'bg-fluent-accent/20 border-fluent-accent/30' : 'bg-white/5 hover:bg-white/10'}
                          `}
                          style={{ left, width: Math.max(width - 2, 0) }}
                          title={hoverTitle}
                     >
                         <div className={`text-xs font-semibold truncate ${isNow ? 'text-white' : 'text-white/80'}`}>{prog.title}</div>
                         <div className="text-[10px] text-white/50 truncate">
                             {new Date(start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {new Date(end).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                         </div>
                         
                         {/* Custom Tooltip on Hover (CSS-based for better UX than native title) */}
                         <div className="hidden group-hover/program:block absolute z-50 bottom-full left-0 mb-2 w-64 bg-black/90 border border-white/10 p-3 rounded-lg shadow-xl text-wrap whitespace-normal pointer-events-none">
                            <div className="font-bold text-white mb-1">{prog.title}</div>
                            <div className="text-xs text-fluent-accent mb-2">
                                {new Date(start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {new Date(end).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                            </div>
                            <div className="text-xs text-white/70 line-clamp-6">
                                {prog.description || "Pas de description disponible."}
                            </div>
                         </div>
                     </div>
                 );
             }) : (
                 <div className="absolute inset-0 flex items-center px-4 text-white/20 text-xs italic">
                     {isLoading ? <span className="flex items-center gap-2"><Loader2 size={12} className="animate-spin"/> Chargement...</span> : "Pas d'EPG disponible"}
                 </div>
             )}
          </div>
      );
  };

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a] text-white overflow-hidden relative select-none">
      
      {/* Header (Time Scale) */}
      <div className="flex-none h-[40px] flex border-b border-white/10 bg-[#202020] z-20 relative">
        <div style={{ width: SIDEBAR_WIDTH }} className="flex-none border-r border-white/10 bg-[#202020] flex items-center justify-center font-bold text-fluent-accent shadow-lg z-30">
            Guide TV
        </div>
        <div ref={headerScrollRef} className="flex-1 overflow-hidden relative flex items-center">
            <div className="absolute top-0 bottom-0 flex" style={{ width: totalWidth }}>
                {timeHeaders.map((t, i) => (
                    <div key={t} className="absolute top-0 bottom-0 border-l border-white/5 flex items-center pl-2 text-xs text-white/50 font-mono"
                        style={{ left: ((t - startTime) / 3600000) * HOUR_WIDTH, width: HOUR_WIDTH / 2 }}>
                        {formatTime(t)}
                    </div>
                ))}
                
                {/* Current Time Line */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 shadow-[0_0_10px_rgba(239,68,68,0.8)]" style={{ left: nowPosition }}>
                    <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 rounded-full" />
                </div>
            </div>
        </div>
      </div>

      {/* Body (Virtual List) */}
      <div className="flex-1 w-full h-full">
        <AutoSizer>
          {({ height, width }) => (
            <div className="flex" style={{ height, width }}>
                {/* Sidebar List */}
                <List
                    ref={sidebarListRef}
                    height={height}
                    itemCount={channels.length}
                    itemSize={ROW_HEIGHT}
                    width={SIDEBAR_WIDTH}
                    className="no-scrollbar border-r border-white/10 z-10 bg-[#1e1e1e]"
                    style={{ overflowY: 'hidden' }} // Controlled by grid scroll
                >
                    {SidebarRow}
                </List>

                {/* Grid List */}
                <List
                    ref={gridListRef}
                    height={height}
                    itemCount={channels.length}
                    itemSize={ROW_HEIGHT}
                    width={width - SIDEBAR_WIDTH}
                    className="custom-scrollbar"
                    onItemsRendered={onItemsRendered}
                    onScroll={({ scrollLeft, scrollTop }) => {
                        if (headerScrollRef.current) headerScrollRef.current.scrollLeft = scrollLeft;
                        if (sidebarListRef.current) sidebarListRef.current.scrollTo(scrollTop);
                    }}
                >
                    {({ index, style }) => (
                        <div style={{ ...style, width: totalWidth }}>
                            <GridRow index={index} style={{ ...style, width: totalWidth, top: 0, left: 0, position: 'relative' }} />
                        </div>
                    )}
                </List>
            </div>
          )}
        </AutoSizer>
      </div>
    </div>
  );
};
