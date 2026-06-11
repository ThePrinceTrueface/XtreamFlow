
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, Minus, Square, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { useAppStore } from './store/useAppStore';
import { useSyncStore } from './store/useSyncStore';
import { useAccountStore } from './store/useAccountStore';
import { RefreshCw, WifiOff, AlertTriangle } from 'lucide-react';
import { XtreamAccount, ViewState, ModalConfig, ModalType, SavedServer, AppBackup } from './types';
import { AcrylicPanel, Modal } from './components/Win11UI';
import { generateId, createProxyUrl } from './utils';

// Views & Components
import { Sidebar } from './components/Sidebars';
import { Dashboard } from './views/Dashboard';
import { AddAccount } from './views/AddAccount';
import { AccountList } from './views/AccountList';
import { SettingsView } from './views/SettingsView';
import { AccountDetailView } from './views/account/AccountDetailView';
import { ServerLibrary } from './views/ServerLibrary';
import { DownloadManager } from './views/account/components/DownloadManager';
import { VideoPlayer } from './components/VideoPlayer';
import { GlobalSearch } from './components/GlobalSearch';
import { ShortcutsModal } from './components/ShortcutsModal';

// --- Custom TitleBar Component ---
const TitleBar: React.FC<{
  onToggleMobileMenu: () => void;
  isMobileMenuOpen: boolean;
}> = ({ onToggleMobileMenu, isMobileMenuOpen }) => {
  return (
    <div className="h-[36px] w-full flex items-center justify-between select-none drag-region bg-transparent z-50 shrink-0">
      {/* App Icon/Name & Mobile Menu Toggle */}
      <div className="flex items-center gap-3 px-4">
        <button 
          className="md:hidden p-1 no-drag rounded hover:bg-white/10 transition-colors"
          onClick={onToggleMobileMenu}
        >
          {isMobileMenuOpen ? <X size={18} /> : <div className="space-y-1"><div className="w-4 h-0.5 bg-white"/><div className="w-4 h-0.5 bg-white"/><div className="w-4 h-0.5 bg-white"/></div>}
        </button>
        <div className="w-4 h-4 rounded-sm bg-fluent-accent/80 flex items-center justify-center shadow-sm">
             <div className="w-2 h-2 bg-white rounded-full opacity-80" />
        </div>
        <span className="text-xs font-medium text-fluent-subtext tracking-wide">XtreamFlow</span>
      </div>

      {/* Window Controls (Simulated, hidden on small screens) */}
      <div className="hidden md:flex h-full no-drag">
        <button className="w-[46px] h-full flex items-center justify-center hover:bg-white/5 text-white transition-colors">
          <Minus size={14} />
        </button>
        <button className="w-[46px] h-full flex items-center justify-center hover:bg-white/5 text-white transition-colors">
          <Square size={12} strokeWidth={2} />
        </button>
        <button className="w-[46px] h-full flex items-center justify-center hover:bg-red-500 text-white transition-colors group">
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

// --- Main App Shell ---

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // App-wide Zustand state
  const {
    isSidebarCollapsed,
    playingDownload,
    editingAccount,
    serverToPrefill,
    initialSearchQuery,
    accentColor,
    themeMode,
    modal,
    toast,
    isGlobalSearchOpen,
    isShortcutsModalOpen,
    setSidebarCollapsed,
    setPlayingDownload,
    setEditingAccount,
    setServerToPrefill,
    setInitialSearchQuery,
    setAccentColor,
    setThemeMode,
    setIsGlobalSearchOpen,
    setIsShortcutsModalOpen,
    showModal,
    closeModal,
    showToast,
  } = useAppStore();

  const {
    isOnline,
    isPreloading,
    preloadProgressData,
    isUpdating,
    updateProgressData
  } = useSyncStore();

  // Data State (Zustand Unified Store)
  const {
    accounts,
    servers: savedServers,
    loadAll: loadAccountsAndServers,
    saveAccount: storeAccount,
    deleteAccount: removeAccount,
    toggleFavoriteAccount,
    saveServer: storeServer,
    deleteServer: removeServer,
    importBackup,
    exportBackup,
  } = useAccountStore();
  
  const accountMatch = location.pathname.match(/\/account\/([^\/]+)/);
  const activeAccountId = accountMatch ? accountMatch[1] : null;

  const handleGlobalSearchResult = async (result: any) => {
    setIsGlobalSearchOpen(false);
    
    if (result.type === 'stream') {
      const stream = result.data;
      const account = await db.accounts.get(stream.accountId);
      if (!account) {
        showToast('Compte introuvable pour ce flux');
        return;
      }

      const streamId = stream.stream_id || stream.series_id;
      const type = stream.type === 'live' ? 'live' : stream.type === 'movie' ? 'vod' : 'series';
      navigate(`/account/${account.id}/${type}/all/${streamId}?autoplay=true`);
    } else if (result.type === 'epg') {
      const prog = result.data;
      const account = await db.accounts.get(prog.accountId);
      if (account) {
        navigate(`/account/${account.id}/live/all/${prog.channel_id}?autoplay=true`);
        showToast(`Programme: ${prog.title}`);
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global Search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (activeAccountId) {
          setIsGlobalSearchOpen(true);
        } else {
          showToast('Ouvrez un compte pour rechercher du contenu');
        }
      }

      // App Navigation
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'h':
            e.preventDefault();
            navigate('/dashboard');
            break;
          case 'n':
            e.preventDefault();
            navigate('/add-account');
            break;
          case 'm':
            e.preventDefault();
            navigate('/manage-accounts');
            break;
          case 'd':
            e.preventDefault();
            navigate('/downloads');
            break;
          case 's':
            e.preventDefault();
            navigate('/settings');
            break;
        }
      }

      // Help Shortcut
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        setIsShortcutsModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeAccountId, navigate, setIsGlobalSearchOpen, showToast, setIsShortcutsModalOpen]);

  // Migration & Initial Load
  useEffect(() => {
    const migrate = async () => {
      const saved = localStorage.getItem('xtream_accounts');
      const savedSrv = localStorage.getItem('xtream_servers');
      
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const count = await db.accounts.count();
            if (count === 0) {
              await db.accounts.bulkAdd(parsed);
              localStorage.removeItem('xtream_accounts');
            }
          }
        } catch (e) {
          console.error("Failed to migrate accounts", e);
        }
      }
      
      if (savedSrv) {
        try {
          const parsed = JSON.parse(savedSrv);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const count = await db.servers.count();
            if (count === 0) {
              await db.servers.bulkAdd(parsed);
              localStorage.removeItem('xtream_servers');
            }
          }
        } catch (e) {
          console.error("Failed to migrate servers", e);
        }
      }
      
      await loadAccountsAndServers();
    };

    migrate();
  }, [loadAccountsAndServers]);

  // --- Account Logic ---

  const handleSaveAccount = async (account: XtreamAccount, silent = false) => {
    try {
      await storeAccount(account);
      
      if (!silent) {
          showModal(
            'success',
            'Account Saved',
            `The account "${account.name}" has been successfully ${editingAccount ? 'updated' : 'added'}.`,
            () => {
               setEditingAccount(null);
               navigate('/manage-accounts');
            },
            "OK"
          );
      }
    } catch (error) {
      console.error("Failed to save account", error);
      showModal('error', 'Error', 'Failed to save account to database.');
    }
  };

  const toggleFavorite = async (id: string) => {
    await toggleFavoriteAccount(id);
  };

  const deleteAccount = (id: string) => {
    showModal(
      'confirm',
      'Delete Account',
      'Are you sure you want to permanently remove this account? This action cannot be undone.',
      async () => {
        await removeAccount(id);
        if (editingAccount?.id === id) {
          setEditingAccount(null);
          navigate('/manage-accounts');
        }
      },
      'Delete',
      'Cancel'
    );
  };

  const startEditing = (account: XtreamAccount) => {
    setEditingAccount(account);
    navigate('/edit-account');
  };

  const cancelEditing = () => {
    setEditingAccount(null);
    navigate('/manage-accounts');
  };

  // --- Server Library Logic ---

  const handleSaveServer = async (server: SavedServer) => {
      await storeServer(server);
      showToast("Server saved to library");
  };

  const handleDeleteServer = (id: string) => {
      showModal(
          'confirm',
          'Delete Server',
          'Remove this server from your library? Linked accounts will not be deleted.',
          async () => {
             await removeServer(id);
             showToast("Server removed");
          }
      );
  };

  const handleAddAccountFromServer = (server: SavedServer) => {
      setServerToPrefill(server);
      navigate('/add-account');
  };

  const handleViewServerAccounts = (server: SavedServer) => {
      setInitialSearchQuery(server.host);
      navigate('/manage-accounts');
  };

  // --- Import / Export Logic ---

  const handleExportData = () => {
    try {
      // Get the full backup object from the store
      const backup = exportBackup();

      const dataStr = JSON.stringify(backup, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      const exportFileDefaultName = `xtreamflow-backup-${new Date().toISOString().slice(0, 10)}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();

      showModal('success', 'Export Successful', 'Your accounts and server library have been exported.');
    } catch (e) {
      showModal('error', 'Export Failed', 'An error occurred while generating the backup file.');
    }
  };

  const handleImportData = async (data: any) => {
    try {
      const { accountsAdded, serversAdded } = await importBackup(data);
      showModal(
          'success', 
          'Import Successful', 
          `Data restored successfully.\n\nAccounts added: ${accountsAdded}\nServers added: ${serversAdded}`
      );
    } catch (e: any) {
      showModal('error', 'Import Failed', e.message || 'An error occurred while restoring data.');
    }
  };

  // Main App Shell
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Close mobile menu on route change
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const getActiveViewForSidebar = () => {
    const path = location.pathname;
    if (path === '/' || path === '/dashboard') return 'dashboard';
    if (path === '/add-account') return 'add-account';
    if (path.startsWith('/manage-accounts') || path === '/edit-account') return 'manage-accounts';
    if (path === '/server-library') return 'server-library';
    if (path === '/downloads') return 'downloads';
    if (path === '/settings') return 'settings';
    if (path.startsWith('/account/')) return 'account-detail';
    return 'dashboard';
  };

  const handleSelectAccount = (account: XtreamAccount) => {
    navigate(`/account/${account.id}`);
  };

  return (
    <AcrylicPanel>
      {/* Window Title Bar */}
      <TitleBar 
        isMobileMenuOpen={isMobileMenuOpen} 
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
      />

      {/* Network Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-200 text-[11px] py-1.5 px-4 flex items-center justify-between z-50 shrink-0">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <WifiOff size={13} className="text-amber-400 animate-pulse shrink-0" />
            <span>
              Mode hors-ligne activé. L'application utilise les catégories et flux en cache local !
            </span>
          </div>
        </div>
      )}

      {/* Global Background Sync/Update mini indicator */}
      {(isPreloading || isUpdating) && (
        <div className="bg-fluent-accent/10 border-b border-fluent-accent/10 text-white text-xs py-1.5 px-4 flex items-center justify-between z-50 shrink-0 relative overflow-hidden">
          {/* Progress bar background fill */}
          <div 
            className="absolute left-0 top-0 bottom-0 bg-fluent-accent/15 transition-all duration-300" 
            style={{ width: `${isPreloading ? preloadProgressData.percent : updateProgressData.percent}%` }}
          />
          <div className="flex items-center gap-2 relative z-10 truncate mr-4">
            <RefreshCw size={12} className="text-fluent-accent animate-spin shrink-0" />
            <span className="font-semibold text-fluent-accent uppercase tracking-wider text-[10px] shrink-0">
              {isPreloading ? 'Mise en cache' : 'Mise à jour'} :
            </span>
            <span className="text-white/70 text-[11px] truncate">
              {isPreloading ? preloadProgressData.step : updateProgressData.step}
            </span>
          </div>
          <div className="font-bold text-[11px] text-fluent-accent shrink-0 relative z-10 flex items-center gap-1">
            <span>{isPreloading ? Math.round(preloadProgressData.percent) : Math.round(updateProgressData.percent)}%</span>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        <Routes>
          <Route path="/account/:accountId/*" element={
            <div className="flex flex-1 relative w-full">
              <AccountDetailView 
                onBack={() => navigate('/manage-accounts')} 
                onPlayDownload={(url, title, type) => setPlayingDownload({ url, title, type })}
                onOpenSearch={() => setIsGlobalSearchOpen(true)}
                isMobileMenuOpen={isMobileMenuOpen}
              />
              {/* Overlay for mobile menu in account view */}
              {isMobileMenuOpen && (
                <div 
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden"
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              )}
            </div>
          } />
          <Route path="*" element={
            <>
              <Sidebar 
                activeView={getActiveViewForSidebar() as ViewState} 
                setView={(view) => navigate(`/${view}`)} 
                isCollapsed={isSidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!isSidebarCollapsed)}
                isMobileMenuOpen={isMobileMenuOpen}
              />
              
              {/* Overlay for mobile menu */}
              {isMobileMenuOpen && (
                <div 
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden"
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              )}
              
              <main className={`flex-1 overflow-y-auto relative scroll-smooth bg-transparent transition-all duration-300 ${location.pathname === '/downloads' ? 'p-0' : 'p-6 md:p-8'}`}>
                <Routes>
                  <Route path="/" element={<Dashboard accounts={accounts} setView={(view) => navigate(`/${view}`)} />} />
                  <Route path="/dashboard" element={<Dashboard accounts={accounts} setView={(view) => navigate(`/${view}`)} />} />
                  
                  <Route path="/add-account" element={
                    <AddAccount 
                        onSave={handleSaveAccount} 
                        onCancel={() => navigate('/dashboard')} 
                        savedServers={savedServers}
                        prefillServer={serverToPrefill}
                    />
                  } />

                  <Route path="/edit-account" element={
                    <AddAccount 
                      onSave={handleSaveAccount} 
                      initialData={editingAccount} 
                      onCancel={cancelEditing} 
                      onDelete={deleteAccount}
                      savedServers={savedServers}
                    />
                  } />

                  <Route path="/manage-accounts" element={
                    <AccountList 
                      accounts={accounts} 
                      onDelete={deleteAccount} 
                      onEdit={startEditing}
                      onToggleFavorite={toggleFavorite}
                      showToast={showToast}
                      onOpenAdvancedSearch={() => {}}
                      onSelect={handleSelectAccount}
                      onUpdate={(acc) => handleSaveAccount(acc, true)}
                      initialQuery={initialSearchQuery}
                    />
                  } />

                  <Route path="/server-library" element={
                      <ServerLibrary 
                          servers={savedServers} 
                          onSave={handleSaveServer} 
                          onDelete={handleDeleteServer}
                          onAddAccount={handleAddAccountFromServer}
                          onViewAccounts={handleViewServerAccounts}
                      />
                  } />
                  
                  <Route path="/settings" element={
                    <SettingsView 
                        accounts={accounts} 
                        onImport={handleImportData} 
                        onExport={handleExportData}
                        accentColor={accentColor}
                        onAccentColorChange={setAccentColor}
                        themeMode={themeMode}
                        setThemeMode={setThemeMode}
                        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
                    />
                  } />

                  <Route path="/downloads" element={
                    <DownloadManager 
                      onPlay={(url, title, type) => setPlayingDownload({ url, title, type })}
                    />
                  } />
                </Routes>
              </main>
            </>
          } />
        </Routes>

        {playingDownload && (
          <VideoPlayer 
            url={playingDownload.url}
            title={playingDownload.title}
            type={playingDownload.type}
            onClose={() => {
              URL.revokeObjectURL(playingDownload.url);
              setPlayingDownload(null);
            }}
          />
        )}

        {/* Toast Notification */}
        {toast.show && (
          <div className="absolute bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-none">
             <div className="bg-fluent-layer border border-fluent-border text-white px-4 py-3 rounded-window shadow-flyout flex items-center gap-3 ring-1 ring-white/5">
               <CheckCircle2 size={18} className="text-fluent-accent" />
               <span className="text-sm">{toast.message}</span>
             </div>
          </div>
        )}

        <div className={`fixed inset-0 z-[49] ${modal.isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
          <Modal 
            isOpen={modal.isOpen}
            type={modal.type}
            title={modal.title}
            onConfirm={modal.onConfirm}
            onCancel={modal.onCancel!}
            confirmLabel={modal.confirmLabel}
            cancelLabel={modal.cancelLabel}
          >
            {modal.message}
          </Modal>
        </div>

        <GlobalSearch 
          isOpen={isGlobalSearchOpen} 
          onClose={() => setIsGlobalSearchOpen(false)} 
          onSelectResult={handleGlobalSearchResult} 
          accountId={activeAccountId}
        />

        <ShortcutsModal 
          isOpen={isShortcutsModalOpen} 
          onClose={() => setIsShortcutsModalOpen(false)} 
        />
      </div>
    </AcrylicPanel>
  );
}
