
import React, { useState, useEffect } from 'react';
import { CheckCircle2, Minus, Square, X } from 'lucide-react';
import { XtreamAccount, ViewState, ModalConfig, ModalType, SavedServer, AppBackup } from './types';
import { AcrylicPanel, Modal } from './components/Win11UI';
import { generateId } from './utils';

// Views & Components
import { Sidebar } from './components/Sidebars';
import { Dashboard } from './views/Dashboard';
import { AddAccount } from './views/AddAccount';
import { AccountList } from './views/AccountList';
import { SettingsView } from './views/SettingsView';
import { AccountDetailView } from './views/account/AccountDetailView';
import { ServerLibrary } from './views/ServerLibrary';

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
  const [activeView, setActiveView] = useState<ViewState>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Data State
  const [accounts, setAccounts] = useState<XtreamAccount[]>([]);
  const [savedServers, setSavedServers] = useState<SavedServer[]>([]);
  
  // View/Selection State
  const [editingAccount, setEditingAccount] = useState<XtreamAccount | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<XtreamAccount | null>(null);
  
  // Cross-View State passing
  const [serverToPrefill, setServerToPrefill] = useState<SavedServer | null>(null);
  const [initialSearchQuery, setInitialSearchQuery] = useState<string>('');
  
  // Modal State
  const [modal, setModal] = useState<ModalConfig>({
    isOpen: false,
    type: 'info',
    title: '',
    message: null,
  });

  // Toast State
  const [toast, setToast] = useState<{ message: string; show: boolean }>({ message: '', show: false });

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('xtream_accounts');
    const savedSrv = localStorage.getItem('xtream_servers');
    const savedSidebarState = localStorage.getItem('sidebar_collapsed');
    
    if (saved) {
      try {
        setAccounts(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load accounts", e);
      }
    }
    
    if (savedSrv) {
        try {
            setSavedServers(JSON.parse(savedSrv));
        } catch (e) {
            console.error("Failed to load servers", e);
        }
    }

    if (savedSidebarState !== null) {
      setIsSidebarCollapsed(savedSidebarState === 'true');
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    localStorage.setItem('xtream_accounts', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
      localStorage.setItem('xtream_servers', JSON.stringify(savedServers));
  }, [savedServers]);

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

  const handleSaveAccount = (account: XtreamAccount, silent = false) => {
    setAccounts(prev => {
      const exists = prev.find(a => a.id === account.id);
      if (exists) {
        return prev.map(a => a.id === account.id ? account : a);
      }
      return [...prev, account];
    });
    
    if (!silent) {
        showModal(
          'success',
          'Account Saved',
          `The account "${account.name}" has been successfully ${editingAccount ? 'updated' : 'added'}.`,
          () => {
             setEditingAccount(null);
             setActiveView('manage-accounts');
          },
          "OK"
        );
    }
  };

  const toggleFavorite = (id: string) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, isFavorite: !a.isFavorite } : a));
  };

  const deleteAccount = (id: string) => {
    showModal(
      'confirm',
      'Delete Account',
      'Are you sure you want to permanently remove this account? This action cannot be undone.',
      () => {
        setAccounts(prev => prev.filter(a => a.id !== id));
        if (editingAccount?.id === id) {
          setEditingAccount(null);
          setActiveView('manage-accounts');
        }
      },
      'Delete',
      'Cancel'
    );
  };

  const startEditing = (account: XtreamAccount) => {
    setEditingAccount(account);
    setActiveView('edit-account');
  };

  const cancelEditing = () => {
    setEditingAccount(null);
    setActiveView('manage-accounts');
  };

  // --- Server Library Logic ---

  const handleSaveServer = (server: SavedServer) => {
      setSavedServers(prev => {
          const exists = prev.find(s => s.id === server.id);
          if (exists) {
              return prev.map(s => s.id === server.id ? server : s);
          }
          return [...prev, server];
      });
      handleToast("Server saved to library");
  };

  const handleDeleteServer = (id: string) => {
      showModal(
          'confirm',
          'Delete Server',
          'Remove this server from your library? Linked accounts will not be deleted.',
          () => {
             setSavedServers(prev => prev.filter(s => s.id !== id));
             handleToast("Server removed");
          }
      );
  };

  const handleAddAccountFromServer = (server: SavedServer) => {
      setServerToPrefill(server);
      setActiveView('add-account');
  };

  const handleViewServerAccounts = (server: SavedServer) => {
      setInitialSearchQuery(server.host);
      setActiveView('manage-accounts');
  };

  // --- Navigation Logic ---

  const handleSetView = (view: ViewState) => {
    if (view !== 'edit-account') {
      setEditingAccount(null);
    }
    // If we leave account detail, clear selection
    if (view !== 'account-detail') {
      setSelectedAccount(null);
    }
    // Clear prefill server if leaving add-account or explicitly changing views
    if (view !== 'add-account') {
        setServerToPrefill(null);
    }
    // Clear search query if explicitly navigating to list (not from Server Library redirection)
    if (view !== 'manage-accounts' && activeView !== 'server-library') {
        setInitialSearchQuery('');
    }
    
    setActiveView(view);
  };

  const handleSelectAccount = (account: XtreamAccount) => {
    setSelectedAccount(account);
    setActiveView('account-detail');
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

  const handleImportData = (data: any) => {
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
        setAccounts(prev => {
            const existingIds = new Set(prev.map(a => a.id));
            const uniqueNew = validAccounts.filter(a => !existingIds.has(a.id));
            newAccountsCount = uniqueNew.length;
            return [...prev, ...uniqueNew];
        });
    }

    // Merge Servers
    let newServersCount = 0;
    if (validServers.length > 0) {
        setSavedServers(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const uniqueNew = validServers.filter(s => !existingIds.has(s.id));
            newServersCount = uniqueNew.length;
            return [...prev, ...uniqueNew];
        });
    }
    
    showModal(
        'success', 
        'Import Successful', 
        `Data restored successfully.\n\nAccounts added: ${newAccountsCount}\nServers added: ${newServersCount}`
    );
  };

  return (
    <AcrylicPanel>
      {/* Window Title Bar */}
      <TitleBar />

      <div className="flex flex-1 overflow-hidden relative">
        {activeView === 'account-detail' && selectedAccount ? (
           <AccountDetailView 
              account={selectedAccount} 
              onBack={() => handleSetView('manage-accounts')} 
           />
        ) : (
          <>
            <Sidebar 
              activeView={activeView === 'edit-account' ? 'manage-accounts' : activeView} 
              setView={handleSetView} 
              isCollapsed={isSidebarCollapsed}
              onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />
            
            <main className="flex-1 overflow-y-auto p-6 md:p-8 relative scroll-smooth bg-transparent transition-all duration-300">
              {activeView === 'dashboard' && <Dashboard accounts={accounts} setView={handleSetView} />}
              
              {activeView === 'add-account' && (
                <AddAccount 
                    onSave={handleSaveAccount} 
                    onCancel={() => handleSetView('dashboard')} 
                    savedServers={savedServers}
                    prefillServer={serverToPrefill}
                />
              )}

              {activeView === 'edit-account' && (
                <AddAccount 
                  onSave={handleSaveAccount} 
                  initialData={editingAccount} 
                  onCancel={cancelEditing} 
                  onDelete={deleteAccount}
                  savedServers={savedServers}
                />
              )}

              {activeView === 'manage-accounts' && (
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
              )}

              {activeView === 'server-library' && (
                  <ServerLibrary 
                      servers={savedServers} 
                      onSave={handleSaveServer} 
                      onDelete={handleDeleteServer}
                      onAddAccount={handleAddAccountFromServer}
                      onViewAccounts={handleViewServerAccounts}
                  />
              )}
              
              {activeView === 'settings' && (
                <SettingsView 
                    accounts={accounts} 
                    onImport={handleImportData} 
                    onExport={handleExportData}
                />
              )}
            </main>
          </>
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
      </div>
    </AcrylicPanel>
  );
}
