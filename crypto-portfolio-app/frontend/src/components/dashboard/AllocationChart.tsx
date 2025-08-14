import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, Sector } from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { TrendingUp, TrendingDown, Eye, EyeOff, Filter, RotateCcw } from 'lucide-react';

interface AllocationData {
  symbol: string;
  name: string;
  value: number;
  percentage: number;
  color?: string;
  change24h?: number;
  changePercentage24h?: number;
  exchange?: string;
  lastUpdated?: Date;
  isStale?: boolean;
}

interface AllocationChartProps {
  data: AllocationData[];
  totalValue: number;
  isLoading?: boolean;
  onAssetClick?: (asset: AllocationData) => void;
  onAssetHover?: (asset: AllocationData | null) => void;
  showChangeIndicators?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
  maxDisplayItems?: number;
  minAllocationThreshold?: number;
  className?: string;
}

const COLORS = [
  '#F59E0B', // Bitcoin orange
  '#6366F1', // Ethereum purple
  '#10B981', // Green
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6B7280', // Gray
  '#8B5A2B', // Brown
  '#DC2626', // Dark Red
  '#059669', // Dark Green
  '#7C3AED', // Dark Purple
  '#B45309', // Dark Orange
];

// Active sector rendering for hover/click effects
const renderActiveShape = (props: any) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props;
  const RADIAN = Math.PI / 180;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 10) * cos;
  const sy = cy + (outerRadius + 10) * sin;
  const mx = cx + (outerRadius + 30) * cos;
  const my = cy + (outerRadius + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill="#374151" className="text-sm font-medium">
        {payload.symbol}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="#fff"
        strokeWidth={2}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 10}
        outerRadius={outerRadius + 12}
        fill={fill}
        opacity={0.8}
      />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" strokeWidth={2} />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text 
        x={ex + (cos >= 0 ? 1 : -1) * 12} 
        y={ey} 
        textAnchor={textAnchor} 
        fill="#374151"
        className="text-xs font-medium"
      >
        {payload.percentage.toFixed(1)}%
      </text>
      <text 
        x={ex + (cos >= 0 ? 1 : -1) * 12} 
        y={ey} 
        dy={18} 
        textAnchor={textAnchor} 
        fill="#6B7280"
        className="text-xs"
      >
        {formatCurrency(payload.value)}
      </text>
    </g>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const hasChange = data.changePercentage24h !== undefined;
    const isPositiveChange = (data.changePercentage24h || 0) >= 0;
    
    return (
      <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-xl max-w-xs">
        <div className="flex items-center gap-2 mb-3">
          <div 
            className="w-4 h-4 rounded-full border-2 border-white shadow-sm" 
            style={{ backgroundColor: data.color }}
          ></div>
          <div>
            <div className="font-semibold text-gray-900">{data.symbol}</div>
            <div className="text-xs text-gray-500 truncate">{data.name}</div>
          </div>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Value:</span>
            <span className="font-medium text-gray-900">{formatCurrency(data.value)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Allocation:</span>
            <span className="font-medium text-gray-900">{data.percentage.toFixed(2)}%</span>
          </div>
          
          {hasChange && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600">24h Change:</span>
              <div className="flex items-center gap-1">
                {isPositiveChange ? (
                  <TrendingUp className="w-3 h-3 text-green-500" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-500" />
                )}
                <span className={`font-medium text-xs ${
                  isPositiveChange ? 'text-green-600' : 'text-red-600'
                }`}>
                  {data.changePercentage24h?.toFixed(2)}%
                </span>
              </div>
            </div>
          )}
          
          {data.exchange && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Exchange:</span>
              <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded">
                {data.exchange.toUpperCase()}
              </span>
            </div>
          )}
          
          {data.isStale && (
            <div className="flex items-center gap-1 text-amber-600 text-xs">
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
              <span>Price data may be stale</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export const AllocationChart: React.FC<AllocationChartProps> = ({ 
  data, 
  totalValue, 
  isLoading = false,
  onAssetClick,
  onAssetHover,
  showChangeIndicators = true,
  autoRefresh = false,
  refreshInterval = 30000,
  maxDisplayItems = 8,
  minAllocationThreshold = 1,
  className = ''
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [hiddenAssets, setHiddenAssets] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<'all' | 'profitable' | 'losing'>('all');
  const [sortBy, setSortBy] = useState<'value' | 'percentage' | 'change'>('value');
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Auto-refresh logic
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshTimerRef.current = setInterval(() => {
        // Trigger refresh by calling parent callback if available
        // This would typically trigger a data refetch
      }, refreshInterval);
      
      return () => {
        if (refreshTimerRef.current) {
          clearInterval(refreshTimerRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval]);
  
  // Filter and process data
  const processedData = useMemo(() => {
    if (!data || data.length === 0) {
      return data; // Return empty array for processing
    }
    
    // Filter out hidden assets
    let filteredData = data.filter(asset => !hiddenAssets.has(asset.symbol));
    
    // Apply filter mode
    if (filterMode === 'profitable') {
      filteredData = filteredData.filter(asset => (asset.changePercentage24h || 0) >= 0);
    } else if (filterMode === 'losing') {
      filteredData = filteredData.filter(asset => (asset.changePercentage24h || 0) < 0);
    }
    
    // Filter by allocation threshold
    filteredData = filteredData.filter(asset => asset.percentage >= minAllocationThreshold);
    
    // Sort data
    filteredData.sort((a, b) => {
      switch (sortBy) {
        case 'percentage':
          return b.percentage - a.percentage;
        case 'change':
          return (b.changePercentage24h || 0) - (a.changePercentage24h || 0);
        case 'value':
        default:
          return b.value - a.value;
      }
    });
    
    return filteredData;
  }, [data, hiddenAssets, filterMode, sortBy, minAllocationThreshold]);
  
  // Prepare chart data
  const chartData = useMemo(() => {

    // Add colors to processed data
    const coloredData = processedData.map((item, index) => ({
      ...item,
      color: item.color || COLORS[index % COLORS.length]
    }));

    // Show top assets and group others
    const topAssets = coloredData.slice(0, maxDisplayItems);
    const otherAssets = coloredData.slice(maxDisplayItems);
    
    let finalData = [...topAssets];
    
    if (otherAssets.length > 0) {
      const othersValue = otherAssets.reduce((sum, asset) => sum + asset.value, 0);
      const othersPercentage = totalValue > 0 ? (othersValue / totalValue) * 100 : 0;
      
      finalData.push({
        symbol: 'OTHER',
        name: `Others (${otherAssets.length} assets)`,
        value: othersValue,
        percentage: othersPercentage,
        color: '#9CA3AF',
        isGrouped: true
      } as AllocationData);
    }
    
    return finalData;
  }, [processedData, maxDisplayItems, totalValue]);
  
  // Event handlers
  const handlePieEnter = useCallback((data: any, index: number) => {
    setActiveIndex(index);
    onAssetHover?.(data);
  }, [onAssetHover]);
  
  const handlePieLeave = useCallback(() => {
    setActiveIndex(null);
    onAssetHover?.(null);
  }, [onAssetHover]);
  
  const handleAssetClick = useCallback((asset: AllocationData) => {
    if (!asset.isGrouped) {
      onAssetClick?.(asset);
    }
  }, [onAssetClick]);
  
  const toggleAssetVisibility = useCallback((symbol: string) => {
    setHiddenAssets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(symbol)) {
        newSet.delete(symbol);
      } else {
        newSet.add(symbol);
      }
      return newSet;
    });
  }, []);
  
  const resetFilters = useCallback(() => {
    setHiddenAssets(new Set());
    setFilterMode('all');
    setSortBy('value');
    setActiveIndex(null);
  }, []);
  
  // Loading state
  if (isLoading) {
    return (
      <div className={`h-96 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-80">
            <div className="bg-gray-100 rounded-lg"></div>
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Empty state
  if (!data || data.length === 0 || chartData.length === 0) {
    return (
      <div className={`h-96 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Portfolio Allocation</h3>
          {data && data.length > 0 && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Filters
            </button>
          )}
        </div>
        <div className="flex items-center justify-center h-64 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-sm font-medium">
              {data && data.length > 0 ? 'No assets match current filters' : 'No allocation data available'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {data && data.length > 0 ? 'Try adjusting your filter settings' : 'Add some assets to see your portfolio allocation'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-auto min-h-96 ${className}`}>
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Portfolio Allocation</h3>
          <p className="text-sm text-gray-500 mt-1">
            {chartData.length} assets • Last updated: {new Date().toLocaleTimeString()}
          </p>
        </div>
        
        {/* Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter Mode */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filterMode === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterMode('profitable')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filterMode === 'profitable' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ↗ Profitable
            </button>
            <button
              onClick={() => setFilterMode('losing')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filterMode === 'losing' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ↘ Losing
            </button>
          </div>
          
          {/* Sort Control */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'value' | 'percentage' | 'change')}
            className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="value">Sort by Value</option>
            <option value="percentage">Sort by Allocation</option>
            <option value="change">Sort by 24h Change</option>
          </select>
          
          {/* Reset Button */}
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            title="Reset all filters"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-80">
        {/* Interactive Pie Chart */}
        <div className="h-80 lg:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                paddingAngle={2}
                dataKey="value"
                onMouseEnter={handlePieEnter}
                onMouseLeave={handlePieLeave}
                animationBegin={0}
                animationDuration={800}
                activeIndex={activeIndex}
                activeShape={renderActiveShape}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color} 
                    stroke="#fff"
                    strokeWidth={2}
                    className="cursor-pointer transition-opacity hover:opacity-90"
                    onClick={() => handleAssetClick(entry)}
                  />
                ))}
              </Pie>
              <Tooltip 
                content={<CustomTooltip />}
                wrapperStyle={{ outline: 'none' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Interactive Asset List */}
        <div className="h-80 lg:h-96">
          <div className="h-full overflow-y-auto pr-2">
            <div className="space-y-2">
              {chartData.map((asset, index) => {
                const isActive = activeIndex === index;
                const isHidden = hiddenAssets.has(asset.symbol);
                const hasChange = asset.changePercentage24h !== undefined;
                const isPositiveChange = (asset.changePercentage24h || 0) >= 0;
                
                return (
                  <div 
                    key={asset.symbol} 
                    className={`group relative p-3 rounded-lg border transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-blue-50 border-blue-200 shadow-md' 
                        : isHidden
                        ? 'bg-gray-50 border-gray-200 opacity-50'
                        : 'bg-white border-gray-200 hover:bg-gray-50 hover:shadow-sm'
                    }`}
                    onMouseEnter={() => handlePieEnter(asset, index)}
                    onMouseLeave={handlePieLeave}
                    onClick={() => handleAssetClick(asset)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div 
                          className="w-4 h-4 rounded-full flex-shrink-0 border border-white shadow-sm" 
                          style={{ backgroundColor: asset.color }}
                        ></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-gray-900 truncate">{asset.symbol}</div>
                            {asset.isStale && (
                              <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" title="Stale data"></div>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 truncate">{asset.name}</div>
                          {asset.exchange && (
                            <div className="text-xs text-gray-400">{asset.exchange.toUpperCase()}</div>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right flex-shrink-0">
                        <div className="font-medium text-gray-900">{asset.percentage.toFixed(2)}%</div>
                        <div className="text-sm text-gray-500">{formatCurrency(asset.value)}</div>
                        {hasChange && showChangeIndicators && (
                          <div className={`flex items-center gap-1 text-xs mt-1 ${
                            isPositiveChange ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {isPositiveChange ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            <span>{asset.changePercentage24h?.toFixed(2)}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Asset Controls */}
                    {!asset.isGrouped && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAssetVisibility(asset.symbol);
                        }}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white rounded"
                        title={isHidden ? 'Show asset' : 'Hide asset'}
                      >
                        {isHidden ? (
                          <EyeOff className="w-3 h-3 text-gray-400" />
                        ) : (
                          <Eye className="w-3 h-3 text-gray-400" />
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Total Summary */}
            <div className="mt-4 pt-4 border-t border-gray-200 bg-white rounded-lg p-3">
              <div className="flex items-center justify-between font-semibold text-gray-900">
                <span>Total Portfolio Value</span>
                <span>{formatCurrency(totalValue)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500 mt-1">
                <span>Visible Assets</span>
                <span>{chartData.length} of {data.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Legend */}
      <div className="mt-6 lg:hidden">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Asset Legend</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {chartData.slice(0, 8).map((asset) => (
              <div key={asset.symbol} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: asset.color }}
                ></div>
                <span className="truncate font-medium">{asset.symbol}</span>
                <span className="text-gray-500 ml-auto">{asset.percentage.toFixed(1)}%</span>
              </div>
            ))}
            {chartData.length > 8 && (
              <div className="text-xs text-gray-400 col-span-full text-center pt-2">
                ... and {chartData.length - 8} more assets
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Real-time indicator */}
      {autoRefresh && (
        <div className="flex items-center gap-2 mt-4 text-xs text-gray-500">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span>Auto-refreshing every {Math.floor(refreshInterval / 1000)}s</span>
        </div>
      )}
    </div>
  );
};