import React, { useState, useCallback, useMemo } from 'react';
import { TrendingUp, TrendingDown, BarChart3, PieChart, Activity, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';
import { useTouch } from '../../hooks/useTouch';
import { useSwipe } from '../../hooks/useSwipe';
import PinchZoomChart from './PinchZoomChart';
import TouchOptimizedSparkline from './TouchOptimizedSparkline';
import GesturePeriodSelector from './GesturePeriodSelector';
import MobileChartControls from './MobileChartControls';
import MobileTooltip from './MobileTooltip';
import TouchCrosshair from './TouchCrosshair';

interface ChartDataPoint {
  timestamp: number;
  price: number;
  volume?: number;
  marketCap?: number;
}

interface MobileChartDashboardProps {
  symbol: string;
  data: ChartDataPoint[];
  currentPrice: number;
  priceChange24h: number;
  priceChangePercentage24h: number;
  loading?: boolean;
  error?: string;
  onPeriodChange?: (period: string) => void;
  onChartTypeChange?: (type: string) => void;
  className?: string;
}

type ChartType = 'line' | 'candlestick' | 'volume' | 'marketcap';
type ChartPeriod = '1H' | '4H' | '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';

const MobileChartDashboard: React.FC<MobileChartDashboardProps> = ({
  symbol,
  data,
  currentPrice,
  priceChange24h,
  priceChangePercentage24h,
  loading = false,
  error,
  onPeriodChange,
  onChartTypeChange,
  className = ''
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<ChartPeriod>('1D');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipData, setTooltipData] = useState<any>(null);
  const [crosshairPosition, setCrosshairPosition] = useState<{ x: number; y: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const { isMobile, isTablet, orientation } = useResponsive();
  const isTouchDevice = isMobile || isTablet;
  const isLandscape = orientation === 'landscape';

  // Chart dimensions based on device and orientation
  const chartDimensions = useMemo(() => {
    if (isFullscreen) {
      return {
        width: isLandscape ? window.innerHeight - 100 : window.innerWidth - 32,
        height: isLandscape ? window.innerWidth - 150 : window.innerHeight - 200
      };
    }
    
    if (isMobile) {
      return {
        width: window.innerWidth - 32,
        height: isLandscape ? 200 : 300
      };
    }
    
    return {
      width: 400,
      height: 300
    };
  }, [isMobile, isLandscape, isFullscreen]);

  // Touch handlers for chart interactions
  const touchHandlers = useTouch({
    onTap: (point) => {
      // Handle tap to show tooltip
      const dataPoint = getDataPointFromPosition(point.x, point.y);
      if (dataPoint) {
        setTooltipData(dataPoint);
        setShowTooltip(true);
        setCrosshairPosition({ x: point.x, y: point.y });
      }
    },
    onDoubleTap: (point) => {
      // Double tap to zoom in
      handleZoomIn();
    },
    onLongPress: (point) => {
      // Long press to toggle fullscreen
      setIsFullscreen(!isFullscreen);
    },
    onPinch: (scale, center) => {
      // Pinch to zoom
      setZoomLevel(prev => Math.max(0.5, Math.min(5, prev * scale)));
    },
    onPan: (point, delta) => {
      // Handle panning when zoomed
      if (zoomLevel > 1) {
        // Update chart pan offset
      }
    }
  });

  // Swipe handlers for period navigation
  const swipeHandlers = useSwipe({
    threshold: 50,
    onSwipe: (direction) => {
      if (direction === 'left') {
        navigatePeriod('next');
      } else if (direction === 'right') {
        navigatePeriod('previous');
      }
    }
  });

  const periods: ChartPeriod[] = ['1H', '4H', '1D', '1W', '1M', '3M', '1Y', 'ALL'];
  
  const navigatePeriod = useCallback((direction: 'next' | 'previous') => {
    const currentIndex = periods.indexOf(selectedPeriod);
    let newIndex: number;
    
    if (direction === 'next') {
      newIndex = Math.min(currentIndex + 1, periods.length - 1);
    } else {
      newIndex = Math.max(currentIndex - 1, 0);
    }
    
    const newPeriod = periods[newIndex];
    setSelectedPeriod(newPeriod);
    onPeriodChange?.(newPeriod);
  }, [selectedPeriod, periods, onPeriodChange]);

  const handlePeriodChange = useCallback((period: ChartPeriod) => {
    setSelectedPeriod(period);
    onPeriodChange?.(period);
  }, [onPeriodChange]);

  const handleChartTypeChange = useCallback((type: ChartType) => {
    setChartType(type);
    onChartTypeChange?.(type);
  }, [onChartTypeChange]);

  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(5, prev * 1.5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(0.5, prev / 1.5));
  }, []);

  const getDataPointFromPosition = (x: number, y: number): ChartDataPoint | null => {
    // Calculate which data point corresponds to the touch position
    // This would be implemented based on your chart library
    const index = Math.floor((x / chartDimensions.width) * data.length);
    return data[index] || null;
  };

  const isPositiveChange = priceChangePercentage24h >= 0;
  const chartColor = isPositiveChange ? '#10b981' : '#ef4444';

  if (loading) {
    return (
      <div className={`mobile-chart-dashboard loading ${className}`}>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
            <div className="h-64 bg-gray-200 rounded mb-4"></div>
            <div className="flex space-x-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-8 bg-gray-200 rounded flex-1"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`mobile-chart-dashboard error ${className}`}>
        <div className="bg-white rounded-xl p-6 shadow-sm text-center">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Chart Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors touch-target">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`mobile-chart-dashboard ${isFullscreen ? 'fullscreen' : ''} ${className}`}
      {...(isTouchDevice ? { ...touchHandlers, ...swipeHandlers } : {})}
    >
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Chart Header */}
        <div className="px-4 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{symbol}</h3>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold text-gray-900">
                  ${currentPrice.toLocaleString()}
                </span>
                <div className={`flex items-center text-sm ${isPositiveChange ? 'text-green-600' : 'text-red-600'}`}>
                  {isPositiveChange ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  <span className="ml-1">
                    {isPositiveChange ? '+' : ''}${Math.abs(priceChange24h).toFixed(2)} 
                    ({isPositiveChange ? '+' : ''}{priceChangePercentage24h.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {!isMobile && (
                <>
                  <button
                    onClick={handleZoomOut}
                    disabled={zoomLevel <= 0.5}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 active:bg-gray-100 transition-colors touch-target disabled:opacity-50"
                  >
                    <ZoomOut size={16} />
                  </button>
                  <button
                    onClick={handleZoomIn}
                    disabled={zoomLevel >= 5}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 active:bg-gray-100 transition-colors touch-target disabled:opacity-50"
                  >
                    <ZoomIn size={16} />
                  </button>
                </>
              )}
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 active:bg-gray-100 transition-colors touch-target"
              >
                <Maximize2 size={16} />
              </button>
            </div>
          </div>

          {/* Chart Type Selector */}
          <div className="flex items-center space-x-2 mb-3">
            {[
              { type: 'line' as ChartType, icon: Activity, label: 'Line' },
              { type: 'candlestick' as ChartType, icon: BarChart3, label: 'Candles' },
              { type: 'volume' as ChartType, icon: BarChart3, label: 'Volume' },
              { type: 'marketcap' as ChartType, icon: PieChart, label: 'Market Cap' }
            ].map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                onClick={() => handleChartTypeChange(type)}
                className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors touch-target ${
                  chartType === type
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon size={14} />
                {!isMobile && <span>{label}</span>}
              </button>
            ))}
          </div>

          {/* Period Selector */}
          <GesturePeriodSelector
            periods={periods}
            selectedPeriod={selectedPeriod}
            onPeriodChange={handlePeriodChange}
            enableSwipe={isTouchDevice}
          />
        </div>

        {/* Chart Container */}
        <div className="relative" style={{ height: chartDimensions.height }}>
          {chartType === 'line' && (
            <PinchZoomChart
              data={data}
              width={chartDimensions.width}
              height={chartDimensions.height}
              color={chartColor}
              enablePinchZoom={isTouchDevice}
              enablePan={isTouchDevice}
              zoomLevel={zoomLevel}
              onZoomChange={setZoomLevel}
            />
          )}

          {/* Crosshair and Tooltip */}
          {showTooltip && crosshairPosition && (
            <>
              <TouchCrosshair
                x={crosshairPosition.x}
                y={crosshairPosition.y}
                width={chartDimensions.width}
                height={chartDimensions.height}
              />
              <MobileTooltip
                data={tooltipData}
                x={crosshairPosition.x}
                y={crosshairPosition.y}
                onClose={() => setShowTooltip(false)}
              />
            </>
          )}

          {/* Mobile Chart Controls Overlay */}
          {isTouchDevice && (
            <MobileChartControls
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onFullscreen={() => setIsFullscreen(!isFullscreen)}
              canZoomIn={zoomLevel < 5}
              canZoomOut={zoomLevel > 0.5}
              className="absolute bottom-4 right-4"
            />
          )}
        </div>

        {/* Chart Instructions for Mobile */}
        {isTouchDevice && !isFullscreen && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
            <div className="text-xs text-gray-600 text-center">
              <div className="flex items-center justify-center space-x-4">
                <span>👆 Tap for details</span>
                <span>🤏 Pinch to zoom</span>
                <span>👈👉 Swipe to change period</span>
                {!isMobile && <span>👆👆 Double-tap to zoom</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center">
          <div className="w-full h-full p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4 text-white">
              <h2 className="text-xl font-bold">{symbol} Chart</h2>
              <button
                onClick={() => setIsFullscreen(false)}
                className="text-white hover:text-gray-300 text-2xl touch-target"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 bg-white rounded-lg p-4">
              <PinchZoomChart
                data={data}
                width={chartDimensions.width}
                height={chartDimensions.height - 100}
                color={chartColor}
                enablePinchZoom={true}
                enablePan={true}
                zoomLevel={zoomLevel}
                onZoomChange={setZoomLevel}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileChartDashboard;