
import { XtreamAccount } from './types';

// Helper to decode Base64 strings safely and fix encoding issues (Mojibake)
export const decodeBase64 = (str: string) => {
    if (!str) return "";
    let decoded = str;

    // 1. Try Base64 decoding if it looks like Base64 (no spaces, valid chars)
    if (!str.includes(' ') && /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/.test(str)) {
         try {
             const raw = window.atob(str);
             // Real UTF-8 text shouldn't have many control chars (0-31), except \t, \n, \r.
             if (!/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(raw)) {
                 decoded = raw;
             }
         } catch (e) {
             // Not base64
         }
    }

    // 2. Fix UTF-8 interpreted as Latin-1 (Mojibake)
    try {
        return decodeURIComponent(escape(decoded));
    } catch (e) {
        return decoded;
    }
};

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
      // Force http for Xtream accounts
      protocol: 'http',
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

export const checkConnection = async (account: Partial<XtreamAccount>): Promise<{ success: boolean; message?: string, protocol?: 'http' | 'https', port?: string }> => {
    if (!account.host || !account.username || !account.password) {
        return { success: false, message: 'Missing credentials' };
    }
    
    const port = account.port || '80';
    const protocol = account.protocol || 'http';
    
    const tryConnect = async (proto: string, prt: string) => {
        const targetUrl = `${proto}://${account.host}:${prt}/player_api.php?username=${account.username}&password=${account.password}`;
        const proxyUrl = createProxyUrl(targetUrl);
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Network error');
        
        const data = await response.json();
        // Xtream API returns user_info.auth = 1 on success
        if (data && data.user_info && data.user_info.auth === 1) {
            return data;
        } else {
            throw new Error('Invalid credentials or expired');
        }
    };

    try {
        await tryConnect(protocol, port);
        return { success: true, protocol, port };
    } catch (error: any) {
        // If HTTP fails, it might be due to a CORS error caused by a redirect to HTTPS.
        // Let's try HTTPS automatically.
        if (protocol === 'http') {
            try {
                const newPort = port === '80' ? '443' : port;
                await tryConnect('https', newPort);
                return { success: true, protocol: 'https', port: newPort };
            } catch (httpsError: any) {
                return { success: false, message: error.message || 'Connection failed' };
            }
        }
        return { success: false, message: error.message || 'Connection failed' };
    }
};

// --- Web Worker Shim Helper ---
export const createInlineWorker = (workerCode: string): Worker => {
  const blob = new Blob([workerCode], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  return new Worker(url);
};
