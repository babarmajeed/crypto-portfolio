# CP-031: Advanced Asset Search and Filtering System

## Overview
Implement comprehensive search and filtering capabilities for assets, allowing users to quickly find and filter cryptocurrencies based on various criteria like performance, market cap, volume, and custom tags.

## Objectives
- Build powerful search functionality with auto-suggestions
- Implement multi-criteria filtering system
- Add sorting and categorization options
- Create saved search and filter presets

## Acceptance Criteria
- [ ] Real-time search with auto-complete suggestions
- [ ] Multi-criteria filtering (price, market cap, volume, change %)
- [ ] Category-based filtering (DeFi, gaming, layer-1, etc.)
- [ ] Performance-based filtering (gainers, losers, trending)
- [ ] Custom tag system for user categorization
- [ ] Saved search presets and favorites
- [ ] Advanced search operators (>, <, =, contains)
- [ ] Search history and recent searches
- [ ] Export filtered results
- [ ] Voice search capability (optional)

## Technical Implementation

### File Structure
```
src/
  components/
    Search/
      AssetSearchBar.jsx
      SearchFilters.jsx
      FilterPresets.jsx
      SearchResults.jsx
      SearchSuggestions.jsx
  hooks/
    useAssetSearch.js
    useSearchFilters.js
  services/
    SearchService.js
    FilterService.js
  utils/
    searchUtils.js
```

### Main Search Component
```jsx
// AssetSearchBar.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useAssetSearch } from '../hooks/useAssetSearch';
import SearchSuggestions from './SearchSuggestions';
import SearchFilters from './SearchFilters';
import { debounce } from '../utils/debounce';

const AssetSearchBar = ({ 
  onResultsChange, 
  placeholder = "Search cryptocurrencies...",
  showFilters = true 
}) => {
  const [query, setQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef(null);
  const suggestionsRef = useRef(null);

  const {
    suggestions,
    searchResults,
    isLoading,
    searchHistory,
    addToHistory,
    clearHistory
  } = useAssetSearch(query);

  // Debounced search to avoid excessive API calls
  const debouncedSearch = debounce((searchQuery) => {
    if (searchQuery.length >= 2) {
      // Trigger search
    }
  }, 300);

  useEffect(() => {
    debouncedSearch(query);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchRef.current && !searchRef.current.contains(event.target) &&
        suggestionsRef.current && !suggestionsRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setShowSuggestions(value.length > 0);
    
    if (onResultsChange) {
      onResultsChange(searchResults);
    }
  };

  const handleInputFocus = () => {
    setIsExpanded(true);
    if (query.length > 0 || searchHistory.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleSuggestionSelect = (suggestion) => {
    setQuery(suggestion.symbol);
    setShowSuggestions(false);
    addToHistory(suggestion);
    
    if (onResultsChange) {
      onResultsChange([suggestion]);
    }
  };

  const handleClearSearch = () => {
    setQuery('');
    setShowSuggestions(false);
    if (onResultsChange) {
      onResultsChange([]);
    }
  };

  const handleAdvancedSearch = () => {
    // Open advanced search modal or expand filters
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={`asset-search-container ${isExpanded ? 'expanded' : ''}`}>
      <div className="search-input-wrapper" ref={searchRef}>
        <div className="search-input-container">
          <div className="search-icon">
            🔍
          </div>
          
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            placeholder={placeholder}
            className="search-input"
            autoComplete="off"
          />
          
          {query && (
            <button
              className="clear-search-btn"
              onClick={handleClearSearch}
            >
              ×
            </button>
          )}
          
          <button
            className="advanced-search-btn"
            onClick={handleAdvancedSearch}
            title="Advanced search and filters"
          >
            ⚙️
          </button>
        </div>

        {isLoading && (
          <div className="search-loading">
            <div className="loading-spinner"></div>
          </div>
        )}

        {showSuggestions && (
          <SearchSuggestions
            ref={suggestionsRef}
            query={query}
            suggestions={suggestions}
            searchHistory={searchHistory}
            onSelect={handleSuggestionSelect}
            onClearHistory={clearHistory}
          />
        )}
      </div>

      {showFilters && isExpanded && (
        <SearchFilters
          onFilterChange={(filters) => {
            // Apply filters and update results
            if (onResultsChange) {
              // Filter and return results
            }
          }}
        />
      )}
    </div>
  );
};

export default AssetSearchBar;
```

