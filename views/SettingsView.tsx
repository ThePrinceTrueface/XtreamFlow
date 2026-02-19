
import React, { useRef, useState, useEffect } from 'react';
import { Database, Download, Upload, Settings as SettingsIcon, Loader2 } from 'lucide-react';
import { XtreamAccount } from '../types';
import { Card, Button } from '../components/Win11UI';
import { createInlineWorker } from '../utils';
import { FILE_WORKER_CODE } from '../workers/file.worker';

export const SettingsView: React.FC<{ 
  accounts: XtreamAccount[]; 
  onImport: (data: any) => void; 
  onExport: () => void;
}> = ({ accounts, onImport, onExport }) => {
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
                alert("Invalid JSON");
            } finally {
                setIsProcessing(false);
            }
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
                    {isProcessing ? 'Processing...' : 'Import Backup'}
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
