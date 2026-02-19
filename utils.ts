
import { XtreamAccount } from './types';

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const createProxyUrl = (targetUrl: string) => {
  const proxyBase = "https://proxygo.princetrueface.workers.dev/";
  return `${proxyBase}?url=${encodeURIComponent(targetUrl)}`;
};

export const parseXtreamUrl = (url: string): Partial<XtreamAccount> | null => {
  if (!url || typeof url !== 'string') return null;
  
  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);
    
    const username = params.get('username');
    const password = params.get('password');
    
    if (!username || !password) return null;

    return {
      protocol: urlObj.protocol.replace(':', '') as 'http' | 'https',
      host: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80'),
      username,
      password
    };
  } catch (e) {
    return null;
  }
};

export const formatDate = (timestamp: string | number) => {
  if (!timestamp) return 'Never';
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

export const calculateDaysRemaining = (timestamp: string | number) => {
  if (!timestamp) return 0;
  const exp = Number(timestamp) * 1000;
  const now = Date.now();
  const diff = exp - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

export const checkConnection = async (account: Partial<XtreamAccount>): Promise<{ success: boolean; message?: string }> => {
    if (!account.host || !account.username || !account.password) {
        return { success: false, message: 'Missing credentials' };
    }
    
    const port = account.port || '80';
    const protocol = account.protocol || 'http';
    const targetUrl = `${protocol}://${account.host}:${port}/player_api.php?username=${account.username}&password=${account.password}`;
    const proxyUrl = createProxyUrl(targetUrl);

    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Network error');
        
        const data = await response.json();
        // Xtream API returns user_info.auth = 1 on success
        if (data && data.user_info && data.user_info.auth === 1) {
            return { success: true };
        } else {
            return { success: false, message: 'Invalid credentials or expired' };
        }
    } catch (error: any) {
        return { success: false, message: error.message || 'Connection failed' };
    }
};

// --- Web Worker Shim Helper ---
export const createInlineWorker = (workerCode: string): Worker => {
  const blob = new Blob([workerCode], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  return new Worker(url);
};
