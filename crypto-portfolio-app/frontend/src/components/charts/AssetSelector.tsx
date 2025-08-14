import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';

interface Asset {
  symbol: string;
  name: string;
  price?: number;
  change24h?: number;
  marketCap?: number;
  volume24h?: number;
  category?: string;
}

interface AssetSelectorProps {
  selectedAssets: string[];
  onAssetAdd: (asset: string) => void;
  onAssetRemove: (asset: string) => void;
  maxAssets?: number;
  availableAssets?: Asset[];
  showSearch?: boolean;
  showCategories?: boolean;
  className?: string;
}

// Mock available assets data
const defaultAvailableAssets: Asset[] = [
  { symbol: 'BTC', name: 'Bitcoin', price: 45000, change24h: 2.5, marketCap: 850000000000, category: 'Layer 1' },
  { symbol: 'ETH', name: 'Ethereum', price: 2800, change24h: 1.8, marketCap: 340000000000, category: 'Layer 1' },
  { symbol: 'ADA', name: 'Cardano', price: 0.95, change24h: -1.2, marketCap: 32000000000, category: 'Layer 1' },
  { symbol: 'DOT', name: 'Polkadot', price: 28, change24h: 3.4, marketCap: 28000000000, category: 'Layer 0' },
  { symbol: 'LINK', name: 'Chainlink', price: 25, change24h: 0.8, marketCap: 12000000000, category: 'Oracle' },
  { symbol: 'UNI', name: 'Uniswap', price: 12, change24h: -2.1, marketCap: 7500000000, category: 'DeFi' },
  { symbol: 'AVAX', name: 'Avalanche', price: 35, change24h: 4.2, marketCap: 13000000000, category: 'Layer 1' },
  { symbol: 'SOL', name: 'Solana', price: 120, change24h: 5.7, marketCap: 42000000000, category: 'Layer 1' },
  { symbol: 'MATIC', name: 'Polygon', price: 1.15, change24h: 1.9, marketCap: 10000000000, category: 'Layer 2' },
  { symbol: 'ATOM', name: 'Cosmos', price: 18, change24h: -0.5, marketCap: 5200000000, category: 'Layer 0' },
  { symbol: 'LUNA', name: 'Terra Luna', price: 85, change24h: 2.8, marketCap: 31000000000, category: 'Layer 1' },
  { symbol: 'FTM', name: 'Fantom', price: 2.8, change24h: 6.1, marketCap: 7200000000, category: 'Layer 1' },
  { symbol: 'ALGO', name: 'Algorand', price: 1.45, change24h: -1.8, marketCap: 9800000000, category: 'Layer 1' },
  { symbol: 'VET', name: 'VeChain', price: 0.085, change24h: 3.2, marketCap: 6900000000, category: 'Enterprise' },
  { symbol: 'ICP', name: 'Internet Computer', price: 42, change24h: -3.4, marketCap: 7800000000, category: 'Computing' },
  { symbol: 'NEAR', name: 'NEAR Protocol', price: 8.5, change24h: 4.8, marketCap: 5600000000, category: 'Layer 1' },
  { symbol: 'FLOW', name: 'Flow', price: 15, change24h: 1.2, marketCap: 1500000000, category: 'NFT' },
  { symbol: 'SAND', name: 'The Sandbox', price: 3.2, change24h: 8.4, marketCap: 4800000000, category: 'Metaverse' },
  { symbol: 'MANA', name: 'Decentraland', price: 2.8, change24h: 5.6, marketCap: 5200000000, category: 'Metaverse' },
  { symbol: 'CRO', name: 'Cronos', price: 0.45, change24h: 2.1, marketCap: 11500000000, category: 'Exchange' }
];

const categories = ['All', 'Layer 1', 'Layer 2', 'Layer 0', 'DeFi', 'Oracle', 'Enterprise', 'Computing', 'NFT', 'Metaverse', 'Exchange'];

