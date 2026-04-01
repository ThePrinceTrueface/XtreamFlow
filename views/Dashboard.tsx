import React, { useMemo } from 'react';
import { Plus, Database, Star, Terminal, Settings as SettingsIcon, Play, Clock, ChevronRight, Film, Tv } from 'lucide-react';
import { XtreamAccount, ViewState, GlobalPreferences, XtreamStream } from '../types';
import { Card, Button } from '../components/Win11UI';
import { decodeBase64 } from '../utils';
import { useNavigate } from 'react-router-dom';

export const Dashboard: React.FC<{ accounts: XtreamAccount[]; setView: (v: ViewState) => void }> = ({ accounts, setView }) => {
  const navigate = useNavigate();
  // Load preferences to show recent activity
  const recentActivity = useMemo(() => {
    try {
      const stored = localStorage.getItem('xtream_user_prefs');
      if (!stored) return { history: [], favorites: [] };
      const prefs = JSON.parse(stored) as GlobalPreferences;
      
      let history: any[] = [];
      let favorites: XtreamStream[] = [];

      Object.keys(prefs).forEach(accId => {
        const acc = prefs[accId];
        const account = accounts.find(a => a.id === accId);
        if (!account) return;

        // Collect history
        if (acc.history) {
          Object.keys(acc.history).forEach(itemId => {
            const entry = acc.history![itemId];
            if (!entry.finished && entry.progress > 0.05) {
              history.push({ ...entry, accountId: accId, accountName: account.name });
            }
          });
        }

        // Collect recent favorites
        if (acc.favoritesTable) {
          const allFavs = [
            ...(acc.favoritesTable.vod || []),
            ...(acc.favoritesTable.series || [])
          ];
          favorites.push(...allFavs);
        }
      });

      // Sort history by last watched
      history.sort((a, b) => b.lastWatched - a.lastWatched);
      
      return {
        history: history.slice(0, 6),
        favorites: favorites.slice(0, 12)
      };
    } catch (e) {
      console.error("Error aggregating dashboard data:", e);
      return { history: [], favorites: [] };
    }
  }, [accounts]);

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-10">
      {/* Hero Welcome */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-fluent-accent/20 to-transparent border border-white/5 p-8 md:p-12">
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Let's start <span className="text-fluent-accent">streaming</span>
          </h1>
          <p className="text-lg text-win-subtext mb-8 leading-relaxed">
            Bienvenue sur XtreamFlow Pro. Votre centre de divertissement personnel est prêt. 
            Gérez vos comptes, explorez votre catalogue et reprenez là où vous vous étiez arrêté.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button variant="primary" onClick={() => navigate('/add-account')} className="h-11 px-6">
              <Plus size={18} /> Ajouter un compte
            </Button>
            <Button variant="secondary" onClick={() => navigate('/manage-accounts')} className="h-11 px-6 bg-white/5 border-white/10 hover:bg-white/10">
              <SettingsIcon size={18} /> Gérer les connexions
            </Button>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-fluent-accent/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 mr-20 mb-10 opacity-20 hidden md:block">
            <Film size={180} className="text-fluent-accent rotate-12" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-win-card/40 backdrop-blur-md border-white/5 hover:border-white/10 transition-all group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-win-subtext">Comptes Actifs</h3>
            <Database size={16} className="text-fluent-accent group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-bold">{accounts.length}</p>
            <span className="text-xs text-win-subtext">enregistrés</span>
          </div>
        </Card>
        
        <Card className="bg-win-card/40 backdrop-blur-md border-white/5 hover:border-white/10 transition-all group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-win-subtext">Favoris</h3>
            <Star size={16} className="text-yellow-400 fill-current group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-bold">{recentActivity.favorites.length}</p>
            <span className="text-xs text-win-subtext">titres</span>
          </div>
        </Card>

        <Card className="bg-win-card/40 backdrop-blur-md border-white/5 hover:border-white/10 transition-all group">
           <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-win-subtext">État Système</h3>
            <Terminal size={16} className="text-green-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${accounts.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
            <p className="text-xl font-semibold">{accounts.length > 0 ? 'Opérationnel' : 'En attente'}</p>
          </div>
        </Card>
      </div>

      {/* Continue Watching */}
      {recentActivity.history.length > 0 && (
        <div className="animate-in slide-in-from-bottom-4 duration-700 delay-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Clock size={20} className="text-fluent-accent" /> Reprendre la lecture
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentActivity.history.map((item, idx) => (
              <div 
                key={idx}
                className="group relative bg-win-card/40 border border-white/5 rounded-xl overflow-hidden hover:border-white/20 transition-all cursor-pointer hover:shadow-xl"
                onClick={() => {
                    // This would ideally open the account and play the item
                    // For now, we can just navigate to manage accounts
                    navigate('/manage-accounts');
                }}
              >
                <div className="aspect-video relative overflow-hidden">
                  <img 
                    src={item.item.stream_icon || item.item.cover} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    alt="" 
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play fill="currentColor" size={32} className="text-white" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                    <div className="h-full bg-fluent-accent" style={{ width: `${item.progress * 100}%` }} />
                  </div>
                </div>
                <div className="p-4">
                  <h4 className="font-semibold truncate mb-1">{decodeBase64(item.item.name)}</h4>
                  <div className="flex items-center justify-between text-[10px] text-win-subtext uppercase tracking-wider font-bold">
                    <span>{item.accountName}</span>
                    <span>{Math.round(item.progress * 100)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Access */}
      <div className="animate-in slide-in-from-bottom-4 duration-700 delay-200">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Plus size={20} className="text-fluent-accent" /> Accès Rapide
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickActionCard 
            icon={<Plus size={24} />} 
            title="Nouveau Compte" 
            subtitle="Ajouter Xtream Codes"
            onClick={() => navigate('/add-account')} 
          />
          <QuickActionCard 
            icon={<SettingsIcon size={24} />} 
            title="Gestion" 
            subtitle="Liste des comptes"
            onClick={() => navigate('/manage-accounts')} 
          />
          <QuickActionCard 
            icon={<Tv size={24} />} 
            title="Live TV" 
            subtitle="Chaînes en direct"
            onClick={() => navigate('/manage-accounts')} 
          />
          <QuickActionCard 
            icon={<Film size={24} />} 
            title="VOD & Séries" 
            subtitle="Cinéma à la demande"
            onClick={() => navigate('/manage-accounts')} 
          />
        </div>
      </div>
    </div>
  );
};

const QuickActionCard = ({ icon, title, subtitle, onClick }: { icon: React.ReactNode, title: string, subtitle: string, onClick: () => void }) => (
    <button 
        onClick={onClick}
        className="group p-6 rounded-xl bg-win-card/40 border border-white/5 hover:bg-white/5 hover:border-white/20 transition-all flex flex-col items-start gap-4 text-left hover:shadow-lg"
    >
        <div className="p-3 rounded-lg bg-fluent-accent/10 text-fluent-accent group-hover:bg-fluent-accent group-hover:text-black transition-all">
            {icon}
        </div>
        <div>
            <div className="font-bold text-white mb-0.5">{title}</div>
            <div className="text-xs text-win-subtext">{subtitle}</div>
        </div>
    </button>
);
