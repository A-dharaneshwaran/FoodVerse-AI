import React from 'react';
import {
  Compass,
  ScanEye,
  Sparkles,
  ShieldAlert,
  ChefHat,
  CalendarDays,
  X
} from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: Compass, tag: 'Live' },
  { id: 'recognition', label: 'Food Recognition', icon: ScanEye, tag: 'Live' },
  { id: 'freshness', label: 'Freshness Detector', icon: Sparkles, tag: 'Live' },
  { id: 'hygiene', label: 'Hygiene & Safety', icon: ShieldAlert, tag: 'Live' },
  { id: 'kitchen', label: 'Smart Kitchen', icon: ChefHat, tag: 'Live' },
  { id: 'meal_planner', label: 'Meal Planner', icon: CalendarDays, tag: 'Live' },
];

export function Sidebar({ currentView, onSelectView, isMobileOpen, onCloseMobile, backendStatus }) {
  const getDotClass = () => {
    if (backendStatus === 'online') return 'pulse-dot online';
    if (backendStatus === 'offline') return 'pulse-dot offline';
    return 'pulse-dot checking';
  };

  const getStatusText = () => {
    if (backendStatus === 'online') return 'FastAPI Online';
    if (backendStatus === 'offline') return 'Service Offline';
    return 'Connecting...';
  };

  return (
    <>
      <div 
        className={`mobile-overlay ${isMobileOpen ? 'mobile-open' : ''}`}
        onClick={onCloseMobile}
        aria-hidden="true"
      />
      <aside className={`sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand-wrapper">
            <div className="brand-mark">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
                <path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <div className="brand-info">
              <span className="brand-name">
                FoodVerse<span>AI</span>
              </span>
              <span className="brand-tagline">Intelligent Food. Safer Choices.</span>
            </div>
          </div>
          {isMobileOpen && (
            <button 
              className="mobile-close-btn" 
              onClick={onCloseMobile}
              aria-label="Close navigation menu"
              style={{ color: 'var(--text-muted)', padding: '4px' }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">Core Intelligence</div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                id={`nav-item-${item.id}`}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onSelectView(item.id);
                  if (isMobileOpen) onCloseMobile();
                }}
              >
                <span className="nav-item-icon">
                  <Icon size={18} />
                </span>
                <span className="nav-item-label">{item.label}</span>
                <span className="nav-item-status">{item.tag}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="footer-system-pill">
            <div className={getDotClass()} />
            <div className="system-pill-text">
              <span className="system-pill-label">Runtime Engine</span>
              <span className="system-pill-value">{getStatusText()}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