const AssetSelector: React.FC<AssetSelectorProps> = ({
  selectedAssets,
  onAssetAdd,
  onAssetRemove,
  maxAssets = 8,
  availableAssets = defaultAvailableAssets,
  showSearch = true,
  showCategories = true,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'change' | 'marketCap'>('marketCap');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isMobile } = useResponsive();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter and sort assets
  const filteredAssets = React.useMemo(() => {
    let filtered = availableAssets.filter(asset => {
      // Filter by search term
      const matchesSearch = !searchTerm || 
        asset.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filter by category
      const matchesCategory = selectedCategory === 'All' || asset.category === selectedCategory;
      
      // Exclude already selected assets
      const notSelected = !selectedAssets.includes(asset.symbol);
      
      return matchesSearch && matchesCategory && notSelected;
    });

    // Sort assets
    filtered.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortBy) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'price':
          aValue = a.price || 0;
          bValue = b.price || 0;
          break;
        case 'change':
          aValue = a.change24h || 0;
          bValue = b.change24h || 0;
          break;
        case 'marketCap':
        default:
          aValue = a.marketCap || 0;
          bValue = b.marketCap || 0;
          break;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortOrder === 'asc' 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

    return filtered;
  }, [availableAssets, searchTerm, selectedCategory, selectedAssets, sortBy, sortOrder]);

  // Format large numbers
  const formatNumber = (num: number): string => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toFixed(2)}`;
  };

  // Format percentage change
  const formatChange = (change: number): string => {
    return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
  };

  // Handle sort change
  const handleSort = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  // Render selected assets
  const renderSelectedAssets = () => {
    if (selectedAssets.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1 mb-2">
        {selectedAssets.map(asset => {
          const assetData = availableAssets.find(a => a.symbol === asset);
          return (
            <div
              key={asset}
              className="flex items-center space-x-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-full px-2 py-1 text-xs"
            >
              <span className="font-medium">{asset}</span>
              {selectedAssets.length > 1 && (
                <button
                  onClick={() => onAssetRemove(asset)}
                  className="text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Mobile view
  if (isMobile) {
    return (
      <div className={`asset-selector-mobile ${className}`}>
        {renderSelectedAssets()}
        
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={selectedAssets.length >= maxAssets}
          className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          <span>Add Asset</span>
          <span className="text-xs opacity-75">
            ({selectedAssets.length}/{maxAssets})
          </span>
        </button>

        {isOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
            <div className="bg-white dark:bg-gray-800 w-full rounded-t-lg max-h-96 overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Add Asset
                  </h3>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Search */}
                {showSearch && (
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search assets..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                )}

                {/* Categories */}
                {showCategories && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {categories.map(category => (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`px-2 py-1 text-xs rounded-full transition-colors ${
                          selectedCategory === category
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                )}

                {/* Asset List */}
                <div className="space-y-2">
                  {filteredAssets.map(asset => (
                    <button
                      key={asset.symbol}
                      onClick={() => {
                        onAssetAdd(asset.symbol);
                        setIsOpen(false);
                      }}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {asset.symbol}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {asset.name}
                          </span>
                        </div>
                        {asset.category && (
                          <div className="text-xs text-gray-400 mt-1">
                            {asset.category}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right">
                        {asset.price && (
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatNumber(asset.price)}
                          </div>
                        )}
                        {asset.change24h !== undefined && (
                          <div className={`text-xs flex items-center ${
                            asset.change24h >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {asset.change24h >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                            {formatChange(asset.change24h)}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop view
  return (
    <div ref={dropdownRef} className={`asset-selector relative ${className}`}>
      {renderSelectedAssets()}
      
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={selectedAssets.length >= maxAssets}
          className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          <span>Add Asset</span>
          <span className="text-xs text-gray-500">
            ({selectedAssets.length}/{maxAssets})
          </span>
        </button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Dropdown */}
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 min-w-96 max-w-lg">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Add Asset to Comparison
                  </h3>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Search */}
                {showSearch && (
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search assets..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                )}

                {/* Categories */}
                {showCategories && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {categories.map(category => (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`px-2 py-1 text-xs rounded-md transition-colors ${
                          selectedCategory === category
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                )}

                {/* Sort Controls */}
                <div className="flex items-center space-x-2 mb-3 text-xs">
                  <span className="text-gray-500">Sort by:</span>
                  {['name', 'price', 'change', 'marketCap'].map(sortKey => (
                    <button
                      key={sortKey}
                      onClick={() => handleSort(sortKey as typeof sortBy)}
                      className={`px-2 py-1 rounded transition-colors ${
                        sortBy === sortKey
                          ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                      }`}
                    >
                      {sortKey}
                      {sortBy === sortKey && (
                        <span className="ml-1">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Asset List */}
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {filteredAssets.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                      No assets found
                    </div>
                  ) : (
                    filteredAssets.map(asset => (
                      <button
                        key={asset.symbol}
                        onClick={() => {
                          onAssetAdd(asset.symbol);
                          setIsOpen(false);
                        }}
                        className="w-full flex items-center justify-between p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-gray-900 dark:text-white text-sm">
                              {asset.symbol}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {asset.name}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            {asset.category && (
                              <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1 rounded">
                                {asset.category}
                              </span>
                            )}
                            {asset.marketCap && (
                              <span className="text-xs text-gray-400">
                                {formatNumber(asset.marketCap)}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-right ml-2">
                          {asset.price && (
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {asset.price >= 1 ? `$${asset.price.toFixed(2)}` : `$${asset.price.toFixed(4)}`}
                            </div>
                          )}
                          {asset.change24h !== undefined && (
                            <div className={`text-xs flex items-center justify-end ${
                              asset.change24h >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {asset.change24h >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                              {formatChange(asset.change24h)}
                            </div>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AssetSelector;