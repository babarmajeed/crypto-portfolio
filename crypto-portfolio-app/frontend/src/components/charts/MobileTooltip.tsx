import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTouchChart } from './TouchChartProvider';
import { formatCurrency } from '../../utils/formatters';
import { TrendingUp, TrendingDown, Volume2, Clock } from 'lucide-react';

interface MobileTooltipProps {
  show?: boolean;
  position?: { x: number; y: number } | null;
  data?: any | null;
  containerRef?: React.RefObject<HTMLElement>;
  offset?: { x: number; y: number };
  maxWidth?: number;
  animationDuration?: number;
  theme?: 'light' | 'dark';
  showArrow?: boolean;
  className?: string;
}

const TOOLTIP_OFFSET = { x: 15, y: 15 };
const ARROW_SIZE = 8;
const MIN_DISTANCE_FROM_EDGE = 10;

export const MobileTooltip: React.FC<MobileTooltipProps> = ({
  show: externalShow,
  position: externalPosition,
  data: externalData,
  containerRef,
  offset = TOOLTIP_OFFSET,
  maxWidth = 280,
  animationDuration = 200,
  theme = 'light',
  showArrow = true,
  className = ''
}) => {
  const {
    tooltipVisible,
    tooltipPosition,
    tooltipContent
  } = useTouchChart();

  const tooltipRef = useRef<HTMLDivElement>(null);
  const [actualPosition, setActualPosition] = useState<{ x: number; y: number } | null>(null);
  const [arrowDirection, setArrowDirection] = useState<'top' | 'bottom' | 'left' | 'right'>('top');
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Use external props or context values
  const show = externalShow !== undefined ? externalShow : tooltipVisible;
  const position = externalPosition || tooltipPosition;
  const data = externalData || tooltipContent;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Calculate optimal tooltip position
  const calculatePosition = useCallback(() => {
    if (!position || !tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Get container bounds if available
    let containerRect = { left: 0, top: 0, right: viewportWidth, bottom: viewportHeight };
    if (containerRef?.current) {
      const rect = containerRef.current.getBoundingClientRect();
      containerRect = {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom
      };
    }

    let x = position.x + offset.x;
    let y = position.y + offset.y;
    let direction: 'top' | 'bottom' | 'left' | 'right' = 'top';

    // Adjust horizontal position
    if (x + tooltipRect.width > containerRect.right - MIN_DISTANCE_FROM_EDGE) {
      x = position.x - tooltipRect.width - offset.x;
      direction = 'right';
    }
    if (x < containerRect.left + MIN_DISTANCE_FROM_EDGE) {
      x = containerRect.left + MIN_DISTANCE_FROM_EDGE;
    }

    // Adjust vertical position
    if (y + tooltipRect.height > containerRect.bottom - MIN_DISTANCE_FROM_EDGE) {
      y = position.y - tooltipRect.height - offset.y;
      direction = direction === 'right' ? 'right' : 'bottom';
    }
    if (y < containerRect.top + MIN_DISTANCE_FROM_EDGE) {
      y = containerRect.top + MIN_DISTANCE_FROM_EDGE;
      direction = direction === 'right' ? 'right' : 'top';
    }

    // Special case: if tooltip would be too close to cursor position, move it further
    const distanceFromCursor = Math.sqrt(
      Math.pow(x - position.x, 2) + Math.pow(y - position.y, 2)
    );
    if (distanceFromCursor < 50) {
      if (position.x > viewportWidth / 2) {
        x = position.x - tooltipRect.width - 20;
        direction = 'right';
      } else {
        x = position.x + 20;
        direction = 'left';
      }
    }

    setActualPosition({ x, y });
    setArrowDirection(direction);
  }, [position, offset, containerRef]);

  // Show/hide animation
  useEffect(() => {
    if (show && position && data) {
      setIsVisible(true);
      // Recalculate position after DOM update
      setTimeout(calculatePosition, 0);
    } else {
      setIsVisible(false);
    }
  }, [show, position, data, calculatePosition]);

  // Recalculate position when window resizes
  useEffect(() => {
    if (!show) return;

    const handleResize = () => calculatePosition();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [show, calculatePosition]);

  // Auto-hide on mobile after delay
  useEffect(() => {
    if (!show || !position) return;

    const isMobile = 'ontouchstart' in window;
    if (isMobile) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 3000); // Hide after 3 seconds on mobile
      
      return () => clearTimeout(timer);
    }
  }, [show, position]);

  if (!isMounted || !show || !position || !data || !actualPosition) {
    return null;
  }

  const themeClasses = {
    light: {
      container: 'bg-white border-gray-200 text-gray-900 shadow-lg',
      header: 'text-gray-900 border-gray-200',
      label: 'text-gray-600',
      value: 'text-gray-900',
      arrow: 'bg-white border-gray-200'
    },
    dark: {
      container: 'bg-gray-800 border-gray-600 text-white shadow-xl',
      header: 'text-white border-gray-600',
      label: 'text-gray-300',
      value: 'text-white',
      arrow: 'bg-gray-800 border-gray-600'
    }
  }[theme];

  const arrowStyles = {
    top: {
      left: '50%',
      bottom: '100%',
      transform: 'translateX(-50%)',
      borderLeft: `${ARROW_SIZE}px solid transparent`,
      borderRight: `${ARROW_SIZE}px solid transparent`,
      borderBottom: `${ARROW_SIZE}px solid ${theme === 'dark' ? '#374151' : '#ffffff'}`
    },
    bottom: {
      left: '50%',
      top: '100%',
      transform: 'translateX(-50%)',
      borderLeft: `${ARROW_SIZE}px solid transparent`,
      borderRight: `${ARROW_SIZE}px solid transparent`,
      borderTop: `${ARROW_SIZE}px solid ${theme === 'dark' ? '#374151' : '#ffffff'}`
    },
    left: {
      right: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      borderTop: `${ARROW_SIZE}px solid transparent`,
      borderBottom: `${ARROW_SIZE}px solid transparent`,
      borderRight: `${ARROW_SIZE}px solid ${theme === 'dark' ? '#374151' : '#ffffff'}`
    },
    right: {
      left: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      borderTop: `${ARROW_SIZE}px solid transparent`,
      borderBottom: `${ARROW_SIZE}px solid transparent`,
      borderLeft: `${ARROW_SIZE}px solid ${theme === 'dark' ? '#374151' : '#ffffff'}`
    }
  };

  const tooltipContent = (
    <div
      ref={tooltipRef}
      className={`
        fixed z-50 rounded-lg border p-3 transition-all duration-${animationDuration}
        ${themeClasses.container}
        ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
        ${className}
      `}
      style={{
        left: actualPosition.x,
        top: actualPosition.y,
        maxWidth,
        pointerEvents: 'none',
        transform: isVisible ? 'translate(0, 0)' : 'translate(0, -10px)'
      }}
    >
      {/* Arrow */}
      {showArrow && (
        <div
          className="absolute w-0 h-0"
          style={arrowStyles[arrowDirection]}
        />
      )}

      {/* Header */}
      {(data.symbol || data.name || data.timestamp) && (
        <div className={`pb-2 mb-2 border-b ${themeClasses.header}`}>
          {data.symbol && (
            <div className="font-semibold text-base">{data.symbol}</div>
          )}
          {data.name && data.name !== data.symbol && (
            <div className="text-sm opacity-75">{data.name}</div>
          )}
          {data.timestamp && (
            <div className="flex items-center gap-1 text-xs opacity-75 mt-1">
              <Clock className="w-3 h-3" />
              {new Date(data.timestamp).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {/* Main content */}
      <div className="space-y-2">
        {/* Price/Value */}
        {data.value !== undefined && (
          <div className="flex items-center justify-between">
            <span className={`text-sm ${themeClasses.label}`}>Value:</span>
            <span className={`font-semibold ${themeClasses.value}`}>
              {formatCurrency(data.value)}
            </span>
          </div>
        )}

        {/* Change */}
        {data.change !== undefined && (
          <div className="flex items-center justify-between">
            <span className={`text-sm ${themeClasses.label}`}>Change:</span>
            <div className={`flex items-center gap-1 font-semibold ${
              data.change >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {data.change >= 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>
                {data.change >= 0 ? '+' : ''}{data.change.toFixed(2)}%
              </span>
            </div>
          </div>
        )}

        {/* Volume */}
        {data.volume !== undefined && (
          <div className="flex items-center justify-between">
            <span className={`text-sm flex items-center gap-1 ${themeClasses.label}`}>
              <Volume2 className="w-3 h-3" />
              Volume:
            </span>
            <span className={`font-semibold ${themeClasses.value}`}>
              {data.volume.toLocaleString()}
            </span>
          </div>
        )}

        {/* High/Low */}
        {(data.high !== undefined || data.low !== undefined) && (
          <div className="space-y-1">
            {data.high !== undefined && (
              <div className="flex items-center justify-between">
                <span className={`text-sm ${themeClasses.label}`}>High:</span>
                <span className="font-semibold text-green-500">
                  {formatCurrency(data.high)}
                </span>
              </div>
            )}
            {data.low !== undefined && (
              <div className="flex items-center justify-between">
                <span className={`text-sm ${themeClasses.label}`}>Low:</span>
                <span className="font-semibold text-red-500">
                  {formatCurrency(data.low)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Open/Close for OHLC data */}
        {(data.open !== undefined || data.close !== undefined) && (
          <div className="space-y-1">
            {data.open !== undefined && (
              <div className="flex items-center justify-between">
                <span className={`text-sm ${themeClasses.label}`}>Open:</span>
                <span className={`font-semibold ${themeClasses.value}`}>
                  {formatCurrency(data.open)}
                </span>
              </div>
            )}
            {data.close !== undefined && (
              <div className="flex items-center justify-between">
                <span className={`text-sm ${themeClasses.label}`}>Close:</span>
                <span className={`font-semibold ${themeClasses.value}`}>
                  {formatCurrency(data.close)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Additional data fields */}
        {Object.entries(data)
          .filter(([key]) => ![
            'symbol', 'name', 'timestamp', 'value', 'change', 'volume',
            'high', 'low', 'open', 'close', 'x', 'y'
          ].includes(key))
          .slice(0, 3)
          .map(([key, value]) => (
            <div key={key} className="flex items-center justify-between">
              <span className={`text-sm ${themeClasses.label} capitalize`}>
                {key.replace(/([A-Z])/g, ' $1').trim()}:
              </span>
              <span className={`font-semibold ${themeClasses.value}`}>
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

      {/* Mobile-specific instructions */}
      {'ontouchstart' in window && (
        <div className={`text-xs ${themeClasses.label} mt-2 pt-2 border-t border-opacity-50`}>
          Tap to select • Long press for crosshair
        </div>
      )}
    </div>
  );

  return createPortal(tooltipContent, document.body);
};
