import React, { useState, useCallback } from 'react';
import { useTouchChart } from './TouchChartProvider';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Move, 
  Target, 
  Settings, 
  Eye, 
  EyeOff,
  Maximize2,
  Minimize2,
  Home,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

interface MobileChartControlsProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  onResetPan?: () => void;
  onResetAll?: () => void;
  onToggleCrosshair?: () => void;
  onToggleTooltip?: () => void;
  onFitToScreen?: () => void;
  canZoomIn?: boolean;
  canZoomOut?: boolean;
  isAtInitialZoom?: boolean;
  showCrosshair?: boolean;
  showTooltip?: boolean;
  zoomLevel?: number;
  className?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'bottom-center';
  collapsed?: boolean;
  showZoomLevel?: boolean;
  showLabels?: boolean;
  theme?: 'light' | 'dark';
}

const BUTTON_SIZE_CLASSES = {
  small: 'w-8 h-8 p-1.5',
  medium: 'w-10 h-10 p-2',
  large: 'w-12 h-12 p-2.5'
};

const ICON_SIZE_CLASSES = {
  small: 'w-4 h-4',
  medium: 'w-5 h-5',
  large: 'w-6 h-6'
};

const POSITION_CLASSES = {
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-center': 'bottom-4 left-1/2 transform -translate-x-1/2'
};

