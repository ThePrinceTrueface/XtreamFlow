
import React, { useState, useEffect } from 'react';
import { Link as LinkIcon, Star, Tag, X, Trash2, AlertCircle, Server, ChevronDown, Activity, CheckCircle2, Loader2 } from 'lucide-react';
import { XtreamAccount, SavedServer } from '../types';
import { Card, Button, Input } from '../components/Win11UI';
import { parseXtreamUrl, generateId, checkConnection } from '../utils';

export const AddAccount: React.FC<{ 
  onSave: (account: XtreamAccount) => void; 
  initialData?: XtreamAccount | null;
  onCancel: () => void;
  onDelete?: (id: string) => void;
  savedServers?: SavedServer[];
  prefillServer?: SavedServer | null;
}> = ({ onSave, initialData, onCancel, onDelete, savedServers = [], prefillServer = null }) => {
  const [mode, setMode] = useState<'url' | 'manual'>('url');
  const [urlInput, setUrlInput] = useState('');
  
  // Manual State
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [port, setPort] = useState('80');
  const [protocol, setProtocol] = useState<'http' | 'https'>('http');
  const [name, setName] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<'active' | 'error' | 'untested'>('untested');
  
  // Tags State
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean; message: string} | null>(null);
  
  // Load initial data if editing
  useEffect(() => {
    if (initialData) {
      setMode('manual');
      setHost(initialData.host);
      setUsername(initialData.username);
      setPassword(initialData.password);
      setPort(initialData.port);
      setProtocol(initialData.protocol);
      setName(initialData.name);
      setIsFavorite(initialData.isFavorite || false);
      setTags(initialData.tags || []);
      setCurrentStatus(initialData.status);
    } else if (prefillServer) {
      // Logic for creating NEW account from a Saved Server
      setMode('manual');
      setHost(prefillServer.host);
      setPort(prefillServer.port);
      setProtocol(prefillServer.protocol);
      setTags(prefillServer.tags || []);
      // Reset User/Pass in case we switched views quickly
      setUsername('');
      setPassword('');
      setName('');
      setCurrentStatus('untested');
    }
  }, [initialData, prefillServer]);

  const handleUrlParse = () => {
    setError(null);
    
    if (!urlInput.trim()) {
      setError("Please paste a valid Xtream URL.");
      return;
    }

    const parsed = parseXtreamUrl(urlInput);
    if (parsed && parsed.host && parsed.username && parsed.password) {
      // Auto-fill manual fields
      setHost(parsed.host);
      setUsername(parsed.username);
      setPassword(parsed.password);
      setPort(parsed.port || '80');
      setProtocol(parsed.protocol || 'http');
      setMode('manual'); // Switch to review
    } else {
      setError("Could not extract credentials automatically. Try entering details manually.");
    }
  };

  const handleSelectServer = (serverId: string) => {
    const server = savedServers.find(s => s.id === serverId);
    if (server) {
      setHost(server.host);
      setPort(server.port);
      setProtocol(server.protocol);
      // Optional: Auto-add server tags to account
      // const combinedTags = Array.from(new Set([...tags, ...server.tags]));
      // setTags(combinedTags);
    }
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleTestConnection = async () => {
    if (!host || !username || !password) {
        setError("Please enter Host, Username and Password before testing.");
        return;
    }
    setError(null);
    setIsTesting(true);
    setTestResult(null);

    const tempAccount: Partial<XtreamAccount> = {
        host, port, username, password, protocol
    };

    const result = await checkConnection(tempAccount);
    setIsTesting(false);
    
    if (result.success) {
        setCurrentStatus('active');
        setTestResult({ success: true, message: "Connection successful! Account is active." });
    } else {
        setCurrentStatus('error');
        setTestResult({ success: false, message: result.message || "Connection failed." });
    }
  };

  const handleSubmit = () => {
    if (!host || !username || !password) {
      setError("Host, Username, and Password are required.");
      return;
    }

    const newAccount: XtreamAccount = {
      id: initialData ? initialData.id : generateId(),
      name: name || `${host} (${username})`,
      host,
      port,
      username,
      password,
      protocol,
      status: currentStatus,
      addedAt: initialData ? initialData.addedAt : Date.now(),
      isFavorite,
      tags
    };

    onSave(newAccount);
    
    // Clear form if adding new
    if (!initialData) {
      setUrlInput('');
      setHost('');
      setUsername('');
      setPassword('');
      setName('');
      setIsFavorite(false);
      setTags([]);
      setCurrentStatus('untested');
      setTestResult(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-2">{initialData ? 'Edit Account' : 'Connect New Account'}</h2>
        <p className="text-win-subtext">
          {initialData ? 'Update your subscription details below.' : 'Add your IPTV subscription via Xtream Codes API.'}
        </p>
      </div>

      {!initialData && (
        <div className="flex gap-2 mb-6 bg-black/20 p-1 rounded-lg w-fit">
          <button 
            onClick={() => setMode('url')}
            className={`px-4 py-1.5 rounded-md text-sm transition-all ${mode === 'url' ? 'bg-win-card shadow-sm text-white' : 'text-win-subtext hover:text-white'}`}
          >
            From URL
          </button>
          <button 
            onClick={() => setMode('manual')}
            className={`px-4 py-1.5 rounded-md text-sm transition-all ${mode === 'manual' ? 'bg-win-card shadow-sm text-white' : 'text-win-subtext hover:text-white'}`}
          >
            Manual Entry
          </button>
        </div>
      )}

      <Card>
        {mode === 'url' ? (
          <div className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg flex gap-3 text-blue-200 mb-4">
              <LinkIcon size={20} className="shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold mb-1">Paste your M3U or Xtream API link</p>
                <p className="opacity-80">We'll try to extract the host, username, and password automatically.</p>
              </div>
            </div>
            <Input 
              label="Xtream / M3U URL" 
              placeholder="http://domain.com:8080/get.php?username=user&password=pass"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
            />
            <div className="flex justify-end mt-4">
              <Button onClick={handleUrlParse}>Analyze Link</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
             <div className="flex justify-between items-start mb-2">
                 <div className="text-sm text-win-subtext">Account Details</div>
                 <button 
                   onClick={() => setIsFavorite(!isFavorite)}
                   className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all
                     ${isFavorite 
                       ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' 
                       : 'bg-white/5 text-win-subtext border border-white/10 hover:bg-white/10'
                     }`}
                 >
                   <Star size={12} fill={isFavorite ? "currentColor" : "none"} />
                   {isFavorite ? 'Favorited' : 'Add to Favorites'}
                 </button>
             </div>
             
             {/* Server Quick Select */}
             {savedServers.length > 0 && !initialData && !prefillServer && (
                <div className="col-span-2 mb-4">
                   <label className="text-xs text-fluent-accent font-medium mb-1.5 block flex items-center gap-1">
                      <Server size={12} /> Quick Load from Library
                   </label>
                   <div className="relative">
                      <select 
                         className="w-full bg-fluent-accent/5 border border-fluent-accent/20 rounded-control h-[36px] px-3 text-sm text-white appearance-none focus:border-fluent-accent outline-none"
                         onChange={(e) => handleSelectServer(e.target.value)}
                         defaultValue=""
                      >
                         <option value="" disabled>Select a saved server to auto-fill...</option>
                         {savedServers.map(s => (
                            <option key={s.id} value={s.id}>{s.alias} ({s.host})</option>
                         ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-fluent-subtext pointer-events-none" />
                   </div>
                </div>
             )}

             <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Friendly Name (Optional)" 
                  placeholder="e.g., Living Room TV"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="col-span-2"
                />
                
                {/* Tags Input */}
                <div className="col-span-2">
                  <label className="text-sm text-win-subtext ml-0.5 mb-2 block">Tags</label>
                  <div className="flex gap-2 mb-3">
                    <div className="relative group flex-1">
                        <input
                          className="w-full bg-black/20 border border-win-border group-hover:border-white/20 rounded-[6px] px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-win-primary focus:bg-black/30 transition-all"
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                          placeholder="Type a tag (e.g. Cinema, Fast) and press Enter..."
                        />
                         <div className="absolute bottom-0 left-0 h-[1px] w-full bg-transparent group-focus-within:bg-win-primary transition-colors rounded-b-[6px]" />
                    </div>
                    <Button variant="secondary" onClick={handleAddTag} disabled={!tagInput.trim()}>Add</Button>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-3 bg-black/20 rounded-lg border border-win-border">
                        {tags.map(tag => (
                        <span key={tag} className="bg-win-primary/10 text-win-primary border border-win-primary/20 px-2.5 py-1 rounded-[6px] text-xs flex items-center gap-1.5 select-none animate-in zoom-in duration-200">
                            <Tag size={10} />
                            {tag}
                            <button onClick={() => handleRemoveTag(tag)} className="hover:text-white transition-colors ml-1 p-0.5 hover:bg-white/10 rounded">
                                <X size={12} />
                            </button>
                        </span>
                        ))}
                    </div>
                  )}
                </div>

                <div className="col-span-2 sm:col-span-1">
                   <label className="text-sm text-win-subtext ml-0.5 mb-2 block">Protocol</label>
                   <div className="flex bg-black/20 rounded-[6px] p-1 border border-win-border">
                     {['http', 'https'].map((p) => (
                       <button
                        key={p}
                        onClick={() => setProtocol(p as 'http' | 'https')}
                        className={`flex-1 py-1 rounded-[4px] text-sm uppercase ${protocol === p ? 'bg-white/10 text-white' : 'text-win-subtext'}`}
                       >
                         {p}
                       </button>
                     ))}
                   </div>
                </div>
                <Input 
                  label="Host / Server URL" 
                  placeholder="domain.com"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  className="col-span-2 sm:col-span-1"
                />
                <Input 
                  label="Port" 
                  placeholder="8080"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                />
                <Input 
                  label="Username" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <Input 
                  label="Password" 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
             </div>

             {/* Test Result Area */}
             {testResult && (
                 <div className={`mt-2 p-3 rounded-lg border text-sm flex items-start gap-2 animate-in fade-in
                    ${testResult.success ? 'bg-green-500/10 border-green-500/20 text-green-200' : 'bg-red-500/10 border-red-500/20 text-red-200'}`}>
                     {testResult.success ? <CheckCircle2 size={18} className="shrink-0"/> : <AlertCircle size={18} className="shrink-0"/>}
                     <span>{testResult.message}</span>
                 </div>
             )}
             
             <div className="flex justify-between items-center mt-6 pt-4 border-t border-win-border">
                {/* Delete Button (Only in Edit Mode) */}
                <div>
                   {initialData && onDelete && (
                     <Button 
                       variant="ghost" 
                       className="text-red-400 hover:bg-red-500/10 hover:text-red-300 px-2"
                       onClick={() => onDelete(initialData.id)}
                     >
                       <Trash2 size={16} /> Delete
                     </Button>
                   )}
                </div>

                <div className="flex gap-2">
                    <Button variant="ghost" onClick={initialData ? onCancel : () => setMode('url')}>
                      {initialData ? 'Cancel' : 'Back'}
                    </Button>
                    <Button variant="secondary" onClick={handleTestConnection} disabled={isTesting}>
                        {isTesting ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />}
                        Test Connection
                    </Button>
                    <Button onClick={handleSubmit}>{initialData ? 'Update Account' : 'Save Account'}</Button>
                </div>
             </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-md flex items-center gap-2 text-red-200 text-sm animate-in fade-in">
            <AlertCircle size={16} /> {error}
          </div>
        )}
      </Card>
    </div>
  );
};
