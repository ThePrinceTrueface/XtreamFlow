
import React, { useState, useEffect, useRef } from 'react';
import { Play, Film, Star, Sparkles, ChevronRight, ChevronLeft, Image as ImageIcon, PlusCircle } from 'lucide-react';
import { XtreamStream } from '../../../types';
import { Button } from '../../../components/Win11UI';

interface ItemGridProps {
  items: XtreamStream[];
  type: 'live' | 'vod' | 'series';
  onItemClick: (item: XtreamStream) => void;
}

export const ItemGrid: React.FC<ItemGridProps> = ({ items, type, onItemClick }) => {
  const [displayLimit, setDisplayLimit] = useState(60);

  // Reset limit when items change
  useEffect(() => {
    setDisplayLimit(60);
  }, [items]);

  const visibleItems = items.slice(0, displayLimit);
  const hasMore = items.length > displayLimit;

  return (
    <div className="space-y-8 pb-20">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {visibleItems.map((item) => (
          <div key={item.stream_id || item.series_id || item.num} onClick={() => onItemClick(item)}
            className="group bg-fluent-layer hover:bg-fluent-layerHover border border-fluent-border rounded-window overflow-hidden cursor-pointer transition-all active:scale-[0.98] relative shadow-sm hover:shadow-md">
            <div className={`${type === 'live' ? 'aspect-video' : 'aspect-[2/3]'} w-full bg-black/20 relative flex items-center justify-center overflow-hidden`}>
              {item.stream_icon || item.cover ? (
                <img src={item.stream_icon || item.cover} className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-500" loading="lazy" />
              ) : (
                <ImageIcon size={32} className="opacity-10" />
              )}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-all duration-300">
                <Play size={32} fill="currentColor" />
              </div>
            </div>
            <div className="p-3">
              <h4 className="text-[11px] font-semibold truncate mb-1 group-hover:text-fluent-accent transition-colors" title={item.name}>{item.name}</h4>
              {item.rating && <div className="flex items-center gap-1 text-[10px] text-yellow-400 font-medium"><Star size={10} fill="currentColor"/> {item.rating}</div>}
            </div>
          </div>
        ))}
      </div>
      
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button variant="secondary" onClick={() => setDisplayLimit(prev => prev + 60)} className="!px-8 h-10 border-white/10 hover:bg-white/5">
            <PlusCircle size={16} /> Afficher plus ({items.length - displayLimit} restants)
          </Button>
        </div>
      )}
    </div>
  );
};

interface HorizontalRowProps {
  categoryId: string;
  name: string;
  items: XtreamStream[];
  onItemClick: (item: XtreamStream) => void;
  onExplore: (categoryId: string) => void;
}

export const HorizontalRow: React.FC<HorizontalRowProps> = ({ categoryId, name, items, onItemClick, onExplore }) => {
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
    <div className="mb-8 last:mb-0">
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
            {items.map(item => (
              <div key={item.stream_id || item.series_id} onClick={() => onItemClick(item)}
                className="shrink-0 w-[140px] group cursor-pointer transition-all active:scale-95">
                <div className="aspect-[2/3] rounded-lg overflow-hidden border border-white/5 bg-black/20 relative shadow-md group-hover:ring-2 group-hover:ring-fluent-accent/30 transition-all duration-300">
                  {item.stream_icon || item.cover ? <img src={item.stream_icon || item.cover} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center text-white/5"><Film size={32}/></div>}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Play fill="currentColor" size={24} className="text-white"/></div>
                </div>
                <h4 className="text-[11px] font-medium mt-2 truncate group-hover:text-fluent-accent transition-colors leading-tight">{item.name}</h4>
              </div>
            ))}
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
