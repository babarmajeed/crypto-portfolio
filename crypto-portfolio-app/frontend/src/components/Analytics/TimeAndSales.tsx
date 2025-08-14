import React, { useState, useMemo, useEffect } from 'react';
import {
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Filter,
  Download,
  RefreshCw,
  Settings,
  Info,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';
import { TimeAndSalesEntry } from '../../services/VolumeAnalysisService';

interface TimeAndSalesProps {
  timeAndSales: TimeAndSalesEntry[];
  symbol?: string;
  className?: string;
  onRefresh?: () => void;
}

interface TimeAndSalesSettings {
  maxEntries: number;
  showSide: 'all' | 'buy' | 'sell';
  minQuantity: number;
  minPrice: number;
  maxPrice: number;
  autoRefresh: boolean;
  groupByPrice: boolean;
  showVolumeWeighted: boolean;
}

interface TradeMetrics {
  totalTrades: number;
  buyTrades: number;
  sellTrades: number;
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  avgTradeSize: number;
  avgPrice: number;
  vwap: number;
  priceRange: { min: number; max: number };
  volumeImbalance: number;
  tradeImbalance: number;
}

const TimeAndSales: React.FC<TimeAndSalesProps> = ({
  timeAndSales,
  symbol = 'BTC/USD',
  className = '',
  onRefresh
}) => {
  const [settings, setSettings] = useState<TimeAndSalesSettings>({
    maxEntries: 100,
    showSide: 'all',
    minQuantity: 0,
    minPrice: 0,
    maxPrice: 999999,
    autoRefresh: true,
    groupByPrice: false,
    showVolumeWeighted: true
  });
  const [showSettings, setShowSettings] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1m' | '5m' | '15m' | '1h'>('5m');

  // Filter and process trades
  const processedTrades = useMemo(() => {
    if (!timeAndSales.length) return [];

    let filtered = timeAndSales.filter(trade => {
      if (settings.showSide !== 'all' && trade.side !== settings.showSide) return false;
      if (trade.quantity < settings.minQuantity) return false;
      if (trade.price < settings.minPrice || trade.price > settings.maxPrice) return false;
      return true;
    });

    // Sort by timestamp descending (newest first)
    filtered = filtered.sort((a, b) => b.timestamp - a.timestamp);

    // Limit entries
    filtered = filtered.slice(0, settings.maxEntries);

    // Group by price if enabled
    if (settings.groupByPrice) {
      const grouped: { [key: string]: TimeAndSalesEntry[] } = {};
      
      filtered.forEach(trade => {
        const priceKey = trade.price.toFixed(2);
        if (!grouped[priceKey]) grouped[priceKey] = [];
        grouped[priceKey].push(trade);
      });

      // Convert back to array with aggregated data
      filtered = Object.entries(grouped).map(([price, trades]) => {
        const totalQuantity = trades.reduce((sum, t) => sum + t.quantity, 0);
        const avgTimestamp = trades.reduce((sum, t) => sum + t.timestamp, 0) / trades.length;
        const buys = trades.filter(t => t.side === 'buy');
        const sells = trades.filter(t => t.side === 'sell');
        const dominantSide = buys.length > sells.length ? 'buy' : 'sell';
        
        return {
          id: `grouped-${price}`,
          timestamp: avgTimestamp,
          price: parseFloat(price),
          quantity: totalQuantity,
          side: dominantSide,
          tradeCount: trades.length
        } as TimeAndSalesEntry & { tradeCount: number };
      }).sort((a, b) => b.timestamp - a.timestamp);
    }

    return filtered;
  }, [timeAndSales, settings]);

  // Calculate trade metrics
  const tradeMetrics = useMemo((): TradeMetrics => {
    if (!timeAndSales.length) {
      return {
        totalTrades: 0,
        buyTrades: 0,
        sellTrades: 0,
        totalVolume: 0,
        buyVolume: 0,
        sellVolume: 0,
        avgTradeSize: 0,
        avgPrice: 0,
        vwap: 0,
        priceRange: { min: 0, max: 0 },
        volumeImbalance: 0,
        tradeImbalance: 0
      };
    }

    // Filter by time range
    const now = Date.now();
    const timeRangeMs = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000
    }[selectedTimeRange];

    const recentTrades = timeAndSales.filter(
      trade => trade.timestamp >= now - timeRangeMs
    );

    const buyTrades = recentTrades.filter(t => t.side === 'buy');
    const sellTrades = recentTrades.filter(t => t.side === 'sell');

    const totalVolume = recentTrades.reduce((sum, t) => sum + t.quantity, 0);
    const buyVolume = buyTrades.reduce((sum, t) => sum + t.quantity, 0);
    const sellVolume = sellTrades.reduce((sum, t) => sum + t.quantity, 0);

    const totalValue = recentTrades.reduce((sum, t) => sum + (t.price * t.quantity), 0);
    const vwap = totalVolume > 0 ? totalValue / totalVolume : 0;

    const prices = recentTrades.map(t => t.price);
    const priceRange = {
      min: Math.min(...prices),
      max: Math.max(...prices)
    };

    const volumeImbalance = totalVolume > 0 ? (buyVolume - sellVolume) / totalVolume : 0;
    const tradeImbalance = recentTrades.length > 0 ? 
      (buyTrades.length - sellTrades.length) / recentTrades.length : 0;

    return {
      totalTrades: recentTrades.length,
      buyTrades: buyTrades.length,
      sellTrades: sellTrades.length,
      totalVolume,
      buyVolume,
      sellVolume,
      avgTradeSize: totalVolume > 0 ? totalVolume / recentTrades.length : 0,
      avgPrice: recentTrades.length > 0 ? 
        recentTrades.reduce((sum, t) => sum + t.price, 0) / recentTrades.length : 0,
      vwap,
      priceRange,
      volumeImbalance,
      tradeImbalance
    };
  }, [timeAndSales, selectedTimeRange]);

  // Auto-refresh effect
  useEffect(() => {
    if (!settings.autoRefresh || !onRefresh) return;

    const interval = setInterval(() => {
      onRefresh();
    }, 2000); // Refresh every 2 seconds

    return () => clearInterval(interval);
  }, [settings.autoRefresh, onRefresh]);

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
    return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
  };

  // Format timestamp
  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // Get side color and icon
  const getSideDisplay = (side: 'buy' | 'sell') => {
    if (side === 'buy') {
      return {
        color: 'text-green-600',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        icon: <ArrowUp className="w-3 h-3" />
      };
    } else {
      return {
        color: 'text-red-600',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        icon: <ArrowDown className="w-3 h-3" />
      };
    }
  };

  // Render settings panel
  const renderSettings = () => (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
      <h4 className="font-medium text-gray-900 dark:text-white mb-3">Time & Sales Settings</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Max Entries
          </label>
          <select
            value={settings.maxEntries}
            onChange={(e) => setSettings(prev => ({ ...prev, maxEntries: Number(e.target.value) }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
          >
            <option value={50}>50 Entries</option>
            <option value={100}>100 Entries</option>
            <option value={200}>200 Entries</option>
            <option value={500}>500 Entries</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Show Side
          </label>
          <select
            value={settings.showSide}
            onChange={(e) => setSettings(prev => ({ ...prev, showSide: e.target.value as any }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
          >
            <option value="all">All Trades</option>
            <option value="buy">Buy Orders Only</option>
            <option value="sell">Sell Orders Only</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Min Quantity
          </label>
          <input
            type="number"
            value={settings.minQuantity}
            onChange={(e) => setSettings(prev => ({ ...prev, minQuantity: Number(e.target.value) }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
            min="0"
            step="0.001"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center space-x-6">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.autoRefresh}
            onChange={(e) => setSettings(prev => ({ ...prev, autoRefresh: e.target.checked }))}
            className="mr-2"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Auto Refresh</span>
        </label>
        
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.groupByPrice}
            onChange={(e) => setSettings(prev => ({ ...prev, groupByPrice: e.target.checked }))}
            className="mr-2"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Group by Price</span>
        </label>

        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.showVolumeWeighted}
            onChange={(e) => setSettings(prev => ({ ...prev, showVolumeWeighted: e.target.checked }))}
            className="mr-2"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Volume Weighted</span>
        </label>
      </div>
    </div>
  );

  // Render metrics
  const renderMetrics = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2 mb-2">
          <Activity className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Trades</h3>
        </div>
        <div className="text-xl font-bold text-gray-900 dark:text-white">
          {tradeMetrics.totalTrades}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Last {selectedTimeRange}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2 mb-2">
          <DollarSign className="w-4 h-4 text-green-600" />
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">VWAP</h3>
        </div>
        <div className="text-xl font-bold text-gray-900 dark:text-white">
          {formatCurrency(tradeMetrics.vwap)}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Volume weighted
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2 mb-2">
          <TrendingUp className="w-4 h-4 text-purple-600" />
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Volume Imbalance</h3>
        </div>
        <div className={`text-xl font-bold ${
          tradeMetrics.volumeImbalance > 0 ? 'text-green-600' : 
          tradeMetrics.volumeImbalance < 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'
        }`}>
          {formatPercentage(tradeMetrics.volumeImbalance)}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Buy vs sell volume
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2 mb-2">
          <Clock className="w-4 h-4 text-orange-600" />
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Avg Trade Size</h3>
        </div>
        <div className="text-xl font-bold text-gray-900 dark:text-white">
          {formatNumber(tradeMetrics.avgTradeSize)}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {formatCurrency(tradeMetrics.avgTradeSize * tradeMetrics.avgPrice)}
        </div>
      </div>
    </div>
  );

  // Render trade imbalance chart
  const renderImbalanceChart = () => (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Trade Flow Analysis
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {tradeMetrics.buyTrades}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Buy Trades</div>
          <div className="text-lg font-medium text-green-600">
            {formatNumber(tradeMetrics.buyVolume)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Volume</div>
        </div>

        <div className="text-center">
          <div className={`text-3xl font-bold ${
            tradeMetrics.volumeImbalance > 0 ? 'text-green-600' : 
            tradeMetrics.volumeImbalance < 0 ? 'text-red-600' : 'text-gray-500'
          }`}>
            {tradeMetrics.volumeImbalance > 0 ? 'BULLISH' : 
             tradeMetrics.volumeImbalance < 0 ? 'BEARISH' : 'NEUTRAL'}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Market Sentiment</div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
            <div
              className={`h-2 rounded-full ${
                tradeMetrics.volumeImbalance > 0 ? 'bg-green-500' : 'bg-red-500'
              }`}
              style={{ 
                width: `${Math.abs(tradeMetrics.volumeImbalance) * 100}%`,
                marginLeft: tradeMetrics.volumeImbalance < 0 ? 
                  `${100 - Math.abs(tradeMetrics.volumeImbalance) * 100}%` : '0'
              }}
            />
          </div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">
            {tradeMetrics.sellTrades}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Sell Trades</div>
          <div className="text-lg font-medium text-red-600">
            {formatNumber(tradeMetrics.sellVolume)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Volume</div>
        </div>
      </div>
    </div>
  );

  // Render trades table
  const renderTradesTable = () => (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Recent Trades - {symbol}
        </h3>
        <div className="flex items-center space-x-2">
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value as any)}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
          >
            <option value="1m">1 Minute</option>
            <option value="5m">5 Minutes</option>
            <option value="15m">15 Minutes</option>
            <option value="1h">1 Hour</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto max-h-96">
        <table className="min-w-full">
          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Side
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Price
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Total
              </th>
              {settings.groupByPrice && (
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Trades
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {processedTrades.map((trade, index) => {
              const sideDisplay = getSideDisplay(trade.side);
              const total = trade.price * trade.quantity;
              
              return (
                <tr key={trade.id || index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white font-mono">
                    {formatTime(trade.timestamp)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${sideDisplay.color} ${sideDisplay.bgColor}`}>
                      {sideDisplay.icon}
                      <span>{trade.side.toUpperCase()}</span>
                    </div>
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-mono ${sideDisplay.color}`}>
                    {formatCurrency(trade.price)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-mono text-gray-900 dark:text-white">
                    {formatNumber(trade.quantity)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-mono text-gray-500 dark:text-gray-400">
                    {formatCurrency(total)}
                  </td>
                  {settings.groupByPrice && (
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-400">
                      {(trade as any).tradeCount || 1}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {processedTrades.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Clock className="w-8 h-8 mx-auto mb-2" />
          <p>No trades found matching current filters</p>
        </div>
      )}
    </div>
  );

  if (!timeAndSales.length) {
    return (
      <div className={`time-and-sales ${className}`}>
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Clock className="w-12 h-12 mx-auto mb-4" />
          <p>No time and sales data available</p>
          <p className="text-sm mt-2">Trade data is being loaded...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`time-and-sales ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Time & Sales Analysis
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Real-time trade execution data with volume flow analysis
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

      {/* Trade Imbalance */}
      {renderImbalanceChart()}

      {/* Trades Table */}
      {renderTradesTable()}

      {/* Info Panel */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center">
          <Info className="w-4 h-4 mr-2" />
          Time & Sales Analysis
        </h4>
        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <p>• <strong>VWAP:</strong> Volume-weighted average price for the selected time period</p>
          <p>• <strong>Volume Imbalance:</strong> Ratio of buy vs sell volume indicating market pressure</p>
          <p>• <strong>Trade Flow:</strong> Real-time visualization of trade execution and market activity</p>
          <p>• <strong>Market Sentiment:</strong> Overall buying/selling pressure based on trade data</p>
        </div>
      </div>
    </div>
  );
};

export default TimeAndSales;