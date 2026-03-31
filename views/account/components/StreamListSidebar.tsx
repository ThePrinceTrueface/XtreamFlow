
import React, { useEffect, useRef, useState } from 'react';
import { Play, Star, ChevronLeft } from 'lucide-react';
import { XtreamStream } from '../../../types';
import { Button } from '../../../components/Win11UI';
import { decodeBase64 } from '../../../utils';

interface StreamListSidebarProps {
  items: XtreamStream[];
  selectedItem: XtreamStream | null;
  onSelect: (item: XtreamStream) => void;
  onClose: () => void;
  title: string;
}

// Simple AutoSizer replacement
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

export const StreamListSidebar: React.FC<StreamListSidebarProps> = ({ 
  items, selectedItem, onSelect, onClose, title 
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Scroll active item into view on mount or change
  useEffect(() => {
    if (selectedItem && scrollRef.current) {
      const index = items.findIndex(i => 
        (i.stream_id && i.stream_id === selectedItem.stream_id) || 
        (i.series_id && i.series_id === selectedItem.series_id)
      );
      if (index !== -1) {
        scrollRef.current.scrollTop = index * 60 - (scrollRef.current.clientHeight / 2) + 30;
      }
    }
  }, [selectedItem, items]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const renderItems = (height: number, width: number) => {
    const itemSize = 60;
    const totalHeight = items.length * itemSize;
    const startIndex = Math.floor(scrollTop / itemSize);
    const endIndex = Math.min(items.length - 1, Math.floor((scrollTop + height) / itemSize) + 5);

    const visibleItems = [];
    for (let i = startIndex; i <= endIndex; i++) {
      const item = items[i];
      const isActive = selectedItem && (
         (item.stream_id && item.stream_id === selectedItem.stream_id) || 
         (item.series_id && item.series_id === selectedItem.series_id)
      );

      visibleItems.push(
        <div 
          key={item.stream_id || item.series_id || item.num}
          style={{ 
            position: 'absolute', 
            top: i * itemSize, 
            left: 0, 
            width: '100%', 
            height: itemSize,
            padding: '4px 8px'
          }}
        >
          <div
            onClick={() => onSelect(item)}
            className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all border border-transparent h-full
              ${isActive 
                ? 'bg-fluent-accent/20 border-fluent-accent/20' 
                : 'hover:bg-white/5 hover:border-white/5'
              }`}
          >
            {/* Icon */}
            <div className="w-10 h-10 shrink-0 rounded bg-black/40 overflow-hidden relative flex items-center justify-center">
              {item.stream_icon || item.cover ? (
                <img 
                  src={item.stream_icon || item.cover} 
                  className="w-full h-full object-contain" 
                  loading="lazy" 
                  alt=""
                />
              ) : (
                <Play size={16} className="text-white/20" />
              )}
              {isActive && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                   <div className="w-2 h-2 bg-fluent-accent rounded-full animate-pulse shadow-[0_0_8px_#60CDFF]" />
                </div>
              )}
            </div>

            {/* Text */}
            <div className="min-w-0 flex-1">
              <p className={`text-[12px] font-medium truncate ${isActive ? 'text-white' : 'text-white/80 group-hover:text-white'}`}>
                {decodeBase64(item.name)}
              </p>
              {item.rating && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Star size={8} className="text-yellow-400 fill-current" />
                  <span className="text-[10px] text-white/50">{item.rating}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={{ height: totalHeight, width: '100%', position: 'relative' }}>
        {visibleItems}
      </div>
    );
  };

  return (
    <div className="w-[300px] shrink-0 border-r border-white/5 flex flex-col bg-[#1a1a1a]/95 backdrop-blur-xl h-full animate-in slide-in-from-left-4 duration-300">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
        <h3 className="font-semibold text-sm truncate pr-2" title={title}>{title}</h3>
        <Button variant="ghost" onClick={onClose} className="!p-1.5 h-8 w-8 rounded-full hover:bg-white/10">
           <ChevronLeft size={18} />
        </Button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-hidden">
        {items.length === 0 ? (
           <div className="p-4 text-center text-fluent-subtext text-xs">Aucun contenu disponible</div>
        ) : (
          <AutoSizer>
            {({ height, width }) => (
              <div 
                ref={scrollRef}
                onScroll={handleScroll}
                className="custom-scrollbar overflow-y-auto"
                style={{ height, width }}
              >
                {renderItems(height, width)}
              </div>
            )}
          </AutoSizer>
        )}
      </div>
      
      {/* Footer Info */}
      <div className="p-2 border-t border-white/5 text-[10px] text-center text-fluent-subtext bg-black/20 shrink-0">
        {items.length} éléments
      </div>
    </div>
  );
};
