import React from 'react';
import {
  ScanEye,
  Sparkles,
  ShieldAlert,
  ChefHat,
  CalendarDays,
  ArrowRight,
  Server,
  CheckCircle2,
  XCircle
} from 'lucide-react';

const MODULES = [
  {
    id: 'freshness',
    title: 'Freshness Detector',
    icon: Sparkles,
    category: 'Perishable Assessment',
    description: 'Inspect surface texture, discoloration, and physical signs of deterioration with strict food-safety boundaries.'
  },
  {
    id: 'hygiene',
    title: 'Hygiene & Safety Monitor',
    icon: ShieldAlert,
    category: 'Sanitary Audit',
    description: 'Audit food prep surfaces, cross-contact vectors, and kitchen hazard proximity with visual analysis.'
  },
  {
    id: 'kitchen',
    title: 'Smart Kitchen & Pantry',
    icon: ChefHat,
    category: 'Inventory & Guidance',
    description: 'Organize pantry ingredients, expiration timelines, and generate tailored zero-waste recipe recommendations.'
  },
  {
    id: 'meal_planner',
    title: 'Personalized Meal Planner',
    icon: CalendarDays,
    category: 'Dietary Scheduling',
    description: 'Synthesize multi-day meal agendas tailored to allergen exclusions, lifestyle goals, and pantry stock.'
  }
];

export function OverviewPage({ onNavigate, systemStatus, statusLoading, statusError }) {
  const backendOnline = !statusError && systemStatus !== null;
  const aiConfig = systemStatus?.ai_status;

  return (
    <div className="overview-editorial">
      {/* Cinematic Luxury-Editorial Hero Section */}
      <section className="editorial-hero-nestora">
        <div className="hero-text-side">
          <span className="hero-kicker">Food Intelligence • Computational Precision</span>
          <h2 className="hero-headline">
            Where culinary craft meets <em>scientific clarity</em>.
          </h2>
          <p className="hero-deck">
            FoodVerse AI unifies multimodal vision analysis, botanical decay assessment,
            and metabolic dietary synthesis into an intentional culinary intelligence platform.
          </p>
          <div className="hero-actions">
            <button 
              className="btn-primary"
              onClick={() => onNavigate('recognition')}
              id="overview-hero-action"
            >
              <ScanEye size={16} />
              <span>Launch Food Recognition</span>
            </button>
            <span style={{ fontSize: '0.8rem', color: 'var(--c-sage-dark)', fontFamily: 'var(--font-mono)' }}>
              Optical Analysis Ready
            </span>
          </div>
        </div>

        <div className="hero-image-side">
          <img 
            src="https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=80" 
            alt="Artisanal culinary ingredients and fresh harvest produce" 
            className="hero-cinematic-img"
            loading="lazy"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          <div className="hero-image-overlay" />
          <div className="hero-image-caption">
            Botanical & Culinary Intelligence
          </div>
        </div>
      </section>

      {/* Purposeful Module Workflows Grid */}
      <section>
        <div className="modules-section-title">
          <span>Specialized Workflows</span>
        </div>
        <div className="modules-editorial-grid">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                id={`editorial-card-${mod.id}`}
                className="editorial-card-nestora"
                onClick={() => onNavigate(mod.id)}
              >
                <div className="card-icon-wrap">
                  <Icon size={20} />
                </div>
                <span className="card-category">{mod.category}</span>
                <h3 className="card-title">{mod.title}</h3>
                <p className="card-description">{mod.description}</p>
                <div className="card-link">
                  <span>Open Module</span>
                  <ArrowRight size={13} />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Clean, Public-Ready Service Status */}
      <section className="system-truth-ledger">
        <div className="ledger-header" style={{ marginBottom: 0 }}>
          <div className="ledger-title">
            <Server size={17} style={{ color: 'var(--c-terracotta)' }} />
            <span>Platform Status</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {statusLoading ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--c-brown-grey)', fontFamily: 'var(--font-mono)' }}>
                Checking service availability...
              </span>
            ) : backendOnline ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--c-sage-dark)', display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                <CheckCircle2 size={14} /> Systems Operational
              </span>
            ) : (
              <span style={{ fontSize: '0.8rem', color: 'var(--c-danger)', display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                <XCircle size={14} /> Service Reconnecting
              </span>
            )}
            <span style={{ fontSize: '0.75rem', color: 'var(--c-brown-grey)', borderLeft: '1px solid var(--c-border-warm)', paddingLeft: '14px' }}>
              Vision & Analysis Pipelines Active
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
