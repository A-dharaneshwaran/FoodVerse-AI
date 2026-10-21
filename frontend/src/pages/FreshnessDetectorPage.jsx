import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Camera,
  UploadCloud,
  ThermometerSnowflake,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  HelpCircle,
  AlertOctagon,
  Info,
  Clock
} from 'lucide-react';
import { analyzeFreshnessImage, ApiError } from '../services/api';

const MAX_FILE_SIZE_MB = 8;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function FreshnessDetectorPage() {
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
      const data = await analyzeFreshnessImage(selectedFile);
      setAnalysisResult(data);
    } catch (err) {
      setErrorState({
        code: err.errorCode || 'ANALYSIS_ERROR',
        message: err.message || 'An error occurred during freshness assessment.',
        guidance: err.guidance || 'Check backend status or verify network connectivity.'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'appears_fresh':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '6px',
            backgroundColor: 'rgba(46, 172, 134, 0.15)',
            border: '1px solid rgba(46, 172, 134, 0.35)',
            color: 'var(--emerald-light)',
            fontSize: '0.8rem',
            fontWeight: 600,
            fontFamily: 'var(--font-mono)'
          }}>
            <CheckCircle2 size={14} /> APPEARS FRESH
          </span>
        );
      case 'possible_deterioration':
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
            <AlertTriangle size={14} /> POSSIBLE DETERIORATION
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
          <Sparkles size={14} /> Perishables & Produce Assessment
        </div>
        <h2 className="module-display-title">Freshness & Spoilage Detector</h2>
        <p className="module-intro-deck">
          Assess surface texture, discoloration, wilting, and physical blemish patterns from visual evidence with strict food-safety boundaries.
        </p>
      </header>

      {/* Prominent Safety Disclaimer */}
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
            Visual Assessment Only — Not a Microbiological Safety Guarantee
          </strong>
          Photographs cannot detect invisible bacterial toxins, chemical residues, or internal pathogens.
          Never consume food with off odors, slimy texture, or uncertain temperature history regardless of visual condition score.
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
            id="freshness-image-input"
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
              style={{ cursor: 'pointer' }}
            >
              <div className="viewfinder-crosshair" />
              <div className="viewfinder-center-info">
                <UploadCloud size={32} style={{ color: 'var(--emerald-light)', opacity: 0.85 }} />
                <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-ivory)' }}>
                  Drag & Drop Food Photo
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  or click to select. Inspect produce, fruits, proteins, or baked items.
                </p>
              </div>
              <div className="viewfinder-corner-label">SURFACE INSPECTION • VISUAL ASSESSMENT</div>
            </div>
          ) : (
            <div className="viewfinder-frame" style={{ position: 'relative' }}>
              <img
                src={previewUrl}
                alt="Selected item preview"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
              {isAnalyzing && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(11, 15, 20, 0.82)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  backdropFilter: 'blur(4px)'
                }}>
                  <ThermometerSnowflake size={28} className="animate-spin" style={{ color: 'var(--emerald-light)' }} />
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-ivory)' }}>
                    Assessing visual freshness indicators...
                  </span>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    Analyzing Optical Decay Patterns
                  </span>
                </div>
              )}
              <div className="viewfinder-corner-label">
                {selectedFile?.name} ({(selectedFile?.size / (1024 * 1024)).toFixed(2)} MB)
              </div>
            </div>
          )}

          {/* Action Row */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {!previewUrl ? (
              <button
                className="btn-primary"
                style={{ flex: 1 }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera size={15} />
                <span>Select Image for Inspection</span>
              </button>
            ) : (
              <>
                <button
                  className="btn-primary"
                  style={{ flex: 1.5 }}
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                >
                  <ThermometerSnowflake size={16} />
                  <span>{isAnalyzing ? 'Inspecting...' : 'Analyze Freshness'}</span>
                </button>
                <button
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={handleClearImage}
                  disabled={isAnalyzing}
                >
                  <RotateCcw size={14} />
                  <span>Replace Photo</span>
                </button>
              </>
            )}
          </div>

          {/* Error Banner */}
          {errorState && (
            <div style={{
              padding: '14px 16px',
              borderRadius: '8px',
              backgroundColor: 'rgba(224, 82, 99, 0.08)',
              border: '1px solid rgba(224, 82, 99, 0.3)',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start'
            }}>
              <XCircle size={18} style={{ color: 'var(--danger-rose)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h5 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--danger-rose)', marginBottom: '2px' }}>
                  {errorState.message}
                </h5>
                {errorState.guidance && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {errorState.guidance}
                  </p>
                )}
                <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  CODE: {errorState.code}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Results or Protocol Deck */}
        <div className="metadata-taxonomy-deck">
          {analysisResult ? (
            /* Real Structured Freshness Assessment Results */
            <div className="taxonomy-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--emerald-light)', textTransform: 'uppercase' }}>
                    CATEGORY: {analysisResult.food_category}
                  </span>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.45rem', fontWeight: 600, color: 'var(--text-ivory)', margin: '2px 0 6px' }}>
                    {analysisResult.food_name}
                  </h3>
                </div>
                <div>
                  {renderStatusBadge(analysisResult.freshness_status)}
                </div>
              </div>

              {/* Score pill if provided */}
              {analysisResult.visual_condition_score !== null && (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Visual Condition Index
                    </span>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                      Estimated purely on observable texture, color vibrancy, and firmness cues
                    </span>
                  </div>
                  <div style={{
                    fontSize: '1.5rem',
                    fontFamily: 'var(--font-serif)',
                    fontWeight: 600,
                    color: analysisResult.visual_condition_score >= 80 ? 'var(--emerald-light)' : analysisResult.visual_condition_score >= 50 ? 'var(--citrus-warm)' : 'var(--danger-rose)'
                  }}>
                    {analysisResult.visual_condition_score}
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/100</span>
                  </div>
                </div>
              )}

              {/* Explanation */}
              <div>
                <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Visual Analysis Grounding
                </span>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  {analysisResult.explanation}
                </p>
              </div>

              {/* Indicators Split */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--emerald-light)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                    Positive Indicators ({analysisResult.positive_indicators?.length || 0})
                  </span>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {analysisResult.positive_indicators?.map((item, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--emerald-light)' }} />
                        {item}
                      </li>
                    ))}
                    {(!analysisResult.positive_indicators || analysisResult.positive_indicators.length === 0) && (
                      <li style={{ color: 'var(--text-muted)' }}>None observed</li>
                    )}
                  </ul>
                </div>

                <div>
                  <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--citrus-warm)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                    Observed Concerns ({analysisResult.concerns?.length || 0})
                  </span>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {analysisResult.concerns?.map((item, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--citrus-warm)' }} />
                        {item}
                      </li>
                    ))}
                    {(!analysisResult.concerns || analysisResult.concerns.length === 0) && (
                      <li style={{ color: 'var(--text-muted)' }}>None visually detected</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Recommended Action */}
              <div style={{
                padding: '12px 14px',
                borderRadius: '6px',
                backgroundColor: 'rgba(46, 172, 134, 0.06)',
                border: '1px solid rgba(46, 172, 134, 0.25)'
              }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--emerald-light)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                  Recommended Action
                </span>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {analysisResult.recommended_action}
                </p>
              </div>

              {/* Safety Disclaimers */}
              <div style={{
                padding: '10px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(230, 157, 69, 0.05)',
                border: '1px solid rgba(230, 157, 69, 0.2)'
              }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--citrus-warm)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                  Safety Advisory & Inherent Limitations
                </span>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {analysisResult.safety_warning}
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                <span>ASSESSMENT: RECORDED</span>
                <span>STATUS: {analysisResult.freshness_status?.toUpperCase()?.replace('_', ' ') || 'EVALUATED'}</span>
              </div>
            </div>
          ) : (
            /* Scientific Protocol Deck Before Analysis */
            <div className="taxonomy-card">
              <h4 className="taxonomy-title">
                <ThermometerSnowflake size={16} />
                <span>Visual Freshness Protocol & Indicators</span>
              </h4>

              <div className="stage-pipeline-list">
                <div className="stage-pipeline-step">
                  <span className="stage-step-num">01</span>
                  <div>
                    <strong style={{ color: 'var(--text-ivory)', display: 'block' }}>Taxonomy & Baseline Matching</strong>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Categorizes the specimen (leafy produce, pome fruits, proteins, dairy) to determine species-specific decay vectors.
                    </span>
                  </div>
                </div>

                <div className="stage-pipeline-step">
                  <span className="stage-step-num">02</span>
                  <div>
                    <strong style={{ color: 'var(--text-ivory)', display: 'block' }}>Optical Decay Analysis</strong>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Scans for oxidation browning, mold colonies, surface wrinkling, moisture weeping, or cellular dehydration.
                    </span>
                  </div>
                </div>

                <div className="stage-pipeline-step">
                  <span className="stage-step-num">03</span>
                  <div>
                    <strong style={{ color: 'var(--text-ivory)', display: 'block' }}>Evidence-Grounded Rating</strong>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Assigns condition index based strictly on observable traits; flags 'cannot_assess' when uncertain.
                    </span>
                  </div>
                </div>

                <div className="stage-pipeline-step">
                  <span className="stage-step-num">04</span>
                  <div>
                    <strong style={{ color: 'var(--text-ivory)', display: 'block' }}>Actionable Guidance & Disclaimers</strong>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Provides practical storage/culling actions alongside clear microbiological food-safety caveats.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="taxonomy-card" style={{ backgroundColor: 'var(--bg-surface-elevated)' }}>
            <h5 style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Responsible Food-Safety Guardrails
            </h5>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Food safety requires verified temperature, smell, and handling history. Visual inspection operates as an initial aesthetic triage and never guarantees microbiological sterility.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
