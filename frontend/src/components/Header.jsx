import React from 'react';
import { Menu, RefreshCw } from 'lucide-react';

export function Header({ currentTitle, onToggleMobile, onRefreshStatus, isRefreshing }) {
  return (
    <header className="top-header">
      <div className="header-left">
        <button 
          className="mobile-menu-toggle" 
          onClick={onToggleMobile} 
          aria-label="Toggle navigation menu"
        >
          <Menu size={18} />
        </button>
        <h1 className="header-title">{currentTitle}</h1>
        <span className="phase-pill">v1.0 Production</span>
      </div>

      <div className="header-right">
        <button 
          className="btn-header-refresh" 
          onClick={onRefreshStatus} 
          disabled={isRefreshing}
          title="Refresh Service Status"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          <span>{isRefreshing ? 'Checking...' : 'Refresh Status'}</span>
        </button>
      </div>
    </header>
  );
}
