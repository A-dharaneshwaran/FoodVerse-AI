import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ScanEye,
  Camera,
  UploadCloud,
  Layers,
  ArrowRight,
  Info,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RotateCcw,
  Sparkles,
  UtensilsCrossed,
  Activity,
  ShieldAlert,
  Clock
} from 'lucide-react';
import { analyzeFoodImage, ApiError } from '../services/api';

const MAX_FILE_SIZE_MB = 8;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function FoodRecognitionPage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Analysis execution states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorState, setErrorState] = useState(null); // { message, guidance, code }
  
  const fileInputRef = useRef(null);

  // Clean up object URLs when replacing, clearing, or unmounting
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
      const data = await analyzeFoodImage(selectedFile);
      setAnalysisResult(data);
    } catch (err) {
      setErrorState({
        code: err.errorCode || 'ANALYSIS_ERROR',
        message: err.message || 'An error occurred during food recognition.',
        guidance: err.guidance || 'Check backend status or verify network connectivity.'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="workspace-wrapper">
      <header className="module-editorial-header">
        <div className="module-category-eyebrow">
          <ScanEye size={14} /> Dish Recognition & Composition
        </div>
        <h2 className="module-display-title">Food Recognition & Nutrition Analysis</h2>
        <p className="module-intro-deck">
          Identify dishes, break down constituent ingredients, and estimate portion-calibrated nutritional metrics from photo evidence.
        </p>
      </header>

      {/* Main Workspace Split */}
      <div className="recognition-split-workspace">
        {/* Left: Viewport / Uploader */}
        <div className="viewfinder-panel">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            id="food-image-input"
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
                  or click to browse from device. JPEG, PNG, or WebP up to 8 MB.
                </p>
              </div>
              <div className="viewfinder-corner-label">IMAGE INGESTION • PHOTO ANALYSIS</div>
            </div>
          ) : (
            <div className="viewfinder-frame" style={{ position: 'relative' }}>
              <img
                src={previewUrl}
                alt="Selected food preview"
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
                  <Sparkles size={28} className="animate-spin" style={{ color: 'var(--emerald-light)' }} />
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-ivory)' }}>
                    Analyzing dish and nutritional breakdown...
                  </span>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    Processing Visual Features
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
                className="btn-spotlight-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera size={15} />
                <span>Select Image</span>
              </button>
            ) : (
              <>
                <button
                  className="btn-spotlight-primary"
                  style={{ flex: 1.5, justifyContent: 'center' }}
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                >
                  <ScanEye size={16} />
                  <span>{isAnalyzing ? 'Analyzing...' : 'Run Vision Recognition'}</span>
                </button>
                <button
                  className="btn-header-refresh"
                  style={{ flex: 1, justifyContent: 'center' }}
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

        {/* Right: Results or Architecture Spec */}
        <div className="metadata-taxonomy-deck">
          {analysisResult ? (
            /* Real Structured Analysis Results */
            <div className="taxonomy-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--emerald-light)', textTransform: 'uppercase' }}>
                    Identified Dish
                  </span>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.45rem', fontWeight: 600, color: 'var(--text-ivory)', margin: '2px 0 4px' }}>
                    {analysisResult.dish_name}
                  </h3>
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {analysisResult.description}
                  </p>
                </div>
              </div>

              {/* Certainty Note */}
              <div style={{ padding: '10px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <strong>Visual Certainty:</strong> {analysisResult.confidence_or_certainty_note}
                </span>
              </div>

              {/* Portion & Serving Size */}
              {analysisResult.estimated_serving_size && (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-ivory)' }}>Portion: </strong>
                  {analysisResult.estimated_serving_size}
                </div>
              )}

              {/* Ingredients Lists */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--emerald-light)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                    Visible Ingredients
                  </span>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {analysisResult.visible_ingredients.map((ing, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--emerald-light)' }} />
                        {ing}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--citrus-warm)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                    Inferred Preparation
                  </span>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {analysisResult.inferred_ingredients.map((ing, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--citrus-warm)' }} />
                        {ing}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Estimated Nutrition Grid */}
              {analysisResult.estimated_nutrition && (
                <div style={{ borderTop: '1px solid var(--border-hairline)', paddingTop: '14px' }}>
                  <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                    Estimated Macronutrients (Visual Approximation)
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center' }}>
                    <div style={{ padding: '8px 4px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>CALORIES</span>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--text-ivory)' }}>
                        {analysisResult.estimated_nutrition.calories_kcal != null ? `${analysisResult.estimated_nutrition.calories_kcal}` : 'N/A'}
                      </strong>
                    </div>
                    <div style={{ padding: '8px 4px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>PROTEIN</span>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--emerald-light)' }}>
                        {analysisResult.estimated_nutrition.protein_g != null ? `${analysisResult.estimated_nutrition.protein_g}g` : 'N/A'}
                      </strong>
                    </div>
                    <div style={{ padding: '8px 4px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>CARBS</span>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--citrus-warm)' }}>
                        {analysisResult.estimated_nutrition.carbohydrates_g != null ? `${analysisResult.estimated_nutrition.carbohydrates_g}g` : 'N/A'}
                      </strong>
                    </div>
                    <div style={{ padding: '8px 4px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>FAT</span>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--danger-rose)' }}>
                        {analysisResult.estimated_nutrition.fat_g != null ? `${analysisResult.estimated_nutrition.fat_g}g` : 'N/A'}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Limitations & Uncertainty */}
              {analysisResult.limitations?.length > 0 && (
                <div style={{ padding: '10px 12px', borderRadius: '6px', backgroundColor: 'rgba(230, 157, 69, 0.05)', border: '1px solid rgba(230, 157, 69, 0.2)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--citrus-warm)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                    Analysis Limitations
                  </span>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    {analysisResult.limitations.join(' • ')}
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                <span>ANALYSIS: COMPLETE</span>
                <span>ITEMS DETECTED: {analysisResult.visible_food_items?.length || 0}</span>
              </div>
            </div>
          ) : (
            /* Analysis Protocol Specifications */
            <div className="taxonomy-card">
              <h4 className="taxonomy-title">
                <Layers size={16} />
                <span>Visual Analysis Protocol</span>
              </h4>
              
              <div className="stage-pipeline-list">
                <div className="stage-pipeline-step">
                  <span className="stage-step-num">01</span>
                  <div>
                    <strong style={{ color: 'var(--text-ivory)', display: 'block' }}>Image Normalization</strong>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Decompression safety checks, EXIF orientation alignment, and resolution normalization.
                    </span>
                  </div>
                </div>

                <div className="stage-pipeline-step">
                  <span className="stage-step-num">02</span>
                  <div>
                    <strong style={{ color: 'var(--text-ivory)', display: 'block' }}>Visual Feature Extraction</strong>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Multimodal visual parsing identifies culinary components, portion cues, and preparation attributes.
                    </span>
                  </div>
                </div>

                <div className="stage-pipeline-step">
                  <span className="stage-step-num">03</span>
                  <div>
                    <strong style={{ color: 'var(--text-ivory)', display: 'block' }}>Nutritional Decomposition</strong>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Caloric and macronutrient ranges estimated based on observed ingredients and estimated volume.
                    </span>
                  </div>
                </div>

                <div className="stage-pipeline-step">
                  <span className="stage-step-num">04</span>
                  <div>
                    <strong style={{ color: 'var(--text-ivory)', display: 'block' }}>Safety & Boundary Advisory</strong>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Automatic surfacing of potential allergens, culinary hidden elements, and visual limitations.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="taxonomy-card" style={{ backgroundColor: 'var(--bg-surface-elevated)' }}>
            <h5 style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Analysis Guidelines
            </h5>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              For best accuracy, photograph dishes under balanced lighting from a 45-degree angle showing distinct ingredients clearly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
