import React, { useCallback, useRef, useState } from 'react';

export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

export interface SwipeConfig {
  threshold?: number;
  velocityThreshold?: number;
  timeThreshold?: number;
  preventDefaultTouchmoveEvent?: boolean;
  trackTouch?: boolean;
  trackMouse?: boolean;
  
  // Callbacks
  onSwipe?: (direction: SwipeDirection, distance: number, velocity: number) => void;
  onSwipeStart?: (point: { x: number; y: number }) => void;
  onSwipeMove?: (point: { x: number; y: number }, delta: { x: number; y: number }) => void;
  onSwipeEnd?: (direction: SwipeDirection | null, distance: number, velocity: number) => void;
  
  // Direction-specific callbacks
  onSwipedUp?: (distance: number, velocity: number) => void;
  onSwipedDown?: (distance: number, velocity: number) => void;
  onSwipedLeft?: (distance: number, velocity: number) => void;
  onSwipedRight?: (distance: number, velocity: number) => void;
}

interface SwipePoint {
  x: number;
  y: number;
  time: number;
}

const DEFAULT_CONFIG: Required<Omit<SwipeConfig, 'onSwipe' | 'onSwipeStart' | 'onSwipeMove' | 'onSwipeEnd' | 'onSwipedUp' | 'onSwipedDown' | 'onSwipedLeft' | 'onSwipedRight'>> = {
  threshold: 20,
  velocityThreshold: 0.3,
  timeThreshold: 250,
  preventDefaultTouchmoveEvent: false,
  trackTouch: true,
  trackMouse: false,
};

/**
 * Calculate distance between two points
 */
const getDistance = (start: SwipePoint, end: SwipePoint): number => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Calculate velocity between two points
 */
const getVelocity = (start: SwipePoint, end: SwipePoint): number => {
  const distance = getDistance(start, end);
  const time = end.time - start.time;
  return time > 0 ? distance / time : 0;
};

/**
 * Determine swipe direction based on delta
 */
const getSwipeDirection = (start: SwipePoint, end: SwipePoint): SwipeDirection | null => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  
  // Determine primary direction based on larger delta
  if (absDx > absDy) {
    return dx > 0 ? 'right' : 'left';
  } else {
    return dy > 0 ? 'down' : 'up';
  }
};

/**
 * Get point from touch or mouse event
 */
const getPointFromEvent = (event: TouchEvent | MouseEvent): SwipePoint => {
  const touch = 'touches' in event ? event.touches[0] : event;
  return {
    x: touch.clientX,
    y: touch.clientY,
    time: Date.now(),
  };
};

/**
 * Custom hook for swipe gesture detection
 * Supports both touch and mouse events with configurable thresholds
 */
