import React, { useRef, useCallback, useState, useMemo, useEffect } from 'react';
import { useTouchGestures } from '../../hooks/useTouchGestures';
import { useTouchChart } from './TouchChartProvider';
import { formatCurrency } from '../../utils/formatters';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PricePoint {
  timestamp: number;
  price: number;
  volume?: number;
  [key: string]: any;
}

interface TouchOptimizedSparklineProps {
  data: PricePoint[];
  width?: number;
  height?: number;
  color?: string;
  positiveColor?: string;
  negativeColor?: string;
  showTooltip?: boolean;
  showTrend?: boolean;
  showVolume?: boolean;
  showFill?: boolean;
  lineWidth?: number;
  animationDuration?: number;
  className?: string;
  onDataPointSelect?: (point: PricePoint | null) => void;
  responsive?: boolean;
  touchSensitivity?: number;
  hapticFeedback?: boolean;
}

export const TouchOptimizedSparkline: React.FC<TouchOptimizedSparklineProps> = ({
  data,
  width = 120,
  height = 40,
  color = '#3b82f6',
  positiveColor = '#10b981',
  negativeColor = '#ef4444',
  showTooltip = true,
  showTrend = true,
  showVolume = false,
  showFill = true,
  lineWidth = 1.5,
  animationDuration = 300,
  className = '',
  onDataPointSelect,
  responsive = true,
  touchSensitivity = 20,
  hapticFeedback = true
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedPoint, setSelectedPoint] = useState<PricePoint | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<PricePoint | null>(null);
  const [touchPosition, setTouchPosition] = useState<{ x: number; y: number } | null>(null);
  const [containerDimensions, setContainerDimensions] = useState({ width, height });
  
  const {
    showTooltip: showContextTooltip,
    hideTooltip: hideContextTooltip,
    setSelectedDataPoint
  } = useTouchChart();

  // Handle responsive sizing
  useEffect(() => {
    if (!responsive || !containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width: newWidth, height: newHeight } = entry.contentRect;
        setContainerDimensions({
          width: newWidth || width,
          height: newHeight || height
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [responsive, width, height]);

  // Calculate trend and statistics
  const chartStats = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        min: 0,
        max: 0,
        first: 0,
        last: 0,
        change: 0,
        changePercent: 0,
        trend: 'neutral' as 'up' | 'down' | 'neutral'
      };
    }

    const prices = data.map(d => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const first = prices[0];
    const last = prices[prices.length - 1];
    const change = last - first;
    const changePercent = first !== 0 ? (change / first) * 100 : 0;
    const trend = changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'neutral';

    return { min, max, first, last, change, changePercent, trend };
  }, [data]);

  // Generate SVG path data
  const pathData = useMemo(() => {
    if (!data || data.length === 0) return { line: '', area: '' };

    const { width: w, height: h } = containerDimensions;
    const margin = { top: 2, right: 2, bottom: 2, left: 2 };
    const innerWidth = w - margin.left - margin.right;
    const innerHeight = h - margin.top - margin.bottom;

    const { min, max } = chartStats;
    const range = max - min || 1;

    // Create scales
    const xScale = (index: number) => (index / (data.length - 1)) * innerWidth;
    const yScale = (price: number) => {
      return innerHeight - ((price - min) / range) * innerHeight;
    };

    // Generate path points
    const points = data.map((point, index) => ({
      x: xScale(index) + margin.left,
      y: yScale(point.price) + margin.top,
      data: point
    }));

    // Create line path
    let linePath = '';
    points.forEach((point, index) => {
      const command = index === 0 ? 'M' : 'L';
      linePath += `${command} ${point.x} ${point.y} `;
    });

    // Create area path
    let areaPath = linePath;
    if (points.length > 0) {
      const lastPoint = points[points.length - 1];
      const firstPoint = points[0];
      areaPath += `L ${lastPoint.x} ${h - margin.bottom} L ${firstPoint.x} ${h - margin.bottom} Z`;
    }

    return {
      line: linePath.trim(),
      area: areaPath.trim(),
      points
    };
  }, [data, containerDimensions, chartStats]);

  // Find nearest point to touch/mouse position
  const findNearestPoint = useCallback((clientX: number, clientY: number): PricePoint | null => {
    if (!svgRef.current || !pathData.points) return null;

    const rect = svgRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    let nearestPoint: PricePoint | null = null;
    let minDistance = Infinity;

    pathData.points.forEach(point => {
      const distance = Math.sqrt(
        Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2)
      );
      
      if (distance < minDistance && distance < touchSensitivity) {
        minDistance = distance;
        nearestPoint = point.data;
      }
    });

    return nearestPoint;
  }, [pathData.points, touchSensitivity]);

  // Haptic feedback helper
  const triggerHaptic = useCallback(() => {
    if (hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
  }, [hapticFeedback]);

  // Handle point selection
  const handlePointSelect = useCallback((point: PricePoint | null, clientX?: number, clientY?: number) => {
    setSelectedPoint(point);
    setSelectedDataPoint?.(point);
    onDataPointSelect?.(point);

    if (point && clientX !== undefined && clientY !== undefined) {
      triggerHaptic();
      if (showTooltip) {
        showContextTooltip?.(point, { x: clientX, y: clientY });
      }
    } else {
      hideContextTooltip?.();
    }
  }, [setSelectedDataPoint, onDataPointSelect, triggerHaptic, showTooltip, showContextTooltip, hideContextTooltip]);

  // Handle hover
  const handlePointHover = useCallback((point: PricePoint | null, clientX?: number, clientY?: number) => {
    setHoveredPoint(point);
    
    if (point && clientX !== undefined && clientY !== undefined) {
      setTouchPosition({ x: clientX, y: clientY });
      if (showTooltip && !selectedPoint) {
        showContextTooltip?.(point, { x: clientX, y: clientY });
      }
    } else {
      setTouchPosition(null);
      if (!selectedPoint) {
        hideContextTooltip?.();
      }
    }
  }, [selectedPoint, showTooltip, showContextTooltip, hideContextTooltip]);

  // Touch gesture handlers
  const { bindGestures } = useTouchGestures({
    onTap: ({ x, y }) => {
      const point = findNearestPoint(x, y);
      handlePointSelect(point, x, y);
    },
    onLongPress: ({ x, y }) => {
      const point = findNearestPoint(x, y);
      if (point) {
        handlePointSelect(point, x, y);
        triggerHaptic();
      }
    },
    enabled: data && data.length > 0
  });

  // Mouse handlers for non-touch devices
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if ('ontouchstart' in window) return; // Skip on touch devices
    
    const point = findNearestPoint(e.clientX, e.clientY);
    handlePointHover(point, e.clientX, e.clientY);
  }, [findNearestPoint, handlePointHover]);

  const handleMouseLeave = useCallback(() => {
    if ('ontouchstart' in window) return; // Skip on touch devices
    
    handlePointHover(null);
  }, [handlePointHover]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if ('ontouchstart' in window) return; // Skip on touch devices
    
    const point = findNearestPoint(e.clientX, e.clientY);
    handlePointSelect(point, e.clientX, e.clientY);
  }, [findNearestPoint, handlePointSelect]);

  // Determine colors
  const lineColor = showTrend && chartStats.trend !== 'neutral' 
    ? (chartStats.trend === 'up' ? positiveColor : negativeColor)
    : color;
  
  const fillColor = lineColor + '20'; // 20% opacity

  if (!data || data.length === 0) {
    return (
      <div 
        ref={containerRef}
        className={`sparkline-empty ${className}`} 
        style={{ width: responsive ? '100%' : width, height: responsive ? '100%' : height }}
      >
        <div className="flex items-center justify-center h-full text-gray-400 text-xs">
          No data
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`relative touch-sparkline ${className}`}
      style={{
        width: responsive ? '100%' : containerDimensions.width,
        height: responsive ? '100%' : containerDimensions.height
      }}
    >
      <svg
        ref={svgRef}
        width={containerDimensions.width}
        height={containerDimensions.height}
        className="sparkline-svg cursor-pointer"
        {...bindGestures()}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        role="img"
        aria-label={`Price chart showing ${chartStats.changePercent.toFixed(2)}% change`}
      >
        {/* Gradient definition */}
        <defs>
          <linearGradient id={`sparkline-gradient-${Math.random().toString(36).substr(2, 9)}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Fill area */}
        {showFill && pathData.area && (
          <path
            d={pathData.area}
            fill={fillColor}
            className="sparkline-area"
          />
        )}

        {/* Volume bars (if enabled) */}
        {showVolume && data.some(d => d.volume) && (
          <g className="volume-bars opacity-30">
            {data.map((point, index) => {
              if (!point.volume) return null;
              
              const x = pathData.points?.[index]?.x || 0;
              const maxVolume = Math.max(...data.filter(d => d.volume).map(d => d.volume!));
              const volumeHeight = (point.volume / maxVolume) * (containerDimensions.height * 0.3);
              
              return (
                <rect
                  key={index}
                  x={x - 0.5}
                  y={containerDimensions.height - volumeHeight - 2}
                  width={1}
                  height={volumeHeight}
                  fill={lineColor}
                />
              );
            })}
          </g>
        )}

        {/* Main line */}
        <path
          d={pathData.line}
          fill="none"
          stroke={lineColor}
          strokeWidth={lineWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="sparkline-line"
          style={{
            transition: `stroke ${animationDuration}ms ease-in-out`
          }}
        />

        {/* Interactive points */}
        {pathData.points?.map((point, index) => {
          const isSelected = selectedPoint?.timestamp === point.data.timestamp;
          const isHovered = hoveredPoint?.timestamp === point.data.timestamp;
          const showPoint = isSelected || isHovered;
          
          return (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={showPoint ? 3 : 1}
              fill={lineColor}
              stroke="white"
              strokeWidth={showPoint ? 1.5 : 0}
              className="sparkline-point transition-all duration-200"
              style={{
                opacity: showPoint ? 1 : 0
              }}
            />
          );
        })}
      </svg>

      {/* Trend indicator */}
      {showTrend && chartStats.trend !== 'neutral' && (
        <div className="absolute top-1 right-1 flex items-center space-x-1">
          {chartStats.trend === 'up' ? (
            <TrendingUp className="w-3 h-3 text-green-500" />
          ) : (
            <TrendingDown className="w-3 h-3 text-red-500" />
          )}
          <span className={`text-xs font-medium ${
            chartStats.trend === 'up' ? 'text-green-600' : 'text-red-600'
          }`}>
            {chartStats.changePercent >= 0 ? '+' : ''}{chartStats.changePercent.toFixed(1)}%
          </span>
        </div>
      )}

      {/* Touch indication */}
      {'ontouchstart' in window && (selectedPoint || hoveredPoint) && (
        <div className="absolute bottom-0 left-0 right-0 text-center">
          <div className="inline-block px-2 py-1 bg-black bg-opacity-75 text-white text-xs rounded-t">
            {selectedPoint ? 'Selected' : 'Tap to select'}
          </div>
        </div>
      )}
    </div>
  );
};
