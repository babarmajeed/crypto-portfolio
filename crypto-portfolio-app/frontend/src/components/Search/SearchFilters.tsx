import React, { useState, useCallback } from 'react';
import { X, Filter, Save, Star, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useSearchFilters } from '../../hooks/useSearch/useSearchFilters';
import FilterPresets from './FilterPresets';

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

interface SearchFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onClose: () => void;
}

const SearchFiltersComponent: React.FC<SearchFiltersProps> = ({
  filters,
  onFiltersChange,
  onClose
}) => {
  const [expandedSections, setExpandedSections] = useState({
    price: true,
    marketCap: false,
    volume: false,
    change: true,
    categories: true,
    exchanges: false,
    portfolio: true
  });

  const {
    categories,
    exchanges,
    presets,
    isLoading: filtersLoading,
    applyPreset,
    savePreset,
    deletePreset
  } = useSearchFilters();

  const handleRangeChange = useCallback((rangeType: keyof SearchFilters, field: 'min' | 'max', value: string) => {
    const numValue = value ? parseFloat(value) : null;
    const currentRange = filters[rangeType] as { min: number | null; max: number | null };
    
    const newRange = {
      ...currentRange,
      [field]: numValue
    };
    
    const newFilters = {
      ...filters,
      [rangeType]: newRange
    };
    
    onFiltersChange(newFilters);
  }, [filters, onFiltersChange]);

  const handleMultiSelectChange = useCallback((filterType: 'categories' | 'exchanges', option: string, isSelected: boolean) => {
    const currentValues = filters[filterType];
    const newValues = isSelected
      ? [...currentValues, option]
      : currentValues.filter(v => v !== option);
    
    const newFilters = {
      ...filters,
      [filterType]: newValues
    };
    
    onFiltersChange(newFilters);
  }, [filters, onFiltersChange]);

  const handleBooleanChange = useCallback((filterType: 'hasHoldings' | 'inWatchlist', value: boolean) => {
    const newFilters = {
      ...filters,
      [filterType]: value
    };
    
    onFiltersChange(newFilters);
  }, [filters, onFiltersChange]);

  const clearAllFilters = useCallback(() => {
    const clearedFilters: SearchFilters = {
      priceRange: { min: null, max: null },
      marketCapRange: { min: null, max: null },
      volumeRange: { min: null, max: null },
      changeRange: { min: null, max: null },
      categories: [],
      exchanges: [],
      hasHoldings: false,
      inWatchlist: false
    };
    
    onFiltersChange(clearedFilters);
  }, [onFiltersChange]);

  const hasActiveFilters = useCallback(() => {
    return Object.keys(filters).some(key => {
      const value = filters[key as keyof SearchFilters];
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object' && value !== null) {
        return (value as any).min !== null || (value as any).max !== null;
      }
      return value === true;
    });
  }, [filters]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleSavePreset = async () => {
    const name = prompt('Enter a name for this filter preset:');
    if (name && name.trim()) {
      try {
        await savePreset(name.trim(), filters);
      } catch (error) {
        console.error('Failed to save preset:', error);
      }
    }
  };

  const renderRangeFilter = (
    title: string,
    rangeType: keyof SearchFilters,
    placeholder: { min: string; max: string },
    prefix: string = '',
    suffix: string = ''
  ) => {
    const range = filters[rangeType] as { min: number | null; max: number | null };
    const isExpanded = expandedSections[rangeType as keyof typeof expandedSections];
    
    return (
      <div className="filter-section">
        <button
          className="filter-section-header"
          onClick={() => toggleSection(rangeType as keyof typeof expandedSections)}
        >
          <span className="filter-section-title">{title}</span>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        
        {isExpanded && (
          <div className="filter-section-content">
            <div className="range-inputs">
              <div className="range-input-group">
                <label>Min</label>
                <div className="input-with-prefix">
                  {prefix && <span className="input-prefix">{prefix}</span>}
                  <input
                    type="number"
                    placeholder={placeholder.min}
                    value={range.min || ''}
                    onChange={(e) => handleRangeChange(rangeType, 'min', e.target.value)}
                    className="range-input"
                    min="0"
                    step="any"
                  />
                  {suffix && <span className="input-suffix">{suffix}</span>}
                </div>
              </div>
              
              <div className="range-separator">to</div>
              
              <div className="range-input-group">
                <label>Max</label>
                <div className="input-with-prefix">
                  {prefix && <span className="input-prefix">{prefix}</span>}
                  <input
                    type="number"
                    placeholder={placeholder.max}
                    value={range.max || ''}
                    onChange={(e) => handleRangeChange(rangeType, 'max', e.target.value)}
                    className="range-input"
                    min="0"
                    step="any"
                  />
                  {suffix && <span className="input-suffix">{suffix}</span>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMultiSelectFilter = (
    title: string,
    filterType: 'categories' | 'exchanges',
    options: Array<{ id: string; name: string; icon?: string }>
  ) => {
    const isExpanded = expandedSections[filterType];
    const selectedCount = filters[filterType].length;
    
    return (
      <div className="filter-section">
        <button
          className="filter-section-header"
          onClick={() => toggleSection(filterType)}
        >
          <span className="filter-section-title">
            {title}
            {selectedCount > 0 && <span className="selected-count">({selectedCount})</span>}
          </span>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        
        {isExpanded && (
          <div className="filter-section-content">
            <div className="multi-select-options">
              {options.map(option => (
                <label key={option.id} className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={filters[filterType].includes(option.id)}
                    onChange={(e) => handleMultiSelectChange(filterType, option.id, e.target.checked)}
                  />
                  <div className="checkbox-content">
                    {option.icon && <span className="option-icon">{option.icon}</span>}
                    <span className="option-name">{option.name}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="search-filters-panel">
      <div className="filters-header">
        <div className="filters-title">
          <Filter size={18} />
          <span>Advanced Filters</span>
        </div>
        
        <div className="filters-actions">
          {hasActiveFilters() && (
            <button
              className="save-preset-btn"
              onClick={handleSavePreset}
              title="Save current filters as preset"
            >
              <Save size={14} />
            </button>
          )}
          
          {hasActiveFilters() && (
            <button
              className="clear-all-btn"
              onClick={clearAllFilters}
              title="Clear all filters"
            >
              Clear All
            </button>
          )}
          
          <button
            className="close-filters-btn"
            onClick={onClose}
            title="Close filters"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="filters-content">
        {/* Filter Presets */}
        {presets.length > 0 && (
          <FilterPresets
            presets={presets}
            onApplyPreset={applyPreset}
            onDeletePreset={deletePreset}
            currentFilters={filters}
            isLoading={filtersLoading}
          />
        )}

        <div className="filter-sections">
          {/* Price Range Filter */}
          {renderRangeFilter(
            'Price Range',
            'priceRange',
            { min: 'Min price', max: 'Max price' },
            '$'
          )}

          {/* Market Cap Range Filter */}
          {renderRangeFilter(
            'Market Cap',
            'marketCapRange',
            { min: 'Min market cap', max: 'Max market cap' },
            '$'
          )}

          {/* Volume Range Filter */}
          {renderRangeFilter(
            '24h Volume',
            'volumeRange',
            { min: 'Min volume', max: 'Max volume' },
            '$'
          )}

          {/* 24h Change Range Filter */}
          {renderRangeFilter(
            '24h Change',
            'changeRange',
            { min: 'Min change', max: 'Max change' },
            '',
            '%'
          )}

          {/* Categories Filter */}
          {categories.length > 0 && renderMultiSelectFilter(
            'Categories',
            'categories',
            categories
          )}

          {/* Exchanges Filter */}
          {exchanges.length > 0 && renderMultiSelectFilter(
            'Exchanges',
            'exchanges',
            exchanges
          )}

          {/* Portfolio Filters */}
          <div className="filter-section">
            <button
              className="filter-section-header"
              onClick={() => toggleSection('portfolio')}
            >
              <span className="filter-section-title">Portfolio</span>
              {expandedSections.portfolio ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            
            {expandedSections.portfolio && (
              <div className="filter-section-content">
                <div className="checkbox-options">
                  <label className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={filters.hasHoldings}
                      onChange={(e) => handleBooleanChange('hasHoldings', e.target.checked)}
                    />
                    <div className="checkbox-content">
                      <span className="option-icon">💼</span>
                      <span className="option-name">Assets I own</span>
                    </div>
                  </label>
                  
                  <label className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={filters.inWatchlist}
                      onChange={(e) => handleBooleanChange('inWatchlist', e.target.checked)}
                    />
                    <div className="checkbox-content">
                      <span className="option-icon">⭐</span>
                      <span className="option-name">In my watchlist</span>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="filters-footer">
        <div className="active-filters-count">
          {hasActiveFilters() ? (
            <span>
              {Object.values(filters).filter(value => {
                if (Array.isArray(value)) return value.length > 0;
                if (typeof value === 'object' && value !== null) {
                  return (value as any).min !== null || (value as any).max !== null;
                }
                return value === true;
              }).length} filters active
            </span>
          ) : (
            <span>No filters applied</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchFiltersComponent;