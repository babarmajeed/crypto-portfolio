import React, { useCallback, useMemo } from 'react';
import { useTouchChart } from './TouchChartProvider';
import { formatCurrency } from '../../utils/formatters';

interface TouchCrosshairProps {
  data: any[];
  width: number;
  height: number;
  xScale?: (value: any) => number;
  yScale?: (value: any) => number;
  snapToData?: boolean;
  showLabels?: boolean;
  lineColor?: string;
  labelColor?: string;
  backgroundColor?: string;
  className?: string;
}

export const TouchCrosshair: React.FC<TouchCrosshairProps> = ({
  data,
  width,
  height,
  xScale = (value) => value,
  yScale = (value) => value,
  snapToData = true,
  showLabels = true,
  lineColor = '#6b7280',
  labelColor = '#374151',
  backgroundColor = '#ffffff',
  className = ''
}) => {
  const {
    crosshairPosition,
    hoveredDataPoint,
    selectedDataPoint,
    setCrosshairPosition
  } = useTouchChart();

  // Find nearest data point to cursor position
  const nearestDataPoint = useMemo(() => {
    if (!crosshairPosition || !data.length || !snapToData) {
      return null;
    }

    let nearestPoint = null;
    let minDistance = Infinity;

    for (const point of data) {
      const x = xScale(point.timestamp || point.x);
      const y = yScale(point.value || point.y);
      const distance = Math.sqrt(
        Math.pow(x - crosshairPosition.x, 2) + Math.pow(y - crosshairPosition.y, 2)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = { ...point, x, y };
      }
    }

    return minDistance < 50 ? nearestPoint : null; // 50px snap threshold
  }, [crosshairPosition, data, xScale, yScale, snapToData]);

  // Get the actual crosshair position (snapped or cursor)
  const actualPosition = useMemo(() => {
    if (snapToData && nearestDataPoint) {
      return { x: nearestDataPoint.x, y: nearestDataPoint.y };
    }
    return crosshairPosition;
  }, [crosshairPosition, nearestDataPoint, snapToData]);

  // Get the data point to display (prioritize selected, then nearest, then hovered)
  const displayDataPoint = selectedDataPoint || nearestDataPoint || hoveredDataPoint;

  // Handle mouse/touch move within crosshair area
  const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    let clientX: number, clientY: number;
    
    if ('touches' in e) {
      if (e.touches.length === 1) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        return; // Multi-touch, ignore
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Clamp to chart bounds
    const clampedX = Math.max(0, Math.min(width, x));
    const clampedY = Math.max(0, Math.min(height, y));

    setCrosshairPosition({ x: clampedX, y: clampedY });
  }, [width, height, setCrosshairPosition]);

  const handleLeave = useCallback(() => {
    setCrosshairPosition(null);
  }, [setCrosshairPosition]);

  if (!actualPosition) {
    return (
      <div 
        className={`absolute inset-0 ${className}`}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        onTouchMove={handleMove}
        onTouchEnd={handleLeave}
        style={{ pointerEvents: 'all' }}
      />
    );
  }

  const { x, y } = actualPosition;

  return (
    <div 
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ width, height }}
    >
      {/* Interaction overlay */}
      <div 
        className="absolute inset-0 pointer-events-all opacity-0"
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        onTouchMove={handleMove}
        onTouchEnd={handleLeave}
      />

      {/* Vertical crosshair line */}
      <div
        className="absolute top-0 bottom-0 w-px opacity-75"
        style={{
          left: x,
          backgroundColor: lineColor,
          boxShadow: `0 0 2px ${lineColor}40`
        }}
      />

      {/* Horizontal crosshair line */}
      <div
        className="absolute left-0 right-0 h-px opacity-75"
        style={{
          top: y,
          backgroundColor: lineColor,
          boxShadow: `0 0 2px ${lineColor}40`
        }}
      />

      {/* Center point */}
      <div
        className="absolute w-2 h-2 rounded-full border-2 border-white shadow-md"
        style={{
          left: x - 4,
          top: y - 4,
          backgroundColor: lineColor
        }}
      />

      {/* Data labels */}
      {showLabels && displayDataPoint && (
        <>
          {/* X-axis label */}
          <div
            className="absolute px-2 py-1 text-xs font-medium rounded shadow-lg border"
            style={{
              left: x,
              bottom: 0,
              transform: 'translateX(-50%)',
              backgroundColor,
              color: labelColor,
              borderColor: lineColor,
              maxWidth: '150px'
            }}
          >
            <div className="truncate">
              {displayDataPoint.timestamp 
                ? new Date(displayDataPoint.timestamp).toLocaleString()
                : displayDataPoint.x || 'N/A'
              }
            </div>
          </div>

          {/* Y-axis label */}
          <div
            className="absolute px-2 py-1 text-xs font-medium rounded shadow-lg border"
            style={{
              right: 0,
              top: y,
              transform: 'translateY(-50%)',
              backgroundColor,
              color: labelColor,
              borderColor: lineColor
            }}
          >
            <div className="whitespace-nowrap">
              {typeof displayDataPoint.value === 'number'
                ? formatCurrency(displayDataPoint.value)
                : displayDataPoint.y || 'N/A'
              }
            </div>
          </div>

          {/* Main data tooltip */}
          <div
            className="absolute px-3 py-2 text-xs rounded-lg shadow-xl border max-w-xs z-10"
            style={{
              left: x > width / 2 ? x - 200 : x + 20,
              top: y > height / 2 ? y - 100 : y + 20,
              backgroundColor,
              color: labelColor,
              borderColor: lineColor
            }}
          >
            <div className="space-y-1">
              {displayDataPoint.timestamp && (
                <div className="font-medium">
                  {new Date(displayDataPoint.timestamp).toLocaleString()}
                </div>
              )}
              
              {displayDataPoint.value !== undefined && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-600">Value:</span>
                  <span className="font-medium">
                    {formatCurrency(displayDataPoint.value)}
                  </span>
                </div>
              )}
              
              {displayDataPoint.volume !== undefined && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-600">Volume:</span>
                  <span className="font-medium">
                    {displayDataPoint.volume.toLocaleString()}
                  </span>
                </div>
              )}
              
              {displayDataPoint.high !== undefined && displayDataPoint.low !== undefined && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-600">High:</span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(displayDataPoint.high)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-600">Low:</span>
                    <span className="font-medium text-red-600">
                      {formatCurrency(displayDataPoint.low)}
                    </span>
                  </div>
                </div>
              )}
              
              {displayDataPoint.change !== undefined && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-600">Change:</span>
                  <span className={`font-medium ${
                    displayDataPoint.change >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {displayDataPoint.change >= 0 ? '+' : ''}
                    {displayDataPoint.change.toFixed(2)}%
                  </span>
                </div>
              )}
              
              {/* Additional custom data */}
              {Object.entries(displayDataPoint)
                .filter(([key]) => ![
                  'timestamp', 'value', 'volume', 'high', 'low', 'open', 'close', 
                  'change', 'x', 'y'
                ].includes(key))
                .slice(0, 3) // Limit additional fields
                .map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <span className="text-gray-600 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}:
                    </span>
                    <span className="font-medium">
                      {typeof value === 'number' 
                        ? (key.toLowerCase().includes('price') || key.toLowerCase().includes('value')
                          ? formatCurrency(value)
                          : value.toLocaleString())
                        : String(value)
                      }
                    </span>
                  </div>
                ))
              }
            </div>
          </div>
        </>
      )}
    </div>
  );
};
