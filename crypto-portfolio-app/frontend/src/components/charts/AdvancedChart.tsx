import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createChart, ColorType, CrosshairMode, IChartApi, ISeriesApi } from 'lightweight-charts';
import { useResponsive } from '../../hooks/useResponsive';
import TimeframeSelector from './TimeframeSelector';
import ChartSettings from './ChartSettings';
import TechnicalIndicators from './TechnicalIndicators';
import DrawingTools from './DrawingTools';
import { useChartData } from '../../hooks/useChartData';

interface CandlestickData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// Volume data interface for chart rendering
// interface VolumeData {
//   time: number;
//   value: number;
//   color?: string;
// }

interface AdvancedChartProps {
  symbol: string;
  data?: CandlestickData[];
  height?: number;
  theme?: 'light' | 'dark';
  showVolume?: boolean;
  showIndicators?: boolean;
  showDrawingTools?: boolean;
  enableRealtime?: boolean;
  onTimeframeChange?: (timeframe: string) => void;
  onChartReady?: (chart: IChartApi) => void;
  className?: string;
}

const AdvancedChart: React.FC<AdvancedChartProps> = ({
  symbol,
  data: propData,
  height = 500,
  theme = 'dark',
  showVolume = true,
  showIndicators = true,
  showDrawingTools = true,
  enableRealtime = true,
  onTimeframeChange,
  onChartReady,
  className = ''
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  
  const [timeframe, setTimeframe] = useState('1h');
  const [chartType, setChartType] = useState<'candlestick' | 'line' | 'area'>('candlestick');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(theme);
  
  // Use chart data hook for real-time data
  const {
    data: hookData,
    isLoading,
    error: dataError,
    isConnected,
    lastUpdate,
    refreshData
  } = useChartData({
    symbol,
    timeframe,
    enableRealtime,
    limit: 1000
  });
  
  // Use provided data or hook data
  const data = propData || hookData;
  
  const { isMobile, isTablet } = useResponsive();
  const isTouchDevice = isMobile || isTablet;

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
        entireTextOnly: true,
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
        mouseWheel: !isTouchDevice,
        pressedMouseMove: true,
        horzTouchDrag: isTouchDevice,
        vertTouchDrag: isTouchDevice,
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
        mouseWheel: !isTouchDevice,
        pinch: isTouchDevice,
      },
    };
  }, [theme, isMobile, isTouchDevice]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      ...getChartOptions(),
    });

    chartRef.current = chart;

    // Add main price series
    const candlestickSeries = (chart as any).addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#10b981',
      wickDownColor: '#ef4444',
      wickUpColor: '#10b981',
      priceLineVisible: false,
      lastValueVisible: true,
    });

    candlestickSeriesRef.current = candlestickSeries;

    // Add volume series if enabled
    if (showVolume) {
      const volumeSeries = (chart as any).addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
        lastValueVisible: false,
      });

      chart.priceScale('volume').applyOptions({
        scaleMargins: {
          top: 0.7,
          bottom: 0,
        },
        visible: false,
      });

      volumeSeriesRef.current = volumeSeries;
    }

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

    // Touch event handling for mobile
    if (isTouchDevice && chartContainerRef.current) {
      const container = chartContainerRef.current;
      
      // Prevent default touch behaviors that might interfere
      const preventDefaults = (e: TouchEvent) => {
        if (e.touches.length > 1) {
          e.preventDefault(); // Prevent pinch-to-zoom on page
        }
      };

      container.addEventListener('touchstart', preventDefaults, { passive: false });
      container.addEventListener('touchmove', preventDefaults, { passive: false });
    }

    // Notify parent component
    onChartReady?.(chart);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [height, getChartOptions, showVolume, isTouchDevice, onChartReady]);

  // Update chart data
  useEffect(() => {
    if (!data || data.length === 0 || !candlestickSeriesRef.current) return;

    try {
      // Format candlestick data
      const formattedCandlestickData = data.map(candle => ({
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }));

      candlestickSeriesRef.current.setData(formattedCandlestickData as any);

      // Format volume data if available
      if (showVolume && volumeSeriesRef.current) {
        const formattedVolumeData = data
          .filter(candle => candle.volume !== undefined)
          .map(candle => ({
            time: candle.time,
            value: candle.volume!,
            color: candle.close >= candle.open ? '#10b98166' : '#ef444466',
          }));

        if (formattedVolumeData.length > 0) {
          volumeSeriesRef.current.setData(formattedVolumeData as any);
        }
      }

      // Auto-scale to fit data
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    } catch (error) {
      console.error('Error updating chart data:', error);
    }
  }, [data, showVolume]);

  // Update chart theme
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions(getChartOptions());
    }
  }, [getChartOptions]);

  // Handle theme changes
  const handleThemeChange = useCallback((newTheme: 'light' | 'dark') => {
    setCurrentTheme(newTheme);
  }, []);

  const handleTimeframeChange = useCallback((newTimeframe: string) => {
    setTimeframe(newTimeframe);
    onTimeframeChange?.(newTimeframe);
  }, [onTimeframeChange]);

  const handleChartTypeChange = useCallback((newChartType: 'candlestick' | 'line' | 'area') => {
    if (!chartRef.current || !candlestickSeriesRef.current) return;

    // Remove current series
    chartRef.current.removeSeries(candlestickSeriesRef.current);

    // Add new series based on type
    let newSeries;
    const formattedData = data.map(candle => ({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));

    switch (newChartType) {
      case 'line':
        newSeries = (chartRef.current as any).addLineSeries({
          color: '#3b82f6',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
        });
        
        const lineData = formattedData.map(item => ({
          time: item.time,
          value: item.close,
        }));
        newSeries.setData(lineData);
        break;

      case 'area':
        newSeries = (chartRef.current as any).addAreaSeries({
          topColor: '#3b82f680',
          bottomColor: '#3b82f610',
          lineColor: '#3b82f6',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
        });
        
        const areaData = formattedData.map(item => ({
          time: item.time,
          value: item.close,
        }));
        newSeries.setData(areaData);
        break;

      default: // candlestick
        newSeries = (chartRef.current as any).addCandlestickSeries({
          upColor: '#10b981',
          downColor: '#ef4444',
          borderDownColor: '#ef4444',
          borderUpColor: '#10b981',
          wickDownColor: '#ef4444',
          wickUpColor: '#10b981',
          priceLineVisible: false,
          lastValueVisible: true,
        });
        newSeries.setData(formattedData);
    }

    candlestickSeriesRef.current = newSeries as any;
    setChartType(newChartType);
  }, [data]);

  const handleExportChart = useCallback((format: 'png' | 'csv') => {
    if (!chartRef.current || !chartContainerRef.current) return;

    if (format === 'png') {
      // Create a canvas element for export
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rect = chartContainerRef.current.getBoundingClientRect();
      canvas.width = rect.width * 2; // Higher resolution
      canvas.height = rect.height * 2;
      ctx.scale(2, 2);

      // Get chart canvas
      const chartCanvas = chartContainerRef.current.querySelector('canvas');
      if (chartCanvas) {
        ctx.drawImage(chartCanvas, 0, 0, rect.width, rect.height);

        // Download the image
        const link = document.createElement('a');
        link.download = `${symbol}-${timeframe}-chart.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    } else if (format === 'csv') {
      // Export data as CSV
      const csvHeaders = ['Time', 'Open', 'High', 'Low', 'Close', 'Volume'];
      const csvRows = data.map(candle => [
        new Date(candle.time * 1000).toISOString(),
        candle.open.toFixed(8),
        candle.high.toFixed(8),
        candle.low.toFixed(8),
        candle.close.toFixed(8),
        candle.volume?.toFixed(8) || '0'
      ]);

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${symbol}-${timeframe}-data.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
  }, [symbol, timeframe, data]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  if (isLoading && (!data || data.length === 0)) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading chart data...</p>
        </div>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <p>Error loading chart data</p>
            <p className="text-sm text-gray-500">{dataError}</p>
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

  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">No chart data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`advanced-chart-container ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''} ${className}`}>
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4 mb-2 sm:mb-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {symbol} Price Chart
          </h3>
          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
            {timeframe}
          </span>
          {enableRealtime && (
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-500">
                {isConnected ? 'Live' : 'Disconnected'}
              </span>
            </div>
          )}
          {isLoading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          )}
          {lastUpdate && (
            <span className="text-xs text-gray-400">
              Updated: {new Date(lastUpdate).toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2 flex-wrap">
          <TimeframeSelector
            selectedTimeframe={timeframe}
            onTimeframeChange={handleTimeframeChange}
          />

          {/* Chart Type Selector */}
          <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            {(['candlestick', 'line', 'area'] as const).map((type) => (
              <button
                key={type}
                onClick={() => handleChartTypeChange(type)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  chartType === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>

          <ChartSettings
            onExport={handleExportChart}
            onFullscreenToggle={toggleFullscreen}
            isFullscreen={isFullscreen}
            theme={currentTheme}
            onThemeChange={handleThemeChange}
          />
        </div>
      </div>

      {/* Chart Content */}
      <div className="relative">
        <div
          ref={chartContainerRef}
          className="chart-container"
          style={{ height: isFullscreen ? 'calc(100vh - 80px)' : `${height}px` }}
        />

        {/* Technical Indicators */}
        {showIndicators && (
          <TechnicalIndicators
            chart={chartRef.current}
            data={data}
            className="absolute top-4 left-4 z-10"
          />
        )}

        {/* Drawing Tools */}
        {showDrawingTools && (
          <DrawingTools
            chart={chartRef.current}
            className="absolute top-4 right-4 z-10"
          />
        )}

        {/* Mobile touch instructions */}
        {isTouchDevice && (
          <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-75 text-white text-xs p-2 rounded-lg pointer-events-none">
            <p>Touch: Pan • Pinch: Zoom • Double tap: Reset zoom</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvancedChart;