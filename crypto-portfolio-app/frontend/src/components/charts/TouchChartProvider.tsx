import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface TouchChartState {
  selectedDataPoint: any | null;
  hoveredDataPoint: any | null;
  crosshairPosition: { x: number; y: number } | null;
  isInteracting: boolean;
  isPinching: boolean;
  isPanning: boolean;
  timeRange: { start: Date; end: Date } | null;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  tooltipVisible: boolean;
  tooltipPosition: { x: number; y: number } | null;
  tooltipContent: any | null;
}

interface TouchChartActions {
  setSelectedDataPoint: (point: any | null) => void;
  setHoveredDataPoint: (point: any | null) => void;
  setCrosshairPosition: (position: { x: number; y: number } | null) => void;
  setIsInteracting: (interacting: boolean) => void;
  setIsPinching: (pinching: boolean) => void;
  setIsPanning: (panning: boolean) => void;
  setTimeRange: (range: { start: Date; end: Date } | null) => void;
  setZoomLevel: (level: number) => void;
  setPanOffset: (offset: { x: number; y: number }) => void;
  showTooltip: (content: any, position: { x: number; y: number }) => void;
  hideTooltip: () => void;
  resetChart: () => void;
  resetZoom: () => void;
  resetPan: () => void;
}

type TouchChartContextType = TouchChartState & TouchChartActions;

const TouchChartContext = createContext<TouchChartContextType | undefined>(undefined);

interface TouchChartProviderProps {
  children: ReactNode;
  initialTimeRange?: { start: Date; end: Date };
  initialZoomLevel?: number;
}

const initialState: TouchChartState = {
  selectedDataPoint: null,
  hoveredDataPoint: null,
  crosshairPosition: null,
  isInteracting: false,
  isPinching: false,
  isPanning: false,
  timeRange: null,
  zoomLevel: 1,
  panOffset: { x: 0, y: 0 },
  tooltipVisible: false,
  tooltipPosition: null,
  tooltipContent: null
};

export const TouchChartProvider: React.FC<TouchChartProviderProps> = ({
  children,
  initialTimeRange = null,
  initialZoomLevel = 1
}) => {
  const [state, setState] = useState<TouchChartState>({
    ...initialState,
    timeRange: initialTimeRange,
    zoomLevel: initialZoomLevel
  });

  // Action creators
  const setSelectedDataPoint = useCallback((point: any | null) => {
    setState(prev => ({ ...prev, selectedDataPoint: point }));
  }, []);

  const setHoveredDataPoint = useCallback((point: any | null) => {
    setState(prev => ({ ...prev, hoveredDataPoint: point }));
  }, []);

  const setCrosshairPosition = useCallback((position: { x: number; y: number } | null) => {
    setState(prev => ({ ...prev, crosshairPosition: position }));
  }, []);

  const setIsInteracting = useCallback((interacting: boolean) => {
    setState(prev => ({ ...prev, isInteracting: interacting }));
  }, []);

  const setIsPinching = useCallback((pinching: boolean) => {
    setState(prev => ({ ...prev, isPinching: pinching }));
  }, []);

  const setIsPanning = useCallback((panning: boolean) => {
    setState(prev => ({ ...prev, isPanning: panning }));
  }, []);

  const setTimeRange = useCallback((range: { start: Date; end: Date } | null) => {
    setState(prev => ({ ...prev, timeRange: range }));
  }, []);

  const setZoomLevel = useCallback((level: number) => {
    setState(prev => ({ ...prev, zoomLevel: Math.max(0.1, Math.min(10, level)) }));
  }, []);

  const setPanOffset = useCallback((offset: { x: number; y: number }) => {
    setState(prev => ({ ...prev, panOffset: offset }));
  }, []);

  const showTooltip = useCallback((content: any, position: { x: number; y: number }) => {
    setState(prev => ({
      ...prev,
      tooltipVisible: true,
      tooltipPosition: position,
      tooltipContent: content
    }));
  }, []);

  const hideTooltip = useCallback(() => {
    setState(prev => ({
      ...prev,
      tooltipVisible: false,
      tooltipPosition: null,
      tooltipContent: null
    }));
  }, []);

  const resetChart = useCallback(() => {
    setState({
      ...initialState,
      timeRange: initialTimeRange,
      zoomLevel: initialZoomLevel
    });
  }, [initialTimeRange, initialZoomLevel]);

  const resetZoom = useCallback(() => {
    setState(prev => ({ ...prev, zoomLevel: initialZoomLevel }));
  }, [initialZoomLevel]);

  const resetPan = useCallback(() => {
    setState(prev => ({ ...prev, panOffset: { x: 0, y: 0 } }));
  }, []);

  const contextValue: TouchChartContextType = {
    ...state,
    setSelectedDataPoint,
    setHoveredDataPoint,
    setCrosshairPosition,
    setIsInteracting,
    setIsPinching,
    setIsPanning,
    setTimeRange,
    setZoomLevel,
    setPanOffset,
    showTooltip,
    hideTooltip,
    resetChart,
    resetZoom,
    resetPan
  };

  return (
    <TouchChartContext.Provider value={contextValue}>
      {children}
    </TouchChartContext.Provider>
  );
};

export const useTouchChart = (): TouchChartContextType => {
  const context = useContext(TouchChartContext);
  if (!context) {
    throw new Error('useTouchChart must be used within a TouchChartProvider');
  }
  return context;
};
