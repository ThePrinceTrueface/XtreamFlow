import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../db';
import { downloadService } from '../../../src/services/DownloadService';
import { Download, Pause, Play, Trash2, Clock, X, FileVideo, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '../../../components/Win11UI';

export const DownloadManager = ({ onClose, onPlay, accountId }: { onClose?: () => void, onPlay?: (url: string, title: string, type: 'vod' | 'series') => void, accountId?: string }) => {
  const downloads = useLiveQuery(() => {
    let query = db.downloads.orderBy('addedAt').reverse();
    if (accountId) {
      // Dexie doesn't support multiple filters easily with orderBy and reverse
      // So we filter in memory if needed, or use a separate index
      return db.downloads.where('accountId').equals(accountId).reverse().toArray();
    }
    return query.toArray();
  }, [accountId]);

  const handlePlay = async (item: any) => {
    if (!item.fileHandle || !onPlay) return;
    try {
      const file = await item.fileHandle.getFile();
      const url = URL.createObjectURL(file);
      onPlay(url, item.name, item.type === 'movie' ? 'vod' : 'series');
    } catch (error) {
      console.error("Failed to play downloaded file", error);
      alert("Impossible de lire le fichier téléchargé. Il a peut-être été déplacé ou supprimé.");
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="animate-in fade-in h-full flex flex-col w-full">
      <div 
        className="w-full flex-1 flex flex-col overflow-hidden"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-fluent-accent/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-fluent-accent/20 rounded-lg text-fluent-accent">
              <Download size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Gestionnaire de Téléchargements</h2>
              <p className="text-xs text-white/40 uppercase tracking-widest font-semibold">File d'attente & Stockage local</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/60 hover:text-white">
              <X size={24} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {!downloads || downloads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/20">
              <Download size={64} strokeWidth={1} className="mb-4 opacity-20" />
              <p className="text-lg font-medium">Aucun téléchargement en cours</p>
              <p className="text-sm">Vos films et épisodes téléchargés apparaîtront ici.</p>
            </div>
          ) : (
            downloads.map((item) => (
              <div key={item.id} className="bg-white/5 border border-white/5 rounded-xl p-4 group hover:border-white/10 transition-all">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-white/5 rounded-lg text-white/40 group-hover:text-fluent-accent transition-colors">
                    <FileVideo size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-white truncate pr-4">{item.name}</h3>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        item.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        item.status === 'downloading' ? 'bg-fluent-accent/20 text-fluent-accent' :
                        item.status === 'error' ? 'bg-red-500/20 text-red-400' :
                        'bg-white/10 text-white/40'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs text-white/40 mb-3">
                      <span className="flex items-center gap-1"><Clock size={12} /> {new Date(item.addedAt).toLocaleDateString()}</span>
                      {item.totalSize && (
                        <span>{formatSize(item.downloadedSize)} / {formatSize(item.totalSize)}</span>
                      )}
                    </div>

                    {item.status !== 'completed' && item.status !== 'error' && (
                      <div className="relative h-1.5 w-full bg-white/5 rounded-full overflow-hidden mb-4">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${item.progress}%` }}
                          className="absolute inset-y-0 left-0 bg-fluent-accent"
                        />
                      </div>
                    )}

                    {item.error && (
                      <p className="text-xs text-red-400 mb-3 flex items-center gap-1">
                        <AlertCircle size={12} /> {item.error}
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      {item.status === 'completed' && (
                        <Button variant="primary" onClick={() => handlePlay(item)} className="h-8 !px-3 text-xs bg-green-600 hover:bg-green-700">
                          <Play size={14} fill="currentColor" /> Lire
                        </Button>
                      )}
                      {item.status === 'downloading' && (
                        <Button variant="secondary" onClick={() => downloadService.pauseDownload(item.id)} className="h-8 !px-3 text-xs">
                          <Pause size={14} /> Pause
                        </Button>
                      )}
                      {(item.status === 'paused' || item.status === 'error') && (
                        <Button variant="secondary" onClick={() => downloadService.resumeDownload(item.id)} className="h-8 !px-3 text-xs">
                          <Play size={14} /> Reprendre
                        </Button>
                      )}
                      <Button variant="secondary" onClick={() => downloadService.removeDownload(item.id)} className="h-8 !px-3 text-xs hover:bg-red-500/20 hover:text-red-400 border-transparent">
                        <Trash2 size={14} /> Supprimer
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