### Search Hook
```javascript
// useAssetSearch.js
import { useState, useEffect, useMemo } from 'react';
import { searchService } from '../services/SearchService';
import { storageService } from '../services/StorageService';

export const useAssetSearch = (query) => {
  const [suggestions, setSuggestions] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);

  useEffect(() => {
    loadSearchHistory();
  }, []);

  useEffect(() => {
    if (query.length >= 2) {
      searchAssets(query);
    } else {
      setSuggestions([]);
      setSearchResults([]);
    }
  }, [query]);

  const loadSearchHistory = () => {
    const history = storageService.getSearchHistory();
    setSearchHistory(history.slice(0, 10)); // Keep last 10 searches
  };

  const searchAssets = async (searchQuery) => {
    try {
      setIsLoading(true);
      
      const [suggestionResults, searchResultData] = await Promise.all([
        searchService.getSuggestions(searchQuery),
        searchService.searchAssets(searchQuery)
      ]);

      setSuggestions(suggestionResults);
      setSearchResults(searchResultData);
    } catch (error) {
      console.error('Search failed:', error);
      setSuggestions([]);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const addToHistory = (asset) => {
    const newHistory = [asset, ...searchHistory.filter(h => h.symbol !== asset.symbol)];
    const trimmedHistory = newHistory.slice(0, 10);
    
    setSearchHistory(trimmedHistory);
    storageService.saveSearchHistory(trimmedHistory);
  };

  const clearHistory = () => {
    setSearchHistory([]);
    storageService.clearSearchHistory();
  };

  return {
    suggestions,
    searchResults,
    isLoading,
    searchHistory,
    addToHistory,
    clearHistory
  };
};
```

### Advanced Search Filters Component
```jsx
// SearchFilters.jsx
import React, { useState } from 'react';
import { useSearchFilters } from '../hooks/useSearchFilters';
import FilterPresets from './FilterPresets';

const SearchFilters = ({ onFilterChange }) => {
  const [activeFilters, setActiveFilters] = useState({
    priceRange: { min: null, max: null },
    marketCapRange: { min: null, max: null },
    volumeRange: { min: null, max: null },
    changeRange: { min: null, max: null },
    categories: [],
    exchanges: [],
    hasHoldings: false,
    inWatchlist: false
  });

  const {
    categories,
    exchanges,
    presets,
    applyPreset,
    savePreset,
    deletePreset
  } = useSearchFilters();

  const handleFilterChange = (filterType, value) => {
    const newFilters = {
      ...activeFilters,
      [filterType]: value
    };
    
    setActiveFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleRangeChange = (rangeType, field, value) => {
    const newRange = {
      ...activeFilters[rangeType],
      [field]: value ? parseFloat(value) : null
    };
    
    handleFilterChange(rangeType, newRange);
  };

  const handleMultiSelectChange = (filterType, option, isSelected) => {
    const currentValues = activeFilters[filterType];
    const newValues = isSelected
      ? [...currentValues, option]
      : currentValues.filter(v => v !== option);
    
    handleFilterChange(filterType, newValues);
  };

  const clearAllFilters = () => {
    const clearedFilters = {
      priceRange: { min: null, max: null },
      marketCapRange: { min: null, max: null },
      volumeRange: { min: null, max: null },
      changeRange: { min: null, max: null },
      categories: [],
      exchanges: [],
      hasHoldings: false,
      inWatchlist: false
    };
    
    setActiveFilters(clearedFilters);
    onFilterChange(clearedFilters);
  };

  const hasActiveFilters = () => {
    return Object.keys(activeFilters).some(key => {
      const value = activeFilters[key];
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object' && value !== null) {
        return value.min !== null || value.max !== null;
      }
      return value !== false && value !== null;
    });
  };

  return (
    <div className="search-filters">
      <div className="filters-header">
        <h3>Advanced Filters</h3>
        <div className="filter-actions">
          {hasActiveFilters() && (
            <button onClick={clearAllFilters} className="clear-filters-btn">
              Clear All
            </button>
          )}
        </div>
      </div>

      <FilterPresets
        presets={presets}
        onApplyPreset={applyPreset}
        onSavePreset={savePreset}
        onDeletePreset={deletePreset}
        currentFilters={activeFilters}
      />

      <div className="filter-sections">
        {/* Price Range Filter */}
        <div className="filter-section">
          <label className="filter-label">Price Range</label>
          <div className="range-inputs">
            <input
              type="number"
              placeholder="Min price"
              value={activeFilters.priceRange.min || ''}
              onChange={(e) => handleRangeChange('priceRange', 'min', e.target.value)}
              className="range-input"
            />
            <span>to</span>
            <input
              type="number"
              placeholder="Max price"
              value={activeFilters.priceRange.max || ''}
              onChange={(e) => handleRangeChange('priceRange', 'max', e.target.value)}
              className="range-input"
            />
          </div>
        </div>

        {/* Market Cap Range Filter */}
        <div className="filter-section">
          <label className="filter-label">Market Cap Range</label>
          <div className="range-inputs">
            <input
              type="number"
              placeholder="Min market cap"
              value={activeFilters.marketCapRange.min || ''}
              onChange={(e) => handleRangeChange('marketCapRange', 'min', e.target.value)}
              className="range-input"
            />
            <span>to</span>
            <input
              type="number"
              placeholder="Max market cap"
              value={activeFilters.marketCapRange.max || ''}
              onChange={(e) => handleRangeChange('marketCapRange', 'max', e.target.value)}
              className="range-input"
            />
          </div>
        </div>

        {/* 24h Change Range Filter */}
        <div className="filter-section">
          <label className="filter-label">24h Change (%)</label>
          <div className="range-inputs">
            <input
              type="number"
              placeholder="Min change %"
              value={activeFilters.changeRange.min || ''}
              onChange={(e) => handleRangeChange('changeRange', 'min', e.target.value)}
              className="range-input"
            />
            <span>to</span>
            <input
              type="number"
              placeholder="Max change %"
              value={activeFilters.changeRange.max || ''}
              onChange={(e) => handleRangeChange('changeRange', 'max', e.target.value)}
              className="range-input"
            />
          </div>
        </div>

        {/* Categories Filter */}
        <div className="filter-section">
          <label className="filter-label">Categories</label>
          <div className="multi-select-options">
            {categories.map(category => (
              <label key={category.id} className="checkbox-option">
                <input
                  type="checkbox"
                  checked={activeFilters.categories.includes(category.id)}
                  onChange={(e) => handleMultiSelectChange('categories', category.id, e.target.checked)}
                />
                <span>{category.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Exchanges Filter */}
        <div className="filter-section">
          <label className="filter-label">Available on Exchanges</label>
          <div className="multi-select-options">
            {exchanges.map(exchange => (
              <label key={exchange.id} className="checkbox-option">
                <input
                  type="checkbox"
                  checked={activeFilters.exchanges.includes(exchange.id)}
                  onChange={(e) => handleMultiSelectChange('exchanges', exchange.id, e.target.checked)}
                />
                <span>{exchange.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Portfolio Filters */}
        <div className="filter-section">
          <label className="filter-label">Portfolio</label>
          <div className="checkbox-options">
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={activeFilters.hasHoldings}
                onChange={(e) => handleFilterChange('hasHoldings', e.target.checked)}
              />
              <span>Assets I own</span>
            </label>
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={activeFilters.inWatchlist}
                onChange={(e) => handleFilterChange('inWatchlist', e.target.checked)}
              />
              <span>In my watchlist</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchFilters;
```

