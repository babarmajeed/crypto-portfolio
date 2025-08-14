import React, { useState, useMemo } from 'react';
import {
  Target,
  BarChart3,
  Activity,
  TrendingUp,
  TrendingDown,
  Layers,
  Info,
  Settings,
  RefreshCw,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { MarketDepth } from '../../services/VolumeAnalysisService';

interface MarketDepthChartProps {
  marketDepth: MarketDepth | null;
  symbol?: string;
  currentPrice?: number;
  className?: string;
  onRefresh?: () => void;
}

interface DepthChartSettings {
  chartType: 'area' | 'step' | 'bar';
  showCumulative: boolean;
  showQuantity: boolean;
  showValue: boolean;
  colorScheme: 'default' | 'intensity' | 'professional';
  zoomLevel: number;
  maxLevels: number;
}

const MarketDepthChart: React.FC<MarketDepthChartProps> = ({
  marketDepth,
  symbol = 'BTC/USD',
  currentPrice = 0,
  className = '',
  onRefresh
}) => {
  const [settings, setSettings] = useState<DepthChartSettings>({
    chartType: 'area',
    showCumulative: true,
    showQuantity: true,
    showValue: false,
    colorScheme: 'default',
    zoomLevel: 1,
    maxLevels: 50
  });
  const [showSettings, setShowSettings] = useState(false);

  // Process market depth data for visualization
  const processedData = useMemo(() => {
    if (!marketDepth) return null;

    const levels = marketDepth.levels.slice(0, settings.maxLevels);
    
    // Separate bids and asks
    const bids = levels.filter(level => level.bidQuantity > 0).reverse();
    const asks = levels.filter(level => level.askQuantity > 0);
    
    // Calculate cumulative values
    let bidCumulative = 0;
    let askCumulative = 0;
    
    const processedBids = bids.map(level => {
      bidCumulative += level.bidQuantity;
      return {
        ...level,
        cumulativeQuantity: bidCumulative,
        cumulativeValue: bidCumulative * level.price
      };
    });
    
    const processedAsks = asks.map(level => {
      askCumulative += level.askQuantity;
      return {
        ...level,
        cumulativeQuantity: askCumulative,
        cumulativeValue: askCumulative * level.price
      };
    });

    // Find mid price if not provided
    const midPrice = currentPrice || (
      bids.length > 0 && asks.length > 0 
        ? (bids[bids.length - 1].price + asks[0].price) / 2
        : 0
    );

    // Calculate metrics
    const totalBidQuantity = bidCumulative;
    const totalAskQuantity = askCumulative;
    const totalBidValue = processedBids.reduce((sum, level) => sum + (level.bidQuantity * level.price), 0);
    const totalAskValue = processedAsks.reduce((sum, level) => sum + (level.askQuantity * level.price), 0);
    
    const imbalance = totalBidQuantity > 0 || totalAskQuantity > 0 
      ? (totalBidQuantity - totalAskQuantity) / (totalBidQuantity + totalAskQuantity)
      : 0;

    // Calculate depth at various distances
    const depthLevels = [0.1, 0.25, 0.5, 1.0, 2.0]; // Percentage from mid
    const depthAnalysis = depthLevels.map(pct => {
      const range = midPrice * (pct / 100);
      const bidDepth = processedBids
        .filter(level => level.price >= midPrice - range)
        .reduce((sum, level) => sum + level.bidQuantity, 0);
      const askDepth = processedAsks
        .filter(level => level.price <= midPrice + range)
        .reduce((sum, level) => sum + level.askQuantity, 0);
      
      return {
        percentage: pct,
        bidDepth,
        askDepth,
        totalDepth: bidDepth + askDepth
      };
    });

    return {
      bids: processedBids,
      asks: processedAsks,
      midPrice,
      totalBidQuantity,
      totalAskQuantity,
      totalBidValue,
      totalAskValue,
      imbalance,
      depthAnalysis,
      maxQuantity: Math.max(
        ...processedBids.map(b => settings.showCumulative ? b.cumulativeQuantity : b.bidQuantity),
        ...processedAsks.map(a => settings.showCumulative ? a.cumulativeQuantity : a.askQuantity)
      )
    };
  }, [marketDepth, settings.maxLevels, settings.showCumulative, currentPrice]);

  // Get chart colors
  const getChartColors = () => {
    switch (settings.colorScheme) {
      case 'intensity':
        return {
          bid: 'rgb(34, 197, 94)',
          ask: 'rgb(239, 68, 68)',
          bidArea: 'rgba(34, 197, 94, 0.3)',
          askArea: 'rgba(239, 68, 68, 0.3)'
        };
      case 'professional':
        return {
          bid: 'rgb(16, 185, 129)',
          ask: 'rgb(245, 101, 101)',
          bidArea: 'rgba(16, 185, 129, 0.2)',
          askArea: 'rgba(245, 101, 101, 0.2)'
        };
      default:
        return {
          bid: 'rgb(22, 163, 74)',
          ask: 'rgb(220, 38, 38)',
          bidArea: 'rgba(22, 163, 74, 0.3)',
          askArea: 'rgba(220, 38, 38, 0.3)'
        };
    }
  };

  // Format currency
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Format number
  const formatNumber = (value: number, decimals: number = 3): string => {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  // Format percentage
  const formatPercentage = (value: number): string => {
    return `${(value * 100).toFixed(2)}%`;
  };

  // Render settings panel
  const renderSettings = () => (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
      <h4 className="font-medium text-gray-900 dark:text-white mb-3">Market Depth Settings</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Chart Type
          </label>
          <select
            value={settings.chartType}
            onChange={(e) => setSettings(prev => ({ ...prev, chartType: e.target.value as any }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
          >
            <option value="area">Area Chart</option>
            <option value="step">Step Chart</option>
            <option value="bar">Bar Chart</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Color Scheme
          </label>
          <select
            value={settings.colorScheme}
            onChange={(e) => setSettings(prev => ({ ...prev, colorScheme: e.target.value as any }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
          >
            <option value="default">Default</option>
            <option value="intensity">High Intensity</option>
            <option value="professional">Professional</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Max Levels
          </label>
          <select
            value={settings.maxLevels}
            onChange={(e) => setSettings(prev => ({ ...prev, maxLevels: Number(e.target.value) }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
          >
            <option value={25}>25 Levels</option>
            <option value={50}>50 Levels</option>
            <option value={100}>100 Levels</option>
            <option value={200}>200 Levels</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex items-center space-x-6">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.showCumulative}
            onChange={(e) => setSettings(prev => ({ ...prev, showCumulative: e.target.checked }))}
            className="mr-2"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Cumulative View</span>
        </label>
        
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.showQuantity}
            onChange={(e) => setSettings(prev => ({ ...prev, showQuantity: e.target.checked }))}
            className="mr-2"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Show Quantity</span>
        </label>

        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.showValue}
            onChange={(e) => setSettings(prev => ({ ...prev, showValue: e.target.checked }))}
            className="mr-2"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Show Value</span>
        </label>
      </div>
    </div>
  );

  // Render metrics
  const renderMetrics = () => {
    if (!processedData) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-2">
            <Target className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Liquidity Score</h3>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {marketDepth ? formatNumber(marketDepth.liquidityScore, 1) : 'N/A'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Out of 10.0
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-2">
            <Activity className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Order Imbalance</h3>
          </div>
          <div className={`text-xl font-bold ${
            processedData.imbalance > 0 ? 'text-green-600' : 
            processedData.imbalance < 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'
          }`}>
            {formatPercentage(processedData.imbalance)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {processedData.imbalance > 0 ? 'Bid heavy' : processedData.imbalance < 0 ? 'Ask heavy' : 'Balanced'}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Bid Depth</h3>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {formatNumber(processedData.totalBidQuantity)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {formatCurrency(processedData.totalBidValue)}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-600" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Ask Depth</h3>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {formatNumber(processedData.totalAskQuantity)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {formatCurrency(processedData.totalAskValue)}
          </div>
        </div>
      </div>
    );
  };

  // Render depth chart
  const renderDepthChart = () => {
    if (!processedData) {
      return (
        <div className="h-96 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <BarChart3 className="w-12 h-12 mx-auto mb-2" />
            <p>No market depth data available</p>
          </div>
        </div>
      );
    }

    const colors = getChartColors();
    const maxQuantity = processedData.maxQuantity;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Market Depth Chart - {symbol}
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSettings(prev => ({ ...prev, zoomLevel: Math.max(0.5, prev.zoomLevel - 0.25) }))}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {(settings.zoomLevel * 100).toFixed(0)}%
            </span>
            <button
              onClick={() => setSettings(prev => ({ ...prev, zoomLevel: Math.min(3, prev.zoomLevel + 0.25) }))}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="relative" style={{ height: '400px' }}>
          <svg width="100%" height="100%" className="overflow-visible">
            {/* Chart background */}
            <defs>
              <linearGradient id="bidGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={colors.bidArea} />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
              <linearGradient id="askGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="transparent" />
                <stop offset="100%" stopColor={colors.askArea} />
              </linearGradient>
            </defs>

            {/* Bid side (left) */}
            {processedData.bids.map((bid, index) => {
              const width = 40; // 40% of chart width for bids
              const height = 90; // 90% of chart height
              const x = 5 + (width - (bid.bidQuantity / maxQuantity) * width);
              const y = 5 + (index / processedData.bids.length) * height;
              const barHeight = height / processedData.bids.length;
              const barWidth = (bid.bidQuantity / maxQuantity) * width;

              return (
                <g key={`bid-${index}`}>
                  {settings.chartType === 'bar' && (
                    <rect
                      x={`${x}%`}
                      y={`${y}%`}
                      width={`${barWidth}%`}
                      height={`${barHeight}%`}
                      fill={colors.bid}
                      opacity={0.7}
                    />
                  )}
                </g>
              );
            })}

            {/* Ask side (right) */}
            {processedData.asks.map((ask, index) => {
              const width = 40; // 40% of chart width for asks
              const height = 90; // 90% of chart height
              const x = 55; // Start from 55% (middle + gap)
              const y = 5 + (index / processedData.asks.length) * height;
              const barHeight = height / processedData.asks.length;
              const barWidth = (ask.askQuantity / maxQuantity) * width;

              return (
                <g key={`ask-${index}`}>
                  {settings.chartType === 'bar' && (
                    <rect
                      x={`${x}%`}
                      y={`${y}%`}
                      width={`${barWidth}%`}
                      height={`${barHeight}%`}
                      fill={colors.ask}
                      opacity={0.7}
                    />
                  )}
                </g>
              );
            })}

            {/* Mid price line */}
            <line
              x1="47%"
              y1="5%"
              x2="47%"
              y2="95%"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="5,5"
              className="text-blue-600"
            />
            
            {/* Mid price label */}
            <text
              x="47%"
              y="3%"
              textAnchor="middle"
              className="text-xs font-medium fill-current text-blue-600"
            >
              {formatCurrency(processedData.midPrice)}
            </text>
          </svg>

          {/* Chart placeholder for complex chart */}
          <div className="absolute inset-4 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <Target className="w-16 h-16 mx-auto mb-4" />
              <p className="text-lg font-medium">Advanced Market Depth Chart</p>
              <p className="text-sm">Interactive depth visualization with {processedData.bids.length + processedData.asks.length} levels</p>
              <div className="mt-4 flex items-center justify-center space-x-4 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span>Bids: {formatNumber(processedData.totalBidQuantity)}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span>Asks: {formatNumber(processedData.totalAskQuantity)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-gray-700 dark:text-gray-300">Bids</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-gray-700 dark:text-gray-300">Asks</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 border border-blue-500 rounded"></div>
            <span className="text-gray-700 dark:text-gray-300">Mid Price</span>
          </div>
        </div>
      </div>
    );
  };

  // Render depth analysis table
  const renderDepthAnalysis = () => {
    if (!processedData) return null;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Depth Analysis by Distance
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Distance from Mid</th>
                <th className="text-right py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Bid Depth</th>
                <th className="text-right py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Ask Depth</th>
                <th className="text-right py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Total Depth</th>
                <th className="text-right py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Liquidity %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {processedData.depthAnalysis.map((depth, index) => {
                const liquidityPercentage = (depth.totalDepth / (processedData.totalBidQuantity + processedData.totalAskQuantity)) * 100;
                return (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="py-3 text-sm text-gray-900 dark:text-white">
                      ±{depth.percentage}%
                    </td>
                    <td className="py-3 text-sm text-right text-green-600">
                      {formatNumber(depth.bidDepth)}
                    </td>
                    <td className="py-3 text-sm text-right text-red-600">
                      {formatNumber(depth.askDepth)}
                    </td>
                    <td className="py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                      {formatNumber(depth.totalDepth)}
                    </td>
                    <td className="py-3 text-sm text-right text-gray-500 dark:text-gray-400">
                      {liquidityPercentage.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (!marketDepth) {
    return (
      <div className={`market-depth-chart ${className}`}>
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Target className="w-12 h-12 mx-auto mb-4" />
          <p>No market depth data available</p>
          <p className="text-sm mt-2">Market depth data is being loaded...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`market-depth-chart ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Market Depth Analysis
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Visual representation of market liquidity and order book depth
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center space-x-2 px-3 py-2 rounded-md border transition-colors text-sm ${
              showSettings 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
          
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && renderSettings()}

      {/* Metrics */}
      {renderMetrics()}

      {/* Depth Chart */}
      {renderDepthChart()}

      {/* Depth Analysis */}
      {renderDepthAnalysis()}

      {/* Info Panel */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center">
          <Info className="w-4 h-4 mr-2" />
          Market Depth Analysis
        </h4>
        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <p>• <strong>Market Depth:</strong> Visualization of order quantities at different price levels</p>
          <p>• <strong>Liquidity Score:</strong> Overall market liquidity rating based on depth and spread</p>
          <p>• <strong>Order Imbalance:</strong> Indicates buying vs selling pressure in the order book</p>
          <p>• <strong>Depth Analysis:</strong> Shows how much liquidity is available at various distances from mid price</p>
        </div>
      </div>
    </div>
  );
};

export default MarketDepthChart;