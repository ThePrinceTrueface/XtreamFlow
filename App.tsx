
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, Minus, Square, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { useAccounts } from './hooks/useAccounts';
import { useServers } from './hooks/useServers';
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

// --- Custom Title Bar Component ---
const TitleBar: React.FC = () => {
  return (
    <div className="h-[36px] w-full flex items-center justify-between select-none drag-region bg-transparent z-50 shrink-0">
      {/* App Icon/Name */}
      <div className="flex items-center gap-3 px-4">
        <div className="w-4 h-4 rounded-sm bg-fluent-accent/80 flex items-center justify-center shadow-sm">
             <div className="w-2 h-2 bg-white rounded-full opacity-80" />
        </div>
        <span className="text-xs font-medium text-fluent-subtext tracking-wide">XtreamFlow</span>
      </div>

      {/* Window Controls (Simulated) */}
      <div className="flex h-full no-drag">
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [playingDownload, setPlayingDownload] = useState<{ url: string, title: string, type: 'live' | 'vod' | 'series' } | null>(null);
  
  // Data State (using custom hooks)
  const { accounts } = useAccounts();
  const { servers: savedServers } = useServers();
  
  // View/Selection State
  const [editingAccount, setEditingAccount] = useState<XtreamAccount | null>(null);
  
  // Cross-View State passing
  const [serverToPrefill, setServerToPrefill] = useState<SavedServer | null>(null);
  const [initialSearchQuery, setInitialSearchQuery] = useState<string>('');
  const [accentColor, setAccentColor] = useState(() => {
    return localStorage.getItem('xtream_accent_color') || '#FF0080';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--fluent-accent', accentColor);
    // Simple hover color calculation (adding transparency)
    root.style.setProperty('--fluent-accent-hover', accentColor + 'CC');
    localStorage.setItem('xtream_accent_color', accentColor);
  }, [accentColor]);
  
  // Modal State
  const [modal, setModal] = useState<ModalConfig>({
    isOpen: false,
    type: 'info',
    title: '',
    message: null,
  });

  // Toast State
  const [toast, setToast] = useState<{ message: string; show: boolean }>({ message: '', show: false });

  // Global Search State
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);

  const handleGlobalSearchResult = async (result: any) => {
    setIsGlobalSearchOpen(false);
    
    if (result.type === 'stream') {
      const stream = result.data;
      const account = await db.accounts.get(stream.accountId);
      if (!account) {
        setToast({ message: 'Compte introuvable pour ce flux', show: true });
        setTimeout(() => setToast({ message: '', show: false }), 3000);
        return;
      }

      const baseUrl = `${account.protocol}://${account.host}:${account.port}`;
      let url = '';
      let title = stream.name;
      let type: 'live' | 'vod' | 'series' = stream.type;

      navigate(`/account/${account.id}/${stream.type === 'live' ? 'live' : stream.type === 'movie' ? 'vod' : 'series'}`);
    } else if (result.type === 'epg') {
      const prog = result.data;
      const account = await db.accounts.get(prog.accountId);
      if (account) {
        navigate(`/account/${account.id}/live`);
        setToast({ message: `Programme: ${prog.title}. Allez dans l'onglet Live pour le voir.`, show: true });
        setTimeout(() => setToast({ message: '', show: false }), 4000);
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsGlobalSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
    };

    migrate();
    
    const savedSidebarState = localStorage.getItem('sidebar_collapsed');
    if (savedSidebarState !== null) {
      setIsSidebarCollapsed(savedSidebarState === 'true');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', isSidebarCollapsed.toString());
  }, [isSidebarCollapsed]);

  const closeModal = () => {
    setModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleToast = (message: string) => {
    setToast({ message, show: true });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  const showModal = (
    type: ModalType, 
    title: string, 
    message: React.ReactNode, 
    onConfirm?: () => void,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel"
  ) => {
    setModal({
      isOpen: true,
      type,
      title,
      message,
      onConfirm: onConfirm ? () => { onConfirm(); closeModal(); } : undefined,
      onCancel: closeModal,
      confirmLabel,
      cancelLabel
    });
  };

  // --- Account Logic ---

  const handleSaveAccount = async (account: XtreamAccount, silent = false) => {
    try {
      await db.accounts.put(account);
      
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
    const account = await db.accounts.get(id);
    if (account) {
      await db.accounts.update(id, { isFavorite: !account.isFavorite });
    }
  };

  const deleteAccount = (id: string) => {
    showModal(
      'confirm',
      'Delete Account',
      'Are you sure you want to permanently remove this account? This action cannot be undone.',
      async () => {
        await db.accounts.delete(id);
        await db.clearAccountData(id);
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
      await db.servers.put(server);
      handleToast("Server saved to library");
  };

  const handleDeleteServer = (id: string) => {
      showModal(
          'confirm',
          'Delete Server',
          'Remove this server from your library? Linked accounts will not be deleted.',
          async () => {
             await db.servers.delete(id);
             handleToast("Server removed");
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
      // Create a full backup object including version, accounts, and servers
      const backup: AppBackup = {
          version: '1.0',
          timestamp: Date.now(),
          accounts: accounts,
          servers: savedServers
      };

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
    let importedAccounts: any[] = [];
    let importedServers: any[] = [];

    // Case 1: Legacy Format (Array of accounts)
    if (Array.isArray(data)) {
        importedAccounts = data;
    } 
    // Case 2: New Backup Format (Object)
    else if (typeof data === 'object' && data !== null) {
        if (Array.isArray(data.accounts)) importedAccounts = data.accounts;
        if (Array.isArray(data.servers)) importedServers = data.servers;
    } else {
        showModal('error', 'Import Failed', 'The selected file is invalid or corrupted.');
        return;
    }

    // Process Accounts
    const validAccounts = importedAccounts.filter(acc => 
      acc.host && acc.username && acc.password
    ).map(acc => ({
      ...acc,
      id: acc.id || generateId(),
      status: 'untested' // Reset status on import
    })) as XtreamAccount[];

    // Process Servers
    const validServers = importedServers.filter(srv => 
        srv.host && (srv.protocol === 'http' || srv.protocol === 'https')
    ).map(srv => ({
        ...srv,
        id: srv.id || generateId()
    })) as SavedServer[];

    if (validAccounts.length === 0 && validServers.length === 0) {
      showModal('warning', 'No Data Found', 'No valid accounts or servers were found in the file.');
      return;
    }

    // Merge Accounts
    let newAccountsCount = 0;
    if (validAccounts.length > 0) {
        const existingIds = new Set(accounts.map(a => a.id));
        const uniqueNew = validAccounts.filter(a => !existingIds.has(a.id));
        newAccountsCount = uniqueNew.length;
        if (newAccountsCount > 0) {
            await db.accounts.bulkAdd(uniqueNew);
        }
    }

    // Merge Servers
    let newServersCount = 0;
    if (validServers.length > 0) {
        const existingIds = new Set(savedServers.map(s => s.id));
        const uniqueNew = validServers.filter(s => !existingIds.has(s.id));
        newServersCount = uniqueNew.length;
        if (newServersCount > 0) {
            await db.servers.bulkAdd(uniqueNew);
        }
    }
    
    showModal(
        'success', 
        'Import Successful', 
        `Data restored successfully.\n\nAccounts added: ${newAccountsCount}\nServers added: ${newServersCount}`
    );
  };

  // Helper to determine active view for Sidebar
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
      <TitleBar />

      <div className="flex flex-1 overflow-hidden relative">
        <Routes>
          <Route path="/account/:accountId/*" element={
            <AccountDetailView 
              onBack={() => navigate('/manage-accounts')} 
              onPlayDownload={(url, title, type) => setPlayingDownload({ url, title, type })}
              onOpenSearch={() => setIsGlobalSearchOpen(true)}
            />
          } />
          <Route path="*" element={
            <>
              <Sidebar 
                activeView={getActiveViewForSidebar() as ViewState} 
                setView={(view) => navigate(`/${view}`)} 
                isCollapsed={isSidebarCollapsed}
                onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                onOpenSearch={() => setIsGlobalSearchOpen(true)}
              />
              
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
                      showToast={handleToast}
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
        />
      </div>
    </AcrylicPanel>
  );
}