export const MobileChartControls: React.FC<MobileChartControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onResetPan,
  onResetAll,
  onToggleCrosshair,
  onToggleTooltip,
  onFitToScreen,
  canZoomIn = true,
  canZoomOut = true,
  isAtInitialZoom = false,
  showCrosshair = true,
  showTooltip = true,
  zoomLevel = 1,
  className = '',
  position = 'bottom-right',
  collapsed: externalCollapsed,
  showZoomLevel = true,
  showLabels = false,
  theme = 'light'
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const {
    resetChart,
    resetZoom: contextResetZoom,
    resetPan: contextResetPan,
    zoomLevel: contextZoomLevel,
    isInteracting
  } = useTouchChart();

  const collapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;
  const actualZoomLevel = zoomLevel || contextZoomLevel || 1;

  // Theme classes
  const themeClasses = {
    light: {
      container: 'bg-white border-gray-200 shadow-lg',
      button: 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700',
      buttonActive: 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700',
      buttonDisabled: 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed',
      text: 'text-gray-700',
      divider: 'border-gray-200'
    },
    dark: {
      container: 'bg-gray-800 border-gray-600 shadow-xl',
      button: 'bg-gray-700 hover:bg-gray-600 border-gray-600 text-gray-200',
      buttonActive: 'bg-blue-700 hover:bg-blue-600 border-blue-600 text-white',
      buttonDisabled: 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed',
      text: 'text-gray-200',
      divider: 'border-gray-600'
    }
  }[theme];

  // Button size based on screen size
  const buttonSize = 'ontouchstart' in window ? 'large' : 'medium';
  const iconSize = 'ontouchstart' in window ? 'large' : 'medium';

  // Handle control actions
  const handleZoomIn = useCallback(() => {
    onZoomIn?.();
  }, [onZoomIn]);

  const handleZoomOut = useCallback(() => {
    onZoomOut?.();
  }, [onZoomOut]);

  const handleResetZoom = useCallback(() => {
    onResetZoom?.();
    contextResetZoom?.();
  }, [onResetZoom, contextResetZoom]);

  const handleResetPan = useCallback(() => {
    onResetPan?.();
    contextResetPan?.();
  }, [onResetPan, contextResetPan]);

  const handleResetAll = useCallback(() => {
    onResetAll?.();
    resetChart?.();
  }, [onResetAll, resetChart]);

  const handleToggleCollapsed = useCallback(() => {
    setInternalCollapsed(!collapsed);
  }, [collapsed]);

  // Control buttons configuration
  const primaryControls = [
    {
      id: 'zoom-in',
      icon: ZoomIn,
      label: 'Zoom In',
      action: handleZoomIn,
      disabled: !canZoomIn,
      visible: true
    },
    {
      id: 'zoom-out',
      icon: ZoomOut,
      label: 'Zoom Out',
      action: handleZoomOut,
      disabled: !canZoomOut,
      visible: true
    },
    {
      id: 'reset-zoom',
      icon: Home,
      label: 'Reset Zoom',
      action: handleResetZoom,
      disabled: isAtInitialZoom,
      visible: true
    }
  ];

  const secondaryControls = [
    {
      id: 'reset-pan',
      icon: Move,
      label: 'Reset Pan',
      action: handleResetPan,
      disabled: false,
      visible: true
    },
    {
      id: 'crosshair',
      icon: Target,
      label: showCrosshair ? 'Hide Crosshair' : 'Show Crosshair',
      action: onToggleCrosshair,
      disabled: false,
      active: showCrosshair,
      visible: !!onToggleCrosshair
    },
    {
      id: 'tooltip',
      icon: showTooltip ? Eye : EyeOff,
      label: showTooltip ? 'Hide Tooltips' : 'Show Tooltips',
      action: onToggleTooltip,
      disabled: false,
      active: showTooltip,
      visible: !!onToggleTooltip
    },
    {
      id: 'fit-screen',
      icon: Maximize2,
      label: 'Fit to Screen',
      action: onFitToScreen,
      disabled: false,
      visible: !!onFitToScreen
    },
    {
      id: 'reset-all',
      icon: RotateCcw,
      label: 'Reset All',
      action: handleResetAll,
      disabled: false,
      visible: true
    }
  ];

  const renderButton = (control: any, index: number) => {
    if (!control.visible) return null;

    const IconComponent = control.icon;
    const isActive = control.active;
    const isDisabled = control.disabled;
    
    let buttonClass = themeClasses.button;
    if (isActive) {
      buttonClass = themeClasses.buttonActive;
    } else if (isDisabled) {
      buttonClass = themeClasses.buttonDisabled;
    }

    return (
      <button
        key={control.id}
        onClick={control.action}
        disabled={isDisabled}
        className={`
          ${BUTTON_SIZE_CLASSES[buttonSize]}
          ${buttonClass}
          border rounded-lg transition-all duration-200
          touch-manipulation
          ${isDisabled ? '' : 'active:scale-95'}
          ${showLabels ? 'flex items-center space-x-2 px-3 w-auto' : 'flex items-center justify-center'}
        `}
        title={control.label}
        aria-label={control.label}
      >
        <IconComponent className={ICON_SIZE_CLASSES[iconSize]} />
        {showLabels && (
          <span className={`text-xs font-medium ${themeClasses.text}`}>
            {control.label}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className={`fixed ${POSITION_CLASSES[position]} z-40 ${className}`}>
      {/* Zoom level indicator */}
      {showZoomLevel && actualZoomLevel !== 1 && !collapsed && (
        <div className={`
          ${themeClasses.container}
          border rounded-lg px-2 py-1 mb-2 text-xs font-medium
          ${themeClasses.text}
        `}>
          {Math.round(actualZoomLevel * 100)}%
        </div>
      )}

      {/* Main control panel */}
      <div className={`
        ${themeClasses.container}
        border rounded-lg backdrop-blur-sm
        ${collapsed ? 'p-1' : 'p-2'}
        ${isInteracting ? 'opacity-75' : 'opacity-100'}
        transition-all duration-300
      `}>
        {collapsed ? (
          /* Collapsed view - only expand button */
          <button
            onClick={handleToggleCollapsed}
            className={`
              ${BUTTON_SIZE_CLASSES[buttonSize]}
              ${themeClasses.button}
              border rounded-lg transition-all duration-200
              flex items-center justify-center
              touch-manipulation active:scale-95
            `}
            title="Expand Controls"
            aria-label="Expand chart controls"
          >
            <Settings className={ICON_SIZE_CLASSES[iconSize]} />
          </button>
        ) : (
          /* Expanded view */
          <div className="space-y-2">
            {/* Primary controls */}
            <div className={`flex ${showLabels ? 'flex-col space-y-2' : 'space-x-2'}`}>
              {primaryControls.map((control, index) => renderButton(control, index))}
            </div>

            {/* Advanced controls toggle */}
            {secondaryControls.some(c => c.visible) && (
              <>
                <div className={`border-t ${themeClasses.divider} pt-2`}>
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className={`
                      w-full flex items-center justify-center space-x-1
                      ${themeClasses.button}
                      border rounded-lg transition-all duration-200
                      py-1 px-2 touch-manipulation active:scale-95
                    `}
                    title={showAdvanced ? 'Hide Advanced Controls' : 'Show Advanced Controls'}
                  >
                    <span className={`text-xs ${themeClasses.text}`}>Advanced</span>
                    {showAdvanced ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                </div>

                {/* Secondary controls */}
                {showAdvanced && (
                  <div className={`flex ${showLabels ? 'flex-col space-y-2' : 'flex-wrap gap-2'}`}>
                    {secondaryControls.map((control, index) => renderButton(control, index))}
                  </div>
                )}
              </>
            )}

            {/* Collapse button */}
            <div className={`border-t ${themeClasses.divider} pt-2`}>
              <button
                onClick={handleToggleCollapsed}
                className={`
                  ${BUTTON_SIZE_CLASSES[buttonSize]}
                  ${themeClasses.button}
                  border rounded-lg transition-all duration-200
                  w-full flex items-center justify-center
                  touch-manipulation active:scale-95
                `}
                title="Collapse Controls"
                aria-label="Collapse chart controls"
              >
                <Minimize2 className={ICON_SIZE_CLASSES[iconSize]} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Touch interaction hints */}
      {'ontouchstart' in window && !collapsed && (
        <div className={`
          ${themeClasses.container}
          border rounded-lg px-2 py-1 mt-2 text-xs
          ${themeClasses.text} opacity-75
        `}>
          <div>Pinch: Zoom • Pan: Move • Tap: Select</div>
        </div>
      )}
    </div>
  );
};
