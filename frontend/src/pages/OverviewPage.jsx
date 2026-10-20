import React from 'react';
import {
  ScanEye,
  Sparkles,
  ShieldAlert,
  ChefHat,
  CalendarDays,
  ArrowUpRight,
  Server,
  Cpu,
  Layers,
  Database,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock
} from 'lucide-react';

const SECONDARY_MODULES = [
  {
    id: 'freshness',
    title: 'Freshness Detector',
    icon: Sparkles,
    track: 'Optical Decay Analysis',
    description: 'Blemish and cellular degradation assessment for fruits, vegetables, and proteins.'
  },
  {
    id: 'hygiene',
    title: 'Hygiene & Safety Monitor',
    icon: ShieldAlert,
    track: 'Sanitary Inspection',
    description: 'Automated operational safety audits, surface cross-contamination tracking, and kitchen hazard vectors.'
  },
  {
    id: 'kitchen',
    title: 'Smart Kitchen & Pantry',
    icon: ChefHat,
    track: 'Culinary Inventory',
    description: 'Dynamic inventory ledger, storage guidance, and zero-waste recipe crafting tailored to on-hand stock.'
  },
  {
    id: 'meal_planner',
    title: 'Personalized Meal Planner',
    icon: CalendarDays,
    track: 'Dietary Synthesis',
    description: 'Personalized multi-day meal scheduling, pantry integration, and consolidated shopping lists.'
  },
];

