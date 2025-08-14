import React, { useState } from 'react';
import { Star, Trash2, Plus, Save, Edit3 } from 'lucide-react';

interface SearchFilters {
  priceRange: { min: number | null; max: number | null };
  marketCapRange: { min: number | null; max: number | null };
  volumeRange: { min: number | null; max: number | null };
  changeRange: { min: number | null; max: number | null };
  categories: string[];
  exchanges: string[];
  hasHoldings: boolean;
  inWatchlist: boolean;
}

interface FilterPreset {
  id: string;
  name: string;
  filters: SearchFilters;
  isDefault?: boolean;
  createdAt: Date;
  usageCount: number;
}

interface FilterPresetsProps {
  presets: FilterPreset[];
  onApplyPreset: (preset: FilterPreset) => void;
  onDeletePreset: (presetId: string) => void;
  currentFilters: SearchFilters;
  isLoading: boolean;
}

const FilterPresets: React.FC<FilterPresetsProps> = ({
  presets,
  onApplyPreset,
  onDeletePreset,
  currentFilters,
  isLoading
}) => {
  const [showPresets, setShowPresets] = useState(false);
  const [editingPreset, setEditingPreset] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');

  const defaultPresets: FilterPreset[] = [
    {
      id: 'top-100',
      name: 'Top 100',
      filters: {
        priceRange: { min: null, max: null },
        marketCapRange: { min: 1000000, max: null },
        volumeRange: { min: null, max: null },
        changeRange: { min: null, max: null },
        categories: [],
        exchanges: [],
        hasHoldings: false,
        inWatchlist: false
      },
      isDefault: true,
      createdAt: new Date(),
      usageCount: 0
    },
    {
      id: 'gainers',
      name: 'Top Gainers',
      filters: {
        priceRange: { min: null, max: null },
        marketCapRange: { min: null, max: null },
        volumeRange: { min: null, max: null },
        changeRange: { min: 5, max: null },
        categories: [],
        exchanges: [],
        hasHoldings: false,
        inWatchlist: false
      },
      isDefault: true,
      createdAt: new Date(),
      usageCount: 0
    },
    {
      id: 'losers',
      name: 'Top Losers',
      filters: {
        priceRange: { min: null, max: null },
        marketCapRange: { min: null, max: null },
        volumeRange: { min: null, max: null },
        changeRange: { min: null, max: -5 },
        categories: [],
        exchanges: [],
        hasHoldings: false,
        inWatchlist: false
      },
      isDefault: true,
      createdAt: new Date(),
      usageCount: 0
    },
    {
      id: 'defi',
      name: 'DeFi Tokens',
      filters: {
        priceRange: { min: null, max: null },
        marketCapRange: { min: null, max: null },
        volumeRange: { min: null, max: null },
        changeRange: { min: null, max: null },
        categories: ['defi'],
        exchanges: [],
        hasHoldings: false,
        inWatchlist: false
      },
      isDefault: true,
      createdAt: new Date(),
      usageCount: 0
    },
    {
      id: 'portfolio',
      name: 'My Holdings',
      filters: {
        priceRange: { min: null, max: null },
        marketCapRange: { min: null, max: null },
        volumeRange: { min: null, max: null },
        changeRange: { min: null, max: null },
        categories: [],
        exchanges: [],
        hasHoldings: true,
        inWatchlist: false
      },
      isDefault: true,
      createdAt: new Date(),
      usageCount: 0
    }
  ];

  const allPresets = [...defaultPresets, ...presets];

  const handleApplyPreset = (preset: FilterPreset) => {
    onApplyPreset(preset);
    setShowPresets(false);
  };

  const handleDeletePreset = (presetId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (window.confirm('Are you sure you want to delete this preset?')) {
      onDeletePreset(presetId);
    }
  };

  const handleEditPreset = (preset: FilterPreset, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditingPreset(preset.id);
    setPresetName(preset.name);
  };

  const getFilterSummary = (filters: SearchFilters): string => {
    const parts: string[] = [];

    if (filters.priceRange.min !== null || filters.priceRange.max !== null) {
      parts.push('Price');
    }
    if (filters.marketCapRange.min !== null || filters.marketCapRange.max !== null) {
      parts.push('Market Cap');
    }
    if (filters.changeRange.min !== null || filters.changeRange.max !== null) {
      parts.push('Change');
    }
    if (filters.categories.length > 0) {
      parts.push(`${filters.categories.length} Categories`);
    }
    if (filters.exchanges.length > 0) {
      parts.push(`${filters.exchanges.length} Exchanges`);
    }
    if (filters.hasHoldings) {
      parts.push('Holdings');
    }
    if (filters.inWatchlist) {
      parts.push('Watchlist');
    }

    return parts.length > 0 ? parts.join(', ') : 'No filters';
  };

  const isCurrentFiltersMatching = (preset: FilterPreset): boolean => {
    return JSON.stringify(preset.filters) === JSON.stringify(currentFilters);
  };

  return (
    <div className="filter-presets">
      <div className="presets-header">
        <button
          className="presets-toggle"
          onClick={() => setShowPresets(!showPresets)}
        >
          <Star size={14} />
          <span>Filter Presets</span>
        </button>
        
        <div className="quick-presets">
          {allPresets.slice(0, 3).map(preset => (
            <button
              key={preset.id}
              className={`quick-preset-btn ${isCurrentFiltersMatching(preset) ? 'active' : ''}`}
              onClick={() => handleApplyPreset(preset)}
              title={getFilterSummary(preset.filters)}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {showPresets && (
        <div className="presets-dropdown">
          <div className="presets-list">
            {allPresets.map(preset => (
              <div
                key={preset.id}
                className={`preset-item ${isCurrentFiltersMatching(preset) ? 'active' : ''}`}
                onClick={() => handleApplyPreset(preset)}
              >
                <div className="preset-main">
                  <div className="preset-info">
                    <div className="preset-name">
                      {preset.isDefault && <Star size={12} className="default-icon" />}
                      {preset.name}
                    </div>
                    <div className="preset-description">
                      {getFilterSummary(preset.filters)}
                    </div>
                  </div>
                  
                  {preset.usageCount > 0 && (
                    <div className="preset-usage">
                      Used {preset.usageCount} times
                    </div>
                  )}
                </div>

                {!preset.isDefault && (
                  <div className="preset-actions">
                    <button
                      className="preset-action-btn"
                      onClick={(e) => handleEditPreset(preset, e)}
                      title="Rename preset"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      className="preset-action-btn delete"
                      onClick={(e) => handleDeletePreset(preset.id, e)}
                      title="Delete preset"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {allPresets.length === 0 && !isLoading && (
            <div className="no-presets">
              <div className="no-presets-icon">
                <Star size={24} />
              </div>
              <div className="no-presets-text">
                <div className="no-presets-title">No saved presets</div>
                <div className="no-presets-subtitle">
                  Configure filters and save them as presets for quick access
                </div>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="presets-loading">
              <div className="loading-spinner-small"></div>
              <span>Loading presets...</span>
            </div>
          )}
        </div>
      )}

      {/* Edit Preset Modal */}
      {editingPreset && (
        <div className="edit-preset-modal">
          <div className="modal-overlay" onClick={() => setEditingPreset(null)} />
          <div className="modal-content">
            <h3>Rename Preset</h3>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name"
              autoFocus
            />
            <div className="modal-actions">
              <button
                className="modal-btn cancel"
                onClick={() => setEditingPreset(null)}
              >
                Cancel
              </button>
              <button
                className="modal-btn save"
                onClick={() => {
                  // Handle rename logic here
                  setEditingPreset(null);
                  setPresetName('');
                }}
                disabled={!presetName.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterPresets;