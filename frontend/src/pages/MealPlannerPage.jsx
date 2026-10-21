import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CalendarDays,
  Clock,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShoppingCart,
  ChefHat,
  Package,
  Layers,
  ChevronDown,
  ChevronUp,
  XCircle,
  RotateCcw,
  Utensils
} from 'lucide-react';
import { generateMealPlan, ApiError } from '../services/api';

const INVENTORY_STORAGE_KEY = 'foodverse_kitchen_inventory_v1';

const DIETARY_OPTIONS = [
  { value: 'none', label: 'No Specific Diet (Omnivore)' },
  { value: 'vegetarian', label: 'Vegetarian (No meat/fish)' },
  { value: 'vegan', label: 'Vegan (100% plant-based)' },
  { value: 'pescatarian', label: 'Pescatarian (Vegetarian + Seafood)' },
  { value: 'keto', label: 'Low-Carb / Keto' },
  { value: 'mediterranean', label: 'Mediterranean Style' }
];

const COMMON_ALLERGIES = [
  'Peanuts',
  'Tree Nuts',
  'Dairy',
  'Gluten',
  'Eggs',
  'Shellfish',
  'Soy',
  'Sesame'
];

const MEAL_TYPE_OPTIONS = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Daily Snack' }
];

const COOKING_TIME_OPTIONS = [
  'Under 20 minutes (Quick & Easy)',
  'Under 30 minutes (Standard)',
  'Under 45 minutes (Elaborate)',
  'Weekend Batch / Meal Prep'
];

