import { db } from '../db';
import { SavedServer } from '../types';

export const serverService = {
  getAllServers: async (): Promise<SavedServer[]> => {
    return await db.servers.toArray();
  },
  saveServer: async (server: SavedServer): Promise<void> => {
    await db.servers.put(server);
  },
  deleteServer: async (id: string): Promise<void> => {
    await db.servers.delete(id);
  }
};
