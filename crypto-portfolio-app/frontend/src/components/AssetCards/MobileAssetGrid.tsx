import React, { useState, useCallback, useMemo } from 'react';
import { Search, Filter, SortAsc, SortDesc, Grid, List } from 'lucide-react';
import { useResponsive, useBreakpointValue } from '../../hooks/useResponsive';
import { useTouch } from '../../hooks/useTouch';
import TouchOptimizedAssetCard from './TouchOptimizedAssetCard';

interface Asset {
  symbol: string;
  name: string;
  currentPrice: number;
  priceChangePercentage24h: number;
  marketCap: number;
  volume24h: number;
  rank: number;
}

interface MobileAssetGridProps {
  assets: Asset[];
  loading?: boolean;
  error?: string;
  onAssetClick?: (symbol: string, assetData: Asset) => void;
  onAssetLongPress?: (symbol: string, assetData: Asset) => void;
  onSwipeAction?: (symbol: string, action: 'buy' | 'sell' | 'favorite') => void;
  showSearch?: boolean;
  showFilters?: boolean;
  enableSwipeActions?: boolean;
  initialViewMode?: 'grid' | 'list' | 'compact';
  className?: string;
}

type SortField = 'rank' | 'price' | 'change' | 'marketCap' | 'volume';
type SortDirection = 'asc' | 'desc';

interface FilterState {
  priceRange: { min: number; max: number };
  changeRange: { min: number; max: number };
  marketCapRange: { min: number; max: number };
  favorites: boolean;
  holdings: boolean;
}

