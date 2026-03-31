
import React from 'react';
import { Layers, Folder, Star } from 'lucide-react';
import { XtreamCategory } from '../../../types';

interface AdvancedSidebarProps {
  categories: XtreamCategory[];
  selectedCategoryId: string | null;
  onSelectCategory: (cat: XtreamCategory | null | 'favorites') => void;
}

export const AdvancedSidebar: React.FC<AdvancedSidebarProps> = ({ categories, selectedCategoryId, onSelectCategory }) => (
  <div className="w-[240px] shrink-0 border-r border-white/5 pr-4 flex flex-col gap-1 overflow-y-auto custom-scrollbar h-full bg-fluent-micaAlt/30 backdrop-blur-xl">
    <div className="px-4 py-6">
      <h3 className="text-[10px] font-bold text-fluent-accent uppercase tracking-widest mb-4 opacity-70">Navigation</h3>
      
      <button onClick={() => onSelectCategory(null)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all group relative mb-1 ${selectedCategoryId === null ? 'bg-fluent-accent/10 text-fluent-accent font-semibold' : 'hover:bg-white/5 text-fluent-subtext'}`}>
        {selectedCategoryId === null && <div className="absolute left-0 w-1 h-4 bg-fluent-accent rounded-r-full" />}
        <Layers size={18} /> Tout le catalogue
      </button>

      <button onClick={() => onSelectCategory('favorites')}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all group relative mb-2 ${selectedCategoryId === 'favorites' ? 'bg-yellow-500/10 text-yellow-500 font-semibold' : 'hover:bg-white/5 text-fluent-subtext'}`}>
        {selectedCategoryId === 'favorites' && <div className="absolute left-0 w-1 h-4 bg-yellow-500 rounded-r-full" />}
        <Star size={18} className={selectedCategoryId === 'favorites' ? 'text-yellow-500' : 'opacity-40 group-hover:opacity-100'} /> Favoris
      </button>
      
      <div className="h-[1px] bg-white/5 my-6 mx-2" />
      
      <h3 className="text-[10px] font-bold text-fluent-subtext uppercase tracking-widest mb-3 opacity-50">Catégories</h3>
      <div className="space-y-1">
        {categories.map((cat, index) => {
          const isActive = selectedCategoryId === cat.category_id;
          return (
            <button key={`${cat.category_id}-${index}`} onClick={() => onSelectCategory(cat)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all group relative ${isActive ? 'bg-fluent-accent/10 text-fluent-accent font-semibold' : 'hover:bg-white/5 text-fluent-subtext'}`}>
              {isActive && <div className="absolute left-0 w-1 h-4 bg-fluent-accent rounded-r-full" />}
              <Folder size={18} className={isActive ? 'text-fluent-accent' : 'opacity-40 group-hover:opacity-100'} />
              <span className="truncate">{cat.category_name}</span>
            </button>
          );
        })}
      </div>
    </div>
  </div>
);
