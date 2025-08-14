import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Settings, History, TrendingUp } from 'lucide-react';
import { useAssetSearch } from '../../hooks/useSearch/useAssetSearch';
import SearchSuggestions from './SearchSuggestions';
import SearchFilters from './SearchFilters';
import { debounce } from '../../utils/debounce';

interface AssetSearchBarProps {
  onResultsChange?: (results: any[]) => void;
  placeholder?: string;
  showFilters?: boolean;
  autoFocus?: boolean;
  className?: string;
}

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

const AssetSearchBar: React.FC<AssetSearchBarProps> = ({
  onResultsChange,
  placeholder = "Search cryptocurrencies...",
  showFilters = true,
  autoFocus = false,
  className = ''
}) => {
  const [query, setQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [activeFilters, setActiveFilters] = useState<SearchFilters>({
    priceRange: { min: null, max: null },
    marketCapRange: { min: null, max: null },
    volumeRange: { min: null, max: null },
    changeRange: { min: null, max: null },
    categories: [],
    exchanges: [],
    hasHoldings: false,
    inWatchlist: false
  });

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const {
    suggestions,
    searchResults,
    isLoading,
    searchHistory,
    trendingSearches,
    addToHistory,
    clearHistory,
    performSearch
  } = useAssetSearch();

  // Debounced search to avoid excessive API calls
  const debouncedSearch = useCallback(
    debounce(async (searchQuery: string, filters?: SearchFilters) => {
      if (searchQuery.length >= 2) {
        const results = await performSearch(searchQuery, filters || activeFilters);
        if (onResultsChange) {
          onResultsChange(results);
        }
      } else if (searchQuery.length === 0) {
        if (onResultsChange) {
          onResultsChange([]);
        }
      }
    }, 300),
    [performSearch, activeFilters, onResultsChange]
  );

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        searchRef.current && !searchRef.current.contains(target) &&
        suggestionsRef.current && !suggestionsRef.current.contains(target)
      ) {
        setShowSuggestions(false);
        setIsExpanded(false);
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowSuggestions(false);
        setIsExpanded(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setShowSuggestions(value.length > 0 || searchHistory.length > 0);
  };

  const handleInputFocus = () => {
    setIsExpanded(true);
    if (query.length > 0 || searchHistory.length > 0 || trendingSearches.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleSuggestionSelect = useCallback((suggestion: any) => {
    setQuery(suggestion.symbol || suggestion.name);
    setShowSuggestions(false);
    addToHistory(suggestion);
    
    if (onResultsChange) {
      onResultsChange([suggestion]);
    }
  }, [addToHistory, onResultsChange]);

  const handleClearSearch = () => {
    setQuery('');
    setShowSuggestions(false);
    if (onResultsChange) {
      onResultsChange([]);
    }
    inputRef.current?.focus();
  };

  const handleToggleFilters = () => {
    setShowFiltersPanel(!showFiltersPanel);
    setIsExpanded(true);
  };

  const handleFiltersChange = useCallback((newFilters: SearchFilters) => {
    setActiveFilters(newFilters);
    // Re-run search with new filters
    if (query.length >= 2) {
      debouncedSearch(query, newFilters);
    }
  }, [query, debouncedSearch]);

  const hasActiveFilters = () => {
    return Object.keys(activeFilters).some(key => {
      const value = activeFilters[key as keyof SearchFilters];
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object' && value !== null) {
        return (value as any).min !== null || (value as any).max !== null;
      }
      return value === true;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (query.length >= 2) {
        setShowSuggestions(false);
        addToHistory({ symbol: query, name: query });
      }
    }
  };

  return (
    <div className={`asset-search-container ${isExpanded ? 'expanded' : ''} ${className}`}>
      <div className="search-input-wrapper" ref={searchRef}>
        <div className="search-input-container">
          <div className="search-icon">
            <Search size={20} />
          </div>
          
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="search-input"
            autoComplete="off"
            spellCheck="false"
          />
          
          {isLoading && (
            <div className="search-loading">
              <div className="loading-spinner"></div>
            </div>
          )}
          
          {query && (
            <button
              className="clear-search-btn"
              onClick={handleClearSearch}
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
          
          {showFilters && (
            <button
              className={`filters-toggle-btn ${hasActiveFilters() ? 'has-filters' : ''}`}
              onClick={handleToggleFilters}
              title="Advanced search and filters"
            >
              <Settings size={16} />
              {hasActiveFilters() && <div className="filter-indicator"></div>}
            </button>
          )}
        </div>

        {showSuggestions && (
          <SearchSuggestions
            ref={suggestionsRef}
            query={query}
            suggestions={suggestions}
            searchHistory={searchHistory}
            trendingSearches={trendingSearches}
            onSelect={handleSuggestionSelect}
            onClearHistory={clearHistory}
            isLoading={isLoading}
          />
        )}
      </div>

      {showFilters && showFiltersPanel && (
        <SearchFilters
          filters={activeFilters}
          onFiltersChange={handleFiltersChange}
          onClose={() => setShowFiltersPanel(false)}
        />
      )}

      {hasActiveFilters() && (
        <div className="active-filters-summary">
          <span className="filters-count">
            {Object.values(activeFilters).filter(value => {
              if (Array.isArray(value)) return value.length > 0;
              if (typeof value === 'object' && value !== null) {
                return (value as any).min !== null || (value as any).max !== null;
              }
              return value === true;
            }).length} filters active
          </span>
          
          <button
            className="clear-all-filters-btn"
            onClick={() => handleFiltersChange({
              priceRange: { min: null, max: null },
              marketCapRange: { min: null, max: null },
              volumeRange: { min: null, max: null },
              changeRange: { min: null, max: null },
              categories: [],
              exchanges: [],
              hasHoldings: false,
              inWatchlist: false
            })}
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};

export default AssetSearchBar;