export function MealPlannerPage() {
  // Read local inventory from Smart Kitchen if available
  const [localInventory, setLocalInventory] = useState([]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(INVENTORY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setLocalInventory(parsed);
        }
      }
    } catch (e) {
      console.warn('Could not read Smart Kitchen inventory from localStorage:', e);
    }
  }, []);

  // Form State
  const [durationDays, setDurationDays] = useState(3);
  const [dietaryPreference, setDietaryPreference] = useState('none');
  const [selectedMeals, setSelectedMeals] = useState(['breakfast', 'lunch', 'dinner']);
  const [selectedAllergies, setSelectedAllergies] = useState([]);
  const [customExclusions, setCustomExclusions] = useState('');
  const [preferredIngredients, setPreferredIngredients] = useState('');
  const [prioritizeInventoryIds, setPrioritizeInventoryIds] = useState([]);
  const [cuisinePreference, setCuisinePreference] = useState('Flexible / Global');
  const [cookingTime, setCookingTime] = useState('Under 30 minutes (Standard)');
  const [calorieTarget, setCalorieTarget] = useState('');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [planResult, setPlanResult] = useState(null);
  const [generationError, setGenerationError] = useState(null);
  const [activePlanInputs, setActivePlanInputs] = useState(null);

  // Expandable days in view
  const [expandedDay, setExpandedDay] = useState(1);

  // Check if form has changed relative to currently rendered plan
  const isPlanStale = useMemo(() => {
    if (!activePlanInputs) return false;
    return (
      activePlanInputs.durationDays !== durationDays ||
      activePlanInputs.dietaryPreference !== dietaryPreference ||
      JSON.stringify(activePlanInputs.selectedMeals) !== JSON.stringify(selectedMeals) ||
      JSON.stringify(activePlanInputs.selectedAllergies) !== JSON.stringify(selectedAllergies) ||
      activePlanInputs.customExclusions !== customExclusions ||
      JSON.stringify(activePlanInputs.prioritizeInventoryIds) !== JSON.stringify(prioritizeInventoryIds)
    );
  }, [
    activePlanInputs,
    durationDays,
    dietaryPreference,
    selectedMeals,
    selectedAllergies,
    customExclusions,
    prioritizeInventoryIds
  ]);

  const toggleMealType = (mealId) => {
    setSelectedMeals((prev) => {
      if (prev.includes(mealId)) {
        if (prev.length === 1) return prev; // Keep at least one meal
        return prev.filter((m) => m !== mealId);
      } else {
        return [...prev, mealId];
      }
    });
  };

  const toggleAllergy = (allergy) => {
    setSelectedAllergies((prev) =>
      prev.includes(allergy) ? prev.filter((a) => a !== allergy) : [...prev, allergy]
    );
  };

  const toggleInventoryItem = (itemId) => {
    setPrioritizeInventoryIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const handleSelectAllInventory = () => {
    if (prioritizeInventoryIds.length === localInventory.length) {
      setPrioritizeInventoryIds([]);
    } else {
      setPrioritizeInventoryIds(localInventory.map((i) => i.id));
    }
  };

  // Convert selected inventory IDs to names for backend
  const prioritizedInventoryNames = useMemo(() => {
    const idSet = new Set(prioritizeInventoryIds);
    return localInventory.filter((item) => idSet.has(item.id)).map((item) => item.name);
  }, [localInventory, prioritizeInventoryIds]);

  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    setGenerationError(null);

    // Build consolidated allergy list
    const allExclusions = [...selectedAllergies];
    if (customExclusions.trim()) {
      customExclusions
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((item) => {
          if (!allExclusions.includes(item)) allExclusions.push(item);
        });
    }

    const preferredList = preferredIngredients
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      duration_days: durationDays,
      meals_per_day: selectedMeals,
      dietary_preference: dietaryPreference,
      allergies_and_exclusions: allExclusions,
      preferred_ingredients: preferredList,
      inventory_ingredients: prioritizedInventoryNames,
      cuisine_preference: cuisinePreference,
      cooking_time_preference: cookingTime,
      calorie_target_daily: calorieTarget ? parseInt(calorieTarget, 10) : undefined
    };

    try {
      const data = await generateMealPlan(payload);
      setPlanResult(data);
      setActivePlanInputs({
        durationDays,
        dietaryPreference,
        selectedMeals: [...selectedMeals],
        selectedAllergies: [...selectedAllergies],
        customExclusions,
        prioritizeInventoryIds: [...prioritizeInventoryIds]
      });
      setExpandedDay(1);
    } catch (err) {
      if (err instanceof ApiError) {
        setGenerationError({
          code: err.errorCode || `HTTP_${err.status}`,
          message: err.message,
          guidance: err.guidance
        });
      } else {
        setGenerationError({
          code: 'CLIENT_ERROR',
          message: 'Failed to generate personalized meal plan.',
          guidance: 'Check that the analysis server is reachable and retry.'
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="workspace-wrapper">
      <header className="module-editorial-header">
        <div className="module-category-eyebrow">
          <CalendarDays size={14} /> Metabolic & Biometric Planning Track
        </div>
        <h2 className="module-display-title">Personalized Dietary & Meal Planner</h2>
        <p className="module-intro-deck">
          Hyper-individualized diet synthesis tailored to dietary constraints, allergen blacklists,
          cooking-time preferences, and available Smart Kitchen pantry stock.
        </p>
      </header>

      {/* Prominent Health & Allergen Disclaimer */}
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
            Nutritional Estimates & Allergen Advisory
          </strong>
          All calorie, macronutrient, and portion values are model approximations and not laboratory or medical measurements.
          If you have severe allergies, always verify manufacturer packaging for cross-contamination warnings.
          FoodVerse AI does not guarantee medical outcomes or weight-loss results.
        </div>
      </div>

      {/* Split Planner Layout: Left Preferences Form | Right Structured Meal Plan */}
      <div className="meal-planner-split" style={{ display: 'grid', gridTemplateColumns: '1.05fr 1.35fr', gap: '28px' }}>
        {/* Left: Preferences Form */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--c-border-warm)',
          borderRadius: '8px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxShadow: 'var(--shadow-subtle)'
        }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontFamily: 'var(--font-serif)', fontWeight: 400, color: 'var(--c-espresso)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} style={{ color: 'var(--c-terracotta)' }} />
              <span>Planning Parameters</span>
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--c-brown-grey)', marginTop: '2px' }}>
              Configure your schedule, dietary style, and ingredient preferences to synthesize an actionable meal agenda.
            </p>
          </div>

          {/* 1. Duration and Dietary Style */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Plan Duration:
              </label>
              <select
                value={durationDays}
                onChange={(e) => setDurationDays(parseInt(e.target.value, 10))}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-hairline)',
                  color: 'var(--text-ivory)',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              >
                <option value={1}>1 Day (Single Day Plan)</option>
                <option value={2}>2 Days (Weekend / Duo)</option>
                <option value={3}>3 Days (Standard Sprint)</option>
                <option value={5}>5 Days (Work Week)</option>
                <option value={7}>7 Days (Full Week Matrix)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Dietary Preference:
              </label>
              <select
                value={dietaryPreference}
                onChange={(e) => setDietaryPreference(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-hairline)',
                  color: 'var(--text-ivory)',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              >
                {DIETARY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Daily Meals Included */}
          <div>
            <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Meals to Include per Day:
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {MEAL_TYPE_OPTIONS.map((meal) => {
                const isSelected = selectedMeals.includes(meal.id);
                return (
                  <button
                    key={meal.id}
                    type="button"
                    onClick={() => toggleMealType(meal.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: isSelected ? 'var(--emerald-light)' : 'var(--border-hairline)',
                      backgroundColor: isSelected ? 'rgba(82, 197, 163, 0.12)' : 'var(--bg-surface-elevated)',
                      color: isSelected ? 'var(--emerald-light)' : 'var(--text-secondary)',
                      fontSize: '0.78rem',
                      fontWeight: isSelected ? 600 : 400,
                      cursor: 'pointer'
                    }}
                  >
                    {meal.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Allergies & Excluded Ingredients */}
          <div>
            <label style={{ fontSize: '0.74rem', color: 'var(--citrus-warm)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
              Allergies & Exclusions to Avoid:
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {COMMON_ALLERGIES.map((allergy) => {
                const isSelected = selectedAllergies.includes(allergy);
                return (
                  <button
                    key={allergy}
                    type="button"
                    onClick={() => toggleAllergy(allergy)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: '1px solid',
                      borderColor: isSelected ? 'rgba(230, 80, 80, 0.5)' : 'var(--border-hairline)',
                      backgroundColor: isSelected ? 'rgba(230, 80, 80, 0.15)' : 'var(--bg-surface-elevated)',
                      color: isSelected ? '#ff9999' : 'var(--text-secondary)',
                      fontSize: '0.74rem',
                      cursor: 'pointer'
                    }}
                  >
                    {allergy}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              placeholder="Additional exclusions (e.g. cilantro, mushrooms, pork)..."
              value={customExclusions}
              onChange={(e) => setCustomExclusions(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-hairline)',
                color: 'var(--text-ivory)',
                fontSize: '0.78rem',
                outline: 'none'
              }}
            />
          </div>

          {/* 4. Smart Kitchen Pantry Integration */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Package size={13} style={{ color: 'var(--emerald-light)' }} />
                <span>Prioritize Smart Kitchen Pantry Stock:</span>
              </label>
              {localInventory.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllInventory}
                  style={{ background: 'none', border: 'none', color: 'var(--emerald-light)', fontSize: '0.72rem', cursor: 'pointer' }}
                >
                  {prioritizeInventoryIds.length === localInventory.length ? 'Clear' : 'Select All'}
                </button>
              )}
            </div>

            {localInventory.length === 0 ? (
              <div style={{
                padding: '10px 12px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px dashed var(--border-hairline)',
                fontSize: '0.76rem',
                color: 'var(--text-muted)'
              }}>
                No items recorded in local Smart Kitchen yet. You can still generate plans freely!
              </div>
            ) : (
              <div style={{
                maxHeight: '120px',
                overflowY: 'auto',
                padding: '8px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-hairline)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px'
              }}>
                {localInventory.map((item) => {
                  const isChecked = prioritizeInventoryIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleInventoryItem(item.id)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        border: '1px solid',
                        borderColor: isChecked ? 'var(--emerald-light)' : 'var(--border-hairline)',
                        backgroundColor: isChecked ? 'rgba(82, 197, 163, 0.14)' : 'var(--bg-surface)',
                        color: isChecked ? 'var(--emerald-light)' : 'var(--text-secondary)',
                        fontSize: '0.72rem',
                        cursor: 'pointer'
                      }}
                    >
                      {item.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 5. Cooking Time & Optional Calorie Target */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Cooking Time Preference:
              </label>
              <select
                value={cookingTime}
                onChange={(e) => setCookingTime(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-hairline)',
                  color: 'var(--text-ivory)',
                  fontSize: '0.8rem',
                  outline: 'none'
                }}
              >
                {COOKING_TIME_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Daily Calorie Target (optional):
              </label>
              <input
                type="number"
                placeholder="e.g. 2000"
                value={calorieTarget}
                onChange={(e) => setCalorieTarget(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-hairline)',
                  color: 'var(--text-ivory)',
                  fontSize: '0.8rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Action Trigger */}
          <button
            type="button"
            className="btn-spotlight-primary"
            onClick={handleGeneratePlan}
            disabled={isGenerating || selectedMeals.length === 0}
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '12px 18px',
              marginTop: '6px',
              opacity: isGenerating ? 0.6 : 1,
              cursor: isGenerating ? 'not-allowed' : 'pointer'
            }}
            id="generate-meal-plan-btn"
          >
            {isGenerating ? (
              <>
                <Clock size={16} className="spin-slow" />
                <span>Synthesizing Multi-Day Meal Plan...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>Generate Personalized Meal Plan</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Structured Meal Plan & Shopping List */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--c-border-warm)',
          borderRadius: '8px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxShadow: 'var(--shadow-subtle)'
        }}>
          {generationError && (
            <div className="error-callout" role="alert">
              <XCircle size={18} className="error-icon" />
              <div className="error-body">
                <div className="error-header">
                  <strong>{generationError.message}</strong>
                  <span className="error-code-badge">{generationError.code}</span>
                </div>
                {generationError.guidance && <p className="error-guidance">{generationError.guidance}</p>}
              </div>
            </div>
          )}

          {isPlanStale && planResult && !isGenerating && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: 'rgba(230, 157, 69, 0.1)',
              border: '1px solid rgba(230, 157, 69, 0.3)',
              fontSize: '0.76rem',
              color: 'var(--citrus-warm)'
            }}>
              <span>Parameters changed. Click "Generate" to recalculate your meal schedule.</span>
              <RotateCcw size={13} />
            </div>
          )}

          {isGenerating && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '80px 24px',
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
                Crafting Personalized Culinary Schedule
              </h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '380px', lineHeight: 1.5 }}>
                Evaluating dietary preferences, respecting allergens, and prioritizing your pantry ingredients...
              </p>
            </div>
          )}

          {!isGenerating && !planResult && !generationError && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 24px',
              textAlign: 'center',
              color: 'var(--c-brown-grey)',
              backgroundColor: 'var(--c-oat-soft)',
              borderRadius: '6px',
              border: '1px dashed var(--c-border-warm)'
            }}>
              <CalendarDays size={38} style={{ marginBottom: '12px', strokeWidth: 1.5, color: 'var(--c-terracotta)', opacity: 0.85 }} />
              <h4 style={{ fontSize: '1.05rem', fontFamily: 'var(--font-serif)', color: 'var(--c-espresso)', marginBottom: '6px' }}>
                Meal Agenda Workspace Ready
              </h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--c-brown-grey)', maxWidth: '340px', lineHeight: 1.5 }}>
                Configure duration, dietary preferences, and allergens on the left to synthesize recipes, portion guidance, and a consolidated shopping list.
              </p>
            </div>
          )}

          {planResult && !isGenerating && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Header Badge */}
              <div style={{
                padding: '18px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-hairline)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--text-ivory)', fontFamily: 'var(--font-serif)', margin: 0 }}>
                    {planResult.planning_period}
                  </h3>
                  <span style={{
                    fontSize: '0.72rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--emerald-light)',
                    backgroundColor: 'rgba(82, 197, 163, 0.1)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid rgba(82, 197, 163, 0.25)'
                  }}>
                    {planResult.dietary_preference_applied}
                  </span>
                </div>

                {planResult.allergies_respected && planResult.allergies_respected.length > 0 && (
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={14} style={{ color: 'var(--emerald-light)' }} />
                    <span>Allergens Excluded: </span>
                    <strong style={{ color: 'var(--text-ivory)' }}>{planResult.allergies_respected.join(', ')}</strong>
                  </div>
                )}
              </div>

              {/* Day Tabs */}
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {planResult.daily_plans.map((day) => {
                  const isActive = expandedDay === day.day_number;
                  return (
                    <button
                      key={day.day_number}
                      type="button"
                      onClick={() => setExpandedDay(day.day_number)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: isActive ? 'var(--emerald-light)' : 'var(--border-hairline)',
                        backgroundColor: isActive ? 'rgba(82, 197, 163, 0.12)' : 'var(--bg-surface-elevated)',
                        color: isActive ? 'var(--emerald-light)' : 'var(--text-secondary)',
                        fontSize: '0.78rem',
                        fontWeight: isActive ? 600 : 400,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {day.day_label}
                    </button>
                  );
                })}
              </div>

              {/* Active Day Content */}
              {planResult.daily_plans
                .filter((day) => day.day_number === expandedDay)
                .map((day) => (
                  <div key={day.day_number} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-ivory)' }}>
                        {day.daily_theme || day.day_label}
                      </span>
                      {day.daily_estimated_calories && (
                        <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'var(--citrus-warm)' }}>
                          {day.daily_estimated_calories}
                        </span>
                      )}
                    </div>

                    {day.meals.map((meal, mIdx) => (
                      <div
                        key={mIdx}
                        style={{
                          padding: '16px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--bg-surface-elevated)',
                          border: '1px solid var(--border-hairline)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{
                            fontSize: '0.7rem',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--emerald-light)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em'
                          }}>
                            {meal.meal_type}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {meal.estimated_prep_and_cook_time}
                          </span>
                        </div>

                        <h4 style={{ fontSize: '0.96rem', color: 'var(--text-ivory)', marginBottom: '4px' }}>
                          {meal.meal_name}
                        </h4>

                        {meal.short_description && (
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.45 }}>
                            {meal.short_description}
                          </p>
                        )}

                        {/* Inventory used vs Needed */}
                        {meal.uses_inventory && meal.uses_inventory.length > 0 && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--emerald-light)', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>From Pantry: </span>
                            {meal.uses_inventory.join(', ')}
                          </div>
                        )}

                        {/* Ingredients */}
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          <strong style={{ color: 'var(--text-ivory)', display: 'block', marginBottom: '2px' }}>Ingredients:</strong>
                          <ul style={{ paddingLeft: '18px', margin: 0, lineHeight: 1.45 }}>
                            {meal.ingredients.map((ing, iIdx) => (
                              <li key={iIdx}>{ing}</li>
                            ))}
                          </ul>
                        </div>

                        {/* Steps */}
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                          <strong style={{ color: 'var(--text-ivory)', display: 'block', marginBottom: '2px' }}>Preparation:</strong>
                          <ol style={{ paddingLeft: '18px', margin: 0, lineHeight: 1.45 }}>
                            {meal.preparation_steps.map((st, sIdx) => (
                              <li key={sIdx} style={{ marginBottom: '2px' }}>{st}</li>
                            ))}
                          </ol>
                        </div>

                        {/* Estimated Nutrition Pill */}
                        {meal.estimated_nutrition && (
                          <div style={{
                            display: 'flex',
                            gap: '12px',
                            marginTop: '10px',
                            paddingTop: '8px',
                            borderTop: '1px solid var(--border-hairline)',
                            fontSize: '0.7rem',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-muted)'
                          }}>
                            {Object.entries(meal.estimated_nutrition).map(([k, v]) => (
                              <span key={k}>
                                {k}: <strong style={{ color: 'var(--text-secondary)' }}>{v}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}

              {/* Consolidated Shopping List */}
              {planResult.consolidated_shopping_list && planResult.consolidated_shopping_list.length > 0 && (
                <div style={{
                  padding: '16px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(82, 197, 163, 0.04)',
                  border: '1px solid rgba(82, 197, 163, 0.2)'
                }}>
                  <h4 style={{
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    color: 'var(--emerald-light)',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <ShoppingCart size={15} />
                    <span>Consolidated Grocery Shopping List</span>
                  </h4>
                  <ul style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '4px 16px',
                    paddingLeft: '18px',
                    margin: 0,
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)'
                  }}>
                    {planResult.consolidated_shopping_list.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preparation Notes & Health Advisory */}
              <div style={{
                padding: '14px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-hairline)',
                fontSize: '0.74rem',
                color: 'var(--text-muted)',
                lineHeight: 1.45
              }}>
                {planResult.preparation_notes && planResult.preparation_notes.length > 0 && (
                  <div style={{ marginBottom: '6px' }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>Prep Tips: </strong>
                    {planResult.preparation_notes.join(' ')}
                  </div>
                )}
                <div>
                  <strong style={{ color: 'var(--citrus-warm)' }}>Medical & Nutrition Advisory: </strong>
                  {planResult.allergy_and_health_warning}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
