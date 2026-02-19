
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, Star, Play, Youtube, Download, Clock, Calendar, Film, User, Hash, AlignLeft, Flag, X, ChevronRight, ChevronLeft, Sparkles, LayoutGrid, Layers, Tv } from 'lucide-react';
import { Button } from '../../../components/Win11UI';
import { XtreamStream, XtreamAccount } from '../../../types';

interface ItemDetailViewProps {
  item: XtreamStream;
  detail: any;
  loading: boolean;
  type: string;
  onBack: () => void;
  onClose?: () => void;
  onPlay: (item: XtreamStream) => void;
  onPlayEpisode?: (episode: any) => void;
  account: XtreamAccount;
  siblingItems?: XtreamStream[];
  onSwitchItem?: (item: XtreamStream) => void;
}

export const ItemDetailView: React.FC<ItemDetailViewProps> = ({ item, detail, loading, type, onBack, onClose, onPlay, onPlayEpisode, account, siblingItems = [], onSwitchItem }) => {
    const [showTrailer, setShowTrailer] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const mainScrollRef = useRef<HTMLDivElement>(null);

    // Series State
    const [selectedSeason, setSelectedSeason] = useState<string>('1');

    // Reset scroll position and season when item changes
    useEffect(() => {
        if (mainScrollRef.current) {
            mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        }
        
        // Reset season selection
        if (type === 'series' && detail?.episodes) {
            const seasons = Object.keys(detail.episodes).sort((a,b) => parseInt(a) - parseInt(b));
            if (seasons.length > 0) setSelectedSeason(seasons[0]);
        }
    }, [item.stream_id, item.series_id, detail]);

    // Determine data based on available detail or fallback to item
    const backdrop = detail?.info?.backdrop_path?.[0] || item?.stream_icon || item?.cover;
    const poster = item?.stream_icon || item?.cover;
    const title = item?.name;
    const plot = detail?.info?.plot || detail?.info?.description || "Aucun synopsis disponible pour ce titre.";
    const rating = detail?.info?.rating || item?.rating;
    
    // Structured Metadata
    const director = detail?.info?.director;
    
    // Parsing Genres
    const rawGenre = detail?.info?.genre || item?.genre;
    const genres = rawGenre ? rawGenre.split(/,|;/).map((g: string) => g.trim()).filter(Boolean) : [];

    const releaseDate = detail?.info?.releasedate || detail?.info?.releaseDate || item?.releaseDate;
    const duration = detail?.info?.duration;
    const cast = detail?.info?.cast;

    // Series specific data
    const episodes = detail?.episodes || {};
    const seasons = Object.keys(episodes).sort((a, b) => parseInt(a) - parseInt(b));
    const currentEpisodes = episodes[selectedSeason] || [];

    // Trailer logic
    const trailerInput = detail?.info?.youtube_trailer;
    
    const getTrailerEmbedUrl = (input: string) => {
        if (!input) return null;
        let id = input;
        // Handle full URLs if present
        try {
            if (input.includes('youtube.com') || input.includes('youtu.be')) {
                if (input.includes('v=')) {
                    id = input.split('v=')[1].split('&')[0];
                } else if (input.includes('youtu.be/')) {
                    id = input.split('youtu.be/')[1].split('?')[0];
                }
            }
        } catch (e) {
            return null; // Fail safe
        }
        return `https://www.youtube.com/embed/${id}?autoplay=1&modestbranding=1&rel=0&showinfo=0`;
    };

    const trailerEmbedUrl = trailerInput ? getTrailerEmbedUrl(trailerInput) : null;

    // Download logic (VOD Only)
    const getDownloadUrl = () => {
        if (type !== 'vod') return null;
        // Check for extension in detail movie_data or item
        const ext = detail?.movie_data?.container_extension || (item as any).container_extension || 'mp4';
        return `${account.protocol}://${account.host}:${account.port}/movie/${account.username}/${account.password}/${item.stream_id}.${ext}`;
    };
    const downloadUrl = getDownloadUrl();

    // Helper for episode download
    const getEpisodeDownloadUrl = (episode: any) => {
        const ext = episode.container_extension || 'mp4';
        return `${account.protocol}://${account.host}:${account.port}/series/${account.username}/${account.password}/${episode.id}.${ext}`;
    };

    const handleDownload = () => {
        if (downloadUrl) {
            window.open(downloadUrl, '_blank');
        }
    };

    // --- Recommendation Logic ---
    const relatedStreams = useMemo(() => {
        if (!siblingItems || siblingItems.length === 0) return [];

        const currentId = item.stream_id || item.series_id;
        const currentNameWords = item.name.toLowerCase().split(/[\s\-_:.]+/).filter(w => w.length > 3); // Significant words
        const currentDirector = director?.toLowerCase();
        
        // Calculate Score
        const scored = siblingItems
            .filter(s => (s.stream_id || s.series_id) !== currentId) // Exclude self
            .map(s => {
                let score = 0;
                
                // Name Similarity (Word Matching)
                const sName = s.name.toLowerCase();
                currentNameWords.forEach(word => {
                    if (sName.includes(word)) score += 2;
                });

                // Genre Matching
                if (s.genre && genres.length > 0) {
                     const sGenres = s.genre.toLowerCase();
                     genres.forEach(g => {
                         if (sGenres.includes(g.toLowerCase())) score += 3;
                     });
                }

                return { stream: s, score };
            });

        // Sort descending by score
        scored.sort((a, b) => b.score - a.score);

        // Take top 18
        return scored.slice(0, 18).map(x => x.stream);
    }, [siblingItems, item, director, genres]);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const scrollAmount = 600;
            scrollContainerRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div ref={mainScrollRef} className="h-full overflow-y-auto custom-scrollbar relative">
            {/* Immersive Backdrop */}
            <div className="absolute inset-0 h-[60vh] opacity-40 pointer-events-none">
                {backdrop && <img src={backdrop} className="w-full h-full object-cover mask-image-b" alt="" />}
                <div className="absolute inset-0 bg-gradient-to-t from-[#191919] via-[#191919]/80 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#191919] via-[#191919]/40 to-transparent" />
            </div>

            <div className="relative z-10 p-8 md:p-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Navigation Controls */}
                <div className="flex items-center gap-3 mb-8">
                    <button 
                        onClick={onBack} 
                        title="Revenir à l'élément précédent"
                        className="flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm font-semibold uppercase tracking-wider bg-black/20 hover:bg-black/40 px-4 py-2 rounded-full backdrop-blur-md border border-white/5"
                    >
                        <ArrowLeft size={16} /> Retour
                    </button>
                    {onClose && (
                        <button 
                            onClick={onClose} 
                            title="Fermer et revenir au catalogue"
                            className="flex items-center gap-2 text-white/70 hover:text-fluent-accent transition-colors text-sm font-semibold uppercase tracking-wider bg-black/20 hover:bg-black/40 px-4 py-2 rounded-full backdrop-blur-md border border-white/5"
                        >
                            <LayoutGrid size={16} /> Catalogue
                        </button>
                    )}
                </div>

                <div className="flex flex-col lg:flex-row gap-12 items-start max-w-7xl mx-auto mb-12">
                    {/* Left Column: Poster & Actions */}
                    <div className="w-full lg:w-[350px] shrink-0 flex flex-col gap-6">
                        <div className="aspect-[2/3] rounded-xl overflow-hidden shadow-2xl border border-white/10 relative group bg-white/5">
                            {poster ? (
                                <img src={poster} className="w-full h-full object-cover" alt={title} />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-white/10">
                                    <Film size={64} />
                                </div>
                            )}
                        </div>
                        
                        {/* Quick Stats Grid */}
                        <div className="grid grid-cols-2 gap-3">
                             {rating && (
                                 <div className="bg-white/5 border border-white/10 rounded-lg p-3 flex flex-col items-center justify-center gap-1">
                                     <Star size={18} className="text-yellow-400 fill-current" />
                                     <span className="text-lg font-bold">{rating}</span>
                                     <span className="text-[10px] text-white/50 uppercase tracking-widest">Note</span>
                                 </div>
                             )}
                             {duration && (
                                 <div className="bg-white/5 border border-white/10 rounded-lg p-3 flex flex-col items-center justify-center gap-1">
                                     <Clock size={18} className="text-fluent-accent" />
                                     <span className="text-sm font-bold text-center">{duration}</span>
                                     <span className="text-[10px] text-white/50 uppercase tracking-widest">Durée</span>
                                 </div>
                             )}
                        </div>
                    </div>

                    {/* Right Column: Details */}
                    <div className="flex-1 min-w-0 pt-2">
                        <div className="mb-6">
                            <div className="flex flex-wrap items-center gap-3 mb-4">
                                <span className="bg-fluent-accent text-black px-3 py-1 rounded text-xs font-bold uppercase tracking-widest">{type}</span>
                                {releaseDate && (
                                    <span className="flex items-center gap-1.5 text-white/60 text-sm font-medium bg-white/5 px-3 py-1 rounded border border-white/5">
                                        <Calendar size={14} /> {releaseDate}
                                    </span>
                                )}
                                {/* Display Genres as Tags */}
                                {genres.map((g: string, i: number) => (
                                    <span key={i} className="flex items-center gap-1.5 text-white/80 text-sm font-medium bg-white/10 px-3 py-1 rounded border border-white/5 hover:bg-white/20 transition-colors cursor-default">
                                        {g}
                                    </span>
                                ))}
                            </div>
                            
                            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight drop-shadow-xl">
                                {title}
                            </h1>

                            {/* Action Bar */}
                            <div className="flex flex-wrap items-center gap-4 mb-8">
                                <Button variant="primary" onClick={() => onPlay(item)} className="!px-8 h-12 text-base font-bold active:scale-95 transition-all">
                                    <Play fill="currentColor" size={20} /> {type === 'series' ? 'Reprendre' : 'Regarder'}
                                </Button>
                                
                                {trailerEmbedUrl && (
                                    <Button variant="secondary" onClick={() => setShowTrailer(true)} className="!px-6 h-12 text-sm border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur-md">
                                        <Youtube size={20} className="text-red-500" /> Bande-annonce
                                    </Button>
                                )}
                                
                                {downloadUrl && (
                                    <Button variant="secondary" onClick={handleDownload} className="!px-6 h-12 text-sm border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur-md">
                                        <Download size={20} className="text-green-400" /> Télécharger
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Synopsis */}
                        <div className="mb-10 bg-white/5 p-6 rounded-xl border border-white/5 backdrop-blur-sm">
                            <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-3">
                                <AlignLeft size={20} className="text-fluent-accent" /> Synopsis
                            </h3>
                            <p className="text-white/80 leading-relaxed text-base font-light">
                                {plot}
                            </p>
                        </div>

                        {/* Info Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                            {director && (
                                <div className="flex gap-4 items-start p-4 rounded-lg hover:bg-white/5 transition-colors">
                                    <div className="p-3 bg-purple-500/20 rounded-lg text-purple-400">
                                        <User size={20} />
                                    </div>
                                    <div>
                                        <span className="text-xs text-white/50 font-bold uppercase tracking-wider block mb-1">Réalisateur</span>
                                        <span className="text-white font-medium">{director}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Cast List */}
                        {cast && (
                            <div>
                                <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
                                    <User size={20} className="text-fluent-accent" /> Distribution
                                </h3>
                                <div className="flex flex-wrap gap-3">
                                    {cast.split(',').map((actor: string, idx: number) => (
                                        <span key={idx} className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-md text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors cursor-default">
                                            {actor.trim()}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- SERIES EPISODES SECTION --- */}
                {type === 'series' && seasons.length > 0 && (
                    <div className="w-full max-w-7xl mx-auto border-t border-white/5 pt-10 mb-10">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="flex items-center gap-2 text-xl font-semibold text-white">
                                <Layers size={22} className="text-fluent-accent" /> Saisons & Épisodes
                            </h3>
                        </div>

                        {/* Season Selector */}
                        <div className="flex overflow-x-auto gap-2 pb-6 px-1 no-scrollbar">
                            {seasons.map((seasonKey) => (
                                <button
                                    key={seasonKey}
                                    onClick={() => setSelectedSeason(seasonKey)}
                                    className={`px-5 py-2 rounded-full text-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap
                                        ${selectedSeason === seasonKey 
                                            ? 'bg-fluent-accent text-black scale-105' 
                                            : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/5'
                                        }`}
                                >
                                    Saison {seasonKey}
                                </button>
                            ))}
                        </div>

                        {/* Episode List */}
                        <div className="space-y-3">
                            {currentEpisodes.map((ep: any) => (
                                <div 
                                    key={ep.id} 
                                    className="group flex flex-col md:flex-row gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer hover:shadow-lg hover:border-white/10 relative"
                                    onClick={() => onPlayEpisode && onPlayEpisode({ ...ep, season: selectedSeason })}
                                >
                                    {/* Thumbnail */}
                                    <div className="w-full md:w-48 shrink-0 aspect-video rounded-lg overflow-hidden relative bg-black/40">
                                        {ep.info?.movie_image ? (
                                            <img src={ep.info.movie_image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" loading="lazy"/>
                                        ) : backdrop ? (
                                            <img src={backdrop} className="w-full h-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-500" alt="" loading="lazy"/>
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-white/10"><Tv size={32} /></div>
                                        )}
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Play fill="currentColor" size={24} className="text-white drop-shadow-md" />
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="text-fluent-accent font-bold text-lg">
                                                {ep.episode_num}.
                                            </span>
                                            <h4 className="text-white font-semibold text-lg truncate group-hover:text-fluent-accent transition-colors">
                                                {ep.title}
                                            </h4>
                                        </div>
                                        
                                        <div className="flex items-center gap-3 text-xs text-white/50 mb-2 font-mono">
                                            {ep.info?.duration && (
                                                <span className="flex items-center gap-1"><Clock size={12}/> {ep.info.duration}</span>
                                            )}
                                            {ep.info?.rating && (
                                                <span className="flex items-center gap-1 text-yellow-500/80"><Star size={12} fill="currentColor"/> {ep.info.rating}</span>
                                            )}
                                            {ep.info?.releasedate && (
                                                 <span className="flex items-center gap-1"><Calendar size={12}/> {ep.info.releasedate}</span>
                                            )}
                                        </div>

                                        <p className="text-sm text-white/70 line-clamp-2 leading-relaxed">
                                            {ep.info?.plot || "Pas de description disponible."}
                                        </p>
                                    </div>

                                    {/* Actions (Desktop) */}
                                    <div className="hidden md:flex items-center gap-3 px-4 border-l border-white/5">
                                         <div className="w-10 h-10 rounded-full bg-fluent-accent text-black flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all shadow-lg" title="Lire">
                                             <Play fill="currentColor" size={18} />
                                         </div>
                                         
                                         <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                window.open(getEpisodeDownloadUrl(ep), '_blank');
                                            }}
                                            className="w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all shadow-lg border border-white/5"
                                            title="Télécharger"
                                         >
                                             <Download size={18} />
                                         </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- Related Streams Section --- */}
                {relatedStreams.length > 0 && (
                    <div className="max-w-7xl mx-auto border-t border-white/5 pt-10 mb-10">
                        <h3 className="flex items-center gap-2 text-xl font-semibold text-white mb-6">
                            <Sparkles size={22} className="text-fluent-accent" /> Titres similaires
                        </h3>
                        
                        <div className="relative group/scroll">
                            <button 
                                onClick={() => scroll('left')} 
                                className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-black/60 hover:bg-fluent-accent/80 text-white p-3 rounded-full opacity-0 group-hover/scroll:opacity-100 transition-all backdrop-blur-sm -ml-4"
                            >
                                <ChevronLeft size={24} />
                            </button>
                            
                            <div 
                                ref={scrollContainerRef} 
                                className="flex gap-5 overflow-x-auto no-scrollbar scroll-smooth pb-4"
                            >
                                {relatedStreams.map((relatedItem) => (
                                    <div 
                                        key={relatedItem.stream_id || relatedItem.series_id}
                                        onClick={() => onSwitchItem && onSwitchItem(relatedItem)}
                                        className="w-[160px] shrink-0 group cursor-pointer"
                                    >
                                        <div className="aspect-[2/3] rounded-lg overflow-hidden border border-white/5 bg-black/20 relative shadow-md group-hover:ring-2 group-hover:ring-fluent-accent/50 transition-all duration-300">
                                            {relatedItem.stream_icon || relatedItem.cover ? (
                                                <img 
                                                    src={relatedItem.stream_icon || relatedItem.cover} 
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                                                    alt={relatedItem.name}
                                                    loading="lazy" 
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-white/5"><Film size={32}/></div>
                                            )}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <Play fill="currentColor" size={32} className="text-white drop-shadow-lg"/>
                                            </div>
                                        </div>
                                        <h4 className="text-xs font-medium mt-3 truncate group-hover:text-fluent-accent transition-colors">
                                            {relatedItem.name}
                                        </h4>
                                        {relatedItem.rating && (
                                            <div className="flex items-center gap-1 text-[10px] text-yellow-500/80 mt-1">
                                                <Star size={8} fill="currentColor"/> {relatedItem.rating}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <button 
                                onClick={() => scroll('right')} 
                                className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-black/60 hover:bg-fluent-accent/80 text-white p-3 rounded-full opacity-0 group-hover/scroll:opacity-100 transition-all backdrop-blur-sm -mr-4"
                            >
                                <ChevronRight size={24} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Trailer Modal Overlay */}
            {showTrailer && trailerEmbedUrl && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300"
                    onClick={() => setShowTrailer(false)}
                >
                    <div 
                        className="relative w-full max-w-6xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 mx-4 animate-in zoom-in-95 duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={() => setShowTrailer(false)} 
                            className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-red-500 text-white rounded-full transition-all backdrop-blur-md border border-white/10 group"
                        >
                            <X size={24} className="group-hover:scale-110 transition-transform"/>
                        </button>
                        <iframe 
                            src={trailerEmbedUrl} 
                            title="Trailer"
                            className="w-full h-full border-0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowFullScreen
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
