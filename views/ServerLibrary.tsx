import React, { useState } from 'react';
import { Server, Plus, Trash2, Tag, Edit3, Globe, Shield, X, Save, AlertCircle, UserPlus, ListFilter } from 'lucide-react';
import { SavedServer } from '../types';
import { Card, Button, Input } from '../components/Win11UI';
import { generateId } from '../utils';

export const ServerLibrary: React.FC<{ 
  servers: SavedServer[]; 
  onSave: (server: SavedServer) => void; 
  onDelete: (id: string) => void;
  onAddAccount: (server: SavedServer) => void;
  onViewAccounts: (server: SavedServer) => void;
}> = ({ servers, onSave, onDelete, onAddAccount, onViewAccounts }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form State
  const [alias, setAlias] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('80');
  const [protocol, setProtocol] = useState<'http' | 'https'>('http');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  
  // Validation State
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setAlias('');
    setHost('');
    setPort('80');
    setProtocol('http');
    setDescription('');
    setTags([]);
    setEditId(null);
    setError(null);
    setIsEditing(false);
  };

  const handleEdit = (server: SavedServer) => {
    setAlias(server.alias);
    setHost(server.host);
    setPort(server.port);
    setProtocol(server.protocol);
    setDescription(server.description || '');
    setTags(server.tags || []);
    setEditId(server.id);
    setError(null);
    setIsEditing(true);
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const removeTag = (t: string) => {
    setTags(tags.filter(tag => tag !== t));
  };

  const handleSubmit = () => {
    setError(null);

    // Host is mandatory
    if (!host.trim()) {
        setError("Please enter the Host URL or IP.");
        return;
    }

    let processedHost = host.trim();
    let processedProtocol = protocol;

    // Basic URL Sanitization: Remove protocol if pasted in host field
    if (processedHost.startsWith('https://')) {
        processedProtocol = 'https';
        processedHost = processedHost.substring(8);
    } else if (processedHost.startsWith('http://')) {
        processedProtocol = 'http';
        processedHost = processedHost.substring(7);
    }

    // Remove trailing slash
    if (processedHost.endsWith('/')) {
        processedHost = processedHost.slice(0, -1);
    }

    // Default alias to host if empty
    const finalAlias = alias.trim() || processedHost;

    const newServer: SavedServer = {
      id: editId || generateId(),
      alias: finalAlias,
      host: processedHost,
      port: port.trim(),
      protocol: processedProtocol,
      tags,
      description: description.trim(),
      addedAt: Date.now()
    };

    onSave(newServer);
    resetForm();
  };

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col animate-in fade-in">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold mb-1">Server Library</h2>
          <p className="text-fluent-subtext">Save your favorite providers' host details for quick access.</p>
        </div>
        {!isEditing && (
            <Button onClick={() => setIsEditing(true)}>
                <Plus size={16} /> Add Server
            </Button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-6 h-full overflow-hidden">
        {/* Left: List of Servers */}
        <div className={`flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3 ${isEditing ? 'hidden md:block' : ''}`}>
           {servers.length === 0 ? (
               <div className="text-center p-8 border border-dashed border-white/10 rounded-xl text-fluent-subtext">
                   <Server size={32} className="mx-auto mb-3 opacity-50" />
                   <p>No saved servers yet.</p>
               </div>
           ) : (
               servers.map(server => (
                   <div 
                     key={server.id} 
                     className="bg-fluent-layer hover:bg-fluent-layerHover border border-fluent-border p-4 rounded-window transition-all group"
                   >
                       <div className="flex justify-between items-start mb-2">
                           <div className="flex items-center gap-2">
                               <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                                   <Globe size={16} />
                               </div>
                               <div>
                                   <h3 className="font-semibold text-white leading-tight">{server.alias}</h3>
                                   <div className="text-xs text-fluent-subtext font-mono mt-0.5">
                                       {server.protocol}://{server.host}:{server.port}
                                   </div>
                               </div>
                           </div>
                           <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                               <Button 
                                    className="!px-2 !py-1 text-fluent-accent hover:bg-fluent-accent/10 hover:text-fluent-accentHover border border-fluent-accent/20"
                                    onClick={() => onAddAccount(server)}
                                    title="Add Account from this Server"
                                >
                                   <UserPlus size={14} />
                               </Button>
                               <Button 
                                    variant="secondary" 
                                    className="!px-2 !py-1" 
                                    onClick={() => onViewAccounts(server)}
                                    title="View Accounts using this Server"
                                >
                                   <ListFilter size={14} />
                               </Button>
                               <Button variant="secondary" className="!px-2 !py-1" onClick={() => handleEdit(server)}>
                                   <Edit3 size={14} />
                               </Button>
                               <Button variant="danger" className="!px-2 !py-1" onClick={() => onDelete(server.id)}>
                                   <Trash2 size={14} />
                               </Button>
                           </div>
                       </div>
                       
                       {server.description && (
                           <p className="text-sm text-white/70 mb-3 line-clamp-2">{server.description}</p>
                       )}

                       {server.tags && server.tags.length > 0 && (
                           <div className="flex flex-wrap gap-1.5">
                               {server.tags.map(tag => (
                                   <span key={tag} className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-fluent-subtext flex items-center gap-1">
                                       <Tag size={10} /> {tag}
                                   </span>
                               ))}
                           </div>
                       )}
                   </div>
               ))
           )}
        </div>

        {/* Right: Add/Edit Form */}
        {isEditing && (
            <div className="w-full md:w-[400px] shrink-0 overflow-y-auto custom-scrollbar animate-in slide-in-from-right-4 fade-in pb-4">
                <Card className="h-fit">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">{editId ? 'Edit Server' : 'New Server'}</h3>
                        <button onClick={resetForm} className="text-fluent-subtext hover:text-white"><X size={18}/></button>
                    </div>

                    <div className="space-y-4">
                        <Input 
                            label="Friendly Name (Optional)" 
                            placeholder="Defaults to Host if empty" 
                            value={alias}
                            onChange={(e) => setAlias(e.target.value)}
                        />
                        
                        <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-1">
                                <label className="text-[13px] text-fluent-text font-normal mb-1.5 block">Protocol</label>
                                <select 
                                    className="w-full bg-white/5 border border-white/10 rounded-control h-[32px] px-2 text-sm text-white outline-none focus:border-fluent-accent"
                                    value={protocol}
                                    onChange={(e) => setProtocol(e.target.value as 'http' | 'https')}
                                >
                                    <option value="http">HTTP</option>
                                    <option value="https">HTTPS</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <Input 
                                    label="Host / URL" 
                                    placeholder="line.srv-ip.com"
                                    value={host}
                                    onChange={(e) => setHost(e.target.value)}
                                />
                            </div>
                        </div>

                        <Input 
                            label="Port" 
                            placeholder="80 or 8080" 
                            value={port}
                            onChange={(e) => setPort(e.target.value)}
                        />

                        <div>
                            <label className="text-[13px] text-fluent-text font-normal mb-1.5 block">Description (Optional)</label>
                            <textarea 
                                className="w-full bg-white/5 border border-white/10 rounded-control p-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-fluent-accent min-h-[80px]"
                                placeholder="Notes about stability, content..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>

                        <div>
                             <label className="text-[13px] text-fluent-text font-normal mb-1.5 block">Tags</label>
                             <div className="flex gap-2 mb-2">
                                 <input 
                                    className="flex-1 bg-white/5 border border-white/10 rounded-control h-[32px] px-3 text-sm text-white focus:outline-none focus:border-fluent-accent"
                                    placeholder="Add tag..."
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                                 />
                                 <Button variant="secondary" onClick={handleAddTag}>Add</Button>
                             </div>
                             <div className="flex flex-wrap gap-2">
                                 {tags.map(tag => (
                                     <span key={tag} className="bg-fluent-accent/10 text-fluent-accent px-2 py-1 rounded text-xs flex items-center gap-1 border border-fluent-accent/20">
                                         {tag}
                                         <button onClick={() => removeTag(tag)} className="hover:text-white"><X size={12}/></button>
                                     </span>
                                 ))}
                             </div>
                        </div>
                        
                        {error && (
                            <div className="flex items-start gap-2 text-red-300 bg-red-500/10 p-3 rounded-md text-sm">
                                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="pt-4 mt-2 border-t border-white/5 flex justify-end gap-2">
                            <Button variant="ghost" onClick={resetForm}>Cancel</Button>
                            <Button onClick={handleSubmit}>
                                <Save size={16} /> Save Server
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        )}
      </div>
    </div>
  );
};