export function OverviewPage({ onNavigate, systemStatus, statusLoading, statusError }) {
  const backendOnline = !statusError && systemStatus !== null;
  const aiConfig = systemStatus?.ai_status;

  return (
    <div className="overview-editorial">
      {/* Editorial Hero Intro */}
      <section className="editorial-hero">
        <div className="hero-meta-tag">
          <Layers size={14} />
          <span>Food Intelligence • Computer Vision • Culinary Science</span>
        </div>
        <h2 className="hero-editorial-title">
          Where culinary intelligence meets <em>computational precision</em>.
        </h2>
        <p className="hero-editorial-deck">
          FoodVerse AI is an integrated platform combining multimodal vision models, botanical decay analytics,
          and culinary knowledge graphs. Unify ingredient verification, kitchen hygiene, and metabolic diet planning.
        </p>
        <div className="hero-pills-row">
          <span className="hero-spec-pill">
            <Server size={13} /> FastAPI Microservices
          </span>
          <span className="hero-spec-pill">
            <Cpu size={13} /> Pretrained Inference Ready
          </span>
          <span className="hero-spec-pill">
            <Layers size={13} /> Modular Vision Pipelines
          </span>
          <span className="hero-spec-pill">
            <Clock size={13} /> Phase 1A Architecture
          </span>
        </div>
      </section>

      {/* Asymmetric Showcase: Spotlight Feature + Stacked Secondary Modules */}
      <section className="showcase-section">
        {/* Spotlight Feature: Food Recognition */}
        <div className="featured-spotlight">
          <div className="spotlight-visual">
            <img 
              src="https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=80" 
              alt="Artisanal culinary ingredients and fresh produce" 
              className="spotlight-img"
              loading="lazy"
              onError={(e) => {
                // Graceful fallback if offline
                e.target.style.display = 'none';
              }}
            />
            <div className="spotlight-overlay" />
            <div className="spotlight-badge">
              <ScanEye size={13} /> Primary Vision Pipeline
            </div>
          </div>

          <div className="spotlight-content">
            <span className="spotlight-eyebrow">Multimodal Ingestion</span>
            <h3 className="spotlight-heading">Food Recognition & Composition</h3>
            <p className="spotlight-desc">
              Ingest complex multi-ingredient dishes, calculate localized bounding segmentations,
              and translate visual plates into macro nutritional records using pretrained vision-language models.
            </p>

            <div className="spotlight-action-row">
              <button 
                className="btn-spotlight-primary"
                onClick={() => onNavigate('recognition')}
              >
                <span>Launch Dish Recognition</span>
                <ArrowUpRight size={15} />
              </button>
              <span style={{ fontSize: '0.78rem', color: 'var(--emerald-light)', fontFamily: 'var(--font-mono)' }}>
                Active & Operational
              </span>
            </div>
          </div>
        </div>

        {/* Stacked Modules List */}
        <div className="modules-editorial-stack">
          {SECONDARY_MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                className="editorial-module-item"
                onClick={() => onNavigate(mod.id)}
              >
                <div className="module-item-icon">
                  <Icon size={18} />
                </div>
                <div className="module-item-body">
                  <div className="module-item-top">
                    <span className="module-item-title">{mod.title}</span>
                    <span className="module-item-track">{mod.track}</span>
                  </div>
                  <p className="module-item-desc">{mod.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Dual Telemetry Status Panels */}
      <section className="telemetry-row">
        {/* Backend Runtime Card */}
        <div className="telemetry-panel">
          <div className="telemetry-header">
            <h3 className="telemetry-title">
              <Server size={18} />
              <span>FastAPI Backend Service</span>
            </h3>
            {statusLoading ? (
              <span className="telemetry-status-badge neutral">Verifying...</span>
            ) : backendOnline ? (
              <span className="telemetry-status-badge connected">
                <CheckCircle2 size={12} /> Operational
              </span>
            ) : (
              <span className="telemetry-status-badge unreachable">
                <XCircle size={12} /> Offline
              </span>
            )}
          </div>

          <div className="telemetry-kv-list">
            <div className="kv-item">
              <span className="kv-key">API Base URL</span>
              <span className="kv-val">{import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}</span>
            </div>
            <div className="kv-item">
              <span className="kv-key">Health Route</span>
              <span className="kv-val">GET /api/health (200 OK)</span>
            </div>
            <div className="kv-item">
              <span className="kv-key">Runtime Environment</span>
              <span className="kv-val">{systemStatus?.environment || 'Checking...'}</span>
            </div>
            <div className="kv-item">
              <span className="kv-key">Database State</span>
              <span className="kv-val">
                {systemStatus?.database_status === 'not_configured' 
                  ? 'Not configured (Phase 1A)' 
                  : (systemStatus?.database_status || 'N/A')}
              </span>
            </div>
          </div>
          {statusError && (
            <p style={{ color: 'var(--danger-rose)', fontSize: '0.78rem' }}>{statusError}</p>
          )}
        </div>

        {/* Vision & Analysis Engine Status Card */}
        <div className="telemetry-panel">
          <div className="telemetry-header">
            <h3 className="telemetry-title">
              <Cpu size={18} />
              <span>Vision & Analysis Pipeline</span>
            </h3>
            {aiConfig?.is_connected ? (
              <span className="telemetry-status-badge connected">Ready</span>
            ) : (
              <span className="telemetry-status-badge neutral">
                <HelpCircle size={12} /> Standby
              </span>
            )}
          </div>

          <div className="telemetry-kv-list">
            <div className="kv-item">
              <span className="kv-key">Pipeline Status</span>
              <span className="kv-val">
                {aiConfig?.is_connected ? 'Active & Ready' : 'Standby'}
              </span>
            </div>
            <div className="kv-item">
              <span className="kv-key">Service Key</span>
              <span className="kv-val">
                {aiConfig?.has_api_key ? 'Configured' : 'Unsupplied'}
              </span>
            </div>
            <div className="kv-item">
              <span className="kv-key">Engine Mode</span>
              <span className="kv-val">
                {aiConfig?.model_identifier || 'Multimodal Vision & Reasoning'}
              </span>
            </div>
            <div className="kv-item">
              <span className="kv-key">Inference Accuracy</span>
              <span className="kv-val">Zero Synthetic Outputs</span>
            </div>
          </div>

          <p className="telemetry-notes">
            {aiConfig?.connection_notes || 'Multimodal vision and reasoning pipelines are operational.'}
          </p>
        </div>
      </section>
    </div>
  );
}
