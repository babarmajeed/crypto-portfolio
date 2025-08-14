import React from 'react';
import {
  Settings,
  Palette,
  Resize,
  Download,
  RefreshCw,
  Filter,
  Grid,
  Map,
  BarChart3,
  TrendingUp,
  DollarSign,
  Volume2
} from 'lucide-react';
import { CategoryData } from '../../services/HeatMapDataService';

interface HeatMapControlsProps {
  colorMetric: string;
  sizeMetric: string;
  viewMode: 'treemap' | 'grid';
  categories: CategoryData[];
  selectedCategory: string;
  colorScheme?: string;
  showLabels?: boolean;
  autoRefresh?: boolean;
  onMetricChange: (metric: string, type: 'color' | 'size') => void;
  onViewModeChange: (mode: 'treemap' | 'grid') => void;
  onCategoryChange: (category: string) => void;
  onColorSchemeChange?: (scheme: string) => void;
  onToggleLabels?: (show: boolean) => void;
  onToggleAutoRefresh?: (enabled: boolean) => void;
  onExport: (format: 'png' | 'svg' | 'pdf') => void;
  onRefresh: () => void;
  className?: string;
}

const HeatMapControls: React.FC<HeatMapControlsProps> = ({
  colorMetric,
  sizeMetric,
  viewMode,
  categories,
  selectedCategory,
  colorScheme = 'redGreen',
  showLabels = true,
  autoRefresh = false,
  onMetricChange,
  onViewModeChange,
  onCategoryChange,
  onColorSchemeChange,
  onToggleLabels,
  onToggleAutoRefresh,
  onExport,
  onRefresh,
  className = ''
}) => {
  // Metric options
  const colorMetrics = [
    { value: 'priceChangePercentage24h', label: '24h Change %', icon: TrendingUp },
    { value: 'priceChangePercentage7d', label: '7d Change %', icon: TrendingUp },
    { value: 'marketCapChangePercentage24h', label: 'Market Cap Change %', icon: BarChart3 }
  ];

  const sizeMetrics = [
    { value: 'marketCap', label: 'Market Cap', icon: DollarSign },
    { value: 'totalVolume', label: '24h Volume', icon: Volume2 },
    { value: 'fullyDilutedValuation', label: 'Fully Diluted Value', icon: BarChart3 }
  ];

  const colorSchemes = [
    { value: 'redGreen', label: 'Red-Green', description: 'Traditional performance colors' },
    { value: 'blueOrange', label: 'Blue-Orange', description: 'Diverging blue to orange' },
    { value: 'purpleGreen', label: 'Purple-Green', description: 'Purple to green scale' },
    { value: 'viridis', label: 'Viridis', description: 'Perceptually uniform' },
    { value: 'plasma', label: 'Plasma', description: 'High contrast scale' },
    { value: 'monochrome', label: 'Monochrome', description: 'Grayscale intensity' }
  ];

  return (
    <div className={`heatmap-controls ${className}`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-6">
          {/* View Mode */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">View:</span>
            <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
              <button
                onClick={() => onViewModeChange('treemap')}
                className={`flex items-center space-x-1 px-3 py-1 rounded-md text-sm transition-colors ${
                  viewMode === 'treemap'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Map className="w-4 h-4" />
                <span>Treemap</span>
              </button>
              <button
                onClick={() => onViewModeChange('grid')}
                className={`flex items-center space-x-1 px-3 py-1 rounded-md text-sm transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Grid className="w-4 h-4" />
                <span>Grid</span>
              </button>
            </div>
          </div>

          {/* Color Metric */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Color by:</span>
            <select
              value={colorMetric}
              onChange={(e) => onMetricChange(e.target.value, 'color')}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {colorMetrics.map(metric => (
                <option key={metric.value} value={metric.value}>
                  {metric.label}
                </option>
              ))}
            </select>
          </div>

          {/* Size Metric */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Size by:</span>
            <select
              value={sizeMetric}
              onChange={(e) => onMetricChange(e.target.value, 'size')}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {sizeMetrics.map(metric => (
                <option key={metric.value} value={metric.value}>
                  {metric.label}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Color Scheme */}
          {onColorSchemeChange && (
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Colors:</span>
              <select
                value={colorScheme}
                onChange={(e) => onColorSchemeChange(e.target.value)}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {colorSchemes.map(scheme => (
                  <option key={scheme.value} value={scheme.value} title={scheme.description}>
                    {scheme.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Secondary Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          {/* Toggle Controls */}
          <div className="flex items-center space-x-4">
            {onToggleLabels && (
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={(e) => onToggleLabels(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700 dark:text-gray-300">Show Labels</span>
              </label>
            )}

            {onToggleAutoRefresh && (
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => onToggleAutoRefresh(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700 dark:text-gray-300">Auto Refresh</span>
              </label>
            )}
          </div>

          {/* Action Controls */}
          <div className="flex items-center space-x-2">
            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              className="flex items-center space-x-1 px-3 py-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="text-sm">Refresh</span>
            </button>

            {/* Export Dropdown */}
            <div className="relative group">
              <button className="flex items-center space-x-1 px-3 py-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                <Download className="w-4 h-4" />
                <span className="text-sm">Export</span>
              </button>
              
              <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                <div className="py-1">
                  <button
                    onClick={() => onExport('png')}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    PNG Image
                  </button>
                  <button
                    onClick={() => onExport('svg')}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    SVG Vector
                  </button>
                  <button
                    onClick={() => onExport('pdf')}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    PDF Document
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeatMapControls;