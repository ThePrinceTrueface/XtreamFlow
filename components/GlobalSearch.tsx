import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Tv, Film, Clapperboard, Calendar, Play } from 'lucide-react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'motion/react';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResult: (result: any) => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose, onSelectResult }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'live' | 'epg' | 'movie' | 'series'>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setFilter('all');
    }
  }, [isOpen]);

  const results = useLiveQuery(async () => {
    if (query.length < 2) return { streams: [], epg: [], accountsMap: {} };
    
    const q = query.toLowerCase();
    
    // Search streams (Live, VOD, Series)
    let streams = await db.streams
      .filter(stream => 
        (stream.name || '').toLowerCase().includes(q) ||
        (stream.plot || '').toLowerCase().includes(q) ||
        (stream.cast || '').toLowerCase().includes(q) ||
        (stream.director || '').toLowerCase().includes(q) ||
        (stream.genre || '').toLowerCase().includes(q)
      )
      .limit(50)
      .toArray();

    if (filter !== 'all') {
      if (filter === 'live') streams = streams.filter(s => s.type === 'live');
      else if (filter === 'movie') streams = streams.filter(s => s.type === 'movie');
      else if (filter === 'series') streams = streams.filter(s => s.type === 'series');
    }
      
    // Search EPG
    let epg = await db.epg
      .filter(prog => 
        (prog.title || '').toLowerCase().includes(q) || 
        (prog.description || '').toLowerCase().includes(q)
      )
      .limit(50)
      .toArray();

    if (filter !== 'all' && filter !== 'epg') {
        epg = [];
    }
    if (filter === 'live' || filter === 'movie' || filter === 'series') {
        epg = [];
    }

    // Fetch account names
    const accountIds = new Set([...streams.map(s => s.accountId), ...epg.map(e => e.accountId)]);
    const accounts = await db.accounts.where('id').anyOf([...accountIds]).toArray();
    const accountsMap = accounts.reduce((acc, curr) => {
      acc[curr.id] = curr.name;
      return acc;
    }, {} as Record<string, string>);
      
    return { streams, epg, accountsMap };
  }, [query, filter], { streams: [], epg: [], accountsMap: {} });

  const filters: { label: string, value: typeof filter }[] = [
    { label: 'Tous', value: 'all' },
    { label: 'Chaînes', value: 'live' },
    { label: 'EPG', value: 'epg' },
    { label: 'Films', value: 'movie' },
    { label: 'Séries', value: 'series' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] bg-black/60 backdrop-blur-sm p-4">
          <div className="absolute inset-0" onClick={onClose} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="relative w-full max-w-2xl bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="flex items-center px-4 py-3 border-b border-white/10 bg-white/5">
              <Search className="text-fluent-subtext mr-3" size={20} />
              <input
                ref={inputRef}
                type="text"
                className="flex-1 bg-transparent border-none outline-none text-white text-lg placeholder-fluent-subtext"
                placeholder="Rechercher des chaînes, films, séries, programmes EPG..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') onClose();
                }}
              />
              {query && (
                <button onClick={() => setQuery('')} className="p-1 hover:bg-white/10 rounded-md text-fluent-subtext">
                  <X size={18} />
                </button>
              )}
            </div>
            
            {/* Filtres */}
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border-b border-white/10 overflow-x-auto">
              {filters.map(f => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    filter === f.value ? 'bg-fluent-accent text-white' : 'bg-white/5 text-fluent-subtext hover:bg-white/10'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {query.length < 2 ? (
                <div className="py-12 text-center text-fluent-subtext">
                  Tapez au moins 2 caractères pour rechercher
                </div>
              ) : results.streams.length === 0 && results.epg.length === 0 ? (
                <div className="py-12 text-center text-fluent-subtext">
                  Aucun résultat trouvé pour "{query}"
                </div>
              ) : (
                <div className="space-y-4 p-2">
                  {results.streams.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-fluent-subtext uppercase tracking-wider mb-2 px-2">Contenu</h3>
                      <div className="space-y-1">
                        {results.streams.map(stream => (
                          <button
                            key={stream.id}
                            onClick={() => onSelectResult({ type: 'stream', data: stream })}
                            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors text-left group"
                          >
                            <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center shrink-0 overflow-hidden">
                              {stream.stream_icon ? (
                                <img src={stream.stream_icon} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                stream.type === 'live' ? <Tv size={20} className="text-fluent-subtext" /> :
                                stream.type === 'movie' ? <Film size={20} className="text-fluent-subtext" /> :
                                <Clapperboard size={20} className="text-fluent-subtext" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-white truncate">{stream.name}</div>
                              <div className="text-xs text-fluent-subtext capitalize flex items-center gap-2">
                                <span>{stream.type === 'movie' ? 'Film' : stream.type === 'live' ? 'En direct' : 'Série'}</span>
                                {results.accountsMap[stream.accountId] && (
                                  <>
                                    <span className="w-1 h-1 rounded-full bg-white/20" />
                                    <span className="text-fluent-accent/80">{results.accountsMap[stream.accountId]}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <Play size={16} className="text-fluent-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {results.epg.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-fluent-subtext uppercase tracking-wider mb-2 px-2 mt-4">Guide TV (EPG)</h3>
                      <div className="space-y-1">
                        {results.epg.map(prog => (
                          <button
                            key={prog.id}
                            onClick={() => onSelectResult({ type: 'epg', data: prog })}
                            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors text-left group"
                          >
                            <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center shrink-0">
                              <Calendar size={20} className="text-fluent-subtext" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-white truncate">{prog.title}</div>
                              <div className="text-xs text-fluent-subtext truncate flex items-center gap-2">
                                <span className="truncate">{prog.description || 'Aucune description'}</span>
                                {results.accountsMap[prog.accountId] && (
                                  <>
                                    <span className="w-1 h-1 rounded-full bg-white/20 shrink-0" />
                                    <span className="text-fluent-accent/80 shrink-0">{results.accountsMap[prog.accountId]}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
