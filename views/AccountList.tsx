
import React, { useState, useEffect } from 'react';
import { Search, X, Filter, Star, Tag, Database, PlayCircle, Pencil, Copy, CheckCircle2, Trash2, Activity, Wifi, WifiOff, Loader2, LayoutGrid, LayoutList } from 'lucide-react';
import { XtreamAccount, SearchCriteria } from '../types';
import { Button } from '../components/Win11UI';
import { AdvancedSearchModal } from '../components/AdvancedSearchModal';
import { checkConnection } from '../utils';

export const AccountList: React.FC<{ 
  accounts: XtreamAccount[]; 
  onDelete: (id: string) => void;
  onEdit: (account: XtreamAccount) => void;
  onToggleFavorite: (id: string) => void;
  showToast: (msg: string) => void;
  onOpenAdvancedSearch: (currentCriteria: SearchCriteria, tags: string[]) => void;
  onSelect: (account: XtreamAccount) => void;
  onUpdate: (account: XtreamAccount) => void;
  initialQuery?: string;
}> = ({ accounts, onDelete, onEdit, onToggleFavorite, showToast, onSelect, onUpdate, initialQuery = '' }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>({
    query: initialQuery,
    onlyFavorites: false,
    tags: []
  });
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  
  // View Mode State (Persisted)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
      return (localStorage.getItem('account_view_mode') as 'list' | 'grid') || 'list';
  });

  const handleViewModeChange = (mode: 'list' | 'grid') => {
      setViewMode(mode);
      localStorage.setItem('account_view_mode', mode);
  };

  // Update search if initialQuery changes
  useEffect(() => {
    if (initialQuery) {
        setSearchCriteria(prev => ({ ...prev, query: initialQuery }));
    }
  }, [initialQuery]);

  // Calculate available tags from all accounts
  const availableTags = Array.from(new Set(accounts.flatMap(a => a.tags || []))).sort();

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast("URL copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleTestAccount = async (account: XtreamAccount) => {
      setTestingId(account.id);
      const result = await checkConnection(account);
      
      const updatedAccount: XtreamAccount = {
          ...account,
          status: result.success ? 'active' : 'error'
      };
      
      onUpdate(updatedAccount); // Persist the new status
      setTestingId(null);
      
      if (result.success) {
          showToast(`Success: ${account.name} is online.`);
      } else {
          showToast(`Failed: ${account.name} is unreachable.`);
      }
  };

  // Filter Logic
  const filteredAccounts = accounts.filter(acc => {
    const q = searchCriteria.query.toLowerCase();
    const matchesQuery = !q || 
      acc.name.toLowerCase().includes(q) || 
      acc.host.toLowerCase().includes(q) || 
      acc.username.toLowerCase().includes(q);

    const matchesFav = searchCriteria.onlyFavorites ? acc.isFavorite : true;

    const matchesTags = searchCriteria.tags.length === 0 || 
      searchCriteria.tags.every(t => acc.tags?.includes(t));

    return matchesQuery && matchesFav && matchesTags;
  });

  // Sort: Favorites first, then Name
  const sortedAccounts = [...filteredAccounts].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const activeFiltersCount = (searchCriteria.onlyFavorites ? 1 : 0) + searchCriteria.tags.length;

  return (
    <div className="space-y-4 max-w-6xl mx-auto animate-in fade-in h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
         <h2 className="text-2xl font-semibold">Manage Accounts</h2>
         
         <div className="flex items-center gap-3">
             {/* View Toggle */}
             <div className="flex bg-black/20 p-1 rounded-lg border border-win-border">
                <button 
                    onClick={() => handleViewModeChange('list')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white/10 text-white shadow-sm' : 'text-win-subtext hover:text-white'}`}
                    title="List View"
                >
                    <LayoutList size={16} />
                </button>
                <button 
                    onClick={() => handleViewModeChange('grid')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white shadow-sm' : 'text-win-subtext hover:text-white'}`}
                    title="Grid View"
                >
                    <LayoutGrid size={16} />
                </button>
             </div>

             <div className="h-6 w-[1px] bg-white/10 mx-1 hidden md:block"></div>

             {/* Search Bar Area */}
             <div className="flex gap-2 flex-1 md:flex-none">
                <div className="relative group w-full md:w-64">
                   <input 
                     className="w-full bg-black/20 border border-win-border rounded-[6px] pl-9 pr-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-win-primary focus:bg-black/30 transition-all"
                     placeholder="Search accounts..."
                     value={searchCriteria.query}
                     onChange={(e) => setSearchCriteria(prev => ({ ...prev, query: e.target.value }))}
                   />
                   <Search size={16} className="absolute left-3 top-2.5 text-win-subtext group-focus-within:text-win-primary transition-colors" />
                   {searchCriteria.query && (
                     <button 
                       onClick={() => setSearchCriteria(prev => ({ ...prev, query: '' }))}
                       className="absolute right-2 top-2 text-win-subtext hover:text-white"
                     >
                       <X size={14} />
                     </button>
                   )}
                </div>
                
                <Button variant="secondary" onClick={() => setIsSearchModalOpen(true)} className={activeFiltersCount > 0 ? "border-win-primary text-win-primary bg-win-primary/10" : ""}>
                   <Filter size={16} />
                   {activeFiltersCount > 0 && <span className="bg-win-primary text-black text-[10px] font-bold px-1.5 rounded-full">{activeFiltersCount}</span>}
                </Button>
             </div>
         </div>
      </div>

      {/* Active Filter Chips */}
      {(activeFiltersCount > 0) && (
        <div className="flex flex-wrap gap-2 mb-2 animate-in slide-in-from-top-2">
           {searchCriteria.onlyFavorites && (
             <span className="bg-yellow-500/20 text-yellow-200 border border-yellow-500/30 px-2 py-1 rounded-md text-xs flex items-center gap-1">
               <Star size={10} fill="currentColor" /> Favorites Only
               <button onClick={() => setSearchCriteria(prev => ({...prev, onlyFavorites: false}))} className="ml-1 hover:text-white"><X size={12} /></button>
             </span>
           )}
           {searchCriteria.tags.map(tag => (
             <span key={tag} className="bg-win-primary/10 text-win-primary border border-win-primary/20 px-2 py-1 rounded-md text-xs flex items-center gap-1">
               <Tag size={10} /> {tag}
               <button onClick={() => setSearchCriteria(prev => ({...prev, tags: prev.tags.filter(t => t !== tag)}))} className="ml-1 hover:text-white"><X size={12} /></button>
             </span>
           ))}
           <button onClick={() => setSearchCriteria({query: '', onlyFavorites: false, tags: []})} className="text-xs text-win-subtext hover:text-white underline ml-2">Clear all</button>
        </div>
      )}

      {/* List / Grid Container */}
      <div className="flex-1 overflow-y-auto pb-4 custom-scrollbar">
        {sortedAccounts.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-48 text-win-subtext opacity-60 border border-dashed border-white/10 rounded-xl shrink-0">
            {accounts.length === 0 ? (
               <>
                 <Database size={48} strokeWidth={1} className="mb-4" />
                 <p>No accounts connected yet.</p>
               </>
            ) : (
               <>
                 <Search size={48} strokeWidth={1} className="mb-4" />
                 <p>No matches found.</p>
               </>
            )}
          </div>
        ) : (
            <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : "flex flex-col gap-3"}>
              {sortedAccounts.map(acc => (
                <div 
                    key={acc.id} 
                    className={`group bg-win-card hover:bg-win-cardHover border border-win-border rounded-lg transition-all relative shrink-0
                        ${viewMode === 'grid' ? 'p-5 flex flex-col h-full hover:shadow-lg hover:-translate-y-1' : 'p-4 flex items-center justify-between'}`}
                >
                  <div className={`flex ${viewMode === 'grid' ? 'flex-col items-start gap-4 mb-4' : 'items-center gap-4'}`}>
                    <div className="relative shrink-0">
                        <div className={`rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold shadow-inner
                            ${viewMode === 'grid' ? 'w-14 h-14 text-xl' : 'w-10 h-10 text-sm'}`}>
                            {acc.name.substring(0, 2).toUpperCase()}
                            {acc.isFavorite && (
                                <div className="absolute -top-1 -right-1 bg-yellow-400 text-black p-0.5 rounded-full border border-black shadow-sm">
                                    <Star size={10} fill="currentColor" />
                                </div>
                            )}
                        </div>
                        {/* Status Dot */}
                        <div className={`absolute -bottom-1 -right-1 rounded-full border-2 border-[#202020] flex items-center justify-center shadow-sm
                            ${viewMode === 'grid' ? 'w-5 h-5' : 'w-4 h-4'}
                            ${acc.status === 'active' ? 'bg-green-500' : acc.status === 'error' ? 'bg-red-500' : 'bg-gray-500'}`}
                            title={acc.status === 'active' ? 'Active' : acc.status === 'error' ? 'Error' : 'Untested'}
                        >
                            {acc.status === 'active' && <Wifi size={viewMode === 'grid' ? 10 : 8} className="text-black" />}
                            {acc.status === 'error' && <WifiOff size={viewMode === 'grid' ? 10 : 8} className="text-white" />}
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-1 min-w-0">
                      <h3 className={`font-medium text-white truncate ${viewMode === 'grid' ? 'text-lg' : 'text-base'}`}>
                        {acc.name}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-win-subtext truncate">
                        <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider">{acc.protocol}</span>
                        <span className="truncate">{acc.host}:{acc.port}</span>
                      </div>
                      {acc.tags && acc.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                              {acc.tags.slice(0, viewMode === 'grid' ? 5 : 3).map(tag => (
                                  <span key={tag} className="bg-white/5 text-win-subtext px-2 py-0.5 rounded-md text-[10px] border border-white/5 flex items-center gap-1">
                                      <Tag size={8} className="opacity-70" /> {tag}
                                  </span>
                              ))}
                              {acc.tags.length > (viewMode === 'grid' ? 5 : 3) && (
                                  <span className="text-[10px] text-win-subtext px-1">+{acc.tags.length - (viewMode === 'grid' ? 5 : 3)}</span>
                              )}
                          </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className={`flex items-center gap-2 transition-opacity
                      ${viewMode === 'grid' ? 'mt-auto pt-4 border-t border-white/5 w-full justify-between' : 'opacity-0 group-hover:opacity-100'}`}>
                    
                    {/* Primary Action Button */}
                    <Button 
                      onClick={() => onSelect(acc)}
                      className={`!px-3 !py-1.5 text-xs bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 font-semibold shadow-sm
                          ${viewMode === 'grid' ? 'flex-1 h-9' : ''}`}
                    >
                      <PlayCircle size={14} /> Open
                    </Button>

                    <div className="flex items-center gap-1">
                        <Button 
                        variant="secondary"
                        className="!px-2 !py-1.5 text-xs"
                        onClick={() => handleTestAccount(acc)}
                        disabled={testingId === acc.id}
                        title="Test Connection"
                        >
                        {testingId === acc.id ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
                        </Button>
                        
                        <Button 
                        variant="secondary"
                        className={`!px-2 !py-1.5 text-xs ${acc.isFavorite ? 'text-yellow-400 hover:text-yellow-300' : 'text-win-subtext hover:text-yellow-200'}`}
                        onClick={() => onToggleFavorite(acc.id)}
                        title={acc.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                        >
                        <Star size={14} fill={acc.isFavorite ? "currentColor" : "none"} />
                        </Button>
                        <Button 
                        variant="secondary" 
                        className="!px-2 !py-1.5 text-xs"
                        onClick={() => onEdit(acc)}
                        >
                        <Pencil size={14} />
                        </Button>
                        <Button 
                        variant="secondary" 
                        className="!px-2 !py-1.5 text-xs"
                        onClick={() => copyToClipboard(`${acc.protocol}://${acc.host}:${acc.port}/get.php?username=${acc.username}&password=${acc.password}`, acc.id)}
                        >
                        {copiedId === acc.id ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                        </Button>
                        <Button 
                        variant="ghost" 
                        className="!px-2 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        onClick={() => onDelete(acc.id)}
                        >
                        <Trash2 size={16} />
                        </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
        )}
      </div>

      <AdvancedSearchModal 
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onApply={setSearchCriteria}
        currentCriteria={searchCriteria}
        availableTags={availableTags}
      />
    </div>
  );
};