const MobileAssetGrid: React.FC<MobileAssetGridProps> = ({
  assets,
  loading = false,
  error,
  onAssetClick,
  onAssetLongPress,
  onSwipeAction,
  showSearch = true,
  showFilters = true,
  enableSwipeActions = true,
  initialViewMode = 'grid',
  className = ''
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [viewMode, setViewMode] = useState(initialViewMode);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    priceRange: { min: 0, max: Infinity },
    changeRange: { min: -Infinity, max: Infinity },
    marketCapRange: { min: 0, max: Infinity },
    favorites: false,
    holdings: false
  });

  const { isMobile, isTablet, isSmallMobile } = useResponsive();
  const isTouchDevice = isMobile || isTablet;

  // Responsive grid columns
  const gridColumns = useBreakpointValue({
    xs: 1,
    sm: 2,
    md: 2,
    lg: 3,
    xl: 4,
    xxl: 4
  }) || 1;

  // Touch handlers for pull-to-refresh (could be implemented)
  const touchHandlers = useTouch({
    onPan: (point, delta) => {
      // Implement pull-to-refresh logic here
      if (delta.y > 100) {
        // Trigger refresh
      }
    }
  });

  // Filter and sort assets
  const filteredAndSortedAssets = useMemo(() => {
    let filtered = assets;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(asset => 
        asset.symbol.toLowerCase().includes(query) ||
        asset.name.toLowerCase().includes(query)
      );
    }

    // Apply price filters
    filtered = filtered.filter(asset => {
      return asset.currentPrice >= filters.priceRange.min &&
             asset.currentPrice <= filters.priceRange.max &&
             asset.priceChangePercentage24h >= filters.changeRange.min &&
             asset.priceChangePercentage24h <= filters.changeRange.max &&
             asset.marketCap >= filters.marketCapRange.min &&
             asset.marketCap <= filters.marketCapRange.max;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: number, bValue: number;
      
      switch (sortField) {
        case 'price':
          aValue = a.currentPrice;
          bValue = b.currentPrice;
          break;
        case 'change':
          aValue = a.priceChangePercentage24h;
          bValue = b.priceChangePercentage24h;
          break;
        case 'marketCap':
          aValue = a.marketCap;
          bValue = b.marketCap;
          break;
        case 'volume':
          aValue = a.volume24h;
          bValue = b.volume24h;
          break;
        case 'rank':
        default:
          aValue = a.rank;
          bValue = b.rank;
          break;
      }
      
      const comparison = aValue - bValue;
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [assets, searchQuery, sortField, sortDirection, filters]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  const handleViewModeChange = useCallback((mode: typeof viewMode) => {
    setViewMode(mode);
  }, []);

  // Auto-adjust view mode based on screen size
  const effectiveViewMode = useMemo(() => {
    if (isSmallMobile) return 'compact';
    if (isMobile && viewMode === 'grid') return 'list';
    return viewMode;
  }, [isSmallMobile, isMobile, viewMode]);

  if (loading) {
    return (
      <div className={`mobile-asset-grid-loading ${className}`}>
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="bg-white rounded-xl p-4 animate-pulse">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-32"></div>
                </div>
                <div className="text-right">
                  <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-16"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`mobile-asset-grid-error ${className}`}>
        <div className="text-center py-12">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to load assets</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors touch-target">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`mobile-asset-grid ${className}`} {...(isTouchDevice ? touchHandlers : {})}>
      {/* Search and filter header */}
      {(showSearch || showFilters) && (
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 mb-4">
          {/* Search bar */}
          {showSearch && (
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-target"
              />
            </div>
          )}

          {/* Filter and view controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {showFilters && (
                <button
                  onClick={() => setShowFilterModal(true)}
                  className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors touch-target"
                >
                  <Filter size={16} />
                  <span className="text-sm font-medium">Filter</span>
                </button>
              )}

              {/* Sort buttons */}
              <div className="flex items-center space-x-1">
                {(['rank', 'price', 'change'] as SortField[]).map((field) => (
                  <button
                    key={field}
                    onClick={() => handleSort(field)}
                    className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-colors touch-target ${
                      sortField === field 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <span className="capitalize">{field}</span>
                    {sortField === field && (
                      sortDirection === 'asc' ? <SortAsc size={12} /> : <SortDesc size={12} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* View mode toggle */}
            {!isSmallMobile && (
              <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => handleViewModeChange('grid')}
                  className={`p-2 rounded-md transition-colors touch-target ${
                    viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
                  }`}
                >
                  <Grid size={16} />
                </button>
                <button
                  onClick={() => handleViewModeChange('list')}
                  className={`p-2 rounded-md transition-colors touch-target ${
                    viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
                  }`}
                >
                  <List size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Asset grid/list */}
      <div className="px-4 pb-20"> {/* Bottom padding for mobile navigation */}
        {filteredAndSortedAssets.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📭</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No assets found</h3>
            <p className="text-gray-600">
              {searchQuery ? 'Try adjusting your search or filters' : 'No assets available'}
            </p>
          </div>
        ) : (
          <div
            className={
              effectiveViewMode === 'grid'
                ? `grid gap-4 ${gridColumns === 1 ? 'grid-cols-1' : gridColumns === 2 ? 'grid-cols-2' : gridColumns === 3 ? 'grid-cols-3' : 'grid-cols-4'}`
                : 'space-y-3'
            }
          >
            {filteredAndSortedAssets.map((asset) => (
              <TouchOptimizedAssetCard
                key={asset.symbol}
                symbol={asset.symbol}
                viewMode={effectiveViewMode}
                onCardClick={onAssetClick}
                onCardLongPress={onAssetLongPress}
                onSwipeAction={onSwipeAction}
                enableSwipeActions={enableSwipeActions && isTouchDevice}
                showQuickActions={true}
              />
            ))}
          </div>
        )}
      </div>

      {/* Results count */}
      {filteredAndSortedAssets.length > 0 && (
        <div className="fixed bottom-safe-or-4 left-4 right-4 bg-black bg-opacity-75 text-white text-center py-2 px-4 rounded-lg text-sm font-medium">
          {filteredAndSortedAssets.length} of {assets.length} assets
          {searchQuery && ` matching "${searchQuery}"`}
        </div>
      )}

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md sm:rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="text-gray-400 hover:text-gray-600 touch-target"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
              {/* Price Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price Range
                </label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    placeholder="Min"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      priceRange: { ...prev.priceRange, min: Number(e.target.value) || 0 }
                    }))}
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      priceRange: { ...prev.priceRange, max: Number(e.target.value) || Infinity }
                    }))}
                  />
                </div>
              </div>

              {/* Change Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  24h Change (%)
                </label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    placeholder="Min %"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      changeRange: { ...prev.changeRange, min: Number(e.target.value) || -Infinity }
                    }))}
                  />
                  <input
                    type="number"
                    placeholder="Max %"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      changeRange: { ...prev.changeRange, max: Number(e.target.value) || Infinity }
                    }))}
                  />
                </div>
              </div>

              {/* Toggle filters */}
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.favorites}
                    onChange={(e) => setFilters(prev => ({ ...prev, favorites: e.target.checked }))}
                    className="mr-3 w-5 h-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Favorites only</span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.holdings}
                    onChange={(e) => setFilters(prev => ({ ...prev, holdings: e.target.checked }))}
                    className="mr-3 w-5 h-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Holdings only</span>
                </label>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-gray-200 flex space-x-3">
              <button
                onClick={() => {
                  setFilters({
                    priceRange: { min: 0, max: Infinity },
                    changeRange: { min: -Infinity, max: Infinity },
                    marketCapRange: { min: 0, max: Infinity },
                    favorites: false,
                    holdings: false
                  });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 active:bg-gray-100 transition-colors touch-target"
              >
                Clear
              </button>
              <button
                onClick={() => setShowFilterModal(false)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors touch-target"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileAssetGrid;