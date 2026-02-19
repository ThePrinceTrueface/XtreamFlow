import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, X, Star, Tag } from 'lucide-react';
import { SearchCriteria } from '../types';
import { Button, Input } from './Win11UI';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onApply: (criteria: SearchCriteria) => void;
  currentCriteria: SearchCriteria;
  availableTags: string[];
}

export const AdvancedSearchModal: React.FC<Props> = ({ isOpen, onClose, onApply, currentCriteria, availableTags }) => {
  const [localCriteria, setLocalCriteria] = useState<SearchCriteria>(currentCriteria);

  useEffect(() => {
    if (isOpen) {
      setLocalCriteria(currentCriteria);
    }
  }, [isOpen, currentCriteria]);

  if (!isOpen) return null;

  const toggleTag = (tag: string) => {
    setLocalCriteria(prev => {
      const exists = prev.tags.includes(tag);
      return {
        ...prev,
        tags: exists 
          ? prev.tags.filter(t => t !== tag)
          : [...prev.tags, tag]
      };
    });
  };

  const handleApply = () => {
    onApply(localCriteria);
    onClose();
  };

  const handleClear = () => {
    const cleared = { query: '', onlyFavorites: false, tags: [] };
    setLocalCriteria(cleared);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#202020] border border-win-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-win-border flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-win-primary" />
            <h3 className="font-semibold text-white">Advanced Search</h3>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Text Search */}
          <div className="space-y-2">
            <label className="text-xs text-win-subtext uppercase tracking-wider font-semibold">Keywords</label>
            <Input 
              placeholder="Search Name, Host, or Username..." 
              value={localCriteria.query}
              onChange={(e) => setLocalCriteria(prev => ({ ...prev, query: e.target.value }))}
              autoFocus
            />
          </div>

          {/* Favorites Toggle */}
          <div className="space-y-2">
             <label className="text-xs text-win-subtext uppercase tracking-wider font-semibold">Status</label>
             <div 
               onClick={() => setLocalCriteria(prev => ({ ...prev, onlyFavorites: !prev.onlyFavorites }))}
               className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${localCriteria.onlyFavorites ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-black/20 border-white/10 hover:border-white/20'}`}
             >
               <div className="flex items-center gap-3">
                 <div className={`p-1.5 rounded-full ${localCriteria.onlyFavorites ? 'bg-yellow-500 text-black' : 'bg-white/10 text-white/50'}`}>
                    <Star size={16} fill={localCriteria.onlyFavorites ? "currentColor" : "none"} />
                 </div>
                 <span className={localCriteria.onlyFavorites ? "text-yellow-100" : "text-white"}>
                   Favorites Only
                 </span>
               </div>
               <div className={`w-10 h-5 rounded-full relative transition-colors ${localCriteria.onlyFavorites ? 'bg-win-primary' : 'bg-white/20'}`}>
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${localCriteria.onlyFavorites ? 'left-6' : 'left-1'}`} />
               </div>
             </div>
          </div>

          {/* Tag Filter */}
          <div className="space-y-2">
            <label className="text-xs text-win-subtext uppercase tracking-wider font-semibold">Filter by Tags</label>
            {availableTags.length === 0 ? (
              <div className="text-sm text-win-subtext italic p-2">No tags available in your accounts.</div>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                {availableTags.map(tag => {
                  const isSelected = localCriteria.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-md text-xs border transition-all flex items-center gap-1.5
                        ${isSelected 
                          ? 'bg-win-primary/20 border-win-primary text-win-primary' 
                          : 'bg-white/5 border-white/10 text-win-subtext hover:bg-white/10'
                        }`}
                    >
                      <Tag size={12} className={isSelected ? 'fill-current' : ''} />
                      {tag}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-black/20 border-t border-win-border flex justify-between items-center">
          <Button variant="ghost" onClick={handleClear} className="text-win-subtext hover:text-white">
            Clear Filters
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleApply}>
              Show Results
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
