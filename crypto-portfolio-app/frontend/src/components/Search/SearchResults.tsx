import React, { useState, useMemo } from 'react';
import { Download, Grid, List, SortAsc, SortDesc } from 'lucide-react';
import { AssetCard, AssetCardGrid } from '../AssetCards';
import { exportSearchResults } from '../../utils/search/searchUtils';

interface SearchResult {
  id: string;
  symbol: string;
  name: string;
  image: string;
  currentPrice: number;
  priceChangePercentage24h: number;
  marketCap: number;
  marketCapRank: number;
  volume24h: number;
}

interface SearchResultsProps {
  results: SearchResult[];
  isLoading: boolean;
  query: string;
  totalCount: number;
  onLoadMore?: () => void;
  hasMore?: boolean;
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
  onAssetClick?: (symbol: string, asset: SearchResult) => void;
  className?: string;
}

type SortField = 'relevance' | 'name' | 'price' | 'marketCap' | 'change' | 'volume' | 'rank';
type SortDirection = 'asc' | 'desc';

const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  isLoading,
  query,
  totalCount,
  onLoadMore,
  hasMore = false,
  viewMode = 'grid',
  onViewModeChange,
  onAssetClick,
  className = ''
}) => {
  const [sortField, setSortField] = useState<SortField>('relevance');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showExportOptions, setShowExportOptions] = useState(false);

  const sortedResults = useMemo(() => {
    if (!results.length) return [];

    const sorted = [...results].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'relevance':
          // For relevance, maintain original order from search
          return 0;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'price':
          comparison = a.currentPrice - b.currentPrice;
          break;
        case 'marketCap':
          comparison = a.marketCap - b.marketCap;
          break;
        case 'change':
          comparison = a.priceChangePercentage24h - b.priceChangePercentage24h;
          break;
        case 'volume':
          comparison = a.volume24h - b.volume24h;
          break;
        case 'rank':
          comparison = a.marketCapRank - b.marketCapRank;
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [results, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'rank' ? 'asc' : 'desc'); // Rank is better when ascending
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      await exportSearchResults(sortedResults, format, query);
      setShowExportOptions(false);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (isLoading && results.length === 0) {
    return (
      <div className={`search-results ${className}`}>
        <div className="results-loading">
          <div className="loading-grid">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="result-skeleton">
                <div className="skeleton-image"></div>
                <div className="skeleton-content">
                  <div className="skeleton-text skeleton-title"></div>
                  <div className="skeleton-text skeleton-subtitle"></div>
                  <div className="skeleton-text skeleton-price"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isLoading && results.length === 0 && query) {
    return (
      <div className={`search-results empty ${className}`}>
        <div className="empty-results">
          <div className="empty-results-icon">🔍</div>
          <div className="empty-results-content">
            <h3>No results found</h3>
            <p>
              No cryptocurrencies match your search for "<strong>{query}</strong>".
              Try adjusting your search terms or filters.
            </p>
            <div className="empty-results-suggestions">
              <p>Suggestions:</p>
              <ul>
                <li>Check for typos in the cryptocurrency name or symbol</li>
                <li>Try searching for a more popular cryptocurrency</li>
                <li>Remove some filters to broaden your search</li>
                <li>Use partial matches (e.g., "bit" instead of "bitcoin")</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`search-results ${className}`}>
      {results.length > 0 && (
        <>
          {/* Results Header */}
          <div className="results-header">
            <div className="results-info">
              <h2 className="results-title">
                {query ? (
                  <>
                    Search results for "<span className="query-highlight">{query}</span>"
                  </>
                ) : (
                  'Search Results'
                )}
              </h2>
              <p className="results-count">
                {isLoading ? (
                  'Loading...'
                ) : (
                  <>
                    Showing {results.length} of {totalCount} results
                  </>
                )}
              </p>
            </div>

            <div className="results-actions">
              {/* Sort Options */}
              <div className="sort-controls">
                <label className="sort-label">Sort by:</label>
                <select
                  className="sort-select"
                  value={sortField}
                  onChange={(e) => handleSort(e.target.value as SortField)}
                >
                  <option value="relevance">Relevance</option>
                  <option value="rank">Market Cap Rank</option>
                  <option value="name">Name</option>
                  <option value="price">Price</option>
                  <option value="marketCap">Market Cap</option>
                  <option value="change">24h Change</option>
                  <option value="volume">24h Volume</option>
                </select>
                
                <button
                  className="sort-direction-btn"
                  onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                  title={`Sort ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}
                >
                  {sortDirection === 'asc' ? <SortAsc size={16} /> : <SortDesc size={16} />}
                </button>
              </div>

              {/* View Toggle */}
              {onViewModeChange && (
                <div className="view-toggle">
                  <button
                    className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                    onClick={() => onViewModeChange('grid')}
                    title="Grid view"
                  >
                    <Grid size={16} />
                  </button>
                  <button
                    className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                    onClick={() => onViewModeChange('list')}
                    title="List view"
                  >
                    <List size={16} />
                  </button>
                </div>
              )}

              {/* Export Options */}
              <div className="export-controls">
                <button
                  className="export-btn"
                  onClick={() => setShowExportOptions(!showExportOptions)}
                  title="Export results"
                >
                  <Download size={16} />
                </button>
                
                {showExportOptions && (
                  <div className="export-dropdown">
                    <button
                      className="export-option"
                      onClick={() => handleExport('csv')}
                    >
                      Export as CSV
                    </button>
                    <button
                      className="export-option"
                      onClick={() => handleExport('json')}
                    >
                      Export as JSON
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Results Grid */}
          <div className={`results-grid ${viewMode === 'list' ? 'list-view' : 'grid-view'}`}>
            {sortedResults.map((result) => (
              <AssetCard
                key={result.id}
                symbol={result.symbol}
                viewMode={viewMode}
                onCardClick={onAssetClick ? () => onAssetClick(result.symbol, result) : undefined}
                showQuickActions={true}
              />
            ))}
          </div>

          {/* Load More */}
          {hasMore && onLoadMore && (
            <div className="load-more-section">
              <button
                className="load-more-btn"
                onClick={onLoadMore}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Load More Results'}
              </button>
            </div>
          )}

          {/* Loading More Indicator */}
          {isLoading && results.length > 0 && (
            <div className="loading-more">
              <div className="loading-spinner-small"></div>
              <span>Loading more results...</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SearchResults;