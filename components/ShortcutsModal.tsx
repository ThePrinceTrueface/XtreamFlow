import React from 'react';
import { X, Command, Keyboard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const shortcutGroups = [
    {
      title: "Navigation Globale",
      shortcuts: [
        { keys: ["Ctrl", "K"], desc: "Recherche globale" },
        { keys: ["Ctrl", "H"], desc: "Tableau de bord" },
        { keys: ["Ctrl", "N"], desc: "Ajouter un compte" },
        { keys: ["Ctrl", "M"], desc: "Gérer les comptes" },
        { keys: ["Ctrl", "D"], desc: "Téléchargements" },
        { keys: ["Ctrl", "S"], desc: "Paramètres" },
        { keys: ["?"], desc: "Afficher ces raccourcis" },
      ]
    },
    {
      title: "Exploration (Catégories)",
      shortcuts: [
        { keys: ["Ctrl", "F"], desc: "Rechercher dans la catégorie" },
        { keys: ["/"], desc: "Rechercher dans la catégorie" },
        { keys: ["R"], desc: "Actualiser le contenu" },
        { keys: ["Esc"], desc: "Effacer la recherche / Retour" },
      ]
    },
    {
      title: "Lecteur Vidéo",
      shortcuts: [
        { keys: ["Espace", "K"], desc: "Lecture / Pause" },
        { keys: ["F"], desc: "Plein écran" },
        { keys: ["M"], desc: "Couper le son" },
        { keys: ["I"], desc: "Informations du flux" },
        { keys: ["↑", "↓"], desc: "Volume" },
        { keys: ["←", "→"], desc: "Précédent / Suivant (VOD) ou Chaînes" },
        { keys: ["Esc"], desc: "Fermer le lecteur" },
      ]
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-fluent-surface border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-fluent-accent/10 rounded-lg text-fluent-accent">
                  <Keyboard size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Raccourcis Clavier</h2>
                  <p className="text-xs text-fluent-subtext">Optimisez votre navigation</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-fluent-subtext hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {shortcutGroups.map((group, idx) => (
                <div key={idx} className="space-y-4">
                  <h3 className="text-sm font-bold text-fluent-accent uppercase tracking-wider">{group.title}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                    {group.shortcuts.map((s, sIdx) => (
                      <div key={sIdx} className="flex items-center justify-between group">
                        <span className="text-[13px] text-fluent-subtext group-hover:text-white transition-colors">{s.desc}</span>
                        <div className="flex items-center gap-1">
                          {s.keys.map((key, kIdx) => (
                            <React.Fragment key={kIdx}>
                              <kbd className="min-w-[24px] h-6 px-1.5 flex items-center justify-center bg-white/10 border border-white/20 rounded text-[11px] font-mono font-bold text-white shadow-inner">
                                {key}
                              </kbd>
                              {kIdx < s.keys.length - 1 && <span className="text-white/20 text-[10px]">+</span>}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-white/5 border-t border-white/10 text-center">
              <p className="text-xs text-fluent-subtext">
                Astuce : Utilisez <kbd className="px-1 bg-white/10 rounded text-[10px]">Ctrl</kbd> ou <kbd className="px-1 bg-white/10 rounded text-[10px]">⌘</kbd> selon votre système.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
