import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createChart, ColorType, CrosshairMode, IChartApi, ISeriesApi } from 'lightweight-charts';
import { useResponsive } from '../../hooks/useResponsive';

interface CandlestickData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface ComparisonChartProps {
  data: Record<string, CandlestickData[]>;
  mode: 'overlay' | 'sideBySide' | 'percentage' | 'normalized';
  baseAsset?: string;
  selectedAssets: string[];
  height?: number;
  theme?: 'light' | 'dark';
  onModeChange?: (mode: 'overlay' | 'sideBySide' | 'percentage' | 'normalized') => void;
  onAssetToggle?: (asset: string, visible: boolean) => void;
  className?: string;
}

interface ChartSeries {
  series: ISeriesApi<any>;
  asset: string;
  color: string;
  visible: boolean;
  panelIndex?: number;
}

const ComparisonChart: React.FC<ComparisonChartProps> = ({
  data,
  mode,
  baseAsset,
  selectedAssets,
  height = 400,
  theme = 'dark',
  onModeChange,
  onAssetToggle,
  className = ''
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartsRef = useRef<IChartApi[]>([]);
  const seriesRefs = useRef<Map<string, ChartSeries>>(new Map());
  
  const [hoveredAsset, setHoveredAsset] = useState<string | null>(null);
  const [crosshairData, setCrosshairData] = useState<Record<string, any>>({});
  
  const { isMobile } = useResponsive();

  // Asset colors
  const assetColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#FFB6C1', '#87CEEB', '#DDA0DD', '#F0E68C'
  ];

  // Chart theme configuration
  const getChartOptions = useCallback((isMain: boolean = true) => {
    const isDark = theme === 'dark';
    
    return {
      layout: {
        background: {
          type: ColorType.Solid,
          color: isDark ? '#1a1a1a' : '#ffffff',
        },
        textColor: isDark ? '#d1d5db' : '#374151',
        fontSize: isMobile ? 10 : 11,
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
        visible: mode === 'overlay' && isMain,
      },
      timeScale: {
        borderColor: isDark ? '#374151' : '#e5e7eb',
        textColor: isDark ? '#d1d5db' : '#374151',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: isMobile ? 3 : 8,
        barSpacing: isMobile ? 6 : 10,
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
  }, [theme, isMobile, mode]);

  // Transform data based on mode
  const getTransformedData = useCallback((assetData: CandlestickData[], asset: string) => {
    if (!assetData || assetData.length === 0) return [];

    switch (mode) {
      case 'percentage':
        const firstPrice = assetData[0].close;
        return assetData.map(candle => ({
          time: candle.time as any,
          value: ((candle.close - firstPrice) / firstPrice) * 100
        }));

      case 'normalized':
        if (baseAsset && data[baseAsset] && asset !== baseAsset) {
          // Normalize relative to base asset
          const baseData = data[baseAsset];
          const alignedData = alignDataByTime(baseData, assetData);
          
          if (alignedData.length === 0) return [];

          const firstBasePrice = alignedData[0].base.close;
          const firstAssetPrice = alignedData[0].asset.close;

          return alignedData.map(({ asset: assetCandle, base: baseCandle }) => ({
            time: assetCandle.time as any,
            value: ((assetCandle.close / firstAssetPrice) / (baseCandle.close / firstBasePrice)) * 100
          }));
        } else {
          // Normalize to starting value of 100
          const firstPrice = assetData[0].close;
          return assetData.map(candle => ({
            time: candle.time as any,
            value: (candle.close / firstPrice) * 100
          }));
        }

      default: // overlay and sideBySide
        return assetData.map(candle => ({
          time: candle.time as any,
          value: candle.close
        }));
    }
  }, [mode, baseAsset, data]);

  // Align data by timestamp
  const alignDataByTime = (baseData: CandlestickData[], assetData: CandlestickData[]) => {
    const baseTimeMap = new Map(baseData.map(item => [item.time, item]));
    const aligned: Array<{ base: CandlestickData; asset: CandlestickData }> = [];

    assetData.forEach(assetCandle => {
      const baseCandle = baseTimeMap.get(assetCandle.time);
      if (baseCandle) {
        aligned.push({ base: baseCandle, asset: assetCandle });
      }
    });

    return aligned.sort((a, b) => a.asset.time - b.asset.time);
  };

  // Initialize charts based on mode
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clear existing charts
    chartsRef.current.forEach(chart => chart.remove());
    chartsRef.current = [];
    seriesRefs.current.clear();

    const container = chartContainerRef.current;
    container.innerHTML = '';

    if (mode === 'sideBySide') {
      // Create multiple charts for side-by-side view
      const chartCount = selectedAssets.length;
      const chartHeight = Math.floor(height / Math.max(1, chartCount));

      selectedAssets.forEach((asset, index) => {
        const chartDiv = document.createElement('div');
        chartDiv.style.height = `${chartHeight}px`;
        chartDiv.style.marginBottom = index < chartCount - 1 ? '8px' : '0';
        container.appendChild(chartDiv);

        const chart = createChart(chartDiv, {
          width: container.clientWidth,
          height: chartHeight,
          ...getChartOptions(false),
        });

        chartsRef.current.push(chart);

        // Add series for this asset
        const assetData = data[asset];
        if (assetData && assetData.length > 0) {
          const color = assetColors[index % assetColors.length];
          const transformedData = getTransformedData(assetData, asset);

          const series = (chart as any).addLineSeries({
            color: color,
            lineWidth: 2,
            title: asset,
            lastValueVisible: true,
            priceLineVisible: false,
          });

          series.setData(transformedData);

          seriesRefs.current.set(asset, {
            series,
            asset,
            color,
            visible: true,
            panelIndex: index
          });

          // Add asset label to chart
          const titleDiv = document.createElement('div');
          titleDiv.innerHTML = `<span style="color: ${color}; font-weight: bold; font-size: 14px; padding: 8px;">${asset}</span>`;
          titleDiv.style.position = 'absolute';
          titleDiv.style.top = '8px';
          titleDiv.style.left = '8px';
          titleDiv.style.zIndex = '10';
          titleDiv.style.backgroundColor = theme === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)';
          titleDiv.style.borderRadius = '4px';
          chartDiv.style.position = 'relative';
          chartDiv.appendChild(titleDiv);
        }
      });
    } else {
      // Create single chart for overlay, percentage, and normalized modes
      const chart = createChart(container, {
        width: container.clientWidth,
        height: height,
        ...getChartOptions(true),
      });

      chartsRef.current.push(chart);

      // Add series for each asset
      selectedAssets.forEach((asset, index) => {
        const assetData = data[asset];
        if (!assetData || assetData.length === 0) return;

        const color = assetColors[index % assetColors.length];
        const isSecondaryAxis = mode === 'overlay' && index > 0 && index % 2 === 1;
        const transformedData = getTransformedData(assetData, asset);

        try {
          const series = (chart as any).addLineSeries({
            color: color,
            lineWidth: 2,
            title: asset,
            priceScaleId: isSecondaryAxis ? 'left' : 'right',
            lastValueVisible: true,
            priceLineVisible: false,
          });

          series.setData(transformedData);

          seriesRefs.current.set(asset, {
            series,
            asset,
            color,
            visible: true
          });

          // Add crosshair move handler for synchronized data display
          chart.subscribeCrosshairMove(param => {
            if (param.time) {
              const seriesData = param.seriesPrices.get(series);
              if (seriesData) {
                setCrosshairData(prev => ({
                  ...prev,
                  [asset]: {
                    time: param.time,
                    value: seriesData,
                    originalValue: assetData.find(d => d.time === param.time)?.close
                  }
                }));
              }
            }
          });
        } catch (error) {
          console.error(`Error adding series for ${asset}:`, error);
        }
      });

      // Configure price scales for overlay mode
      if (mode === 'overlay' && selectedAssets.length > 1) {
        chart.priceScale('left').applyOptions({
          visible: true,
          position: 'left',
        });
        chart.priceScale('right').applyOptions({
          visible: true,
          position: 'right',
        });
      }

      // Auto-scale to fit data
      chart.timeScale().fitContent();
    }

    // Handle resize
    const handleResize = () => {
      chartsRef.current.forEach(chart => {
        if (chartContainerRef.current) {
          chart.applyOptions({
            width: chartContainerRef.current.clientWidth,
          });
        }
      });
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      chartsRef.current.forEach(chart => chart.remove());
    };
  }, [data, selectedAssets, mode, baseAsset, height, getChartOptions, getTransformedData, theme]);

  // Toggle series visibility
  const toggleSeriesVisibility = useCallback((asset: string) => {
    const chartSeries = seriesRefs.current.get(asset);
    if (chartSeries) {
      const newVisibility = !chartSeries.visible;
      chartSeries.series.applyOptions({ visible: newVisibility });
      chartSeries.visible = newVisibility;
      seriesRefs.current.set(asset, chartSeries);
      onAssetToggle?.(asset, newVisibility);
    }
  }, [onAssetToggle]);

  // Synchronize chart interactions for side-by-side mode
  useEffect(() => {
    if (mode !== 'sideBySide' || chartsRef.current.length <= 1) return;

    const charts = chartsRef.current;
    let isUpdating = false;

    // Sync time scale across charts
    const syncTimeScale = (sourceChart: IChartApi) => {
      if (isUpdating) return;
      isUpdating = true;

      const visibleLogicalRange = sourceChart.timeScale().getVisibleLogicalRange();
      
      charts.forEach(chart => {
        if (chart !== sourceChart) {
          chart.timeScale().setVisibleLogicalRange(visibleLogicalRange);
        }
      });

      isUpdating = false;
    };

    // Sync crosshair position across charts
    const syncCrosshair = (sourceChart: IChartApi, time: any) => {
      if (isUpdating) return;
      isUpdating = true;

      charts.forEach(chart => {
        if (chart !== sourceChart) {
          // Move crosshair to the same time position
          chart.timeScale().scrollToPosition(0, true);
          setTimeout(() => {
            chart.clearCrosshairPosition();
            if (time) {
              chart.setCrosshairPosition(100, time, chart.priceScale('right').defaultPriceScale());
            }
          }, 0);
        }
      });

      isUpdating = false;
    };

    // Add event listeners for time scale synchronization
    const timeScaleUnsubscribeFunctions = charts.map(chart => 
      chart.timeScale().subscribeVisibleLogicalRangeChange(() => syncTimeScale(chart))
    );

    // Add event listeners for crosshair synchronization
    const crosshairUnsubscribeFunctions = charts.map(chart => 
      chart.subscribeCrosshairMove(param => {
        if (param.time && !isUpdating) {
          syncCrosshair(chart, param.time);
        }
      })
    );

    return () => {
      timeScaleUnsubscribeFunctions.forEach(unsubscribe => unsubscribe());
      crosshairUnsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }, [mode, chartsRef.current.length]);

  // Render mode selector
  const renderModeSelector = () => {
    const modes = [
      { key: 'overlay', label: 'Overlay', desc: 'Multiple Y-axes' },
      { key: 'sideBySide', label: 'Side by Side', desc: 'Separate panels' },
      { key: 'percentage', label: 'Percentage', desc: '% change from start' },
      { key: 'normalized', label: 'Normalized', desc: 'Relative performance' }
    ] as const;

    return (
      <div className="flex items-center space-x-1 mb-4">
        {modes.map(modeOption => (
          <button
            key={modeOption.key}
            onClick={() => onModeChange?.(modeOption.key)}
            className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${
              mode === modeOption.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            title={modeOption.desc}
          >
            {modeOption.label}
          </button>
        ))}
      </div>
    );
  };

  // Render asset legend
  const renderLegend = () => {
    if (mode === 'sideBySide') return null; // Labels are on individual charts

    return (
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {selectedAssets.map((asset, index) => {
          const chartSeries = seriesRefs.current.get(asset);
          const color = assetColors[index % assetColors.length];
          const crosshairInfo = crosshairData[asset];
          
          return (
            <div key={asset} className="flex items-center space-x-2 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => toggleSeriesVisibility(asset)}
                className="flex items-center space-x-1"
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
              
              {crosshairInfo && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {mode === 'percentage' && `${crosshairInfo.value?.toFixed(2)}%`}
                  {mode === 'normalized' && `${crosshairInfo.value?.toFixed(2)}`}
                  {(mode === 'overlay') && crosshairInfo.originalValue && `$${crosshairInfo.originalValue.toFixed(2)}`}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`comparison-chart ${className}`}>
      {onModeChange && renderModeSelector()}
      {renderLegend()}
      
      <div
        ref={chartContainerRef}
        className="chart-container border border-gray-200 dark:border-gray-700 rounded-lg"
        style={{ height: `${height}px` }}
      />

      {/* Base asset selector for normalized mode */}
      {mode === 'normalized' && baseAsset && selectedAssets.length > 1 && (
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          <span>Normalized relative to: <strong>{baseAsset}</strong></span>
        </div>
      )}

      {/* Mode description */}
      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {mode === 'overlay' && 'Multiple assets overlaid with separate Y-axes for different price scales'}
        {mode === 'sideBySide' && 'Each asset displayed in its own panel with synchronized time axis'}
        {mode === 'percentage' && 'Percentage change from the first data point, showing relative performance'}
        {mode === 'normalized' && 'Assets normalized to 100 at start or relative to base asset'}
      </div>
    </div>
  );
};

export default ComparisonChart;