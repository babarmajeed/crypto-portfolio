import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  DollarSign,
  Percent,
  RefreshCw,
  Settings,
  Info,
  AlertTriangle
} from 'lucide-react';
import { OrderBook, OrderBookLevel } from '../../services/VolumeAnalysisService';

interface OrderBookVisualizationProps {
  orderBook: OrderBook | null;
  symbol?: string;
  className?: string;
  onRefresh?: () => void;
}

interface OrderBookSettings {
  showDepth: number;
  showSpread: boolean;
  showImbalance: boolean;
  colorScheme: 'default' | 'intensity' | 'gradient';
  displayMode: 'combined' | 'separate';
  aggregationLevel: number;
}

const OrderBookVisualization: React.FC<OrderBookVisualizationProps> = ({
  orderBook,
  symbol = 'BTC/USD',
  className = '',
  onRefresh
}) => {
  const [settings, setSettings] = useState<OrderBookSettings>({
    showDepth: 20,
    showSpread: true,
    showImbalance: true,
    colorScheme: 'default',
    displayMode: 'combined',
    aggregationLevel: 1
  });
  const [showSettings, setShowSettings] = useState(false);

  // Calculate order book metrics
  const orderBookMetrics = useMemo(() => {
    if (!orderBook) return null;

    const topBids = orderBook.bids.slice(0, settings.showDepth);
    const topAsks = orderBook.asks.slice(0, settings.showDepth);

    // Calculate total quantities
    const totalBidQuantity = topBids.reduce((sum, bid) => sum + bid.quantity, 0);
    const totalAskQuantity = topAsks.reduce((sum, ask) => sum + ask.quantity, 0);

    // Calculate weighted average prices
    const bidVWAP = topBids.reduce((sum, bid) => sum + (bid.price * bid.quantity), 0) / totalBidQuantity;
    const askVWAP = topAsks.reduce((sum, ask) => sum + (ask.price * ask.quantity), 0) / totalAskQuantity;

    // Calculate imbalance
    const imbalance = (totalBidQuantity - totalAskQuantity) / (totalBidQuantity + totalAskQuantity);

    // Calculate spread metrics
    const spreadAbsolute = orderBook.spread;
    const spreadPercentage = (spreadAbsolute / orderBook.mid) * 100;

    // Calculate depth at various percentages from mid
    const midPrice = orderBook.mid;
    const depthLevels = [0.1, 0.25, 0.5, 1.0, 2.0]; // Percentage levels
    
    const depthAnalysis = depthLevels.map(pct => {
      const range = midPrice * (pct / 100);
      const bidDepth = topBids
        .filter(bid => bid.price >= midPrice - range)
        .reduce((sum, bid) => sum + bid.quantity * bid.price, 0);
      const askDepth = topAsks
        .filter(ask => ask.price <= midPrice + range)
        .reduce((sum, ask) => sum + ask.quantity * ask.price, 0);
      
      return {
        percentage: pct,
        bidDepth,
        askDepth,
        totalDepth: bidDepth + askDepth,
        imbalance: (bidDepth - askDepth) / (bidDepth + askDepth)
      };
    });

    // Find largest bid and ask quantities
    const maxBidQuantity = Math.max(...topBids.map(bid => bid.quantity));
    const maxAskQuantity = Math.max(...topAsks.map(ask => ask.quantity));
    const maxQuantity = Math.max(maxBidQuantity, maxAskQuantity);

    return {
      totalBidQuantity,
      totalAskQuantity,
      bidVWAP,
      askVWAP,
      imbalance,
      spreadAbsolute,
      spreadPercentage,
      depthAnalysis,
      maxQuantity,
      maxBidQuantity,
      maxAskQuantity
    };
  }, [orderBook, settings.showDepth]);

  // Aggregate order book levels if needed
  const processedOrderBook = useMemo(() => {
    if (!orderBook || settings.aggregationLevel <= 1) return orderBook;

    const aggregateLevel = settings.aggregationLevel;
    const midPrice = orderBook.mid;

    // Aggregate bids
    const aggregatedBids: OrderBookLevel[] = [];
    const bidGroups: { [key: string]: OrderBookLevel[] } = {};

    orderBook.bids.forEach(bid => {
      const priceLevel = Math.floor((midPrice - bid.price) / aggregateLevel) * aggregateLevel;
      const key = (midPrice - priceLevel).toString();
      
      if (!bidGroups[key]) bidGroups[key] = [];
      bidGroups[key].push(bid);
    });

    Object.entries(bidGroups).forEach(([, group]) => {
      const totalQuantity = group.reduce((sum, bid) => sum + bid.quantity, 0);
      const weightedPrice = group.reduce((sum, bid) => sum + (bid.price * bid.quantity), 0) / totalQuantity;
      const totalValue = group.reduce((sum, bid) => sum + bid.total, 0);
      
      aggregatedBids.push({
        price: weightedPrice,
        quantity: totalQuantity,
        total: totalValue
      });
    });

    // Aggregate asks
    const aggregatedAsks: OrderBookLevel[] = [];
    const askGroups: { [key: string]: OrderBookLevel[] } = {};

    orderBook.asks.forEach(ask => {
      const priceLevel = Math.floor((ask.price - midPrice) / aggregateLevel) * aggregateLevel;
      const key = (midPrice + priceLevel).toString();
      
      if (!askGroups[key]) askGroups[key] = [];
      askGroups[key].push(ask);
    });

    Object.entries(askGroups).forEach(([, group]) => {
      const totalQuantity = group.reduce((sum, ask) => sum + ask.quantity, 0);
      const weightedPrice = group.reduce((sum, ask) => sum + (ask.price * ask.quantity), 0) / totalQuantity;
      const totalValue = group.reduce((sum, ask) => sum + ask.total, 0);
      
      aggregatedAsks.push({
        price: weightedPrice,
        quantity: totalQuantity,
        total: totalValue
      });
    });

    return {
      ...orderBook,
      bids: aggregatedBids.sort((a, b) => b.price - a.price),
      asks: aggregatedAsks.sort((a, b) => a.price - b.price)
    };
  }, [orderBook, settings.aggregationLevel]);

  // Get bar color based on side and intensity
  const getBarColor = (side: 'bid' | 'ask', quantity: number, maxQuantity: number): string => {
    const intensity = quantity / maxQuantity;
    
    if (side === 'bid') {
      switch (settings.colorScheme) {
        case 'intensity':
          if (intensity > 0.8) return 'bg-green-600';
          if (intensity > 0.6) return 'bg-green-500';
          if (intensity > 0.4) return 'bg-green-400';
          return 'bg-green-300';
        case 'gradient':
          return 'bg-gradient-to-r from-green-400 to-green-600';
        default:
          return 'bg-green-500';
      }
    } else {
      switch (settings.colorScheme) {
        case 'intensity':
          if (intensity > 0.8) return 'bg-red-600';
          if (intensity > 0.6) return 'bg-red-500';
          if (intensity > 0.4) return 'bg-red-400';
          return 'bg-red-300';
        case 'gradient':
          return 'bg-gradient-to-r from-red-400 to-red-600';
        default:
          return 'bg-red-500';
      }
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
      <h4 className="font-medium text-gray-900 dark:text-white mb-3">Order Book Settings</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Depth Levels
          </label>
          <select
            value={settings.showDepth}
            onChange={(e) => setSettings(prev => ({ ...prev, showDepth: Number(e.target.value) }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
          >
            <option value={10}>Top 10</option>
            <option value={20}>Top 20</option>
            <option value={50}>Top 50</option>
            <option value={100}>Top 100</option>
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
            <option value="intensity">Intensity</option>
            <option value="gradient">Gradient</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Display Mode
          </label>
          <select
            value={settings.displayMode}
            onChange={(e) => setSettings(prev => ({ ...prev, displayMode: e.target.value as any }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
          >
            <option value="combined">Combined</option>
            <option value="separate">Separate</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex items-center space-x-6">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.showSpread}
            onChange={(e) => setSettings(prev => ({ ...prev, showSpread: e.target.checked }))}
            className="mr-2"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Show Spread</span>
        </label>
        
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.showImbalance}
            onChange={(e) => setSettings(prev => ({ ...prev, showImbalance: e.target.checked }))}
            className="mr-2"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Show Imbalance</span>
        </label>
      </div>
    </div>
  );

  // Render metrics
  const renderMetrics = () => {
    if (!orderBookMetrics) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-2">
            <DollarSign className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Spread</h3>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(orderBookMetrics.spreadAbsolute)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {formatPercentage(orderBookMetrics.spreadPercentage / 100)}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-2">
            <Activity className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Imbalance</h3>
          </div>
          <div className={`text-xl font-bold ${
            orderBookMetrics.imbalance > 0 ? 'text-green-600' : 
            orderBookMetrics.imbalance < 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'
          }`}>
            {formatPercentage(orderBookMetrics.imbalance)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {orderBookMetrics.imbalance > 0 ? 'Bid heavy' : orderBookMetrics.imbalance < 0 ? 'Ask heavy' : 'Balanced'}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Bid Depth</h3>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {formatNumber(orderBookMetrics.totalBidQuantity)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            VWAP: {formatCurrency(orderBookMetrics.bidVWAP)}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-600" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Ask Depth</h3>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {formatNumber(orderBookMetrics.totalAskQuantity)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            VWAP: {formatCurrency(orderBookMetrics.askVWAP)}
          </div>
        </div>
      </div>
    );
  };

  // Render order book table
  const renderOrderBook = () => {
    if (!processedOrderBook || !orderBookMetrics) return null;

    const topBids = processedOrderBook.bids.slice(0, settings.showDepth);
    const topAsks = processedOrderBook.asks.slice(0, settings.showDepth);

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Order Book - {symbol}
          </h3>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Last updated: {new Date(processedOrderBook.timestamp).toLocaleTimeString()}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Asks (Sell Orders) */}
          <div>
            <h4 className="text-md font-medium text-red-600 mb-3 flex items-center">
              <TrendingDown className="w-4 h-4 mr-2" />
              Asks (Sell Orders)
            </h4>
            <div className="space-y-1">
              <div className="grid grid-cols-4 text-xs font-medium text-gray-500 dark:text-gray-400 pb-2">
                <div>Price</div>
                <div className="text-right">Size</div>
                <div className="text-right">Total</div>
                <div className="text-right">Volume</div>
              </div>
              {topAsks.reverse().map((ask, index) => {
                const barWidth = (ask.quantity / orderBookMetrics.maxQuantity) * 100;
                return (
                  <div key={index} className="relative">
                    <div
                      className={`absolute inset-0 ${getBarColor('ask', ask.quantity, orderBookMetrics.maxQuantity)} opacity-20`}
                      style={{ width: `${barWidth}%` }}
                    />
                    <div className="relative grid grid-cols-4 text-sm py-1 px-2">
                      <div className="font-mono text-red-600">
                        {formatCurrency(ask.price)}
                      </div>
                      <div className="text-right font-mono">
                        {formatNumber(ask.quantity)}
                      </div>
                      <div className="text-right font-mono">
                        {formatNumber(ask.total)}
                      </div>
                      <div className="text-right font-mono text-xs text-gray-500">
                        {formatCurrency(ask.price * ask.quantity)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bids (Buy Orders) */}
          <div>
            <h4 className="text-md font-medium text-green-600 mb-3 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" />
              Bids (Buy Orders)
            </h4>
            <div className="space-y-1">
              <div className="grid grid-cols-4 text-xs font-medium text-gray-500 dark:text-gray-400 pb-2">
                <div>Price</div>
                <div className="text-right">Size</div>
                <div className="text-right">Total</div>
                <div className="text-right">Volume</div>
              </div>
              {topBids.map((bid, index) => {
                const barWidth = (bid.quantity / orderBookMetrics.maxQuantity) * 100;
                return (
                  <div key={index} className="relative">
                    <div
                      className={`absolute inset-0 ${getBarColor('bid', bid.quantity, orderBookMetrics.maxQuantity)} opacity-20`}
                      style={{ width: `${barWidth}%` }}
                    />
                    <div className="relative grid grid-cols-4 text-sm py-1 px-2">
                      <div className="font-mono text-green-600">
                        {formatCurrency(bid.price)}
                      </div>
                      <div className="text-right font-mono">
                        {formatNumber(bid.quantity)}
                      </div>
                      <div className="text-right font-mono">
                        {formatNumber(bid.total)}
                      </div>
                      <div className="text-right font-mono text-xs text-gray-500">
                        {formatCurrency(bid.price * bid.quantity)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Spread Indicator */}
        {settings.showSpread && (
          <div className="mt-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Bid-Ask Spread
                </span>
              </div>
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                {formatCurrency(orderBookMetrics.spreadAbsolute)} ({formatPercentage(orderBookMetrics.spreadPercentage / 100)})
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render depth analysis
  const renderDepthAnalysis = () => {
    if (!orderBookMetrics) return null;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Market Depth Analysis
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Distance</th>
                <th className="text-right py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Bid Depth</th>
                <th className="text-right py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Ask Depth</th>
                <th className="text-right py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Total</th>
                <th className="text-right py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Imbalance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {orderBookMetrics.depthAnalysis.map((depth, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="py-3 text-sm text-gray-900 dark:text-white">
                    ±{depth.percentage}%
                  </td>
                  <td className="py-3 text-sm text-right text-green-600">
                    {formatCurrency(depth.bidDepth)}
                  </td>
                  <td className="py-3 text-sm text-right text-red-600">
                    {formatCurrency(depth.askDepth)}
                  </td>
                  <td className="py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                    {formatCurrency(depth.totalDepth)}
                  </td>
                  <td className={`py-3 text-sm text-right font-medium ${
                    depth.imbalance > 0 ? 'text-green-600' : 
                    depth.imbalance < 0 ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {formatPercentage(depth.imbalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (!orderBook) {
    return (
      <div className={`order-book-visualization ${className}`}>
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <BookOpen className="w-12 h-12 mx-auto mb-4" />
          <p>No order book data available</p>
          <p className="text-sm mt-2">Order book data is being loaded...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`order-book-visualization ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Order Book Visualization
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Real-time market depth and liquidity analysis
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

      {/* Order Book Table */}
      {renderOrderBook()}

      {/* Depth Analysis */}
      {renderDepthAnalysis()}

      {/* Info Panel */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center">
          <Info className="w-4 h-4 mr-2" />
          Order Book Analysis
        </h4>
        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <p>• <strong>Bid-Ask Spread:</strong> Difference between highest bid and lowest ask prices</p>
          <p>• <strong>Market Depth:</strong> Total quantity of orders at various price levels</p>
          <p>• <strong>Order Imbalance:</strong> Ratio of bid vs ask quantities indicating market sentiment</p>
          <p>• <strong>VWAP:</strong> Volume-weighted average price for bid and ask sides</p>
        </div>
      </div>
    </div>
  );
};

export default OrderBookVisualization;