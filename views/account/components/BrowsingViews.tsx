
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Play, Film, Star, Sparkles, ChevronRight, ChevronLeft, Image as ImageIcon, PlusCircle, CheckCircle2 } from 'lucide-react';
import { XtreamStream } from '../../../types';
import { Button } from '../../../components/Win11UI';
import { useUserPreferences } from '../../../hooks/useUserPreferences';
import { decodeBase64 } from '../../../utils';

interface ItemGridProps {
  items: XtreamStream[];
  type: 'live' | 'vod' | 'series';
  onItemClick: (item: XtreamStream) => void;
  accountId?: string;
}

export const ItemGrid: React.FC<ItemGridProps> = ({ items, type, onItemClick, accountId = 'guest' }) => {
  const [displayLimit, setDisplayLimit] = useState(60);
  const { getProgress, isFavorite } = useUserPreferences(accountId);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDisplayLimit(60);
  }, [items]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setDisplayLimit(prev => Math.min(prev + 60, items.length));
        }
      },
      { rootMargin: '400px' } 
    );
    
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    
    return () => observer.disconnect();
  }, [items.length]);

  const visibleItems = items.slice(0, displayLimit);
  const hasMore = items.length > displayLimit;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
          <Star size={32} className="text-white/20" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Aucun élément trouvé</h3>
        <p className="text-fluent-subtext max-w-xs mx-auto">
          {type === 'live' ? 'Aucune chaîne' : type === 'vod' ? 'Aucun film' : 'Aucune série'} ne correspond à votre sélection ou n'a été ajouté à vos favoris.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {visibleItems.map((item) => {
          const id = item.stream_id || item.series_id || item.num;
          const progress = getProgress(id);
          const fav = isFavorite(id, type);
          
          return (
            <motion.div 
              key={id} 
              onClick={() => onItemClick(item)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -5 }}
              whileTap={{ scale: 0.98 }}
              className="group bg-fluent-layer hover:bg-fluent-layerHover border border-fluent-border rounded-window overflow-hidden cursor-pointer transition-all duration-200 relative shadow-sm hover:shadow-md">
              
              {/* Image Container */}
              <div className={`${type === 'live' ? 'aspect-square' : 'aspect-[2/3]'} w-full bg-black/40 relative flex items-center justify-center overflow-hidden`}>
                {item.stream_icon || item.cover ? (
                  <motion.img 
                    src={item.stream_icon || item.cover} 
                    className="w-full h-full object-contain p-2 transition-transform duration-500 group-hover:scale-105" 
                    loading="lazy" 
                    alt={item.name}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/10">
                    <ImageIcon size={32} />
                  </div>
                )}
                
                {/* Status Badges (Top Right) */}
                <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
                    {fav && <div className="bg-yellow-500 text-black p-1 rounded-full shadow-md"><Star size={10} fill="currentColor"/></div>}
                    {progress?.finished && <div className="bg-green-500 text-black p-1 rounded-full shadow-md"><CheckCircle2 size={10} /></div>}
                </div>

                {/* Simple Play Overlay on Hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-all duration-200">
                  <Play size={32} fill="currentColor" className="text-white drop-shadow-lg" />
                </div>

                {/* Progress Bar (Bottom) */}
                {progress && !progress.finished && progress.progress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                        <div className="h-full bg-fluent-accent" style={{ width: `${progress.progress * 100}%` }} />
                    </div>
                )}
              </div>

              <div className="p-3 border-t border-white/5">
                <motion.h4 
                  className="text-[13px] font-medium truncate mb-1 text-white group-hover:text-fluent-accent transition-colors" 
                  title={decodeBase64(item.name)}
                >
                    {decodeBase64(item.name)}
                </motion.h4>
                {item.rating && (
                    <div className="flex items-center gap-1 text-[11px] text-white/50">
                        <Star size={10} className="text-yellow-500/70 fill-current"/> 
                        <span>{item.rating}</span>
                    </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      
      {hasMore && (
        <div ref={observerTarget} className="flex justify-center pt-6 h-10 w-full">
           <div className="flex items-center gap-2 text-white/50 animate-pulse text-sm">
              <PlusCircle size={16} className="animate-spin" /> 
              Chargement...
           </div>
        </div>
      )}
    </div>
  );
};

interface HorizontalRowProps {
  categoryId: string;
  name: string;
  items: XtreamStream[];
  type?: 'live' | 'vod' | 'series';
  onItemClick: (item: XtreamStream) => void;
  onExplore: (categoryId: string) => void;
}

export const HorizontalRow: React.FC<HorizontalRowProps> = ({ categoryId, name, items, type, onItemClick, onExplore }) => {
  const rowRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const scrollAmount = 500;
      rowRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="mb-8 last:mb-0 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Sparkles size={16} className="text-fluent-accent" /> {name}
        </h3>
        <button 
            onClick={() => onExplore(categoryId)} 
            className="flex items-center gap-1 text-[11px] text-fluent-accent hover:text-white transition-all font-bold uppercase tracking-widest bg-fluent-accent/5 px-3 py-1 rounded-full border border-fluent-accent/10 hover:bg-fluent-accent/10 whitespace-nowrap"
        >
            Explorer <ChevronRight size={14} />
        </button>
      </div>
      
      <div className="relative group/row">
          <button 
            onClick={() => scroll('left')} 
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-black/60 hover:bg-fluent-accent/80 text-white p-2 rounded-full opacity-0 group-hover/row:opacity-100 transition-all backdrop-blur-sm -ml-2 shadow-lg border border-white/10"
          >
            <ChevronLeft size={20} />
          </button>

          <div 
            ref={rowRef}
            className="flex overflow-x-auto gap-4 px-2 pb-4 no-scrollbar custom-scrollbar scroll-smooth"
          >
            {items.map(item => {
              const id = item.stream_id || item.series_id;
              return (
                <motion.div 
                  key={id} 
                  onClick={() => onItemClick(item)}
                  layoutId={`item-container-${id}`}
                  whileHover={{ y: -5 }}
                  whileTap={{ scale: 0.95 }}
                  className="shrink-0 w-[150px] group bg-fluent-layer hover:bg-fluent-layerHover border border-fluent-border rounded-window overflow-hidden cursor-pointer transition-all duration-200 relative shadow-sm hover:shadow-md">
                  
                  <div className={`${type === 'live' ? 'aspect-square' : 'aspect-[2/3]'} w-full bg-black/40 relative flex items-center justify-center overflow-hidden`}>
                    {item.stream_icon || item.cover ? (
                      <motion.img 
                        layoutId={`poster-${id}`}
                        src={item.stream_icon || item.cover} 
                        className={`w-full h-full ${type === 'live' ? 'object-contain p-2' : 'object-cover'} transition-transform duration-500 group-hover:scale-105`} 
                        loading="lazy" 
                        alt={item.name} 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/5"><Film size={32}/></div>
                    )}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play fill="currentColor" size={24} className="text-white"/>
                    </div>
                  </div>

                  <div className="p-2.5 border-t border-white/5">
                      <motion.h4 
                        layoutId={`title-${id}`}
                        className="text-[12px] font-medium truncate text-white group-hover:text-fluent-accent transition-colors leading-tight"
                      >
                        {decodeBase64(item.name)}
                      </motion.h4>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <button 
            onClick={() => scroll('right')} 
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-black/60 hover:bg-fluent-accent/80 text-white p-2 rounded-full opacity-0 group-hover/row:opacity-100 transition-all backdrop-blur-sm -mr-2 shadow-lg border border-white/10"
          >
            <ChevronRight size={20} />
          </button>
      </div>
    </div>
  );
};
