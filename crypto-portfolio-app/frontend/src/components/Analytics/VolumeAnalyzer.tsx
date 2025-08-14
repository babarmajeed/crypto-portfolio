import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Activity,
  Target,
  Clock,
  DollarSign,
  Layers,
  BookOpen,
  Settings,
  RefreshCw,
  Download,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useVolumeAnalysis } from '../../hooks/useVolumeAnalysis';
import { useResponsive } from '../../hooks/useResponsive';
import VolumeProfile from './VolumeProfile';
import OrderBookVisualization from './OrderBookVisualization';
import MarketDepthChart from './MarketDepthChart';
import VolumeIndicators from './VolumeIndicators';
import TimeAndSales from './TimeAndSales';
import VolumeDataExport from './VolumeDataExport';

interface VolumeAnalyzerProps {
  symbol?: string;
  timeframe?: string;
  className?: string;
}

const VolumeAnalyzer: React.FC<VolumeAnalyzerProps> = ({
  symbol = 'BTC/USD',
  timeframe = '1h',
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'indicators' | 'orderbook' | 'depth' | 'trades' | 'settings'>('overview');
  const [selectedSymbol, setSelectedSymbol] = useState(symbol);
  const [selectedTimeframe, setSelectedTimeframe] = useState(timeframe);
  
  const { isMobile } = useResponsive();

  const {
    volumeData,
    volumeProfile,
    vwapData,
    volumeIndicators,
    volumeTrends,
    orderBook,
    marketDepth,
    timeAndSales,
    liquidityMetrics,
    pointOfControl,
    orderBookSpread,
    volumeStrength,
    isLoading,
    error,
    lastUpdated,
    refresh,
    updateSymbol,
    updateTimeframe,
    refreshOrderBook,
    refreshMarketDepth,
    refreshTimeAndSales
  } = useVolumeAnalysis({
    symbol: selectedSymbol,
    timeframe: selectedTimeframe,
    autoRefresh: true,
    refreshInterval: 30000
  });

  // Available symbols
  const symbols = [
    { value: 'BTC/USD', label: 'Bitcoin (BTC/USD)' },
    { value: 'ETH/USD', label: 'Ethereum (ETH/USD)' },
    { value: 'ADA/USD', label: 'Cardano (ADA/USD)' },
    { value: 'DOT/USD', label: 'Polkadot (DOT/USD)' },
    { value: 'LINK/USD', label: 'Chainlink (LINK/USD)' }
  ];

  // Available timeframes
  const timeframes = [
    { value: '1m', label: '1 Minute' },
    { value: '5m', label: '5 Minutes' },
    { value: '15m', label: '15 Minutes' },
    { value: '1h', label: '1 Hour' },
    { value: '4h', label: '4 Hours' },
    { value: '1d', label: '1 Day' }
  ];

  // Tab definitions
  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'profile', label: 'Volume Profile', icon: Layers },
    { id: 'indicators', label: 'Indicators', icon: TrendingUp },
    { id: 'orderbook', label: 'Order Book', icon: BookOpen },
    { id: 'depth', label: 'Market Depth', icon: Target },
    { id: 'trades', label: 'Time & Sales', icon: Clock },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  // Handle symbol change
  const handleSymbolChange = (newSymbol: string) => {
    setSelectedSymbol(newSymbol);
    updateSymbol(newSymbol);
  };

  // Handle timeframe change
  const handleTimeframeChange = (newTimeframe: string) => {
    setSelectedTimeframe(newTimeframe);
    updateTimeframe(newTimeframe);
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

  // Format percentage
  const formatPercentage = (value: number, decimals: number = 2): string => {
    return `${(value * 100).toFixed(decimals)}%`;
  };

  // Format number with appropriate precision
  const formatNumber = (value: number, decimals: number = 2): string => {
    return value.toLocaleString('en-US', { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  // Get volume strength color
  const getVolumeStrengthColor = (strength: string): string => {
    switch (strength) {
      case 'bullish': return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      case 'bearish': return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      case 'neutral': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700';
    }
  };

  // Render metric card
  const renderMetricCard = (
    title: string,
    value: string | React.ReactNode,
    subtitle: string,
    icon: React.ReactNode,
    colorClass?: string
  ) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div className="text-gray-500 dark:text-gray-400">
            {icon}
          </div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</h3>
        </div>
      </div>
      <div className={`text-xl font-bold mb-1 ${colorClass || 'text-gray-900 dark:text-white'}`}>
        {value}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {subtitle}
      </div>
    </div>
  );

  // Render overview tab
  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {renderMetricCard(
          'Total Volume',
          volumeData.length > 0 ? formatNumber(volumeData.reduce((sum, d) => sum + d.volume, 0)) : 'Loading...',
          `Last ${volumeData.length} periods`,
          <BarChart3 className="w-4 h-4" />
        )}

        {renderMetricCard(
          'Current VWAP',
          vwapData ? formatCurrency(vwapData.current) : 'Loading...',
          vwapData ? `Deviation: ${formatPercentage(vwapData.deviation / 100)}` : 'Calculating...',
          <TrendingUp className="w-4 h-4" />
        )}

        {renderMetricCard(
          'Volume Trend',
          volumeTrends ? volumeTrends.trend.toUpperCase() : 'Loading...',
          volumeTrends ? `${volumeTrends.strength} strength` : 'Analyzing...',
          <Activity className="w-4 h-4" />,
          volumeTrends ? 
            volumeTrends.trend === 'increasing' ? 'text-green-600' : 
            volumeTrends.trend === 'decreasing' ? 'text-red-600' : 'text-yellow-600'
            : undefined
        )}

        {renderMetricCard(
          'Order Book Spread',
          orderBookSpread ? `${formatPercentage(orderBookSpread.percentage / 100)}` : 'Loading...',
          orderBookSpread ? formatCurrency(orderBookSpread.absolute) : 'Updating...',
          <Target className="w-4 h-4" />
        )}

        {renderMetricCard(
          'Liquidity Score',
          liquidityMetrics ? formatNumber(liquidityMetrics.liquidityScore, 1) : 'Loading...',
          'Market liquidity rating',
          <DollarSign className="w-4 h-4" />,
          liquidityMetrics && liquidityMetrics.liquidityScore > 7 ? 'text-green-600' :
          liquidityMetrics && liquidityMetrics.liquidityScore > 4 ? 'text-yellow-600' : 'text-red-600'
        )}

        {renderMetricCard(
          'Point of Control',
          pointOfControl ? formatCurrency(pointOfControl.price) : 'Loading...',
          pointOfControl ? `Volume: ${formatNumber(pointOfControl.volume)}` : 'Calculating...',
          <Layers className="w-4 h-4" />
        )}

        {renderMetricCard(
          'Market Depth',
          marketDepth ? formatNumber(marketDepth.levels.length) : 'Loading...',
          marketDepth ? `Liquidity: ${formatNumber(marketDepth.liquidityScore, 1)}` : 'Updating...',
          <BookOpen className="w-4 h-4" />
        )}

        {renderMetricCard(
          'Recent Trades',
          timeAndSales.length.toString(),
          timeAndSales.length > 0 ? 'Last trade: ' + new Date(timeAndSales[0].timestamp).toLocaleTimeString() : 'No trades',
          <Clock className="w-4 h-4" />
        )}
      </div>

      {/* Volume Strength Indicator */}
      {volumeTrends && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Volume Analysis Summary</h3>
          <div className="flex items-center space-x-4 mb-4">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${getVolumeStrengthColor(volumeStrength)}`}>
              {volumeStrength.toUpperCase()} VOLUME
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Strength: {volumeTrends.strength} | Change: {formatPercentage(volumeTrends.volumeChange / 100)}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Recent Average</div>
              <div className="text-lg font-medium">{formatNumber(volumeTrends.recentAverage)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Historical Average</div>
              <div className="text-lg font-medium">{formatNumber(volumeTrends.historicalAverage)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Volume Change</div>
              <div className={`text-lg font-medium ${
                volumeTrends.volumeChange > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {volumeTrends.volumeChange > 0 ? '+' : ''}{formatPercentage(volumeTrends.volumeChange / 100)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VWAP Analysis */}
      {vwapData && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">VWAP Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(vwapData.current)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Current VWAP</div>
              <div className={`text-sm font-medium ${
                vwapData.deviation > 0 ? 'text-green-600' : 
                vwapData.deviation < 0 ? 'text-red-600' : 'text-gray-500'
              }`}>
                {formatPercentage(vwapData.deviation / 100)} deviation
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {vwapData.series.length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Data Points</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Last updated: {new Date().toLocaleTimeString()}
              </div>
            </div>
            
            <div className="text-center">
              <div className="h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <TrendingUp className="w-8 h-8 mx-auto mb-1" />
                  <p className="text-xs">VWAP Trend</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart Placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Volume Profile</h3>
          <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <Layers className="w-12 h-12 mx-auto mb-2" />
              <p>Volume Profile Chart</p>
              <p className="text-sm">{volumeProfile.length} price levels</p>
              <button
                onClick={() => setActiveTab('profile')}
                className="mt-2 text-blue-600 hover:text-blue-700 text-sm underline"
              >
                View Details
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Volume Indicators</h3>
          <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <TrendingUp className="w-12 h-12 mx-auto mb-2" />
              <p>Volume Indicators Chart</p>
              <p className="text-sm">OBV, A/D, CMF, VPT</p>
              <button
                onClick={() => setActiveTab('indicators')}
                className="mt-2 text-blue-600 hover:text-blue-700 text-sm underline"
              >
                View Details
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Render placeholder for other tabs
  const renderTabPlaceholder = (tabName: string, description: string, icon: React.ReactNode) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-8 border border-gray-200 dark:border-gray-700">
      <div className="text-center">
        <div className="text-gray-400 dark:text-gray-600 mb-4">
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{tabName}</h3>
        <p className="text-gray-600 dark:text-gray-400">{description}</p>
        <div className="mt-4 text-sm text-blue-600 dark:text-blue-400">
          Component implementation coming next
        </div>
      </div>
    </div>
  );

  // Loading state
  if (isLoading && !volumeData.length) {
    return (
      <div className={`volume-analyzer ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading volume analysis data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`volume-analyzer ${className}`}>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
            <div>
              <h3 className="font-medium text-red-800 dark:text-red-200">Error loading volume data</h3>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={refresh}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`volume-analyzer ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Volume Analysis & Market Depth
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Advanced volume analysis tools and market microstructure insights
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 mt-4 lg:mt-0">
            {/* Symbol Selector */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">Symbol:</span>
              <select
                value={selectedSymbol}
                onChange={(e) => handleSymbolChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {symbols.map(symbol => (
                  <option key={symbol.value} value={symbol.value}>
                    {symbol.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Timeframe Selector */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">Timeframe:</span>
              <select
                value={selectedTimeframe}
                onChange={(e) => handleTimeframeChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {timeframes.map(timeframe => (
                  <option key={timeframe.value} value={timeframe.value}>
                    {timeframe.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center space-x-3">
              <button
                onClick={refresh}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
              
              <VolumeDataExport
                volumeData={volumeData}
                volumeIndicators={volumeIndicators}
                volumeProfile={volumeProfile}
                vwapData={vwapData}
                orderBook={orderBook}
                marketDepth={marketDepth}
                timeAndSales={timeAndSales}
                liquidityMetrics={liquidityMetrics}
                symbol={selectedSymbol}
                timeframe={selectedTimeframe}
              />
            </div>
          </div>
        </div>
        
        {lastUpdated && (
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map(tab => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <IconComponent className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'profile' && (
          <VolumeProfile
            volumeProfile={volumeProfile}
            currentPrice={vwapData?.current || 0}
            symbol={selectedSymbol}
            timeframe={selectedTimeframe}
            onRefresh={refresh}
          />
        )}
        {activeTab === 'indicators' && (
          <VolumeIndicators
            volumeIndicators={volumeIndicators}
            symbol={selectedSymbol}
            timeframe={selectedTimeframe}
            onRefresh={refresh}
          />
        )}
        {activeTab === 'orderbook' && (
          <OrderBookVisualization
            orderBook={orderBook}
            symbol={selectedSymbol}
            onRefresh={refreshOrderBook}
          />
        )}
        {activeTab === 'depth' && (
          <MarketDepthChart
            marketDepth={marketDepth}
            symbol={selectedSymbol}
            currentPrice={vwapData?.current || 0}
            onRefresh={refreshMarketDepth}
          />
        )}
        {activeTab === 'trades' && (
          <TimeAndSales
            timeAndSales={timeAndSales}
            symbol={selectedSymbol}
            onRefresh={refreshTimeAndSales}
          />
        )}
        {activeTab === 'settings' && renderTabPlaceholder(
          'Volume Analysis Settings',
          'Configure volume analysis parameters, alerts, and display preferences',
          <Settings className="w-16 h-16 mx-auto" />
        )}
      </div>

      {/* Info Panel */}
      <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center">
          <Info className="w-4 h-4 mr-2" />
          Volume Analysis Tools
        </h4>
        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <p>• Volume Profile: Identifies key support/resistance levels based on volume</p>
          <p>• VWAP: Volume Weighted Average Price for institutional trading levels</p>
          <p>• Order Book: Real-time market depth and liquidity analysis</p>
          <p>• Volume Indicators: Technical analysis tools for volume-based signals</p>
          <p>• Market Microstructure: Spread analysis, market impact, and liquidity metrics</p>
        </div>
      </div>
    </div>
  );
};

export default VolumeAnalyzer;