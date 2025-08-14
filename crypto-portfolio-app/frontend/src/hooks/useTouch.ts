import { useCallback, useRef, useState, useEffect } from 'react';

export interface TouchPoint {
  x: number;
  y: number;
  id: number;
  timestamp: number;
}

export interface TouchGesture {
  type: 'tap' | 'double-tap' | 'long-press' | 'pinch' | 'pan' | 'swipe';
  startPoint: TouchPoint;
  endPoint?: TouchPoint;
  distance?: number;
  duration: number;
  scale?: number;
  velocity?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

export interface TouchConfig {
  // Tap configuration
  tapTimeout?: number;
  doubleTapDelay?: number;
  longPressDelay?: number;
  tapThreshold?: number;
  
  // Pinch configuration
  pinchThreshold?: number;
  minPinchScale?: number;
  maxPinchScale?: number;
  
  // Pan/Swipe configuration
  panThreshold?: number;
  swipeThreshold?: number;
  swipeVelocityThreshold?: number;
  
  // Callbacks
  onTap?: (point: TouchPoint) => void;
  onDoubleTap?: (point: TouchPoint) => void;
  onLongPress?: (point: TouchPoint) => void;
  onPinchStart?: (scale: number, center: TouchPoint) => void;
  onPinch?: (scale: number, center: TouchPoint) => void;
  onPinchEnd?: (scale: number, center: TouchPoint) => void;
  onPanStart?: (point: TouchPoint) => void;
  onPan?: (point: TouchPoint, delta: { x: number; y: number }) => void;
  onPanEnd?: (point: TouchPoint, velocity: { x: number; y: number }) => void;
  onSwipe?: (direction: string, distance: number, velocity: number) => void;
  
