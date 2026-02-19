import React from 'react';
import { 
  Tv, 
  Plus, 
  Settings as SettingsIcon, 
  LayoutDashboard, 
  Database, 
  Info as InfoIcon,
  Film,
  Clapperboard,
  ChevronLeft,
  ChevronRight,
  Server,
  Wrench,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { ViewState } from '../types';

// Generic Nav Item Component
const NavItem: React.FC<{ 
  isActive: boolean; 
  onClick: () => void; 
  icon: React.ElementType; 
  label: string; 
  isCollapsed: boolean;
}> = ({ isActive, onClick, icon: Icon, label, isCollapsed }) => (
  <button
    onClick={onClick}
    title={isCollapsed ? label : undefined}
    className={`w-full flex items-center gap-3 px-3 py-2 rounded-control text-[13px] transition-all duration-200 mb-1 group relative
      ${isActive 
        ? 'bg-white/10 text-white font-medium' 
        : 'text-fluent-subtext hover:bg-white/5 hover:text-white'
      } ${isCollapsed ? 'justify-center' : ''}`}
  >
    {/* Win11 Active Indicator Pill */}
    {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[16px] bg-fluent-accent rounded-r-full" />}
    <Icon size={18} className={isActive ? 'text-fluent-accent' : 'text-current'} />
    <span className={`truncate transition-all duration-200 ${isCollapsed ? 'w-0 opacity-0 pointer-events-none absolute' : 'w-auto opacity-100'}`}>
      {label}
    </span>
  </button>
);

interface SidebarProps {
  activeView: ViewState;
  setView: (v: ViewState) => void;
  isCollapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, setView, isCollapsed, onToggle }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'add-account', label: 'Add Account', icon: Plus },
    { id: 'manage-accounts', label: 'Manage Accounts', icon: Database },
    { id: 'server-library', label: 'Server Library', icon: Server },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div 
      className={`bg-fluent-micaAlt/50 border-r border-fluent-border flex flex-col pt-2 pb-2 px-2 backdrop-blur-xl transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-[68px]' : 'w-[260px]'}`}
    >
      <div className={`flex items-center mb-4 mt-2 px-1 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed && (
          <div className="flex items-center gap-2 px-2">
            <div className="w-5 h-5 rounded-sm bg-fluent-accent flex items-center justify-center">
              <Tv size={12} className="text-black" />
            </div>
            <span className="font-bold text-xs tracking-tight text-white uppercase opacity-80">XtreamFlow</span>
          </div>
        )}
        <button 
          onClick={onToggle}
          className="p-2 rounded-control text-fluent-subtext hover:bg-white/5 hover:text-white transition-colors"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => (
          <NavItem 
            key={item.id}
            isActive={activeView === item.id}
            onClick={() => setView(item.id as ViewState)}
            icon={item.icon}
            label={item.label}
            isCollapsed={isCollapsed}
          />
        ))}
      </nav>
      
      {!isCollapsed && (
        <div className="px-4 py-4 mt-auto animate-in fade-in duration-300">
          <div className="p-3 rounded-lg bg-gradient-to-br from-fluent-accent/10 to-transparent border border-fluent-accent/5">
              <p className="text-[10px] font-bold text-fluent-accent uppercase tracking-widest mb-1">Version</p>
              <p className="text-[11px] text-fluent-subtext">v1.2.0 Preview</p>
          </div>
        </div>
      )}
    </div>
  );
};

interface AccountSidebarProps {
  activeTab: string;
  setTab: (t: string) => void;
  onBack: () => void;
  accountName: string;
  isCollapsed: boolean;
  onToggle: () => void;
}

export const AccountSidebar: React.FC<AccountSidebarProps> = ({ activeTab, setTab, onBack, accountName, isCollapsed, onToggle }) => {
  const navItems = [
    { id: 'info', label: 'Information', icon: InfoIcon },
    { id: 'live', label: 'Live TV', icon: Tv },
    { id: 'vod', label: 'Movies', icon: Film },
    { id: 'series', label: 'Series', icon: Clapperboard },
    { id: 'tools', label: 'Tools', icon: Wrench },
  ];

  return (
    <div 
      className={`bg-fluent-micaAlt/50 border-r border-fluent-border flex flex-col pt-2 px-2 backdrop-blur-xl transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-[68px]' : 'w-[260px]'}`}
    >
      <div className={`mb-2 mt-2 flex flex-col ${isCollapsed ? 'items-center' : 'px-2'}`}>
         <div className={`flex items-center w-full mb-4 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
            {!isCollapsed && (
               <button 
                 onClick={onBack} 
                 className="flex items-center gap-2 text-[11px] font-bold text-fluent-accent uppercase tracking-widest hover:text-white transition-colors"
               >
                  <ChevronLeft size={14} /> Back
               </button>
            )}
            <button 
              onClick={onToggle}
              className="p-2 rounded-control text-fluent-subtext hover:bg-white/5 hover:text-white transition-colors"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
         </div>
         
         {!isCollapsed && (
           <div className="px-2 mb-4 animate-in slide-in-from-left-2 duration-300">
              <h2 className="font-bold text-lg truncate text-white leading-tight" title={accountName}>{accountName}</h2>
              <div className="flex items-center gap-2 mt-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]"></span>
                  <span className="text-[10px] font-bold text-green-400/80 uppercase tracking-widest">Active Session</span>
              </div>
           </div>
         )}

         {isCollapsed && (
            <button 
              onClick={onBack}
              title="Back to Dashboard"
              className="p-2 mb-4 rounded-control text-fluent-accent hover:bg-white/5 hover:text-white transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
         )}
      </div>

      <div className="h-[1px] bg-white/5 mx-2 mb-4" />

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <NavItem 
            key={item.id}
            isActive={activeTab === item.id}
            onClick={() => setTab(item.id)}
            icon={item.icon}
            label={item.label}
            isCollapsed={isCollapsed}
          />
        ))}
      </nav>
    </div>
  );
};
