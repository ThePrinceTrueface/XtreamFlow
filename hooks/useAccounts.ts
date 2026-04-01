import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { XtreamAccount } from '../types';
import { accountService } from '../services/accountService';

export const useAccounts = () => {
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  
  return {
    accounts,
    saveAccount: accountService.saveAccount,
    deleteAccount: accountService.deleteAccount,
  };
};
