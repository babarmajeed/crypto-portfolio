import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Target,
  Activity,
  TrendingUp,
  TrendingDown,
  Info,
  Settings,
  RefreshCw,
  Layers
} from 'lucide-react';
import { VolumeProfileLevel } from '../../services/VolumeAnalysisService';

interface VolumeProfileProps {
  volumeProfile: VolumeProfileLevel[];
  currentPrice?: number;
  symbol?: string;
  timeframe?: string;
  className?: string;
  onRefresh?: () => void;
}

interface VolumeProfileSettings {
  periods: number;
  showPOC: boolean;
  showValueArea: boolean;
  valueAreaPercentage: number;
  colorScheme: 'default' | 'heatmap' | 'gradient';
  displayMode: 'horizontal' | 'vertical';
}

const VolumeProfile: React.FC<VolumeProfileProps> = ({
  volumeProfile,
  currentPrice = 0,
  symbol = 'BTC/USD',
  timeframe = '1h',
  className = '',
  onRefresh
}) => {
  const [settings, setSettings] = useState<VolumeProfileSettings>({
    periods: 100,
    showPOC: true,
    showValueArea: true,
    valueAreaPercentage: 70,
    colorScheme: 'default',
    displayMode: 'horizontal'
  });
  const [showSettings, setShowSettings] = useState(false);

  // Calculate key volume profile metrics
  const profileMetrics = useMemo(() => {
    if (!volumeProfile.length) return null;

    // Sort by volume descending to find POC
    const sortedByVolume = [...volumeProfile].sort((a, b) => b.volume - a.volume);
    const pointOfControl = sortedByVolume[0];

    // Calculate total volume
    const totalVolume = volumeProfile.reduce((sum, level) => sum + level.volume, 0);

    // Calculate Value Area (default 70% of volume)
    const valueAreaTarget = totalVolume * (settings.valueAreaPercentage / 100);
    let valueAreaVolume = 0;
    let valueAreaLow = pointOfControl.price;
    let valueAreaHigh = pointOfControl.price;

    // Start from POC and expand outward to capture 70% of volume
    const pocIndex = volumeProfile.findIndex(level => level.price === pointOfControl.price);
    let lowIndex = pocIndex;
    let highIndex = pocIndex;

    valueAreaVolume = pointOfControl.volume;

    while (valueAreaVolume < valueAreaTarget && (lowIndex > 0 || highIndex < volumeProfile.length - 1)) {
      const lowVolume = lowIndex > 0 ? volumeProfile[lowIndex - 1].volume : 0;
      const highVolume = highIndex < volumeProfile.length - 1 ? volumeProfile[highIndex + 1].volume : 0;

      if (lowVolume >= highVolume && lowIndex > 0) {
        lowIndex--;
        valueAreaVolume += volumeProfile[lowIndex].volume;
        valueAreaLow = volumeProfile[lowIndex].price;
      } else if (highIndex < volumeProfile.length - 1) {
        highIndex++;
        valueAreaVolume += volumeProfile[highIndex].volume;
        valueAreaHigh = volumeProfile[highIndex].price;
      }
    }

    // Calculate support and resistance levels
    const supportLevels = volumeProfile
      .filter(level => level.price < currentPrice)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 3);

    const resistanceLevels = volumeProfile
      .filter(level => level.price > currentPrice)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 3);

    // Calculate volume distribution
    const priceRange = Math.max(...volumeProfile.map(l => l.price)) - Math.min(...volumeProfile.map(l => l.price));
    const averageVolume = totalVolume / volumeProfile.length;
    const volumeVariance = volumeProfile.reduce((sum, level) => 
      sum + Math.pow(level.volume - averageVolume, 2), 0) / volumeProfile.length;
    const volumeStdDev = Math.sqrt(volumeVariance);

    return {
      pointOfControl,
      valueAreaHigh,
      valueAreaLow,
      valueAreaVolume,
      totalVolume,
      supportLevels,
      resistanceLevels,
      priceRange,
      averageVolume,
      volumeStdDev,
      volumeConcentration: (pointOfControl.volume / totalVolume) * 100
    };
  }, [volumeProfile, currentPrice, settings.valueAreaPercentage]);

  // Get bar color based on volume intensity
  const getBarColor = (volume: number, maxVolume: number): string => {
    const intensity = volume / maxVolume;
    
    switch (settings.colorScheme) {
      case 'heatmap':
        if (intensity > 0.8) return 'bg-red-600';
        if (intensity > 0.6) return 'bg-orange-500';
        if (intensity > 0.4) return 'bg-yellow-500';
        if (intensity > 0.2) return 'bg-blue-500';
        return 'bg-gray-400';
      
      case 'gradient':
        if (intensity > 0.8) return 'bg-gradient-to-r from-blue-600 to-purple-600';
        if (intensity > 0.6) return 'bg-gradient-to-r from-blue-500 to-blue-600';
        if (intensity > 0.4) return 'bg-gradient-to-r from-blue-400 to-blue-500';
        if (intensity > 0.2) return 'bg-gradient-to-r from-blue-300 to-blue-400';
        return 'bg-gradient-to-r from-gray-300 to-gray-400';
      
      default:
        if (intensity > 0.8) return 'bg-blue-600';
        if (intensity > 0.6) return 'bg-blue-500';
        if (intensity > 0.4) return 'bg-blue-400';
        if (intensity > 0.2) return 'bg-blue-300';
        return 'bg-gray-300';
    }
  };

  // Format number for display
  const formatNumber = (value: number, decimals: number = 0): string => {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
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

  // Render settings panel
  const renderSettings = () => (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
      <h4 className="font-medium text-gray-900 dark:text-white mb-3">Volume Profile Settings</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Price Levels
          </label>
          <select
            value={settings.periods}
            onChange={(e) => setSettings(prev => ({ ...prev, periods: Number(e.target.value) }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
          >
            <option value={50}>50 Levels</option>
            <option value={100}>100 Levels</option>
            <option value={200}>200 Levels</option>
            <option value={500}>500 Levels</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Value Area %
          </label>
          <select
            value={settings.valueAreaPercentage}
            onChange={(e) => setSettings(prev => ({ ...prev, valueAreaPercentage: Number(e.target.value) }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
          >
            <option value={60}>60%</option>
            <option value={70}>70%</option>
            <option value={80}>80%</option>
            <option value={90}>90%</option>
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
            <option value="default">Default Blue</option>
            <option value="heatmap">Heat Map</option>
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
            <option value="horizontal">Horizontal Bars</option>
            <option value="vertical">Vertical Bars</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex items-center space-x-6">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.showPOC}
            onChange={(e) => setSettings(prev => ({ ...prev, showPOC: e.target.checked }))}
            className="mr-2"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Show Point of Control</span>
        </label>
        
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.showValueArea}
            onChange={(e) => setSettings(prev => ({ ...prev, showValueArea: e.target.checked }))}
            className="mr-2"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Show Value Area</span>
        </label>
      </div>
    </div>
  );

  // Render volume profile metrics
  const renderMetrics = () => {
    if (!profileMetrics) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-2">
            <Target className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Point of Control</h3>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(profileMetrics.pointOfControl.price)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Volume: {formatNumber(profileMetrics.pointOfControl.volume)}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-2">
            <Activity className="w-4 h-4 text-green-600" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Value Area</h3>
          </div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {formatCurrency(profileMetrics.valueAreaLow)} - {formatCurrency(profileMetrics.valueAreaHigh)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {settings.valueAreaPercentage}% of volume
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-2">
            <BarChart3 className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Volume</h3>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {formatNumber(profileMetrics.totalVolume)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Across {volumeProfile.length} levels
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-2">
            <Layers className="w-4 h-4 text-orange-600" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Concentration</h3>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {profileMetrics.volumeConcentration.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            At POC level
          </div>
        </div>
      </div>
    );
  };

  // Render support and resistance levels
  const renderLevels = () => {
    if (!profileMetrics) return null;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <TrendingDown className="w-5 h-5 mr-2 text-green-600" />
            Support Levels
          </h3>
          <div className="space-y-3">
            {profileMetrics.supportLevels.map((level, index) => (
              <div key={index} className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-green-600">
                    {formatCurrency(level.price)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Volume: {formatNumber(level.volume)}
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  #{index + 1}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-red-600" />
            Resistance Levels
          </h3>
          <div className="space-y-3">
            {profileMetrics.resistanceLevels.map((level, index) => (
              <div key={index} className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-red-600">
                    {formatCurrency(level.price)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Volume: {formatNumber(level.volume)}
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  #{index + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Render volume profile chart
  const renderChart = () => {
    if (!volumeProfile.length) {
      return (
        <div className="h-96 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <BarChart3 className="w-12 h-12 mx-auto mb-2" />
            <p>No volume profile data available</p>
          </div>
        </div>
      );
    }

    const maxVolume = Math.max(...volumeProfile.map(level => level.volume));
    const sortedLevels = [...volumeProfile].sort((a, b) => b.price - a.price);

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Volume Profile Chart
          </h3>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {symbol} • {timeframe}
          </div>
        </div>

        <div className="relative">
          {/* Price levels and volume bars */}
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {sortedLevels.map((level, index) => {
              const barWidth = (level.volume / maxVolume) * 100;
              const isPOC = profileMetrics?.pointOfControl.price === level.price;
              const isInValueArea = profileMetrics && 
                level.price >= profileMetrics.valueAreaLow && 
                level.price <= profileMetrics.valueAreaHigh;
              const isCurrentPrice = Math.abs(level.price - currentPrice) < level.priceRange;

              return (
                <div key={index} className="flex items-center space-x-2 text-xs">
                  {/* Price label */}
                  <div className={`w-20 text-right font-mono ${
                    isCurrentPrice ? 'text-blue-600 font-bold' : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {formatCurrency(level.price)}
                  </div>

                  {/* Volume bar */}
                  <div className="flex-1 relative h-4 bg-gray-100 dark:bg-gray-700 rounded">
                    <div
                      className={`h-full rounded transition-all duration-200 ${getBarColor(level.volume, maxVolume)} ${
                        isPOC && settings.showPOC ? 'ring-2 ring-yellow-400' : ''
                      } ${
                        isInValueArea && settings.showValueArea ? 'opacity-80' : 'opacity-60'
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                    
                    {/* POC indicator */}
                    {isPOC && settings.showPOC && (
                      <div className="absolute right-1 top-0 h-full flex items-center">
                        <Target className="w-3 h-3 text-yellow-600" />
                      </div>
                    )}
                  </div>

                  {/* Volume value */}
                  <div className="w-16 text-left text-gray-500 dark:text-gray-400">
                    {formatNumber(level.volume)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Current price line */}
          {currentPrice > 0 && (
            <div className="absolute left-0 right-0 flex items-center mt-2">
              <div className="w-20 text-right font-mono text-blue-600 font-bold text-sm">
                Current:
              </div>
              <div className="flex-1 ml-2 border-t-2 border-blue-600 border-dashed"></div>
              <div className="w-16 text-left text-blue-600 font-bold text-sm">
                {formatCurrency(currentPrice)}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!volumeProfile.length) {
    return (
      <div className={`volume-profile ${className}`}>
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <BarChart3 className="w-12 h-12 mx-auto mb-4" />
          <p>No volume profile data available</p>
          <p className="text-sm mt-2">Volume profile data is being calculated...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`volume-profile ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Volume Profile Analysis
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Price level volume distribution with Point of Control and Value Area analysis
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

      {/* Support/Resistance Levels */}
      {renderLevels()}

      {/* Volume Profile Chart */}
      {renderChart()}

      {/* Info Panel */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center">
          <Info className="w-4 h-4 mr-2" />
          Volume Profile Analysis
        </h4>
        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <p>• <strong>Point of Control (POC):</strong> Price level with highest traded volume</p>
          <p>• <strong>Value Area:</strong> Price range containing {settings.valueAreaPercentage}% of total volume</p>
          <p>• <strong>Support/Resistance:</strong> High-volume levels indicating potential price reversals</p>
          <p>• <strong>Volume Concentration:</strong> Measure of how concentrated trading is at specific levels</p>
        </div>
      </div>
    </div>
  );
};

export default VolumeProfile;