export const useSwipe = (config: SwipeConfig = {}) => {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  // State for tracking swipe
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<SwipeDirection | null>(null);
  const [swipeDistance, setSwipeDistance] = useState(0);
  const [swipeVelocity, setSwipeVelocity] = useState(0);
  
  // Refs for tracking swipe state
  const startPointRef = useRef<SwipePoint | null>(null);
  const lastPointRef = useRef<SwipePoint | null>(null);
  const isTrackingRef = useRef(false);
  
  // Handle swipe start
  const handleStart = useCallback((event: TouchEvent | MouseEvent) => {
    const point = getPointFromEvent(event);
    
    startPointRef.current = point;
    lastPointRef.current = point;
    isTrackingRef.current = true;
    setIsSwiping(false);
    setSwipeDirection(null);
    setSwipeDistance(0);
    setSwipeVelocity(0);
    
    config.onSwipeStart?.(point);
  }, [config]);
  
  // Handle swipe move
  const handleMove = useCallback((event: TouchEvent | MouseEvent) => {
    if (!isTrackingRef.current || !startPointRef.current || !lastPointRef.current) {
      return;
    }
    
    if (mergedConfig.preventDefaultTouchmoveEvent) {
      event.preventDefault();
    }
    
    const currentPoint = getPointFromEvent(event);
    const startPoint = startPointRef.current;
    const distance = getDistance(startPoint, currentPoint);
    const velocity = getVelocity(lastPointRef.current, currentPoint);
    
    // Update tracking state
    lastPointRef.current = currentPoint;
    setSwipeDistance(distance);
    setSwipeVelocity(velocity);
    
    // Check if we've moved enough to start swiping
    if (!isSwiping && distance > mergedConfig.threshold) {
      setIsSwiping(true);
      const direction = getSwipeDirection(startPoint, currentPoint);
      setSwipeDirection(direction);
    }
    
    // Calculate delta from start
    const delta = {
      x: currentPoint.x - startPoint.x,
      y: currentPoint.y - startPoint.y,
    };
    
    config.onSwipeMove?.(currentPoint, delta);
  }, [config, mergedConfig.preventDefaultTouchmoveEvent, mergedConfig.threshold, isSwiping]);
  
  // Handle swipe end
  const handleEnd = useCallback((event: TouchEvent | MouseEvent) => {
    if (!isTrackingRef.current || !startPointRef.current || !lastPointRef.current) {
      return;
    }
    
    const endPoint = getPointFromEvent(event);
    const startPoint = startPointRef.current;
    const distance = getDistance(startPoint, endPoint);
    const velocity = getVelocity(startPoint, endPoint);
    const duration = endPoint.time - startPoint.time;
    
    let direction: SwipeDirection | null = null;
    
    // Determine if this qualifies as a swipe
    const isValidSwipe = 
      distance >= mergedConfig.threshold &&
      velocity >= mergedConfig.velocityThreshold &&
      duration <= mergedConfig.timeThreshold;
    
    if (isValidSwipe) {
      direction = getSwipeDirection(startPoint, endPoint);
      
      // Call general swipe callback
      config.onSwipe?.(direction, distance, velocity);
      
      // Call direction-specific callbacks
      switch (direction) {
        case 'up':
          config.onSwipedUp?.(distance, velocity);
          break;
        case 'down':
          config.onSwipedDown?.(distance, velocity);
          break;
        case 'left':
          config.onSwipedLeft?.(distance, velocity);
          break;
        case 'right':
          config.onSwipedRight?.(distance, velocity);
          break;
      }
    }
    
    // Call end callback with final state
    config.onSwipeEnd?.(direction, distance, velocity);
    
    // Reset state
    startPointRef.current = null;
    lastPointRef.current = null;
    isTrackingRef.current = false;
    setIsSwiping(false);
    setSwipeDirection(null);
    setSwipeDistance(0);
    setSwipeVelocity(0);
  }, [config, mergedConfig.threshold, mergedConfig.velocityThreshold, mergedConfig.timeThreshold]);
  
  // Create event handlers based on configuration
  const eventHandlers = {
    // Touch event handlers
    ...(mergedConfig.trackTouch && {
      onTouchStart: handleStart,
      onTouchMove: handleMove,
      onTouchEnd: handleEnd,
    }),
    
    // Mouse event handlers
    ...(mergedConfig.trackMouse && {
      onMouseDown: handleStart,
      onMouseMove: handleMove,
      onMouseUp: handleEnd,
    }),
  };
  
  return {
    // Event handlers
    ...eventHandlers,
    
    // Current swipe state
    isSwiping,
    swipeDirection,
    swipeDistance,
    swipeVelocity,
    
    // Manual control functions
    handleStart,
    handleMove,
    handleEnd,
    
    // Utility functions
    getDistance,
    getVelocity,
    getSwipeDirection,
  };
};

/**
 * Higher-order component for adding swipe functionality
 */
export const withSwipe = <P extends object>(
  Component: React.ComponentType<P>,
  swipeConfig?: SwipeConfig
) => {
  const SwipeableComponent = (props: P) => {
    const swipeHandlers = useSwipe(swipeConfig);
    
    return (
      <div {...swipeHandlers}>
        <Component {...props} />
      </div>
    );
  };
  
  SwipeableComponent.displayName = `withSwipe(${Component.displayName || Component.name})`;
  
  return SwipeableComponent;
};

export default useSwipe;