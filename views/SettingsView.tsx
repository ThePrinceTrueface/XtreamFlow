
import React, { useRef, useState, useEffect } from 'react';
import { Database, Download, Upload, Settings as SettingsIcon, Loader2, Palette, SlidersHorizontal, Keyboard, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { XtreamAccount } from '../types';
import { Card, Button } from '../components/Win11UI';
import { createInlineWorker } from '../utils';
import { FILE_WORKER_CODE } from '../workers/file.worker';
import { useUserPreferences } from '../hooks/useUserPreferences';

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
  themeMode: 'dark' | 'light';
  setThemeMode: (mode: 'dark' | 'light') => void;
  onOpenShortcuts: () => void;
}> = ({ accounts, onImport, onExport, accentColor, onAccentColorChange, themeMode, setThemeMode, onOpenShortcuts }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const { t, i18n: i18nInstance } = useTranslation();
  
  const { getPlayerSettings, updatePlayerSettings, getAutoPlayNavigation, toggleAutoPlayNavigation } = useUserPreferences('global');
  const playerSettings = getPlayerSettings();
  const autoPlayNavigation = getAutoPlayNavigation();

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
      <h2 className="text-2xl font-semibold mb-6">{t('settings.title')}</h2>
      <div className="space-y-6">
        <Card>
          <div className="flex items-start gap-4">
             <div className="p-3 bg-pink-500/10 rounded-lg text-pink-400" style={{ color: accentColor, backgroundColor: accentColor + '1A' }}>
                <Palette size={24} />
             </div>
             <div className="flex-1 min-w-0">
                <h3 className="text-lg font-medium mb-1">{t('settings.appearance.title')}</h3>
                <p className="text-fluent-subtext text-sm mb-4">
                  {t('settings.appearance.desc')}
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
                
                <div className="mt-4 border-t border-white/5 pt-4">
                  <label className="text-sm font-medium text-win-subtext">{t('settings.appearance.themeLabel')}</label>
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus:outline-none ring-1 ring-white/10 ${
                         themeMode === 'light' ? 'bg-fluent-accent' : 'bg-white/10'
                      }`}
                    >
                      <span className="sr-only">{t('settings.appearance.toggleTheme')}</span>
                      <span
                        className={`pointer-events-none absolute left-0 inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-1 ring-black/5 transition duration-200 ease-in-out ${
                          themeMode === 'light' ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className="text-sm text-white/70">
                      {themeMode === 'light' ? t('settings.appearance.lightMode') : t('settings.appearance.darkMode')}
                    </span>
                  </div>
                </div>
             </div>
          </div>
        </Card>

        {/* Language Selection Card */}
        <Card>
          <div className="flex items-start gap-4">
             <div className="p-3 bg-teal-500/10 rounded-lg text-teal-400">
                <Languages size={24} />
             </div>
             <div className="flex-1">
                <h3 className="text-lg font-medium mb-1">{t('settings.language.label')}</h3>
                <p className="text-fluent-subtext text-sm mb-4">
                  {t('settings.language.desc')}
                </p>
                <div className="flex gap-3">
                  <Button 
                    onClick={() => i18nInstance.changeLanguage('fr')} 
                    variant={i18nInstance.language?.startsWith('fr') ? 'primary' : 'secondary'}
                  >
                     Français
                  </Button>
                  <Button 
                    onClick={() => i18nInstance.changeLanguage('en')} 
                    variant={i18nInstance.language?.startsWith('en') ? 'primary' : 'secondary'}
                  >
                     English
                  </Button>
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
                <h3 className="text-lg font-medium mb-1">{t('settings.data.title')}</h3>
                <p className="text-fluent-subtext text-sm mb-4">
                  {t('settings.data.desc')}
                </p>
                <div className="flex gap-3">
                  <Button onClick={onExport} variant="secondary" disabled={isProcessing}>
                    <Download size={16} /> {t('settings.data.export')}
                  </Button>
                  <Button onClick={handleImportClick} variant="secondary" disabled={isProcessing}>
                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    <span>{isProcessing ? t('settings.data.processing') : t('settings.data.import')}</span>
                  </Button>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
                </div>
             </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start gap-4">
             <div className="p-3 bg-orange-500/10 rounded-lg text-orange-400">
                <SlidersHorizontal size={24} />
             </div>
             <div className="flex-1">
                <h3 className="text-lg font-medium mb-1">{t('settings.preferences.title')}</h3>
                <p className="text-fluent-subtext text-sm mb-4">
                  {t('settings.preferences.desc')}
                </p>
                <div className="flex flex-col gap-2 max-w-xs">
                  <label className="text-sm font-medium text-win-subtext">{t('settings.preferences.audioLang')}</label>
                  <select 
                    className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                    value={playerSettings.preferredAudioLanguage || 'English'}
                    onChange={(e) => updatePlayerSettings({ preferredAudioLanguage: e.target.value })}
                  >
                    <option value="English">English</option>
                    <option value="French">French</option>
                    <option value="Spanish">Spanish</option>
                    <option value="German">German</option>
                    <option value="Italian">Italian</option>
                    <option value="Arabic">Arabic</option>
                    <option value="Original">Original</option>
                  </select>

                  <label className="text-sm font-medium text-win-subtext mt-4">{t('settings.preferences.liveFormat')}</label>
                  <select 
                    className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                    value={playerSettings.liveStreamFormat || 'smart'}
                    onChange={(e) => updatePlayerSettings({ liveStreamFormat: e.target.value as 'smart' | 'm3u8' | 'ts' })}
                  >
                    <option value="smart">Switch intelligent (Repli TS)</option>
                    <option value="m3u8">Forcé M3U8 (Audio multiple)</option>
                    <option value="ts">Forcé TS (Standard, plus rapide)</option>
                  </select>

                  <label className="text-sm font-medium text-win-subtext mt-4">{t('settings.preferences.autoplayNav')}</label>
                  <p className="text-[11px] text-white/40 mb-1 leading-tight">{t('settings.preferences.autoplayNavDesc')}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <button
                      onClick={() => toggleAutoPlayNavigation(!autoPlayNavigation)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus:outline-none ring-1 ring-white/10 ${
                        autoPlayNavigation ? 'bg-fluent-accent' : 'bg-white/10'
                      }`}
                    >
                      <span className="sr-only">Toggle Autoplay Navigation</span>
                      <span
                        className={`pointer-events-none absolute left-0 inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-1 ring-black/5 transition duration-200 ease-in-out ${
                          autoPlayNavigation ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className="text-sm text-white/70">
                      {autoPlayNavigation ? t('settings.preferences.enabled') : t('settings.preferences.disabled')}
                    </span>
                  </div>

                  <label className="text-sm font-medium text-win-subtext mt-4">{t('settings.preferences.autoplaySeries')}</label>
                  <div className="flex items-center gap-3 mt-1">
                    <button
                      onClick={() => updatePlayerSettings({ autoPlayEpisodes: !(playerSettings.autoPlayEpisodes ?? true) })}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus:outline-none ring-1 ring-white/10 ${
                        (playerSettings.autoPlayEpisodes ?? true) ? 'bg-fluent-accent' : 'bg-white/10'
                      }`}
                    >
                      <span className="sr-only">Toggle Autoplay Episodes</span>
                      <span
                        className={`pointer-events-none absolute left-0 inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-1 ring-black/5 transition duration-200 ease-in-out ${
                          (playerSettings.autoPlayEpisodes ?? true) ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className="text-sm text-white/70">
                      {(playerSettings.autoPlayEpisodes ?? true) ? t('settings.preferences.enabled') : t('settings.preferences.disabled')}
                    </span>
                  </div>
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
                <h3 className="text-lg font-medium mb-1">{t('settings.app.title')}</h3>
                <p className="text-fluent-subtext text-sm">Version 1.0.0 Alpha (Sync Core)</p>
                <div className="mt-2 text-xs text-white/50 border-t border-white/5 pt-2">
                   {t('settings.app.poweredBy')} <span className="text-fluent-accent font-medium">Ebinasoft</span> {t('settings.app.createdBy')} <span className="text-fluent-accent font-medium">prince true-face</span>.
                </div>
             </div>
           </div>
        </Card>
        <Card>
          <div className="flex items-start gap-4">
            <div className="p-3 bg-fluent-accent/10 rounded-lg text-fluent-accent">
               <Keyboard size={24} />
            </div>
            <div className="flex-1">
               <h3 className="text-lg font-medium mb-1">{t('settings.accessibility.title')}</h3>
               <p className="text-fluent-subtext text-sm mb-4">
                  {t('settings.accessibility.desc')}
               </p>
               <Button onClick={onOpenShortcuts} variant="secondary">
                  <Keyboard size={16} className="mr-2" /> {t('settings.accessibility.showShortcuts')}
               </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
