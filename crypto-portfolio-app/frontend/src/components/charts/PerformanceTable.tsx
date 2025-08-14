import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  BarChart3,
  Activity,
  Target,
  DollarSign,
  Percent,
  Clock
} from 'lucide-react';

interface CandlestickData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface PerformanceMetrics {
  asset: string;
  currentPrice: number;
  change1h: number;
  change24h: number;
  change7d: number;
  change30d: number;
  volume24h: number;
  marketCap?: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  correlation?: number;
  beta?: number;
  rank: number;
}

interface PerformanceTableProps {
  assets: string[];
  multiAssetData: Record<string, CandlestickData[]>;
  correlationMatrix?: Record<string, Record<string, number>>;
  benchmarkAsset?: string;
  sortBy?: keyof PerformanceMetrics;
  sortOrder?: 'asc' | 'desc';
  onSort?: (column: keyof PerformanceMetrics, order: 'asc' | 'desc') => void;
  onAssetClick?: (asset: string) => void;
  className?: string;
}

type SortableColumn = keyof PerformanceMetrics;

const PerformanceTable: React.FC<PerformanceTableProps> = ({
  assets,
  multiAssetData,
  correlationMatrix,
  benchmarkAsset,
  sortBy = 'change24h',
  sortOrder = 'desc',
  onSort,
  onAssetClick,
  className = ''
}) => {
  const [localSortBy, setLocalSortBy] = useState<SortableColumn>(sortBy);
  const [localSortOrder, setLocalSortOrder] = useState<'asc' | 'desc'>(sortOrder);

  // Calculate performance metrics for each asset
  const performanceData = useMemo((): PerformanceMetrics[] => {
    const metrics = assets.map(asset => {
      const data = multiAssetData[asset] || [];
      
      if (data.length === 0) {
        return {
          asset,
          currentPrice: 0,
          change1h: 0,
          change24h: 0,
          change7d: 0,
          change30d: 0,
          volume24h: 0,
          volatility: 0,
          sharpeRatio: 0,
          maxDrawdown: 0,
          rank: 0
        };
      }

      const currentPrice = data[data.length - 1].close;
      
      // Calculate returns for different periods
      const change1h = calculatePeriodReturn(data, 1); // 1 hour
      const change24h = calculatePeriodReturn(data, 24); // 24 hours  
      const change7d = calculatePeriodReturn(data, 24 * 7); // 7 days
      const change30d = calculatePeriodReturn(data, 24 * 30); // 30 days

      // Calculate volume (use latest or average)
      const volume24h = data[data.length - 1]?.volume || 
        data.slice(-24).reduce((sum, candle) => sum + (candle.volume || 0), 0);

      // Calculate volatility (annualized)
      const returns = calculateReturns(data);
      const volatility = calculateVolatility(returns) * Math.sqrt(252 * 24); // Assuming hourly data

      // Calculate Sharpe ratio
      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const sharpeRatio = volatility > 0 ? (avgReturn * 252 * 24 - 0.02) / volatility : 0;

      // Calculate maximum drawdown
      const maxDrawdown = calculateMaxDrawdown(data);

      // Calculate correlation with benchmark if available
      let correlation: number | undefined;
      if (benchmarkAsset && correlationMatrix && asset !== benchmarkAsset) {
        correlation = correlationMatrix[asset]?.[benchmarkAsset];
      }

      // Calculate beta if benchmark data is available
      let beta: number | undefined;
      if (benchmarkAsset && multiAssetData[benchmarkAsset] && asset !== benchmarkAsset) {
        beta = calculateBeta(data, multiAssetData[benchmarkAsset]);
      }

      return {
        asset,
        currentPrice,
        change1h,
        change24h,
        change7d,
        change30d,
        volume24h,
        volatility,
        sharpeRatio,
        maxDrawdown,
        correlation,
        beta,
        rank: 0 // Will be calculated after sorting
      };
    });

    // Sort metrics
    const sortedMetrics = [...metrics].sort((a, b) => {
      const aValue = a[localSortBy];
      const bValue = b[localSortBy];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return localSortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      const aNum = Number(aValue) || 0;
      const bNum = Number(bValue) || 0;
      
      return localSortOrder === 'asc' ? aNum - bNum : bNum - aNum;
    });

    // Add rankings
    return sortedMetrics.map((metric, index) => ({
      ...metric,
      rank: index + 1
    }));
  }, [assets, multiAssetData, correlationMatrix, benchmarkAsset, localSortBy, localSortOrder]);

  // Helper functions
  const calculatePeriodReturn = (data: CandlestickData[], hours: number): number => {
    if (data.length < 2) return 0;
    
    const endPrice = data[data.length - 1].close;
    const targetTime = data[data.length - 1].time - (hours * 3600);
    
    // Find closest data point to target time
    let startPrice = data[0].close;
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].time <= targetTime) {
        startPrice = data[i].close;
        break;
      }
    }
    
    return ((endPrice - startPrice) / startPrice);
  };

  const calculateReturns = (data: CandlestickData[]): number[] => {
    const returns: number[] = [];
    for (let i = 1; i < data.length; i++) {
      const prevPrice = data[i - 1].close;
      const currentPrice = data[i].close;
      returns.push((currentPrice - prevPrice) / prevPrice);
    }
    return returns;
  };

  const calculateVolatility = (returns: number[]): number => {
    if (returns.length < 2) return 0;
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    
    return Math.sqrt(variance);
  };

  const calculateMaxDrawdown = (data: CandlestickData[]): number => {
    let maxDrawdown = 0;
    let peak = data[0]?.close || 0;

    for (const candle of data) {
      if (candle.close > peak) {
        peak = candle.close;
      }
      const drawdown = (peak - candle.close) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  };

  const calculateBeta = (assetData: CandlestickData[], benchmarkData: CandlestickData[]): number => {
    const assetReturns = calculateReturns(assetData);
    const benchmarkReturns = calculateReturns(benchmarkData);
    
    if (assetReturns.length !== benchmarkReturns.length || assetReturns.length < 2) {
      return 0;
    }

    const assetMean = assetReturns.reduce((sum, r) => sum + r, 0) / assetReturns.length;
    const benchmarkMean = benchmarkReturns.reduce((sum, r) => sum + r, 0) / benchmarkReturns.length;

    let covariance = 0;
    let benchmarkVariance = 0;

    for (let i = 0; i < assetReturns.length; i++) {
      const assetDiff = assetReturns[i] - assetMean;
      const benchmarkDiff = benchmarkReturns[i] - benchmarkMean;
      
      covariance += assetDiff * benchmarkDiff;
      benchmarkVariance += benchmarkDiff * benchmarkDiff;
    }

    return benchmarkVariance > 0 ? covariance / benchmarkVariance : 0;
  };

  // Handle column sorting
  const handleSort = (column: SortableColumn) => {
    const newOrder = localSortBy === column && localSortOrder === 'desc' ? 'asc' : 'desc';
    setLocalSortBy(column);
    setLocalSortOrder(newOrder);
    onSort?.(column, newOrder);
  };

  // Format functions
  const formatPrice = (price: number): string => {
    if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    if (price >= 0.01) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(6)}`;
  };

  const formatPercentage = (value: number, showSign: boolean = true): string => {
    const formatted = `${(value * 100).toFixed(2)}%`;
    return showSign && value > 0 ? `+${formatted}` : formatted;
  };

  const formatVolume = (volume: number): string => {
    if (volume >= 1e9) return `$${(volume / 1e9).toFixed(2)}B`;
    if (volume >= 1e6) return `$${(volume / 1e6).toFixed(2)}M`;
    if (volume >= 1e3) return `$${(volume / 1e3).toFixed(2)}K`;
    return `$${volume.toFixed(0)}`;
  };

  const formatNumber = (value: number, decimals: number = 2): string => {
    return value.toFixed(decimals);
  };

  // Get color for percentage values
  const getPercentageColor = (value: number): string => {
    if (value > 0) return 'text-green-600 dark:text-green-400';
    if (value < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  // Get trend icon
  const getTrendIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="w-3 h-3" />;
    if (value < 0) return <TrendingDown className="w-3 h-3" />;
    return <div className="w-3 h-3" />;
  };

  // Render sort header
  const renderSortHeader = (column: SortableColumn, label: string, icon?: React.ReactNode) => {
    const isActive = localSortBy === column;
    
    return (
      <th 
        onClick={() => handleSort(column)}
        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center space-x-1">
          {icon}
          <span>{label}</span>
          <div className="flex flex-col">
            {isActive ? (
              localSortOrder === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
            ) : (
              <ArrowUpDown className="w-3 h-3 opacity-50" />
            )}
          </div>
        </div>
      </th>
    );
  };

  return (
    <div className={`performance-table ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Performance Rankings
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Comprehensive performance metrics for selected assets
        </p>
      </div>

      <div className="overflow-x-auto bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {renderSortHeader('rank', '#')}
              {renderSortHeader('asset', 'Asset', <DollarSign className="w-3 h-3" />)}
              {renderSortHeader('currentPrice', 'Price', <DollarSign className="w-3 h-3" />)}
              {renderSortHeader('change1h', '1H', <Clock className="w-3 h-3" />)}
              {renderSortHeader('change24h', '24H', <Percent className="w-3 h-3" />)}
              {renderSortHeader('change7d', '7D', <Percent className="w-3 h-3" />)}
              {renderSortHeader('change30d', '30D', <Percent className="w-3 h-3" />)}
              {renderSortHeader('volume24h', 'Volume', <BarChart3 className="w-3 h-3" />)}
              {renderSortHeader('volatility', 'Volatility', <Activity className="w-3 h-3" />)}
              {renderSortHeader('sharpeRatio', 'Sharpe', <Target className="w-3 h-3" />)}
              {renderSortHeader('maxDrawdown', 'Max DD', <TrendingDown className="w-3 h-3" />)}
              {benchmarkAsset && renderSortHeader('correlation', 'Correlation', <Activity className="w-3 h-3" />)}
              {benchmarkAsset && renderSortHeader('beta', 'Beta', <Target className="w-3 h-3" />)}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {performanceData.map((metric, index) => (
              <tr 
                key={metric.asset}
                onClick={() => onAssetClick?.(metric.asset)}
                className={`hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                  onAssetClick ? 'cursor-pointer' : ''
                }`}
              >
                {/* Rank */}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  <div className="flex items-center">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                      metric.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                      metric.rank === 2 ? 'bg-gray-100 text-gray-800' :
                      metric.rank === 3 ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-50 text-gray-600'
                    }`}>
                      {metric.rank}
                    </span>
                  </div>
                </td>

                {/* Asset */}
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                  {metric.asset}
                </td>

                {/* Current Price */}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {formatPrice(metric.currentPrice)}
                </td>

                {/* 1H Change */}
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  <div className={`flex items-center space-x-1 ${getPercentageColor(metric.change1h)}`}>
                    {getTrendIcon(metric.change1h)}
                    <span>{formatPercentage(metric.change1h)}</span>
                  </div>
                </td>

                {/* 24H Change */}
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  <div className={`flex items-center space-x-1 ${getPercentageColor(metric.change24h)}`}>
                    {getTrendIcon(metric.change24h)}
                    <span className="font-medium">{formatPercentage(metric.change24h)}</span>
                  </div>
                </td>

                {/* 7D Change */}
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  <div className={`flex items-center space-x-1 ${getPercentageColor(metric.change7d)}`}>
                    {getTrendIcon(metric.change7d)}
                    <span>{formatPercentage(metric.change7d)}</span>
                  </div>
                </td>

                {/* 30D Change */}
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  <div className={`flex items-center space-x-1 ${getPercentageColor(metric.change30d)}`}>
                    {getTrendIcon(metric.change30d)}
                    <span>{formatPercentage(metric.change30d)}</span>
                  </div>
                </td>

                {/* Volume */}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {formatVolume(metric.volume24h)}
                </td>

                {/* Volatility */}
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  <span className={`${
                    metric.volatility > 0.6 ? 'text-red-600' :
                    metric.volatility > 0.3 ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {formatPercentage(metric.volatility, false)}
                  </span>
                </td>

                {/* Sharpe Ratio */}
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  <span className={`${
                    metric.sharpeRatio > 1 ? 'text-green-600' :
                    metric.sharpeRatio > 0.5 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {formatNumber(metric.sharpeRatio)}
                  </span>
                </td>

                {/* Max Drawdown */}
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  <span className={`${
                    metric.maxDrawdown > 0.3 ? 'text-red-600' :
                    metric.maxDrawdown > 0.15 ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {formatPercentage(metric.maxDrawdown, false)}
                  </span>
                </td>

                {/* Correlation (if benchmark available) */}
                {benchmarkAsset && (
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                    {metric.correlation !== undefined ? formatNumber(metric.correlation, 3) : 'N/A'}
                  </td>
                )}

                {/* Beta (if benchmark available) */}
                {benchmarkAsset && (
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                    {metric.beta !== undefined ? formatNumber(metric.beta, 2) : 'N/A'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Statistics */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="text-gray-600 dark:text-gray-400">Best Performer (24h)</div>
          <div className="font-semibold text-green-600">
            {performanceData.find(m => m.change24h === Math.max(...performanceData.map(p => p.change24h)))?.asset} 
            {' '}
            {formatPercentage(Math.max(...performanceData.map(p => p.change24h)))}
          </div>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="text-gray-600 dark:text-gray-400">Worst Performer (24h)</div>
          <div className="font-semibold text-red-600">
            {performanceData.find(m => m.change24h === Math.min(...performanceData.map(p => p.change24h)))?.asset}
            {' '}
            {formatPercentage(Math.min(...performanceData.map(p => p.change24h)))}
          </div>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="text-gray-600 dark:text-gray-400">Highest Sharpe</div>
          <div className="font-semibold text-green-600">
            {performanceData.find(m => m.sharpeRatio === Math.max(...performanceData.map(p => p.sharpeRatio)))?.asset}
            {' '}
            {formatNumber(Math.max(...performanceData.map(p => p.sharpeRatio)))}
          </div>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="text-gray-600 dark:text-gray-400">Lowest Volatility</div>
          <div className="font-semibold text-blue-600">
            {performanceData.find(m => m.volatility === Math.min(...performanceData.map(p => p.volatility)))?.asset}
            {' '}
            {formatPercentage(Math.min(...performanceData.map(p => p.volatility)), false)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceTable;