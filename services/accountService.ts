import { db } from '../db';
import { XtreamAccount } from '../types';

export const accountService = {
  getAllAccounts: async (): Promise<XtreamAccount[]> => {
    return await db.accounts.toArray();
  },
  saveAccount: async (account: XtreamAccount): Promise<void> => {
    await db.accounts.put(account);
  },
  deleteAccount: async (id: string): Promise<void> => {
    await db.accounts.delete(id);
  }
};
