import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Camera,
  UploadCloud,
  RotateCcw,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  HelpCircle,
  AlertOctagon,
  Info,
  Clock,
  Sparkles,
  ClipboardCheck,
  CheckSquare,
  AlertCircle
} from 'lucide-react';
import { analyzeHygieneImage, ApiError } from '../services/api';

const MAX_FILE_SIZE_MB = 8;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function HygieneMonitorPage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorState, setErrorState] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleClearImage = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setAnalysisResult(null);
    setErrorState(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [previewUrl]);

  const validateAndSetFile = (file) => {
    setErrorState(null);
    setAnalysisResult(null);

    if (!file) return;

    if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      setErrorState({
        code: 'UNSUPPORTED_FORMAT',
        message: 'Unsupported image type.',
        guidance: 'Please select a JPEG, PNG, or WebP photograph.'
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setErrorState({
        code: 'FILE_TOO_LARGE',
        message: `Image exceeds the ${MAX_FILE_SIZE_MB}MB limit.`,
        guidance: 'Please upload an image smaller than 8MB.'
      });
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    const newUrl = URL.createObjectURL(file);
    setPreviewUrl(newUrl);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    validateAndSetFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    validateAndSetFile(file);
  };

  const handleAnalyze = async () => {
    if (!selectedFile || isAnalyzing) return;

    setIsAnalyzing(true);
    setErrorState(null);

    try {
      const data = await analyzeHygieneImage(selectedFile);
      setAnalysisResult(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorState({
          code: err.errorCode || `HTTP_${err.status}`,
          message: err.message,
          guidance: err.guidance
        });
      } else {
        setErrorState({
          code: 'CLIENT_ERROR',
          message: 'An unexpected error occurred during hygiene analysis.',
          guidance: 'Please check your connection and retry.'
        });
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderAssessmentBadge = (assessment) => {
    switch (assessment) {
      case 'no_obvious_visible_concerns':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '6px',
            backgroundColor: 'rgba(82, 197, 163, 0.15)',
            border: '1px solid rgba(82, 197, 163, 0.35)',
            color: 'var(--emerald-light)',
            fontSize: '0.8rem',
            fontWeight: 600,
            fontFamily: 'var(--font-mono)'
          }}>
            <CheckCircle2 size={14} /> NO OBVIOUS VISIBLE CONCERNS
          </span>
        );
      case 'visible_concerns':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '6px',
            backgroundColor: 'rgba(230, 157, 69, 0.15)',
            border: '1px solid rgba(230, 157, 69, 0.35)',
            color: 'var(--citrus-warm)',
            fontSize: '0.8rem',
            fontWeight: 600,
            fontFamily: 'var(--font-mono)'
          }}>
            <AlertTriangle size={14} /> VISIBLE CONCERNS DETECTED
          </span>
        );
      default:
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-muted)',
            fontSize: '0.8rem',
            fontWeight: 600,
            fontFamily: 'var(--font-mono)'
          }}>
            <HelpCircle size={14} /> CANNOT ASSESS
          </span>
        );
    }
  };

  return (
    <div className="workspace-wrapper">
      <header className="module-editorial-header">
        <div className="module-category-eyebrow">
          <ShieldAlert size={14} /> Kitchen Safety & Sanitation Audit
        </div>
        <h2 className="module-display-title">Hygiene & Safety Compliance Monitor</h2>
        <p className="module-intro-deck">
          Automated visual sanitation analysis for kitchen prep surfaces, utensils, cross-contact vectors,
          and waste proximity. Grounded exclusively in observable evidence with strict food-safety boundaries.
        </p>
      </header>

      {/* Prominent Visual-Only Safety Disclaimer */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '14px 18px',
        borderRadius: '8px',
        backgroundColor: 'rgba(230, 157, 69, 0.07)',
        border: '1px solid rgba(230, 157, 69, 0.22)',
        marginBottom: '24px'
      }}>
        <ShieldAlert size={18} style={{ color: 'var(--citrus-warm)', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--citrus-warm)', display: 'block', marginBottom: '2px' }}>
            Visual Assessment Only — Cannot Certify Hygiene or Microbial Sterility
          </strong>
          Photographic inspection cannot detect invisible bacteria, viruses, biofilms, toxins, or chemical sanitizer concentration.
          A visually clean surface is not guaranteed to be sterile. Always adhere to standard HACCP protocols and sanitary wash cycles.
        </div>
      </div>

      {/* Workspace Split */}
      <div className="recognition-split-workspace">
        {/* Left: Viewport / Uploader */}
        <div className="viewfinder-panel">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            id="hygiene-image-input"
          />

          {!previewUrl ? (
            <div
              className={`viewfinder-frame ${isDragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              aria-label="Upload kitchen or prep area photo for hygiene inspection"
            >
              <div className="viewfinder-glass-overlay">
                <UploadCloud size={44} className="viewfinder-icon" />
                <span className="viewfinder-title">Drop kitchen station photo here</span>
                <span className="viewfinder-subtext">or click to browse from device</span>
                <div className="viewfinder-meta-specs">
                  <span>JPEG, PNG, WEBP</span>
                  <span>•</span>
                  <span>UP TO {MAX_FILE_SIZE_MB}MB</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="preview-container">
              <img
                src={previewUrl}
                alt="Kitchen prep area preview for hygiene inspection"
                className="preview-img"
              />
              <div className="preview-actions-bar">
                <button
                  type="button"
                  className="preview-action-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Replace image"
                >
                  <RotateCcw size={14} /> Replace Photo
                </button>
                <button
                  type="button"
                  className="preview-action-btn danger"
                  onClick={handleClearImage}
                  title="Remove image"
                >
                  <XCircle size={14} /> Remove
                </button>
              </div>
            </div>
          )}

          {/* Action Trigger */}
          <div style={{ marginTop: '16px' }}>
            <button
              type="button"
              id="analyze-hygiene-btn"
              className="btn-spotlight-primary"
              disabled={!selectedFile || isAnalyzing}
              onClick={handleAnalyze}
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '12px 20px',
                opacity: !selectedFile || isAnalyzing ? 0.6 : 1,
                cursor: !selectedFile || isAnalyzing ? 'not-allowed' : 'pointer'
              }}
            >
              {isAnalyzing ? (
                <>
                  <Clock size={16} className="spin-slow" />
                  <span>Inspecting Sanitary Conditions...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Analyze Hygiene & Safety</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Results / Guidance Panel */}
        <div className="insights-panel">
          {errorState && (
            <div className="error-callout" role="alert" style={{ marginBottom: '20px' }}>
              <AlertOctagon size={18} className="error-icon" />
              <div className="error-body">
                <div className="error-header">
                  <strong>{errorState.message}</strong>
                  <span className="error-code-badge">{errorState.code}</span>
                </div>
                {errorState.guidance && (
                  <p className="error-guidance">{errorState.guidance}</p>
                )}
              </div>
            </div>
          )}

          {isAnalyzing && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 24px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                border: '3px solid var(--border-medium)',
                borderTopColor: 'var(--emerald-light)',
                animation: 'spin 1s linear infinite',
                marginBottom: '16px'
              }} />
              <h4 style={{ fontSize: '1.05rem', color: 'var(--text-ivory)', marginBottom: '6px' }}>
                Evaluating Visible Sanitary Conditions
              </h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '380px' }}>
                Inspecting prep surfaces, cleanliness markers, and potential cross-contact risks...
              </p>
            </div>
          )}

          {!isAnalyzing && !analysisResult && !errorState && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 24px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              textAlign: 'center',
              color: 'var(--text-muted)'
            }}>
              <Camera size={40} style={{ marginBottom: '14px', strokeWidth: 1.5, opacity: 0.5 }} />
              <h4 style={{ fontSize: '0.98rem', color: 'var(--text-ivory)', marginBottom: '6px' }}>
                No Inspection Conducted Yet
              </h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '360px', lineHeight: 1.5 }}>
                Upload a photograph of a food preparation counter, cutting station, or dining area to begin automated visual audit.
              </p>
            </div>
          )}

          {analysisResult && !isAnalyzing && (
            <div className="results-deck" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Primary Assessment Header */}
              <div style={{
                padding: '22px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ClipboardCheck size={20} style={{ color: 'var(--emerald-light)' }} />
                    <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Operational Inspection Verdict
                    </span>
                  </div>
                  {renderAssessmentBadge(analysisResult.overall_assessment)}
                </div>

                <h3 style={{
                  fontSize: '1.25rem',
                  fontFamily: 'var(--font-serif)',
                  color: 'var(--text-ivory)',
                  marginBottom: '10px'
                }}>
                  {analysisResult.environment_summary}
                </h3>

                {analysisResult.confidence && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.76rem',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-hairline)'
                  }}>
                    <span>Model Confidence Estimate:</span>
                    <strong style={{ color: 'var(--text-ivory)' }}>{analysisResult.confidence}</strong>
                    <span style={{ color: 'var(--text-faint)' }}>(uncalibrated)</span>
                  </div>
                )}
              </div>

              {/* Visible Observations */}
              {analysisResult.observations && analysisResult.observations.length > 0 && (
                <div style={{
                  padding: '20px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px'
                }}>
                  <h4 style={{
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    color: 'var(--text-ivory)',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <CheckSquare size={16} style={{ color: 'var(--emerald-light)' }} />
                    <span>Direct Visual Observations</span>
                  </h4>
                  <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {analysisResult.observations.map((obs, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>{obs}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Cleanliness Indicators vs Potential Concerns Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Positive Cleanliness Indicators */}
                <div style={{
                  padding: '18px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <ShieldCheck size={16} style={{ color: 'var(--emerald-light)' }} />
                    <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--emerald-light)' }}>
                      Cleanliness Indicators
                    </span>
                  </div>
                  {analysisResult.cleanliness_indicators && analysisResult.cleanliness_indicators.length > 0 ? (
                    <ul style={{ paddingLeft: '18px', margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {analysisResult.cleanliness_indicators.map((item, idx) => (
                        <li key={idx} style={{ marginBottom: '4px' }}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                      No specific positive indicators observed in this view.
                    </p>
                  )}
                </div>

                {/* Potential Concerns */}
                <div style={{
                  padding: '18px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <AlertTriangle size={16} style={{ color: 'var(--citrus-warm)' }} />
                    <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--citrus-warm)' }}>
                      Potential Concerns
                    </span>
                  </div>
                  {analysisResult.potential_concerns && analysisResult.potential_concerns.length > 0 ? (
                    <ul style={{ paddingLeft: '18px', margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {analysisResult.potential_concerns.map((item, idx) => (
                        <li key={idx} style={{ marginBottom: '4px' }}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                      No visible cross-contact or sanitary hazard vectors observed.
                    </p>
                  )}
                </div>
              </div>

              {/* Recommended Actions */}
              {analysisResult.recommended_actions && analysisResult.recommended_actions.length > 0 && (
                <div style={{
                  padding: '18px',
                  backgroundColor: 'rgba(82, 197, 163, 0.05)',
                  border: '1px solid rgba(82, 197, 163, 0.2)',
                  borderRadius: '12px'
                }}>
                  <h4 style={{
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    color: 'var(--emerald-light)',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <CheckCircle2 size={16} />
                    <span>Recommended Sanitary Actions</span>
                  </h4>
                  <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {analysisResult.recommended_actions.map((act, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>{act}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Limitations & Model Metadata */}
              <div style={{
                padding: '16px',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-hairline)',
                borderRadius: '8px',
                fontSize: '0.76rem',
                color: 'var(--text-muted)',
                lineHeight: 1.5
              }}>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Info size={14} /> Evaluation Limitations:
                </div>
                {analysisResult.limitations && (
                  <ul style={{ paddingLeft: '18px', margin: '4px 0 10px 0' }}>
                    {analysisResult.limitations.map((lim, idx) => (
                      <li key={idx}>{lim}</li>
                    ))}
                  </ul>
                )}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border-hairline)',
                  paddingTop: '8px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.7rem'
                }}>
                  <span>INSPECTION: RECORDED</span>
                  <span>VERDICT: {analysisResult.overall_assessment?.toUpperCase()?.replace(/_/g, ' ') || 'EVALUATED'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
