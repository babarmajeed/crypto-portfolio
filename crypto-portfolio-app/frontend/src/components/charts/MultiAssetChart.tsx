import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createChart, ColorType, CrosshairMode, IChartApi, ISeriesApi } from 'lightweight-charts';
import { useResponsive } from '../../hooks/useResponsive';
import { useMultiAssetData } from '../../hooks/useMultiAssetData';
import { useCorrelationAnalysis } from '../../hooks/useCorrelationAnalysis';
import AssetSelector from './AssetSelector';
import CorrelationHeatmap from './CorrelationHeatmap';
import StatisticalAnalysis from './StatisticalAnalysis';

interface MultiAssetChartProps {
  initialAssets?: string[];
  timeframe?: string;
  comparisonMode?: 'overlay' | 'sideBySide' | 'percentage' | 'normalized';
  height?: number;
  maxAssets?: number;
  showCorrelationHeatmap?: boolean;
  showStatistics?: boolean;
  enableRealTime?: boolean;
  className?: string;
}

interface ChartSeries {
  series: ISeriesApi<any>;
  asset: string;
  color: string;
  visible: boolean;
}

const MultiAssetChart: React.FC<MultiAssetChartProps> = ({
  initialAssets = ['BTC', 'ETH'],
  timeframe = '1h',
  comparisonMode = 'overlay',
  height = 500,
  maxAssets = 8,
  showCorrelationHeatmap = true,
  showStatistics = false,
  enableRealTime = true,
  className = ''
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<Map<string, ChartSeries>>(new Map());
  
  const [selectedAssets, setSelectedAssets] = useState<string[]>(initialAssets);
  const [chartMode, setChartMode] = useState<'overlay' | 'sideBySide' | 'percentage' | 'normalized'>(comparisonMode);
  const [baseAsset, setBaseAsset] = useState<string>(initialAssets[0]);
  const [showHeatmap, setShowHeatmap] = useState(showCorrelationHeatmap);
  const [showStats, setShowStats] = useState(showStatistics);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  
  const { isMobile } = useResponsive();

  // Asset colors for consistency
  const assetColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#FFB6C1', '#87CEEB', '#DDA0DD', '#F0E68C'
  ];

  // Multi-asset data hook
  const {
    multiAssetData,
    normalizedData,
    percentageData,
    isLoading,
    error,
    isRealTimeEnabled,
    lastUpdate,
    refreshData,
    toggleRealTime,
    addAsset,
    removeAsset
  } = useMultiAssetData({
    assets: selectedAssets,
    timeframe,
    enableRealTime,
    baseAsset: chartMode === 'normalized' ? baseAsset : undefined
  });

  // Correlation analysis hook
  const {
    correlationMatrix,
    pairCorrelations,
    topCorrelatedPairs,
    antiCorrelatedPairs,
    getCorrelation,
    isCalculating
  } = useCorrelationAnalysis({
    multiAssetData,
    minCorrelationThreshold: 0.5,
    maxAntiCorrelationThreshold: -0.3,
    enableRollingCorrelation: true
  });

  // Chart theme configuration
  const getChartOptions = useCallback(() => {
    const isDark = theme === 'dark';
    
    return {
      layout: {
        background: {
          type: ColorType.Solid,
          color: isDark ? '#1a1a1a' : '#ffffff',
        },
        textColor: isDark ? '#d1d5db' : '#374151',
        fontSize: isMobile ? 11 : 12,
      },
      grid: {
        vertLines: {
          color: isDark ? '#2d2d2d' : '#f3f4f6',
          style: 1,
        },
        horzLines: {
          color: isDark ? '#2d2d2d' : '#f3f4f6',
          style: 1,
        },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: isDark ? '#6b7280' : '#9ca3af',
          width: 1 as any,
          style: 3 as any,
        },
        horzLine: {
          color: isDark ? '#6b7280' : '#9ca3af',
          width: 1 as any,
          style: 3 as any,
        },
      },
      rightPriceScale: {
        borderColor: isDark ? '#374151' : '#e5e7eb',
        textColor: isDark ? '#d1d5db' : '#374151',
        visible: true,
      },
      leftPriceScale: {
        borderColor: isDark ? '#374151' : '#e5e7eb',
        textColor: isDark ? '#d1d5db' : '#374151',
        visible: chartMode === 'overlay' && selectedAssets.length > 1,
      },
      timeScale: {
        borderColor: isDark ? '#374151' : '#e5e7eb',
        textColor: isDark ? '#d1d5db' : '#374151',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: isMobile ? 5 : 12,
        barSpacing: isMobile ? 8 : 12,
      },
      handleScroll: {
        mouseWheel: !isMobile,
        pressedMouseMove: true,
        horzTouchDrag: isMobile,
        vertTouchDrag: isMobile,
      },
      handleScale: {
        axisPressedMouseMove: {
          time: true,
          price: true,
        },
        axisDoubleClickReset: {
          time: true,
          price: true,
        },
        mouseWheel: !isMobile,
        pinch: isMobile,
      },
    };
  }, [theme, isMobile, chartMode, selectedAssets.length]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      ...getChartOptions(),
    });

    chartRef.current = chart;

    // Handle resize
    const handleResize = () => {
      if (chart && chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [height, getChartOptions]);

  // Update chart data and series
  useEffect(() => {
    if (!chartRef.current) return;

    // Clear existing series
    seriesRefs.current.forEach(({ series }) => {
      chartRef.current!.removeSeries(series);
    });
    seriesRefs.current.clear();

    // Get appropriate data based on chart mode
    let dataToUse: Record<string, any[]>;
    switch (chartMode) {
      case 'percentage':
        dataToUse = percentageData;
        break;
      case 'normalized':
        dataToUse = normalizedData;
        break;
      default:
        dataToUse = multiAssetData;
    }

    if (!dataToUse || Object.keys(dataToUse).length === 0) return;

    // Add series for each selected asset
    selectedAssets.forEach((asset, index) => {
      const assetData = dataToUse[asset];
      if (!assetData || assetData.length === 0) return;

      const color = assetColors[index % assetColors.length];
      const isSecondaryAxis = chartMode === 'overlay' && index > 0 && index % 2 === 1;

      try {
        const series = (chartRef.current as any).addLineSeries({
          color: color,
          lineWidth: 2,
          title: asset,
          priceScaleId: isSecondaryAxis ? 'left' : 'right',
          lastValueVisible: true,
          priceLineVisible: false,
        });

        const formattedData = assetData.map(point => ({
          time: point.time as any,
          value: point.close,
        }));

        series.setData(formattedData);

        seriesRefs.current.set(asset, {
          series,
          asset,
          color,
          visible: true
        });
      } catch (error) {
        console.error(`Error adding series for ${asset}:`, error);
      }
    });

    // Configure price scales for overlay mode
    if (chartMode === 'overlay' && selectedAssets.length > 1) {
      chartRef.current.priceScale('left').applyOptions({
        visible: true,
        position: 'left',
      });
      chartRef.current.priceScale('right').applyOptions({
        visible: true,
        position: 'right',
      });
    }

    // Auto-scale to fit data
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [multiAssetData, normalizedData, percentageData, selectedAssets, chartMode]);

  // Handle asset selection
  const handleAssetAdd = useCallback(async (asset: string) => {
    if (!selectedAssets.includes(asset) && selectedAssets.length < maxAssets) {
      const newAssets = [...selectedAssets, asset];
      setSelectedAssets(newAssets);
      await addAsset(asset);
    }
  }, [selectedAssets, maxAssets, addAsset]);

  const handleAssetRemove = useCallback((asset: string) => {
    if (selectedAssets.length > 1) {
      const newAssets = selectedAssets.filter(a => a !== asset);
      setSelectedAssets(newAssets);
      removeAsset(asset);
      
      // Update base asset if it was removed
      if (asset === baseAsset && newAssets.length > 0) {
        setBaseAsset(newAssets[0]);
      }
    }
  }, [selectedAssets, removeAsset, baseAsset]);

  // Handle chart mode changes
  const handleModeChange = useCallback((mode: typeof chartMode) => {
    setChartMode(mode);
  }, []);

  // Handle base asset change for normalized mode
  const handleBaseAssetChange = useCallback((asset: string) => {
    if (selectedAssets.includes(asset)) {
      setBaseAsset(asset);
    }
  }, [selectedAssets]);

  // Toggle series visibility
  const toggleSeriesVisibility = useCallback((asset: string) => {
    const chartSeries = seriesRefs.current.get(asset);
    if (chartSeries) {
      const newVisibility = !chartSeries.visible;
      chartSeries.series.applyOptions({ visible: newVisibility });
      chartSeries.visible = newVisibility;
      seriesRefs.current.set(asset, chartSeries);
    }
  }, []);

  // Export chart data
  const exportChartData = useCallback((format: 'csv' | 'json') => {
    const dataToExport = chartMode === 'percentage' ? percentageData : 
                         chartMode === 'normalized' ? normalizedData : multiAssetData;
    
    if (format === 'csv') {
      // CSV export
      const headers = ['Time', ...selectedAssets.map(asset => `${asset}_Close`)];
      const rows: string[] = [headers.join(',')];
      
      // Find common timestamps
      const allTimes = new Set<number>();
      Object.values(dataToExport).forEach(data => {
        data.forEach(point => allTimes.add(point.time));
      });
      
      const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);
      
      sortedTimes.forEach(time => {
        const row = [new Date(time * 1000).toISOString()];
        selectedAssets.forEach(asset => {
          const dataPoint = dataToExport[asset]?.find(point => point.time === time);
          row.push(dataPoint ? dataPoint.close.toFixed(8) : '');
        });
        rows.push(row.join(','));
      });
      
      const csvContent = rows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `multi-asset-comparison-${timeframe}-${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      // JSON export
      const jsonData = {
        assets: selectedAssets,
        timeframe,
        mode: chartMode,
        baseAsset: chartMode === 'normalized' ? baseAsset : null,
        data: dataToExport,
        correlations: correlationMatrix,
        exportTime: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `multi-asset-data-${timeframe}-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    }
  }, [chartMode, percentageData, normalizedData, multiAssetData, selectedAssets, timeframe, correlationMatrix, baseAsset]);

  // Render chart legend
  const renderLegend = () => {
    return (
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {selectedAssets.map((asset, index) => {
          const chartSeries = seriesRefs.current.get(asset);
          const color = assetColors[index % assetColors.length];
          const correlation = selectedAssets.length > 1 && selectedAssets[0] !== asset 
            ? getCorrelation(selectedAssets[0], asset) 
            : null;
          
          return (
            <div key={asset} className="flex items-center space-x-2 bg-white dark:bg-gray-800 rounded-lg px-3 py-1 border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => toggleSeriesVisibility(asset)}
                className="flex items-center space-x-1"
                title={`Toggle ${asset} visibility`}
              >
                <div 
                  className="w-3 h-3 rounded-full border"
                  style={{ 
                    backgroundColor: chartSeries?.visible ? color : 'transparent',
                    borderColor: color 
                  }}
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {asset}
                </span>
              </button>
              
              {correlation !== null && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ρ: {correlation.toFixed(3)}
                </span>
              )}
              
              {selectedAssets.length > 1 && (
                <button
                  onClick={() => handleAssetRemove(asset)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title={`Remove ${asset}`}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Render mode selector
  const renderModeSelector = () => {
    const modes = [
      { key: 'overlay', label: 'Overlay', description: 'Multiple Y-axes' },
      { key: 'percentage', label: 'Percentage', description: 'Percentage change' },
      { key: 'normalized', label: 'Normalized', description: 'Normalized to 100' }
    ] as const;

    return (
      <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {modes.map(mode => (
          <button
            key={mode.key}
            onClick={() => handleModeChange(mode.key)}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-all duration-200 ${
              chartMode === mode.key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50'
            }`}
            title={mode.description}
          >
            {mode.label}
          </button>
        ))}
      </div>
    );
  };

  // Render correlation info panel
  const renderCorrelationInfo = () => {
    if (selectedAssets.length < 2) return null;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Correlation Analysis
        </h4>
        
        <div className="space-y-2">
          {topCorrelatedPairs.slice(0, 3).map((pair, index) => (
            <div key={`${pair.asset1}-${pair.asset2}`} className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">
                {pair.asset1} × {pair.asset2}
              </span>
              <span className={`font-medium ${
                pair.correlation > 0.7 ? 'text-green-600' : 
                pair.correlation > 0.3 ? 'text-yellow-600' : 'text-gray-600'
              }`}>
                {pair.correlation.toFixed(3)}
              </span>
            </div>
          ))}
          
          {antiCorrelatedPairs.length > 0 && (
            <>
              <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Anti-correlated:</div>
                {antiCorrelatedPairs.slice(0, 2).map((pair) => (
                  <div key={`${pair.asset1}-${pair.asset2}`} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">
                      {pair.asset1} × {pair.asset2}
                    </span>
                    <span className="font-medium text-red-600">
                      {pair.correlation.toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  if (isLoading && Object.keys(multiAssetData).length === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading multi-asset data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <p>Error loading multi-asset data</p>
            <p className="text-sm text-gray-500">{error}</p>
          </div>
          <button
            onClick={refreshData}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`multi-asset-chart-container ${isFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900' : ''} ${className}`}>
      {/* Chart Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 space-y-4 lg:space-y-0">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Multi-Asset Comparison
          </h3>
          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
            {timeframe}
          </span>
          {enableRealTime && (
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${isRealTimeEnabled ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {isRealTimeEnabled ? 'Live' : 'Paused'}
              </span>
            </div>
          )}
          {lastUpdate && (
            <span className="text-xs text-gray-400">
              Updated: {new Date(lastUpdate).toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2 flex-wrap">
          <AssetSelector
            selectedAssets={selectedAssets}
            onAssetAdd={handleAssetAdd}
            onAssetRemove={handleAssetRemove}
            maxAssets={maxAssets}
            className="flex-shrink-0"
          />

          {renderModeSelector()}

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                showHeatmap 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Heatmap
            </button>

            <button
              onClick={() => setShowStats(!showStats)}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                showStats 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Stats
            </button>

            <div className="relative">
              <select
                onChange={(e) => exportChartData(e.target.value as 'csv' | 'json')}
                value=""
                className="appearance-none bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm"
              >
                <option value="" disabled>Export</option>
                <option value="csv">Export CSV</option>
                <option value="json">Export JSON</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Content */}
      <div className={`grid ${showHeatmap ? 'lg:grid-cols-3' : 'grid-cols-1'} gap-4 p-4`}>
        {/* Main Chart */}
        <div className={`${showHeatmap ? 'lg:col-span-2' : 'col-span-1'}`}>
          {renderLegend()}
          
          <div
            ref={chartContainerRef}
            className="chart-container border border-gray-200 dark:border-gray-700 rounded-lg"
            style={{ height: `${height}px` }}
          />

          {chartMode === 'normalized' && selectedAssets.length > 1 && (
            <div className="mt-2">
              <label className="text-sm text-gray-600 dark:text-gray-400 mr-2">
                Base Asset:
              </label>
              <select
                value={baseAsset}
                onChange={(e) => handleBaseAssetChange(e.target.value)}
                className="text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1"
              >
                {selectedAssets.map(asset => (
                  <option key={asset} value={asset}>{asset}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Side Panel */}
        {showHeatmap && (
          <div className="space-y-4">
            {renderCorrelationInfo()}
            
            {selectedAssets.length >= 2 && (
              <CorrelationHeatmap
                correlationMatrix={correlationMatrix}
                assets={selectedAssets}
                width={300}
                height={300}
              />
            )}
          </div>
        )}
      </div>

      {/* Statistical Analysis Modal */}
      {showStats && (
        <StatisticalAnalysis
          assets={selectedAssets}
          multiAssetData={multiAssetData}
          correlationMatrix={correlationMatrix}
          pairCorrelations={pairCorrelations}
          onClose={() => setShowStats(false)}
        />
      )}
    </div>
  );
};

export default MultiAssetChart;