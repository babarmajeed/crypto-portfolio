import React, { useState, useMemo, useCallback } from 'react';
import { Grid, List, Filter, Search, SortAsc, SortDesc } from 'lucide-react';
import AssetCard from './AssetCard';

interface AssetCardGridProps {
  symbols: string[];
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
  onAssetClick?: (symbol: string, assetData: any) => void;
  showViewToggle?: boolean;
  showSearch?: boolean;
  showSort?: boolean;
  showFilter?: boolean;
  className?: string;
}

interface SortOption {
  value: string;
  label: string;
}

interface FilterOption {
  value: string;
  label: string;
}

const sortOptions: SortOption[] = [
  { value: 'rank', label: 'Market Cap' },
  { value: 'name', label: 'Name' },
  { value: 'price', label: 'Price' },
  { value: 'change24h', label: '24h Change' },
  { value: 'volume24h', label: '24h Volume' }
];

const filterOptions: FilterOption[] = [
  { value: 'all', label: 'All Assets' },
  { value: 'holdings', label: 'My Holdings' },
  { value: 'watchlist', label: 'Watchlist' },
  { value: 'gainers', label: 'Top Gainers' },
  { value: 'losers', label: 'Top Losers' }
];

const AssetCardGrid: React.FC<AssetCardGridProps> = ({
  symbols,
  viewMode = 'grid',
  onViewModeChange,
  onAssetClick,
  showViewToggle = true,
  showSearch = true,
  showSort = true,
  showFilter = true,
  className = ''
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rank');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterBy, setFilterBy] = useState('all');

  // Filter and search symbols
  const filteredSymbols = useMemo(() => {
    let filtered = [...symbols];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(symbol =>
        symbol.toLowerCase().includes(query)
      );
    }

    // TODO: Apply additional filters based on filterBy
    // This would require access to asset data and portfolio data
    // For now, we'll just return the search-filtered results

    return filtered;
  }, [symbols, searchQuery, filterBy]);

  // Sort symbols (this would need asset data in a real implementation)
  const sortedSymbols = useMemo(() => {
    // For now, just return the filtered symbols
    // In a real implementation, you'd sort based on actual asset data
    return filteredSymbols;
  }, [filteredSymbols, sortBy, sortDirection]);

  const handleSortChange = useCallback((newSortBy: string) => {
    if (sortBy === newSortBy) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortDirection('asc');
    }
  }, [sortBy]);


  return (
    <div className={`asset-card-grid-container ${className}`}>
      {/* Controls Bar */}
      {(showSearch || showSort || showFilter || showViewToggle) && (
        <div className="controls-bar">
          {/* Search */}
          {showSearch && (
            <div className="search-control">
              <div className="search-input-wrapper">
                <Search className="search-icon" size={16} />
                <input
                  type="text"
                  placeholder="Search assets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>
          )}

          {/* Filter */}
          {showFilter && (
            <div className="filter-control">
              <Filter className="control-icon" size={16} />
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value)}
                className="filter-select"
              >
                {filterOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sort */}
          {showSort && (
            <div className="sort-control">
              <button
                className="sort-button"
                onClick={() => handleSortChange(sortBy)}
              >
                {sortDirection === 'asc' ? (
                  <SortAsc className="control-icon" size={16} />
                ) : (
                  <SortDesc className="control-icon" size={16} />
                )}
                <span>Sort</span>
              </button>
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                className="sort-select"
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* View Toggle */}
          {showViewToggle && onViewModeChange && (
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
        </div>
      )}

      {/* Results Count */}
      <div className="results-info">
        <span className="results-count">
          {sortedSymbols.length} asset{sortedSymbols.length !== 1 ? 's' : ''}
          {searchQuery && (
            <span className="search-info">
              {' '}matching "{searchQuery}"
            </span>
          )}
        </span>
      </div>

      {/* Asset Grid */}
      <div className={`asset-cards ${viewMode === 'grid' ? 'grid-layout' : 'list-layout'}`}>
        {sortedSymbols.length > 0 ? (
          sortedSymbols.map(symbol => (
            <AssetCard
              key={symbol}
              symbol={symbol}
              viewMode={viewMode}
              onCardClick={onAssetClick}
              showQuickActions={true}
            />
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📈</div>
            <h3>No assets found</h3>
            <p>
              {searchQuery 
                ? `No assets match "${searchQuery}". Try adjusting your search.`
                : 'No assets to display. Add some assets to your portfolio or watchlist.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Load More Button (if needed for pagination) */}
      {/* This would be implemented based on your pagination strategy */}
    </div>
  );
};

export default AssetCardGrid;