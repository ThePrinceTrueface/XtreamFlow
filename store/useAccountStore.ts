import { create } from 'zustand';
import { db } from '../db';
import { XtreamAccount, SavedServer, AppBackup } from '../types';
import { generateId } from '../utils';

interface AccountState {
  accounts: XtreamAccount[];
  servers: SavedServer[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchAccounts: () => Promise<XtreamAccount[]>;
  fetchServers: () => Promise<SavedServer[]>;
  loadAll: () => Promise<void>;
  
  saveAccount: (account: XtreamAccount) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  toggleFavoriteAccount: (id: string) => Promise<void>;
  
  saveServer: (server: SavedServer) => Promise<void>;
  deleteServer: (id: string) => Promise<void>;
  
  importBackup: (data: any) => Promise<{ accountsAdded: number; serversAdded: number }>;
  exportBackup: () => AppBackup;
  setError: (error: string | null) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: [],
  servers: [],
  isLoading: false,
  error: null,

  fetchAccounts: async () => {
    try {
      const accounts = await db.accounts.toArray();
      set({ accounts });
      return accounts;
    } catch (e: any) {
      console.error("Failed to fetch accounts", e);
      set({ error: e.message || 'Une erreur est survenue lors de la récupération des comptes' });
      return [];
    }
  },

  fetchServers: async () => {
    try {
      const servers = await db.servers.toArray();
      set({ servers });
      return servers;
    } catch (e: any) {
      console.error("Failed to fetch servers", e);
      set({ error: e.message || 'Une erreur est survenue lors de la récupération des serveurs' });
      return [];
    }
  },

  loadAll: async () => {
    set({ isLoading: true, error: null });
    try {
      await Promise.all([get().fetchAccounts(), get().fetchServers()]);
    } catch (e: any) {
      set({ error: e.message || 'Une erreur est survenue lors du chargement des données' });
    } finally {
      set({ isLoading: false });
    }
  },

  saveAccount: async (account) => {
    set({ error: null });
    try {
      await db.accounts.put(account);
      await get().fetchAccounts();
    } catch (e: any) {
      console.error("Failed to save account", e);
      set({ error: e.message || 'Impossible de sauvegarder le compte' });
      throw e;
    }
  },

  deleteAccount: async (id) => {
    set({ error: null });
    try {
      await db.accounts.delete(id);
      await db.deleteAccountData(id);
      await get().fetchAccounts();
    } catch (e: any) {
      console.error("Failed to delete account", e);
      set({ error: e.message || 'Impossible de supprimer le compte' });
      throw e;
    }
  },

  toggleFavoriteAccount: async (id) => {
    try {
      const account = await db.accounts.get(id);
      if (account) {
        await db.accounts.update(id, { isFavorite: !account.isFavorite });
        await get().fetchAccounts();
      }
    } catch (e: any) {
      console.error("Failed to toggle favorite on account", e);
    }
  },

  saveServer: async (server) => {
    try {
      await db.servers.put(server);
      await get().fetchServers();
    } catch (e: any) {
      console.error("Failed to save server", e);
      set({ error: e.message || 'Impossible de sauvegarder le serveur' });
      throw e;
    }
  },

  deleteServer: async (id) => {
    try {
      await db.servers.delete(id);
      await get().fetchServers();
    } catch (e: any) {
      console.error("Failed to delete server", e);
      set({ error: e.message || 'Impossible de supprimer le serveur' });
      throw e;
    }
  },

  importBackup: async (data: any) => {
    let importedAccounts: any[] = [];
    let importedServers: any[] = [];

    if (Array.isArray(data)) {
      importedAccounts = data;
    } else if (typeof data === 'object' && data !== null) {
      if (Array.isArray(data.accounts)) importedAccounts = data.accounts;
      if (Array.isArray(data.servers)) importedServers = data.servers;
    } else {
      throw new Error('Le fichier sélectionné est invalide ou corrompu.');
    }

    // Filtrer et normaliser les comptes
    const validAccounts = importedAccounts.filter(acc => 
      acc.host && acc.username && acc.password
    ).map(acc => ({
      ...acc,
      id: acc.id || generateId(),
      status: 'untested'
    })) as XtreamAccount[];

    // Filtrer et normaliser les serveurs
    const validServers = importedServers.filter(srv => 
      srv.host && (srv.protocol === 'http' || srv.protocol === 'https')
    ).map(srv => ({
      ...srv,
      id: srv.id || generateId()
    })) as SavedServer[];

    if (validAccounts.length === 0 && validServers.length === 0) {
      throw new Error('Aucun compte ou serveur valide n\'a été trouvé dans le fichier.');
    }

    let accountsAdded = 0;
    if (validAccounts.length > 0) {
      const existing = await db.accounts.toArray();
      const existingIds = new Set(existing.map(a => a.id));
      const uniqueNew = validAccounts.filter(a => !existingIds.has(a.id));
      accountsAdded = uniqueNew.length;
      if (accountsAdded > 0) {
        await db.accounts.bulkAdd(uniqueNew);
      }
    }

    let serversAdded = 0;
    if (validServers.length > 0) {
      const existing = await db.servers.toArray();
      const existingIds = new Set(existing.map(s => s.id));
      const uniqueNew = validServers.filter(s => !existingIds.has(s.id));
      serversAdded = uniqueNew.length;
      if (serversAdded > 0) {
        await db.servers.bulkAdd(uniqueNew);
      }
    }

    await get().loadAll();
    return { accountsAdded, serversAdded };
  },

  exportBackup: () => {
    const backup: AppBackup = {
      version: '1.0',
      timestamp: Date.now(),
      accounts: get().accounts,
      servers: get().servers
    };
    return backup;
  },

  setError: (error) => set({ error }),
  setLoading: (isLoading) => set({ isLoading }),
}));
