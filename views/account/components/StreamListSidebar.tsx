
import React, { useEffect, useRef } from 'react';
import { Play, Star, ChevronLeft, Search } from 'lucide-react';
import { XtreamStream } from '../../../types';
import { Button } from '../../../components/Win11UI';

interface StreamListSidebarProps {
  items: XtreamStream[];
  selectedItem: XtreamStream | null;
  onSelect: (item: XtreamStream) => void;
  onClose: () => void;
  title: string;
}

// Helper to decode Base64 strings safely and fix encoding issues
const decodeBase64 = (str: string) => {
    if (!str) return "";
    let decoded = str;

    // 1. Try Base64 decoding if it looks like Base64 (no spaces, valid chars)
    if (!str.includes(' ') && /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/.test(str)) {
         try {
             const raw = window.atob(str);
             if (!/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(raw)) {
                 decoded = raw;
             }
         } catch (e) {
             // Not base64
         }
    }

    // 2. Fix UTF-8 interpreted as Latin-1 (Mojibake)
    try {
        return decodeURIComponent(escape(decoded));
    } catch (e) {
        return decoded;
    }
};

export const StreamListSidebar: React.FC<StreamListSidebarProps> = ({ 
  items, selectedItem, onSelect, onClose, title 
}) => {
  const activeRef = useRef<HTMLDivElement>(null);

  // Scroll active item into view on mount or change
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [selectedItem]);

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
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {items.length === 0 ? (
           <div className="p-4 text-center text-fluent-subtext text-xs">Aucun contenu disponible</div>
        ) : (
           items.map((item) => {
             const isActive = selectedItem && (
                (item.stream_id && item.stream_id === selectedItem.stream_id) || 
                (item.series_id && item.series_id === selectedItem.series_id)
             );

             return (
               <div
                 key={item.stream_id || item.series_id || item.num}
                 ref={isActive ? activeRef : null}
                 onClick={() => onSelect(item)}
                 className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all border border-transparent
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
             );
           })
        )}
      </div>
      
      {/* Footer Info */}
      <div className="p-2 border-t border-white/5 text-[10px] text-center text-fluent-subtext bg-black/20 shrink-0">
        {items.length} éléments
      </div>
    </div>
  );
};