### Search Service
```javascript
// SearchService.js
class SearchService {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  async getSuggestions(query) {
    const cacheKey = `suggestions:${query.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    try {
      const suggestions = await this.apiClient.get('/search/suggestions', {
        params: { q: query, limit: 10 }
      });

      this.cache.set(cacheKey, {
        data: suggestions.data,
        timestamp: Date.now()
      });

      return suggestions.data;
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      return [];
    }
  }

  async searchAssets(query, filters = {}) {
    try {
      const response = await this.apiClient.post('/search/assets', {
        query,
        filters,
        limit: 100
      });

      return response.data;
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  }

  async searchWithAdvancedFilters(filters) {
    try {
      const response = await this.apiClient.post('/search/advanced', {
        filters
      });

      return response.data;
    } catch (error) {
      console.error('Advanced search failed:', error);
      throw error;
    }
  }

  // Fuzzy search for better matching
  fuzzySearch(query, assets) {
    const normalizedQuery = query.toLowerCase();
    
    return assets
      .map(asset => ({
        ...asset,
        score: this.calculateFuzzyScore(normalizedQuery, asset)
      }))
      .filter(asset => asset.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  calculateFuzzyScore(query, asset) {
    const symbol = asset.symbol.toLowerCase();
    const name = asset.name.toLowerCase();
    
    let score = 0;
    
    // Exact symbol match gets highest score
    if (symbol === query) score += 100;
    else if (symbol.startsWith(query)) score += 80;
    else if (symbol.includes(query)) score += 60;
    
    // Name matching
    if (name === query) score += 90;
    else if (name.startsWith(query)) score += 70;
    else if (name.includes(query)) score += 50;
    
    // Bonus for popular assets
    if (asset.rank <= 100) score += 10;
    if (asset.rank <= 50) score += 10;
    if (asset.rank <= 10) score += 10;
    
    return score;
  }

  clearCache() {
    this.cache.clear();
  }
}

export const searchService = new SearchService();
```

## Testing Requirements
- Search functionality testing with various queries
- Filter combination testing
- Performance testing with large datasets
- Auto-suggestion accuracy testing
- Search history persistence testing

## Dependencies
- Depends on: CP-004 (Portfolio Management)
- Depends on: CP-030 (Asset Detail Cards)
- Blocks: CP-032 (Settings and Preferences)

## Time Estimate
**Beginner**: 6-7 days
**Intermediate**: 4-5 days
**Advanced**: 3-4 days

## Required Skills
- Advanced search algorithms and fuzzy matching
- React component composition
- Debouncing and performance optimization
- Local storage and caching
- Complex state management