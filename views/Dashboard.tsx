import React from 'react';
import { Plus, Database, Star, Terminal, Settings as SettingsIcon } from 'lucide-react';
import { XtreamAccount, ViewState } from '../types';
import { Card, Button } from '../components/Win11UI';

export const Dashboard: React.FC<{ accounts: XtreamAccount[]; setView: (v: ViewState) => void }> = ({ accounts, setView }) => {
  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-light mb-1">Welcome back</h1>
          <p className="text-win-subtext">Here's an overview of your streaming connections.</p>
        </div>
        <Button onClick={() => setView('add-account')}>
          <Plus size={16} /> Add Connection
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-win-card to-white/5 border-win-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-win-subtext">Total Accounts</h3>
            <Database size={16} className="text-win-primary" />
          </div>
          <p className="text-4xl font-semibold">{accounts.length}</p>
        </Card>
        <Card className="bg-gradient-to-br from-win-card to-white/5 border-win-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-win-subtext">Favorites</h3>
            <Star size={16} className="text-yellow-400" />
          </div>
          <p className="text-4xl font-semibold">{accounts.filter(a => a.isFavorite).length}</p>
        </Card>
        <Card className="bg-gradient-to-br from-win-card to-white/5 border-win-border">
           <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-win-subtext">Server Status</h3>
            <Terminal size={16} className="text-green-400" />
          </div>
          <p className="text-4xl font-semibold">{accounts.length > 0 ? 'Online' : 'Idle'}</p>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button 
             onClick={() => setView('add-account')}
             className="h-24 rounded-lg bg-win-card border border-win-border hover:bg-win-cardHover transition-all flex flex-col items-center justify-center gap-2 text-win-subtext hover:text-white"
          >
            <Plus size={24} />
            <span className="text-sm">New Account</span>
          </button>
          <button 
             onClick={() => setView('manage-accounts')}
             className="h-24 rounded-lg bg-win-card border border-win-border hover:bg-win-cardHover transition-all flex flex-col items-center justify-center gap-2 text-win-subtext hover:text-white"
          >
            <SettingsIcon size={24} />
            <span className="text-sm">Manage</span>
          </button>
        </div>
      </div>
    </div>
  );
};