  // General callbacks
  onTouchStart?: (points: TouchPoint[]) => void;
  onTouchMove?: (points: TouchPoint[]) => void;
  onTouchEnd?: (points: TouchPoint[]) => void;
}

const DEFAULT_CONFIG: Required<TouchConfig> = {
  tapTimeout: 200,
  doubleTapDelay: 300,
  longPressDelay: 500,
  tapThreshold: 10,
  pinchThreshold: 10,
  minPinchScale: 0.5,
  maxPinchScale: 3,
  panThreshold: 10,
  swipeThreshold: 50,
  swipeVelocityThreshold: 0.5,
  onTap: () => {},
  onDoubleTap: () => {},
  onLongPress: () => {},
  onPinchStart: () => {},
  onPinch: () => {},
  onPinchEnd: () => {},
  onPanStart: () => {},
  onPan: () => {},
  onPanEnd: () => {},
  onSwipe: () => {},
  onTouchStart: () => {},
  onTouchMove: () => {},
  onTouchEnd: () => {},
};

/**
 * Utility function to convert touch event to TouchPoint
 */
const getTouchPoint = (touch: Touch, id: number = 0): TouchPoint => ({
  x: touch.clientX,
  y: touch.clientY,
  id,
  timestamp: Date.now(),
});

/**
 * Utility function to get touch points from touch event
 */
const getTouchPoints = (event: TouchEvent): TouchPoint[] => {
  return Array.from(event.touches).map((touch, index) => getTouchPoint(touch, index));
};

/**
 * Calculate distance between two points
 */
const getDistance = (point1: TouchPoint, point2: TouchPoint): number => {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Calculate center point between multiple touches
 */
const getCenter = (points: TouchPoint[]): TouchPoint => {
  const x = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const y = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  return {
    x,
    y,
    id: -1,
    timestamp: Date.now(),
  };
};

/**
 * Calculate velocity between two points
 */
const getVelocity = (startPoint: TouchPoint, endPoint: TouchPoint): { x: number; y: number } => {
  const timeDelta = endPoint.timestamp - startPoint.timestamp;
  if (timeDelta === 0) return { x: 0, y: 0 };
  
  return {
    x: (endPoint.x - startPoint.x) / timeDelta,
    y: (endPoint.y - startPoint.y) / timeDelta,
  };
};

/**
 * Get swipe direction based on delta
 */
const getSwipeDirection = (startPoint: TouchPoint, endPoint: TouchPoint): string => {
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  } else {
    return dy > 0 ? 'down' : 'up';
  }
};

/**
 * Custom hook for comprehensive touch gesture handling
 */
export const useTouch = (config: TouchConfig = {}) => {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  // State for tracking gestures
  const [isPressed, setIsPressed] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [currentScale, setCurrentScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  
  // Refs for tracking touch state
  const touchStartRef = useRef<TouchPoint[]>([]);
  const lastTouchRef = useRef<TouchPoint[]>([]);
  const initialDistanceRef = useRef<number>(0);
  const lastTapRef = useRef<TouchPoint | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const panStartRef = useRef<TouchPoint | null>(null);
  const isPanningRef = useRef(false);
  
  // Clear long press timer
  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);
  
  // Handle touch start
  const handleTouchStart = useCallback((event: TouchEvent) => {
    event.preventDefault();
    
    const touchPoints = getTouchPoints(event);
    touchStartRef.current = touchPoints;
    lastTouchRef.current = touchPoints;
    
    setIsPressed(true);
    mergedConfig.onTouchStart(touchPoints);
    
    if (touchPoints.length === 1) {
      // Single touch - prepare for tap, pan, or swipe
      const point = touchPoints[0];
      panStartRef.current = point;
      
      // Set up long press timer
      longPressTimerRef.current = setTimeout(() => {
        mergedConfig.onLongPress(point);
        clearLongPressTimer();
      }, mergedConfig.longPressDelay);
      
    } else if (touchPoints.length === 2) {
      // Two touches - prepare for pinch
      clearLongPressTimer();
      const distance = getDistance(touchPoints[0], touchPoints[1]);
      initialDistanceRef.current = distance;
      setIsPinching(true);
      
      const center = getCenter(touchPoints);
      mergedConfig.onPinchStart(1, center);
    }
  }, [mergedConfig, clearLongPressTimer]);
  
  // Handle touch move
  const handleTouchMove = useCallback((event: TouchEvent) => {
    event.preventDefault();
    
    const touchPoints = getTouchPoints(event);
    const startPoints = touchStartRef.current;
    
    if (startPoints.length === 0) return;
    
    lastTouchRef.current = touchPoints;
    mergedConfig.onTouchMove(touchPoints);
    
    if (touchPoints.length === 1 && startPoints.length === 1) {
      // Single touch movement
      const currentPoint = touchPoints[0];
      const startPoint = startPoints[0];
      const distance = getDistance(startPoint, currentPoint);
      
      // Clear long press if moved too much
      if (distance > mergedConfig.tapThreshold) {
        clearLongPressTimer();
      }
      
      // Check for pan
      if (distance > mergedConfig.panThreshold) {
        if (!isPanningRef.current) {
          isPanningRef.current = true;
          setIsPanning(true);
          mergedConfig.onPanStart(startPoint);
        }
        
        const delta = {
          x: currentPoint.x - startPoint.x,
          y: currentPoint.y - startPoint.y,
        };
        
        setPanOffset(delta);
        mergedConfig.onPan(currentPoint, delta);
      }
      
    } else if (touchPoints.length === 2 && startPoints.length === 2) {
      // Two touch movement - pinch
      const currentDistance = getDistance(touchPoints[0], touchPoints[1]);
      const initialDistance = initialDistanceRef.current;
      
      if (initialDistance > 0) {
        let scale = currentDistance / initialDistance;
        scale = Math.max(mergedConfig.minPinchScale, Math.min(mergedConfig.maxPinchScale, scale));
        
        setCurrentScale(scale);
        const center = getCenter(touchPoints);
        mergedConfig.onPinch(scale, center);
      }
    }
  }, [mergedConfig, clearLongPressTimer]);
  
  // Handle touch end
  const handleTouchEnd = useCallback((event: TouchEvent) => {
    const touchPoints = getTouchPoints(event);
    const startPoints = touchStartRef.current;
    const endTime = Date.now();
    
    if (startPoints.length === 0) return;
    
    setIsPressed(false);
    clearLongPressTimer();
    
    mergedConfig.onTouchEnd(touchPoints);
    
    // Handle single touch end
    if (startPoints.length === 1) {
      const startPoint = startPoints[0];
      const endPoint = lastTouchRef.current[0] || startPoint;
      const distance = getDistance(startPoint, endPoint);
      const duration = endTime - startPoint.timestamp;
      
      if (isPanningRef.current) {
        // End pan
        isPanningRef.current = false;
        setIsPanning(false);
        setPanOffset({ x: 0, y: 0 });
        
        const velocity = getVelocity(startPoint, endPoint);
        mergedConfig.onPanEnd(endPoint, velocity);
        
        // Check for swipe
        const velocityMagnitude = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
        if (distance > mergedConfig.swipeThreshold && velocityMagnitude > mergedConfig.swipeVelocityThreshold) {
          const direction = getSwipeDirection(startPoint, endPoint);
          mergedConfig.onSwipe(direction, distance, velocityMagnitude);
        }
        
      } else if (distance <= mergedConfig.tapThreshold && duration <= mergedConfig.tapTimeout) {
        // Handle tap
        const now = Date.now();
        const lastTap = lastTapRef.current;
        const lastTapTime = lastTapTimeRef.current;
        
        if (lastTap && 
            now - lastTapTime <= mergedConfig.doubleTapDelay && 
            getDistance(lastTap, endPoint) <= mergedConfig.tapThreshold) {
          // Double tap
          mergedConfig.onDoubleTap(endPoint);
          lastTapRef.current = null;
          lastTapTimeRef.current = 0;
        } else {
          // Single tap
          mergedConfig.onTap(endPoint);
          lastTapRef.current = endPoint;
          lastTapTimeRef.current = now;
        }
      }
    }
    
    // Handle pinch end
    if (isPinching && startPoints.length === 2) {
      setIsPinching(false);
      const center = getCenter(startPoints);
      mergedConfig.onPinchEnd(currentScale, center);
    }
    
    // Reset state
    touchStartRef.current = [];
    lastTouchRef.current = [];
    initialDistanceRef.current = 0;
  }, [mergedConfig, clearLongPressTimer, isPinching, currentScale]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, [clearLongPressTimer]);
  
  return {
    // Touch event handlers
    touchStart: handleTouchStart,
    touchMove: handleTouchMove,
    touchEnd: handleTouchEnd,
    
    // Touch state
    isPressed,
    isPinching,
    isPanning,
    currentScale,
    panOffset,
    
    // Helper functions
    clearLongPressTimer,
    
    // Utility functions
    getDistance,
    getCenter,
    getVelocity,
    getSwipeDirection,
  };
};

export default useTouch;