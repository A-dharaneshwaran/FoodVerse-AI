import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, NAV_ITEMS } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewPage } from './pages/OverviewPage';
import { FoodRecognitionPage } from './pages/FoodRecognitionPage';
import { FreshnessDetectorPage } from './pages/FreshnessDetectorPage';
import { HygieneMonitorPage } from './pages/HygieneMonitorPage';
import { SmartKitchenPage } from './pages/SmartKitchenPage';
import { MealPlannerPage } from './pages/MealPlannerPage';
import { getHealth, getSystemStatus } from './services/api';

export function App() {
  const [currentView, setCurrentView] = useState('overview');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  
  // Real backend connection states
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking' | 'online' | 'offline'
  const [systemStatus, setSystemStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState(null);

  const fetchSystemData = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    setBackendStatus('checking');

    try {
      // Parallel fetch to ensure both health check and full status are validated
      const [healthRes, systemRes] = await Promise.all([
        getHealth(),
        getSystemStatus()
      ]);

      if (healthRes?.status === 'ok' && systemRes?.backend_status === 'operational') {
        setBackendStatus('online');
        setSystemStatus(systemRes);
      } else {
        setBackendStatus('offline');
        setStatusError('Backend returned non-operational status response.');
      }
    } catch (err) {
      setBackendStatus('offline');
      setStatusError(err.message || 'Failed to reach FoodVerse AI FastAPI backend.');
      setSystemStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSystemData();
  }, [fetchSystemData]);

  // Determine current view title
  const activeNavItem = NAV_ITEMS.find((item) => item.id === currentView);
  const currentTitle = activeNavItem ? activeNavItem.label : 'Overview';

  // Render view router
  const renderActiveView = () => {
    switch (currentView) {
      case 'overview':
        return (
          <OverviewPage
            onNavigate={(viewId) => setCurrentView(viewId)}
            systemStatus={systemStatus}
            statusLoading={statusLoading}
            statusError={statusError}
          />
        );
      case 'recognition':
        return <FoodRecognitionPage />;
      case 'freshness':
        return <FreshnessDetectorPage />;
      case 'hygiene':
        return <HygieneMonitorPage />;
      case 'kitchen':
        return <SmartKitchenPage />;
      case 'meal_planner':
        return <MealPlannerPage />;
      default:
        return (
          <OverviewPage
            onNavigate={(viewId) => setCurrentView(viewId)}
            systemStatus={systemStatus}
            statusLoading={statusLoading}
            statusError={statusError}
          />
        );
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onSelectView={(viewId) => setCurrentView(viewId)}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        backendStatus={backendStatus}
      />

      {/* Main Content Area */}
      <div className="main-wrapper">
        <Header
          currentTitle={currentTitle}
          onToggleMobile={() => setIsMobileNavOpen(!isMobileNavOpen)}
          onRefreshStatus={fetchSystemData}
          isRefreshing={statusLoading}
        />

        <main className="page-container">
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
}

export default App;
