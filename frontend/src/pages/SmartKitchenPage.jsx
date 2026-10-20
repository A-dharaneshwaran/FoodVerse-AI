import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChefHat,
  Package,
  Sparkles,
  CookingPot,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  Info,
  Archive,
  RefreshCw,
  Utensils,
  ShieldCheck,
  ChevronRight,
  XCircle,
  HelpCircle,
  BookOpen
} from 'lucide-react';
import { assistSmartKitchen, ApiError } from '../services/api';

const INVENTORY_STORAGE_KEY = 'foodverse_kitchen_inventory_v1';

const CATEGORIES = [
  'Produce',
  'Dairy & Eggs',
  'Meat & Seafood',
  'Bakery',
  'Pantry & Grains',
  'Canned & Jarred',
  'Beverages',
  'Condiments & Spices',
  'Frozen Foods',
  'Other'
];

const STORAGE_LOCATIONS = [
  'Refrigerator',
  'Freezer',
  'Pantry',
  'Countertop',
  'Spice Rack',
  'Cellar / Cool Storage'
];

export function SmartKitchenPage() {
  // Inventory state loaded strictly from localStorage without fictitious default filler
  const [inventory, setInventory] = useState(() => {
    try {
      const saved = localStorage.getItem(INVENTORY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse kitchen inventory from localStorage:', e);
    }
    return [];
  });

  // Selected ingredient IDs for AI synthesis
  const [selectedIngredientIds, setSelectedIngredientIds] = useState([]);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [selectedLocationFilter, setSelectedLocationFilter] = useState('All');

  // Form modal/drawer state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Produce',
    quantity: '1',
    unit: 'item',
    storage_location: 'Refrigerator',
    purchase_date: '',
    expiration_date: '',
    notes: ''
  });
  const [formValidationError, setFormValidationError] = useState('');

  // AI Assistant states
  const [assistanceMode, setAssistanceMode] = useState('utilization'); // 'utilization' | 'storage'
  const [dietaryNote, setDietaryNote] = useState('');
  const [isRequestingAI, setIsRequestingAI] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState(null);

  // Sync inventory changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inventory));
    } catch (e) {
      console.error('Failed to save kitchen inventory to localStorage:', e);
    }
  }, [inventory]);

  // Clean up selected IDs if items were removed
  useEffect(() => {
    const existingIds = new Set(inventory.map((item) => item.id));
    setSelectedIngredientIds((prev) => prev.filter((id) => existingIds.has(id)));
  }, [inventory]);

  // Invalidate AI suggestions if selected ingredients change
  const handleToggleSelect = useCallback((itemId) => {
    setSelectedIngredientIds((prev) => {
      const next = prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId];
      return next;
    });
    setAiResult(null); // Clear previous AI results when selection changes
    setAiError(null);
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIngredientIds.length === inventory.length) {
      setSelectedIngredientIds([]);
    } else {
      setSelectedIngredientIds(inventory.map((item) => item.id));
    }
    setAiResult(null);
    setAiError(null);
  }, [inventory, selectedIngredientIds.length]);

  // Open Add modal
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      category: 'Produce',
      quantity: '1',
      unit: 'item',
      storage_location: 'Refrigerator',
      purchase_date: '',
      expiration_date: '',
      notes: ''
    });
    setFormValidationError('');
    setIsFormOpen(true);
  };

  // Open Edit modal
  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      category: item.category || 'Produce',
      quantity: item.quantity || '1',
      unit: item.unit || 'item',
      storage_location: item.storage_location || 'Refrigerator',
      purchase_date: item.purchase_date || '',
      expiration_date: item.expiration_date || '',
      notes: item.notes || ''
    });
    setFormValidationError('');
    setIsFormOpen(true);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormValidationError('Please enter a valid ingredient or food item name.');
      return;
    }

    if (editingItem) {
      // Update existing item
      setInventory((prev) =>
        prev.map((item) =>
          item.id === editingItem.id
            ? { ...item, ...formData, updatedAt: new Date().toISOString() }
            : item
        )
      );
    } else {
      // Add new item
      const newItem = {
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        ...formData,
        createdAt: new Date().toISOString()
      };
      setInventory((prev) => [newItem, ...prev]);
    }

    setIsFormOpen(false);
    setEditingItem(null);
  };

  const handleDeleteItem = (itemId) => {
    if (window.confirm('Remove this item from your kitchen inventory?')) {
      setInventory((prev) => prev.filter((item) => item.id !== itemId));
    }
  };

  const handleMarkDepleted = (itemId) => {
    setInventory((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, quantity: '0', notes: (item.notes ? item.notes + ' ' : '') + '[Used/Depleted]' }
          : item
      )
    );
  };

  // Helper date calculations: strictly honest without declaring food spoiled
  const calculateDateStatus = (dateStr) => {
    if (!dateStr) return { status: 'none', label: 'No date provided', daysDiff: null };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    if (isNaN(target.getTime())) {
      return { status: 'none', label: 'Invalid date', daysDiff: null };
    }
    target.setHours(0, 0, 0, 0);
    const diffTime = target - today;
    const daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysDiff < 0) {
      return { status: 'passed', label: `Date passed ${Math.abs(daysDiff)}d ago`, daysDiff };
    }
    if (daysDiff === 0) {
      return { status: 'today', label: 'Due today', daysDiff: 0 };
    }
    if (daysDiff <= 3) {
      return { status: 'approaching', label: `Approaching in ${daysDiff}d`, daysDiff };
    }
    return { status: 'stable', label: `In ${daysDiff}d`, daysDiff };
  };

  // Inventory Overview counts
  const overviewStats = useMemo(() => {
    let approachingCount = 0;
    let passedCount = 0;

    inventory.forEach((item) => {
      const { status } = calculateDateStatus(item.expiration_date);
      if (status === 'approaching' || status === 'today') approachingCount++;
      if (status === 'passed') passedCount++;
    });

    return {
      totalItems: inventory.length,
      approachingCount,
      passedCount,
      selectedCount: selectedIngredientIds.length
    };
  }, [inventory, selectedIngredientIds]);

  // Filtered inventory list
  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory =
        selectedCategoryFilter === 'All' || item.category === selectedCategoryFilter;

      const matchesLocation =
        selectedLocationFilter === 'All' || item.storage_location === selectedLocationFilter;

      return matchesSearch && matchesCategory && matchesLocation;
    });
  }, [inventory, searchQuery, selectedCategoryFilter, selectedLocationFilter]);

  // Selected ingredient names for AI
  const selectedIngredientNames = useMemo(() => {
    const idSet = new Set(selectedIngredientIds);
    return inventory.filter((i) => idSet.has(i.id)).map((i) => i.name);
  }, [inventory, selectedIngredientIds]);

  // Request AI Assistance
  const handleRequestAIAssistance = async () => {
    if (selectedIngredientNames.length === 0 || isRequestingAI) return;

    setIsRequestingAI(true);
    setAiError(null);
    setAiResult(null);

    try {
      const data = await assistSmartKitchen({
        mode: assistanceMode,
        ingredients: selectedIngredientNames,
        dietary_preferences: dietaryNote.trim() || undefined
      });
      setAiResult(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setAiError({
          code: err.errorCode || `HTTP_${err.status}`,
          message: err.message,
          guidance: err.guidance
        });
      } else {
        setAiError({
          code: 'CLIENT_ERROR',
          message: 'Failed to generate culinary suggestions.',
          guidance: 'Check that the analysis server is reachable and retry.'
        });
      }
    } finally {
      setIsRequestingAI(false);
    }
  };

  return (
    <div className="workspace-wrapper">
      <header className="module-editorial-header">
        <div className="module-category-eyebrow">
          <ChefHat size={14} /> Culinary Intelligence & Inventory Ledger
        </div>
        <h2 className="module-display-title">Smart Kitchen & Pantry Workspace</h2>
        <p className="module-intro-deck">
          Track genuine kitchen stock, monitor approaching expiration dates, and craft zero-waste recipes tailored to your ingredients.
        </p>
      </header>

      {/* Prominent Honesty & Scope Advisory */}
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
        <Info size={18} style={{ color: 'var(--citrus-warm)', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--citrus-warm)', display: 'block', marginBottom: '2px' }}>
            Local Device Inventory & Cautious Storage Guidance
          </strong>
          Inventory is saved locally in this browser session. Expiration dates and storage suggestions are practical estimates
          and do not verify microbiological sterility. Always inspect food condition, odor, and texture before consumption.
        </div>
      </div>

      {/* Overview Metric Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '26px'
      }}>
        <div style={{
          padding: '16px 20px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px'
        }}>
          <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Recorded Items
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 600, color: 'var(--text-ivory)', marginTop: '4px' }}>
            {overviewStats.totalItems}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>in active inventory</span>
        </div>

        <div style={{
          padding: '16px 20px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px'
        }}>
          <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--citrus-warm)', textTransform: 'uppercase' }}>
            Approaching Dates
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 600, color: 'var(--citrus-warm)', marginTop: '4px' }}>
            {overviewStats.approachingCount}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>due within 3 days</span>
        </div>

        <div style={{
          padding: '16px 20px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px'
        }}>
          <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Passed Dates
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 600, color: 'var(--text-ivory)', marginTop: '4px' }}>
            {overviewStats.passedCount}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>require physical inspection</span>
        </div>

        <div style={{
          padding: '16px 20px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px'
        }}>
          <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--emerald-light)', textTransform: 'uppercase' }}>
            Selected for AI
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 600, color: 'var(--emerald-light)', marginTop: '4px' }}>
            {overviewStats.selectedCount}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>ready for culinary recipe synthesis</span>
        </div>
      </div>

      {/* Main Split Layout: Left Inventory Ledger | Right Culinary Assistant */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '28px' }}>
        {/* Left: Inventory Management */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-ivory)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={18} style={{ color: 'var(--emerald-light)' }} />
                <span>Pantry & Kitchen Ledger</span>
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Select ingredients to request zero-waste culinary pairings or storage advice.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn-spotlight-primary"
                onClick={handleOpenAdd}
                style={{ padding: '8px 14px', fontSize: '0.82rem' }}
                id="add-inventory-btn"
              >
                <Plus size={15} /> Add Item
              </button>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{
              flex: 1,
              minWidth: '180px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-hairline)',
              borderRadius: '6px',
              padding: '6px 12px'
            }}>
              <Search size={14} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search inventory..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-ivory)',
                  fontSize: '0.82rem',
                  outline: 'none',
                  width: '100%'
                }}
              />
            </div>

            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-hairline)',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                fontSize: '0.78rem',
                padding: '6px 10px',
                outline: 'none'
              }}
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select
              value={selectedLocationFilter}
              onChange={(e) => setSelectedLocationFilter(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-hairline)',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                fontSize: '0.78rem',
                padding: '6px 10px',
                outline: 'none'
              }}
            >
              <option value="All">All Locations</option>
              {STORAGE_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Inventory Table / Empty state */}
          {inventory.length === 0 ? (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              backgroundColor: 'var(--bg-surface-elevated)',
              borderRadius: '8px',
              border: '1px dashed var(--border-hairline)'
            }}>
              <Archive size={36} style={{ color: 'var(--text-muted)', marginBottom: '10px', opacity: 0.5 }} />
              <h4 style={{ fontSize: '0.94rem', color: 'var(--text-ivory)', marginBottom: '4px' }}>
                Inventory is Currently Empty
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '340px', margin: '0 auto 16px auto' }}>
                No food items are recorded yet. Add items from your pantry, fridge, or fresh grocery purchase to start tracking.
              </p>
              <button
                type="button"
                className="btn-spotlight-primary"
                onClick={handleOpenAdd}
                style={{ padding: '7px 14px', fontSize: '0.8rem', margin: '0 auto' }}
              >
                <Plus size={14} /> Add First Item
              </button>
            </div>
          ) : filteredInventory.length === 0 ? (
            <div style={{
              padding: '30px 20px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.82rem'
            }}>
              No inventory items match the current search or filter criteria.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                <span>Showing {filteredInventory.length} of {inventory.length} items</span>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  style={{ background: 'none', border: 'none', color: 'var(--emerald-light)', cursor: 'pointer', fontSize: '0.74rem' }}
                >
                  {selectedIngredientIds.length === inventory.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <table className="freshness-matrix-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ width: '32px' }}></th>
                    <th>Ingredient</th>
                    <th>Location</th>
                    <th>Qty</th>
                    <th>Date Guidance</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((item) => {
                    const isSelected = selectedIngredientIds.includes(item.id);
                    const dateInfo = calculateDateStatus(item.expiration_date);

                    return (
                      <tr
                        key={item.id}
                        style={{
                          backgroundColor: isSelected ? 'rgba(82, 197, 163, 0.05)' : 'transparent',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(item.id)}
                            style={{ cursor: 'pointer' }}
                            aria-label={`Select ${item.name} for AI culinary recipes`}
                          />
                        </td>
                        <td>
                          <strong style={{ color: 'var(--text-ivory)', display: 'block', fontSize: '0.84rem' }}>
                            {item.name}
                          </strong>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {item.category}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            fontSize: '0.72rem',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-secondary)',
                            backgroundColor: 'var(--bg-surface-elevated)',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>
                            {item.storage_location}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {item.quantity} {item.unit}
                          </span>
                        </td>
                        <td>
                          {dateInfo.status === 'approaching' || dateInfo.status === 'today' ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.72rem',
                              color: 'var(--citrus-warm)',
                              fontFamily: 'var(--font-mono)'
                            }}>
                              <Clock size={12} /> {dateInfo.label}
                            </span>
                          ) : dateInfo.status === 'passed' ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.72rem',
                              color: 'var(--text-muted)',
                              fontFamily: 'var(--font-mono)'
                            }}>
                              <AlertTriangle size={12} /> {dateInfo.label}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                              {dateInfo.label}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              title="Edit item"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: '4px'
                              }}
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMarkDepleted(item.id)}
                              title="Mark depleted"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--emerald-light)',
                                cursor: 'pointer',
                                padding: '4px'
                              }}
                            >
                              <CheckCircle2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              title="Remove item"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '4px'
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Generative Culinary & Storage Assistant */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CookingPot size={20} style={{ color: 'var(--citrus-warm)' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-ivory)' }}>
                Culinary & Storage Assistant
              </h3>
            </div>
            <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--emerald-light)' }}>
              Recipe & Storage Engine
            </span>
          </div>

          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            Generate recipes constrained to your selected stock or view scientific shelf-life guidance.
          </p>

          {/* Mode Switcher */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-hairline)', paddingBottom: '12px' }}>
            <button
              type="button"
              onClick={() => { setAssistanceMode('utilization'); setAiResult(null); }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: assistanceMode === 'utilization' ? 'var(--emerald-light)' : 'var(--border-hairline)',
                backgroundColor: assistanceMode === 'utilization' ? 'rgba(82, 197, 163, 0.12)' : 'var(--bg-surface-elevated)',
                color: assistanceMode === 'utilization' ? 'var(--emerald-light)' : 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Zero-Waste Recipes
            </button>
            <button
              type="button"
              onClick={() => { setAssistanceMode('storage'); setAiResult(null); }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: assistanceMode === 'storage' ? 'var(--citrus-warm)' : 'var(--border-hairline)',
                backgroundColor: assistanceMode === 'storage' ? 'rgba(230, 157, 69, 0.12)' : 'var(--bg-surface-elevated)',
                color: assistanceMode === 'storage' ? 'var(--citrus-warm)' : 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Storage Guidance
            </button>
          </div>

          {/* Selected Ingredients Pill Display */}
          <div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
              Selected Ingredients ({selectedIngredientNames.length}):
            </span>
            {selectedIngredientNames.length === 0 ? (
              <div style={{
                padding: '12px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-surface-elevated)',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                fontStyle: 'italic'
              }}>
                Select one or more items from the inventory table on the left to activate assistant.
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {selectedIngredientNames.map((name, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: '0.74rem',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(82, 197, 163, 0.12)',
                      border: '1px solid rgba(82, 197, 163, 0.25)',
                      color: 'var(--emerald-light)'
                    }}
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Dietary preference input */}
          <div>
            <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Optional Dietary Preferences / Exclusions:
            </label>
            <input
              type="text"
              placeholder="e.g. Vegetarian, dairy-free, low-carb..."
              value={dietaryNote}
              onChange={(e) => setDietaryNote(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-hairline)',
                color: 'var(--text-ivory)',
                fontSize: '0.8rem',
                outline: 'none'
              }}
            />
          </div>

          {/* Action Button */}
          <button
            type="button"
            className="btn-spotlight-primary"
            onClick={handleRequestAIAssistance}
            disabled={selectedIngredientNames.length === 0 || isRequestingAI}
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '10px 16px',
              opacity: selectedIngredientNames.length === 0 || isRequestingAI ? 0.6 : 1,
              cursor: selectedIngredientNames.length === 0 || isRequestingAI ? 'not-allowed' : 'pointer'
            }}
            id="smart-kitchen-assist-btn"
          >
            {isRequestingAI ? (
              <>
                <Clock size={15} className="spin-slow" />
                <span>Generating Culinary Guidance...</span>
              </>
            ) : (
              <>
                <Sparkles size={15} />
                <span>
                  {assistanceMode === 'utilization'
                    ? 'Synthesize Zero-Waste Recipes'
                    : 'Analyze Storage Protocols'}
                </span>
              </>
            )}
          </button>

          {/* Error Message */}
          {aiError && (
            <div className="error-callout" role="alert" style={{ marginTop: '10px' }}>
              <XCircle size={18} className="error-icon" />
              <div className="error-body">
                <div className="error-header">
                  <strong>{aiError.message}</strong>
                  <span className="error-code-badge">{aiError.code}</span>
                </div>
                {aiError.guidance && <p className="error-guidance">{aiError.guidance}</p>}
              </div>
            </div>
          )}

          {/* AI Result Container */}
          {aiResult && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              marginTop: '10px',
              borderTop: '1px solid var(--border-hairline)',
              paddingTop: '16px'
            }}>
              <div>
                <h4 style={{ fontSize: '0.94rem', color: 'var(--text-ivory)', marginBottom: '4px' }}>
                  {aiResult.summary}
                </h4>
              </div>

              {/* Recipe Suggestions */}
              {aiResult.recipe_suggestions && aiResult.recipe_suggestions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {aiResult.recipe_suggestions.map((recipe, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '16px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-hairline)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <strong style={{ color: 'var(--emerald-light)', fontSize: '0.95rem' }}>
                          {recipe.dish_name}
                        </strong>
                        {recipe.estimated_prep_time && (
                          <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                            {recipe.estimated_prep_time}
                          </span>
                        )}
                      </div>

                      {/* Matched Ingredients */}
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Using your stock: </span>
                        {recipe.matched_ingredients.join(', ')}
                      </div>

                      {/* Additional Needed */}
                      {recipe.additional_needed && recipe.additional_needed.length > 0 && (
                        <div style={{ fontSize: '0.76rem', color: 'var(--citrus-warm)', marginBottom: '10px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Staples/Additions: </span>
                          {recipe.additional_needed.join(', ')}
                        </div>
                      )}

                      {/* Steps */}
                      <ol style={{ paddingLeft: '18px', margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {recipe.preparation_steps.map((step, sIdx) => (
                          <li key={sIdx} style={{ marginBottom: '4px' }}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              )}

              {/* Storage Guidance Items */}
              {aiResult.storage_guidance && aiResult.storage_guidance.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {aiResult.storage_guidance.map((sg, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '14px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-hairline)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <strong style={{ color: 'var(--citrus-warm)', fontSize: '0.88rem' }}>
                          {sg.ingredient}
                        </strong>
                        <span style={{
                          fontSize: '0.7rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-secondary)',
                          backgroundColor: 'var(--bg-surface)',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {sg.recommended_location}
                        </span>
                      </div>
                      <ul style={{ paddingLeft: '18px', margin: '4px 0', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        {sg.best_practices.map((bp, bpIdx) => (
                          <li key={bpIdx}>{bp}</li>
                        ))}
                      </ul>
                      {sg.separation_notes && (
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          <span style={{ fontWeight: 600 }}>Note:</span> {sg.separation_notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Practical Tips */}
              {aiResult.practical_tips && aiResult.practical_tips.length > 0 && (
                <div style={{
                  padding: '12px 14px',
                  backgroundColor: 'rgba(82, 197, 163, 0.05)',
                  border: '1px solid rgba(82, 197, 163, 0.2)',
                  borderRadius: '6px',
                  fontSize: '0.76rem',
                  color: 'var(--text-secondary)'
                }}>
                  <strong style={{ color: 'var(--emerald-light)', display: 'block', marginBottom: '4px' }}>
                    Zero-Waste Culinary Tip:
                  </strong>
                  {aiResult.practical_tips.join(' ')}
                </div>
              )}

              {/* Safety Advisory Banner */}
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4, borderTop: '1px solid var(--border-hairline)', paddingTop: '8px' }}>
                <span style={{ fontWeight: 600 }}>Advisory:</span> {aiResult.safety_advisory}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Inventory Item Modal Drawer */}
      {isFormOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(11, 15, 20, 0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '480px',
            padding: '24px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)'
          }}>
            <h3 style={{ fontSize: '1.15rem', color: 'var(--text-ivory)', marginBottom: '4px' }}>
              {editingItem ? 'Edit Kitchen Inventory Item' : 'Add Item to Kitchen Inventory'}
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '18px' }}>
              Record real ingredients currently available in your kitchen stock.
            </p>

            {formValidationError && (
              <div style={{
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(230, 80, 80, 0.15)',
                border: '1px solid rgba(230, 80, 80, 0.35)',
                color: '#ff9999',
                fontSize: '0.78rem',
                marginBottom: '14px'
              }}>
                {formValidationError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Baby Spinach, Greek Yogurt, Olive Oil"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-hairline)',
                    color: 'var(--text-ivory)',
                    fontSize: '0.82rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-hairline)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      outline: 'none'
                    }}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Storage Location
                  </label>
                  <select
                    value={formData.storage_location}
                    onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-hairline)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      outline: 'none'
                    }}
                  >
                    {STORAGE_LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Quantity
                  </label>
                  <input
                    type="text"
                    placeholder="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-hairline)',
                      color: 'var(--text-ivory)',
                      fontSize: '0.82rem',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Unit
                  </label>
                  <input
                    type="text"
                    placeholder="item, bag, grams, cups"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-hairline)',
                      color: 'var(--text-ivory)',
                      fontSize: '0.82rem',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Purchase Date (optional)
                  </label>
                  <input
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-hairline)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.78rem',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Use-By Date (optional)
                  </label>
                  <input
                    type="date"
                    value={formData.expiration_date}
                    onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-hairline)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.78rem',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Notes (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Opened 2 days ago, organic"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-hairline)',
                    color: 'var(--text-ivory)',
                    fontSize: '0.82rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-hairline)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-spotlight-primary"
                  style={{ padding: '8px 16px', fontSize: '0.82rem' }}
                >
                  {editingItem ? 'Save Changes' : 'Add to Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
