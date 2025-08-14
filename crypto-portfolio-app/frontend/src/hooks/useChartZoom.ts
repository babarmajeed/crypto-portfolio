import { useState, useCallback, useRef, useMemo } from 'react';

interface ZoomState {
  scale: number;
  translateX: number;
  translateY: number;
  minScale: number;
  maxScale: number;
  centerX: number;
  centerY: number;
}

interface UseChartZoomOptions {
  initialScale?: number;
  minScale?: number;
  maxScale?: number;
  zoomSensitivity?: number;
  panSensitivity?: number;
  onZoomChange?: (zoomState: ZoomState) => void;
  containerWidth?: number;
  containerHeight?: number;
  contentWidth?: number;
  contentHeight?: number;
}

export const useChartZoom = (options: UseChartZoomOptions = {}) => {
  const {
    initialScale = 1,
    minScale = 0.5,
    maxScale = 10,
    zoomSensitivity = 0.1,
    panSensitivity = 1,
    onZoomChange,
    containerWidth = 800,
    containerHeight = 400,
    contentWidth = 800,
    contentHeight = 400
  } = options;

  const [zoomState, setZoomState] = useState<ZoomState>({
    scale: initialScale,
    translateX: 0,
    translateY: 0,
    minScale,
    maxScale,
    centerX: containerWidth / 2,
    centerY: containerHeight / 2
  });

  const lastPinchRef = useRef<{ scale: number; centerX: number; centerY: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Calculate bounds for panning
  const bounds = useMemo(() => {
    const scaledContentWidth = contentWidth * zoomState.scale;
    const scaledContentHeight = contentHeight * zoomState.scale;
    
    const maxTranslateX = Math.max(0, (scaledContentWidth - containerWidth) / 2);
    const maxTranslateY = Math.max(0, (scaledContentHeight - containerHeight) / 2);
    
    return {
      minX: -maxTranslateX,
      maxX: maxTranslateX,
      minY: -maxTranslateY,
      maxY: maxTranslateY
    };
  }, [zoomState.scale, contentWidth, contentHeight, containerWidth, containerHeight]);

  // Constrain translation to bounds
  const constrainTranslation = useCallback((x: number, y: number): { x: number; y: number } => {
    return {
      x: Math.max(bounds.minX, Math.min(bounds.maxX, x)),
      y: Math.max(bounds.minY, Math.min(bounds.maxY, y))
    };
  }, [bounds]);

  // Zoom to point
  const zoomToPoint = useCallback((newScale: number, pointX: number, pointY: number) => {
    const clampedScale = Math.max(minScale, Math.min(maxScale, newScale));
    
    if (clampedScale === zoomState.scale) return;

    // Calculate the new translation to keep the point under cursor
    const scaleRatio = clampedScale / zoomState.scale;
    const newTranslateX = pointX - scaleRatio * (pointX - zoomState.translateX);
    const newTranslateY = pointY - scaleRatio * (pointY - zoomState.translateY);
    
    const constrained = constrainTranslation(newTranslateX, newTranslateY);
    
    const newZoomState: ZoomState = {
      ...zoomState,
      scale: clampedScale,
      translateX: constrained.x,
      translateY: constrained.y,
      centerX: pointX,
      centerY: pointY
    };
    
    setZoomState(newZoomState);
    onZoomChange?.(newZoomState);
  }, [zoomState, minScale, maxScale, constrainTranslation, onZoomChange]);

  // Pan
  const pan = useCallback((deltaX: number, deltaY: number) => {
    const adjustedDeltaX = deltaX * panSensitivity;
    const adjustedDeltaY = deltaY * panSensitivity;
    
    const newTranslateX = zoomState.translateX + adjustedDeltaX;
    const newTranslateY = zoomState.translateY + adjustedDeltaY;
    
    const constrained = constrainTranslation(newTranslateX, newTranslateY);
    
    const newZoomState: ZoomState = {
      ...zoomState,
      translateX: constrained.x,
      translateY: constrained.y
    };
    
    setZoomState(newZoomState);
    onZoomChange?.(newZoomState);
  }, [zoomState, panSensitivity, constrainTranslation, onZoomChange]);

  // Zoom in
  const zoomIn = useCallback((centerX?: number, centerY?: number) => {
    const pointX = centerX ?? containerWidth / 2;
    const pointY = centerY ?? containerHeight / 2;
    const newScale = zoomState.scale * (1 + zoomSensitivity);
    zoomToPoint(newScale, pointX, pointY);
  }, [zoomState.scale, zoomSensitivity, containerWidth, containerHeight, zoomToPoint]);

  // Zoom out
  const zoomOut = useCallback((centerX?: number, centerY?: number) => {
    const pointX = centerX ?? containerWidth / 2;
    const pointY = centerY ?? containerHeight / 2;
    const newScale = zoomState.scale * (1 - zoomSensitivity);
    zoomToPoint(newScale, pointX, pointY);
  }, [zoomState.scale, zoomSensitivity, containerWidth, containerHeight, zoomToPoint]);

  // Reset zoom
  const resetZoom = useCallback(() => {
    const newZoomState: ZoomState = {
      scale: initialScale,
      translateX: 0,
      translateY: 0,
      minScale,
      maxScale,
      centerX: containerWidth / 2,
      centerY: containerHeight / 2
    };
    
    setZoomState(newZoomState);
    onZoomChange?.(newZoomState);
  }, [initialScale, minScale, maxScale, containerWidth, containerHeight, onZoomChange]);

  // Fit to container
  const fitToContainer = useCallback(() => {
    const scaleX = containerWidth / contentWidth;
    const scaleY = containerHeight / contentHeight;
    const newScale = Math.min(scaleX, scaleY);
    
    const newZoomState: ZoomState = {
      scale: Math.max(minScale, Math.min(maxScale, newScale)),
      translateX: 0,
      translateY: 0,
      minScale,
      maxScale,
      centerX: containerWidth / 2,
      centerY: containerHeight / 2
    };
    
    setZoomState(newZoomState);
    onZoomChange?.(newZoomState);
  }, [containerWidth, containerHeight, contentWidth, contentHeight, minScale, maxScale, onZoomChange]);

  // Handle pinch gesture
  const handlePinchStart = useCallback((event: { scale: number; center: { x: number; y: number } }) => {
    lastPinchRef.current = {
      scale: zoomState.scale,
      centerX: event.center.x,
      centerY: event.center.y
    };
  }, [zoomState.scale]);

  const handlePinchMove = useCallback((event: { scale: number; center: { x: number; y: number }; delta: number }) => {
    if (!lastPinchRef.current) return;
    
    const newScale = lastPinchRef.current.scale * event.scale;
    zoomToPoint(newScale, event.center.x, event.center.y);
  }, [zoomToPoint]);

  const handlePinchEnd = useCallback(() => {
    lastPinchRef.current = null;
  }, []);

  // Handle wheel zoom
  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    
    const rect = (event.currentTarget as Element).getBoundingClientRect();
    const pointX = event.clientX - rect.left;
    const pointY = event.clientY - rect.top;
    
    const zoomDirection = event.deltaY > 0 ? -1 : 1;
    const newScale = zoomState.scale * (1 + zoomDirection * zoomSensitivity);
    
    zoomToPoint(newScale, pointX, pointY);
  }, [zoomState.scale, zoomSensitivity, zoomToPoint]);

  // Get transform style
  const getTransform = useCallback(() => {
    return `translate(${zoomState.translateX}px, ${zoomState.translateY}px) scale(${zoomState.scale})`;
  }, [zoomState.translateX, zoomState.translateY, zoomState.scale]);

  // Get view box for SVG
  const getViewBox = useCallback(() => {
    const viewWidth = containerWidth / zoomState.scale;
    const viewHeight = containerHeight / zoomState.scale;
    const viewX = -zoomState.translateX / zoomState.scale;
    const viewY = -zoomState.translateY / zoomState.scale;
    
    return `${viewX} ${viewY} ${viewWidth} ${viewHeight}`;
  }, [containerWidth, containerHeight, zoomState.scale, zoomState.translateX, zoomState.translateY]);

  // Check if can zoom in/out
  const canZoomIn = zoomState.scale < maxScale;
  const canZoomOut = zoomState.scale > minScale;
  const isAtInitialZoom = Math.abs(zoomState.scale - initialScale) < 0.001 && 
                          Math.abs(zoomState.translateX) < 0.001 && 
                          Math.abs(zoomState.translateY) < 0.001;

  return {
    zoomState,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToContainer,
    pan,
    zoomToPoint,
    handlePinchStart,
    handlePinchMove,
    handlePinchEnd,
    handleWheel,
    getTransform,
    getViewBox,
    canZoomIn,
    canZoomOut,
    isAtInitialZoom,
    bounds
  };
};
