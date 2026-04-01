import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { SavedServer } from '../types';
import { serverService } from '../services/serverService';

export const useServers = () => {
  const servers = useLiveQuery(() => db.servers.toArray()) || [];
  
  return {
    servers,
    saveServer: serverService.saveServer,
    deleteServer: serverService.deleteServer,
  };
};
