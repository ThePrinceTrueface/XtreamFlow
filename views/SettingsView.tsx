
import React, { useRef, useState, useEffect } from 'react';
import { Database, Download, Upload, Settings as SettingsIcon, Loader2, Palette } from 'lucide-react';
import { XtreamAccount } from '../types';
import { Card, Button } from '../components/Win11UI';
import { createInlineWorker } from '../utils';
import { FILE_WORKER_CODE } from '../workers/file.worker';

const ACCENT_COLORS = [
  { name: 'Pink', value: '#FF0080' },
  { name: 'Blue', value: '#0078D4' },
  { name: 'Purple', value: '#881798' },
  { name: 'Green', value: '#107C10' },
  { name: 'Red', value: '#E81123' },
  { name: 'Orange', value: '#D83B01' },
  { name: 'Teal', value: '#00B7C3' },
  { name: 'Yellow', value: '#FFB900' },
  { name: 'Mint', value: '#00CC6A' },
  { name: 'Magenta', value: '#C239B3' },
  { name: 'Slate', value: '#607D8B' },
  { name: 'Indigo', value: '#4B0082' },
];

export const SettingsView: React.FC<{ 
  accounts: XtreamAccount[]; 
  onImport: (data: any) => void; 
  onExport: () => void;
  accentColor: string;
  onAccentColorChange: (color: string) => void;
}> = ({ accounts, onImport, onExport, accentColor, onAccentColorChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Initialize Worker
    try {
        workerRef.current = createInlineWorker(FILE_WORKER_CODE);
        
        workerRef.current.onmessage = (e) => {
            const { type, data, error } = e.data;
            if (type === 'SUCCESS') {
                onImport(data);
                setIsProcessing(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            } else if (type === 'ERROR') {
                console.error("Worker Import Error:", error);
                alert(`Import Failed: ${error}`);
                setIsProcessing(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
    } catch (e) {
        console.error("Failed to initialize worker", e);
    }

    return () => {
        workerRef.current?.terminate();
    };
  }, [onImport]);

  const handleImportClick = () => {
    if (isProcessing) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileObj = event.target.files && event.target.files[0];
    if (!fileObj) return;

    setIsProcessing(true);

    if (workerRef.current) {
        // Offload to worker
        workerRef.current.postMessage({ file: fileObj });
    } else {
        // Fallback if worker failed to init
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                onImport(json);
            } catch (err) {
                console.error("Invalid JSON file:", err);
                alert("Le fichier sélectionné n'est pas un fichier JSON valide.");
            } finally {
                setIsProcessing(false);
            }
        };
        reader.onerror = (e) => {
            console.error("Error reading file:", e);
            alert("Erreur lors de la lecture du fichier.");
            setIsProcessing(false);
        };
        reader.readAsText(fileObj);
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in">
      <h2 className="text-2xl font-semibold mb-6">Settings</h2>
      <div className="space-y-6">
        <Card>
          <div className="flex items-start gap-4">
             <div className="p-3 bg-pink-500/10 rounded-lg text-pink-400" style={{ color: accentColor, backgroundColor: accentColor + '1A' }}>
                <Palette size={24} />
             </div>
             <div className="flex-1 min-w-0">
                <h3 className="text-lg font-medium mb-1">Appearance</h3>
                <p className="text-fluent-subtext text-sm mb-4">
                  Choose your application accent color.
                </p>
                <div className="flex gap-3 overflow-x-auto py-2 px-1 pb-4 snap-x scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                  {ACCENT_COLORS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => onAccentColorChange(color.value)}
                      className={`w-10 h-10 shrink-0 rounded-full border-2 transition-all snap-start ${
                        accentColor === color.value ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
             </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start gap-4">
             <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400">
                <Database size={24} />
             </div>
             <div className="flex-1">
                <h3 className="text-lg font-medium mb-1">Data Management</h3>
                <p className="text-fluent-subtext text-sm mb-4">
                  Backup your connected accounts and server library to a JSON file, or restore them.
                </p>
                <div className="flex gap-3">
                  <Button onClick={onExport} variant="secondary" disabled={isProcessing}>
                    <Download size={16} /> Export Full Backup
                  </Button>
                  <Button onClick={handleImportClick} variant="secondary" disabled={isProcessing}>
                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    <span>{isProcessing ? 'Processing...' : 'Import Backup'}</span>
                  </Button>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
                </div>
             </div>
          </div>
        </Card>
        <Card>
           <div className="flex items-start gap-4">
             <div className="p-3 bg-purple-500/10 rounded-lg text-purple-400">
                <SettingsIcon size={24} />
             </div>
             <div>
                <h3 className="text-lg font-medium mb-1">Application</h3>
                <p className="text-fluent-subtext text-sm">Version 1.0.0 Alpha (Sync Core)</p>
             </div>
           </div>
        </Card>
      </div>
    </div>
  );
};
