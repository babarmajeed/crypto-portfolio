import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useTouchGestures } from '../../hooks/useTouchGestures';
import { useChartZoom } from '../../hooks/useChartZoom';
import { useTouchChart } from './TouchChartProvider';
import { formatCurrency } from '../../utils/formatters';

interface ChartDataPoint {
  timestamp: number;
  value: number;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
  close?: number;
  [key: string]: any;
}

interface PinchZoomChartProps {
  data: ChartDataPoint[];
  width?: number;
  height?: number;
  lineColor?: string;
  gridColor?: string;
  backgroundColor?: string;
  showGrid?: boolean;
  showTooltip?: boolean;
  showCrosshair?: boolean;
  onDataPointSelect?: (point: ChartDataPoint | null) => void;
  onZoomChange?: (zoomLevel: number, timeRange: { start: Date; end: Date } | null) => void;
  className?: string;
  loading?: boolean;
  error?: string | null;
  accessibilityLabel?: string;
  dataKey?: string;
  yAxisDomain?: [number | 'dataMin', number | 'dataMax'];
  xAxisType?: 'number' | 'category';
  animationDuration?: number;
}

export const PinchZoomChart: React.FC<PinchZoomChartProps> = ({
  data,
  width = 800,
  height = 400,
  lineColor = '#3b82f6',
  gridColor = '#e5e7eb',
  backgroundColor = 'transparent',
  showGrid = true,
  showTooltip = true,
  showCrosshair = true,
  onDataPointSelect,
  onZoomChange,
  className = '',
  loading = false,
  error = null,
  accessibilityLabel = 'Interactive price chart with touch controls',
  dataKey = 'value',
  yAxisDomain = ['dataMin', 'dataMax'],
  xAxisType = 'number',
  animationDuration = 300
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [containerDimensions, setContainerDimensions] = useState({ width, height });

  const {
    selectedDataPoint,
    crosshairPosition,
    setCrosshairPosition,
    setSelectedDataPoint,
    showTooltip: showContextTooltip,
    hideTooltip
  } = useTouchChart();

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Handle container resize
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width: newWidth, height: newHeight } = entry.contentRect;
        setContainerDimensions({ width: newWidth || width, height: newHeight || height });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [width, height]);

  // Filter and process data based on zoom and time range
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Sort data by timestamp
    const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
    
    return sortedData.map(point => ({
      ...point,
      formattedTime: new Date(point.timestamp).toLocaleTimeString(),
      formattedValue: formatCurrency(point.value)
    }));
  }, [data]);

  // Chart zoom functionality
  const {
    zoomState,
    zoomIn,
    zoomOut,
    resetZoom,
    handlePinchStart,
    handlePinchMove,
    handlePinchEnd,
    handleWheel,
    pan,
    canZoomIn,
    canZoomOut,
    isAtInitialZoom
  } = useChartZoom({
    containerWidth: containerDimensions.width,
    containerHeight: containerDimensions.height,
    contentWidth: containerDimensions.width,
    contentHeight: containerDimensions.height,
    minScale: 0.5,
    maxScale: 10,
    onZoomChange: (zoomState) => {
      const timeRange = processedData.length > 0 ? {
        start: new Date(processedData[0].timestamp),
        end: new Date(processedData[processedData.length - 1].timestamp)
      } : null;
      onZoomChange?.(zoomState.scale, timeRange);
    }
  });

  // Touch gesture handling
  const {
    gestureState,
    bindGestures
  } = useTouchGestures({
    onPinchStart: handlePinchStart,
    onPinchMove: handlePinchMove,
    onPinchEnd: handlePinchEnd,
    onPanMove: ({ deltaX, deltaY }) => {
      pan(deltaX, deltaY);
    },
    onTap: ({ x, y }) => {
      handleChartClick(x, y);
    },
    onDoubleTap: ({ x, y }) => {
      if (isAtInitialZoom) {
        zoomIn(x, y);
      } else {
        resetZoom();
      }
    },
    onLongPress: ({ x, y }) => {
      handleLongPress(x, y);
    },
    enabled: !loading && !error
  });

  // Find nearest data point to coordinates
  const findNearestDataPoint = useCallback((x: number, y: number): ChartDataPoint | null => {
    if (!containerRef.current || !processedData.length) return null;

    const rect = containerRef.current.getBoundingClientRect();
    const chartX = x - rect.left;
    const chartWidth = rect.width;
    
    // Calculate which data point this x coordinate corresponds to
    const dataIndex = Math.round((chartX / chartWidth) * (processedData.length - 1));
    const clampedIndex = Math.max(0, Math.min(processedData.length - 1, dataIndex));
    
    return processedData[clampedIndex] || null;
  }, [processedData]);

  // Handle chart click
  const handleChartClick = useCallback((x: number, y: number) => {
    const point = findNearestDataPoint(x, y);
    setSelectedDataPoint(point);
    onDataPointSelect?.(point);
    
    if (point && showTooltip) {
      showContextTooltip(point, { x, y });
    } else {
      hideTooltip();
    }
  }, [findNearestDataPoint, setSelectedDataPoint, onDataPointSelect, showTooltip, showContextTooltip, hideTooltip]);

  // Handle long press
  const handleLongPress = useCallback((x: number, y: number) => {
    const point = findNearestDataPoint(x, y);
    if (point && showCrosshair) {
      setCrosshairPosition({ x, y });
      setSelectedDataPoint(point);
      if (showTooltip) {
        showContextTooltip(point, { x, y });
      }
    }
  }, [findNearestDataPoint, showCrosshair, setCrosshairPosition, setSelectedDataPoint, showTooltip, showContextTooltip]);

  // Handle mouse move for non-touch devices
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (gestureState.isPinching || gestureState.isPanning) return;

    const point = findNearestDataPoint(e.clientX, e.clientY);
    if (point && showCrosshair) {
      setCrosshairPosition({ x: e.clientX, y: e.clientY });
      if (showTooltip) {
        showContextTooltip(point, { x: e.clientX, y: e.clientY });
      }
    }
  }, [gestureState, findNearestDataPoint, showCrosshair, setCrosshairPosition, showTooltip, showContextTooltip]);

  const handleMouseLeave = useCallback(() => {
    setCrosshairPosition(null);
    hideTooltip();
  }, [setCrosshairPosition, hideTooltip]);

  // Accessibility handlers
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        if (selectedDataPoint) {
          const currentIndex = processedData.findIndex(p => p.timestamp === selectedDataPoint.timestamp);
          if (currentIndex > 0) {
            const newPoint = processedData[currentIndex - 1];
            setSelectedDataPoint(newPoint);
            onDataPointSelect?.(newPoint);
          }
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (selectedDataPoint) {
          const currentIndex = processedData.findIndex(p => p.timestamp === selectedDataPoint.timestamp);
          if (currentIndex < processedData.length - 1) {
            const newPoint = processedData[currentIndex + 1];
            setSelectedDataPoint(newPoint);
            onDataPointSelect?.(newPoint);
          }
        }
        break;
      case '+':
      case '=':
        e.preventDefault();
        zoomIn();
        break;
      case '-':
        e.preventDefault();
        zoomOut();
        break;
      case '0':
        e.preventDefault();
        resetZoom();
        break;
      case 'Escape':
        e.preventDefault();
        setSelectedDataPoint(null);
        setCrosshairPosition(null);
        hideTooltip();
        break;
    }
  }, [selectedDataPoint, processedData, setSelectedDataPoint, onDataPointSelect, zoomIn, zoomOut, resetZoom, setCrosshairPosition, hideTooltip]);

  if (loading) {
    return (
      <div className={`relative ${className}`} style={{ width, height }}>
        <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-2 text-gray-500">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span>Loading chart data...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`relative ${className}`} style={{ width, height }}>
        <div className="flex items-center justify-center h-full bg-red-50 rounded-lg border border-red-200">
          <div className="text-center text-red-600">
            <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-sm font-medium">Chart Error</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!processedData.length) {
    return (
      <div className={`relative ${className}`} style={{ width, height }}>
        <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-center text-gray-500">
            <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-sm font-medium">No Data Available</p>
            <p className="text-xs mt-1">Chart data is empty or unavailable</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`relative select-none ${className}`}
      style={{ width, height, backgroundColor }}
      {...bindGestures()}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="img"
      aria-label={accessibilityLabel}
      aria-describedby="chart-instructions"
    >
      {/* Screen reader instructions */}
      <div id="chart-instructions" className="sr-only">
        Use arrow keys to navigate data points. Press + to zoom in, - to zoom out, 0 to reset zoom. 
        Press Escape to clear selection. On touch devices, pinch to zoom, pan to move, tap to select, double-tap to zoom, long press for crosshair.
      </div>

      {/* Chart container with zoom transform */}
      <div 
        ref={chartRef}
        style={{
          transform: `translate(${zoomState.translateX}px, ${zoomState.translateY}px) scale(${zoomState.scale})`,
          transformOrigin: '0 0',
          transition: gestureState.isPinching || gestureState.isPanning ? 'none' : `transform ${animationDuration}ms ease-out`,
          width: '100%',
          height: '100%'
        }}
      >
        {isClient && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={processedData}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              {showGrid && (
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke={gridColor}
                  opacity={0.6}
                />
              )}
              <XAxis 
                dataKey="timestamp"
                type={xAxisType}
                domain={xAxisType === 'number' ? ['dataMin', 'dataMax'] : undefined}
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
                stroke="#6b7280"
                fontSize={12}
              />
              <YAxis 
                domain={yAxisDomain}
                tickFormatter={(value) => formatCurrency(value)}
                stroke="#6b7280"
                fontSize={12}
              />
              <Line 
                type="monotone" 
                dataKey={dataKey}
                stroke={lineColor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: lineColor, stroke: '#fff', strokeWidth: 2 }}
                animationDuration={animationDuration}
              />
              
              {/* Selected point indicator */}
              {selectedDataPoint && (
                <ReferenceLine 
                  x={selectedDataPoint.timestamp}
                  stroke={lineColor}
                  strokeDasharray="2 2"
                  opacity={0.8}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Zoom level indicator */}
      {!isAtInitialZoom && (
        <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
          {Math.round(zoomState.scale * 100)}%
        </div>
      )}

      {/* Gesture indicators */}
      {gestureState.isPinching && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
          Pinching
        </div>
      )}
      
      {gestureState.isPanning && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-600 text-white text-xs px-2 py-1 rounded">
          Panning
        </div>
      )}

      {/* Crosshair */}
      {showCrosshair && crosshairPosition && (
        <div 
          className="absolute pointer-events-none"
          style={{
            left: crosshairPosition.x,
            top: crosshairPosition.y,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="w-px h-full bg-gray-400 opacity-75 absolute left-1/2 top-0 transform -translate-x-1/2"></div>
          <div className="h-px w-full bg-gray-400 opacity-75 absolute top-1/2 left-0 transform -translate-y-1/2"></div>
          <div className="w-2 h-2 bg-blue-600 rounded-full border border-white"></div>
        </div>
      )}
    </div>
  );
};
