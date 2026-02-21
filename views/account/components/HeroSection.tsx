
import React from 'react';
import { Play, Info as InfoIcon, ChevronLast, Image as ImageIcon, Star, Film, Tag, Volume2, VolumeX } from 'lucide-react';
import { Button } from '../../../components/Win11UI';
import { XtreamStream } from '../../../types';

interface HeroSectionProps {
  item: XtreamStream;
  detail: any;
  phase: 'backdrop' | 'trailer';
  isFading: boolean;
  ytContainerId: string;
  onNext: () => void;
  onPlay: (item: XtreamStream) => void;
  onInfo: (item: XtreamStream) => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
}

// Helper to decode Base64 strings safely and fix encoding issues
const decodeBase64 = (str: string) => {
    if (!str) return "";
    let decoded = str;

    // 1. Try Base64 decoding if it looks like Base64 (no spaces, valid chars)
    if (!str.includes(' ') && /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/.test(str)) {
         try {
             const raw = window.atob(str);
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

export const HeroSection: React.FC<HeroSectionProps> = ({ 
  item, detail, phase, isFading, ytContainerId, onNext, onPlay, onInfo, isMuted, onToggleMute 
}) => {
  const backdrop = detail?.info?.backdrop_path?.[0] || item.stream_icon || item.cover;
  const poster = item.stream_icon || item.cover;
  
  // Récupération et nettoyage des genres
  const rawGenre = detail?.info?.genre || item.genre;
  const genres = rawGenre ? rawGenre.split(/,|;/).map((g: string) => decodeBase64(g.trim())).filter(Boolean).slice(0, 3) : [];

  return (
    <div className={`relative w-full h-[420px] mb-8 rounded-window overflow-hidden group shadow-window transition-opacity duration-500 ring-1 ring-white/10 ${isFading ? 'opacity-0' : 'opacity-100'}`}>
      {/* Fond : Image ou Vidéo */}
      <div className="absolute inset-0 bg-black">
        {phase === 'trailer' && detail?.info?.youtube_trailer ? (
          <div className="absolute inset-0 w-full h-full scale-125">
            <div id={ytContainerId} className="w-full h-full pointer-events-none" />
            <div className="absolute inset-0 bg-black/40" />
          </div>
        ) : (
          <div className="absolute inset-0 animate-in fade-in duration-700">
            {backdrop ? (
              <img src={backdrop} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[10s]" alt="Backdrop" />
            ) : (
              <div className="w-full h-full bg-fluent-layer flex items-center justify-center text-white/5"><ImageIcon size={64}/></div>
            )}
          </div>
        )}
        {/* Gradients de lisibilité Windows 11 */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#202020] via-black/30 to-black/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent" />
      </div>

      {/* Contenu textuel */}
      <div className="absolute inset-0 flex items-center px-10">
        <div className="flex gap-8 items-end max-w-4xl">
          <div className="hidden md:block w-48 shrink-0 aspect-[2/3] rounded-lg overflow-hidden shadow-window border border-white/10 animate-in slide-in-from-bottom-4 duration-500">
            {poster ? <img src={poster} className="w-full h-full object-cover" alt="Poster" /> : <div className="w-full h-full bg-white/5 flex items-center justify-center"><Film size={32} className="opacity-10"/></div>}
          </div>

          <div className="flex-1 pb-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-fluent-accent/90 text-black px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Projecteur</span>
              {item.rating && <span className="flex items-center gap-1 text-yellow-400 text-xs font-bold bg-black/40 px-2 py-0.5 rounded border border-yellow-400/20"><Star size={12} fill="currentColor"/>{item.rating}</span>}
              {phase === 'trailer' && <span className="text-[10px] text-white/80 uppercase font-bold tracking-tight bg-red-500/80 px-2 py-0.5 rounded ml-2 animate-pulse">Bande-annonce en cours</span>}
            </div>

            {/* Genres / Thèmes */}
            {genres.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 animate-in slide-in-from-left-2 duration-500 delay-100">
                    {genres.map((g: string, i: number) => (
                        <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded bg-white/10 border border-white/5 text-white/90 uppercase tracking-wide backdrop-blur-md flex items-center gap-1">
                            {g}
                        </span>
                    ))}
                </div>
            )}

            <h1 className="text-3xl font-bold text-white mb-2 line-clamp-2 drop-shadow-md">{decodeBase64(item.name)}</h1>
            <p className="text-sm text-white/80 line-clamp-2 mb-6 max-w-xl leading-relaxed font-medium">
              {decodeBase64(item.plot) || "Un titre exceptionnel à découvrir immédiatement dans votre catalogue streaming."}
            </p>
            <div className="flex items-center gap-3">
              <Button variant="primary" onClick={() => onPlay(item)} className="!px-6 h-10 font-semibold shadow-lg">
                <Play fill="currentColor" size={16} /> Regarder
              </Button>
              <Button variant="secondary" onClick={() => onInfo(item)} className="!px-6 h-10 backdrop-blur-xl bg-white/10 border-white/10 text-sm font-medium">
                <InfoIcon size={16} /> Détails
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Controls */}
      <div className="absolute bottom-6 right-6 z-30 flex items-center gap-3">
        
        {/* Mute/Unmute Toggle - Only visible when playing a trailer */}
        {phase === 'trailer' && onToggleMute && (
            <button 
                onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-xl border border-white/20 hover:bg-white/10 transition-all text-white active:scale-90 shadow-lg"
                title={isMuted ? "Activer le son" : "Couper le son"}
            >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
        )}

        {/* Next Item Button */}
        <button onClick={onNext} className="w-10 h-10 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-xl border border-white/20 hover:bg-white/10 transition-all text-white active:scale-90 shadow-lg" title="Suivant">
          <ChevronLast size={20} />
        </button>
      </div>
      
      {/* Barre de Progression Windows 11 Neon */}
      {phase === 'backdrop' && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10 z-40 overflow-hidden">
          <div 
            key={`${item.stream_id || item.series_id}-${item.name}-${phase}`} 
            className="h-full bg-fluent-accent w-full origin-left shadow-[0_0_12px_#60CDFF]" 
            style={{ animation: 'heroProgress 8s linear forwards' }}
          />
        </div>
      )}
    </div>
  );
};
