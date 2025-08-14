import { useState, useEffect, useRef, useCallback } from 'react';

interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

interface GestureState {
  isPinching: boolean;
  isPanning: boolean;
  isLongPress: boolean;
  scale: number;
  rotation: number;
  translateX: number;
  translateY: number;
  velocity: { x: number; y: number };
  center: { x: number; y: number };
}

interface UseTouchGesturesOptions {
  onPinchStart?: (event: { scale: number; center: { x: number; y: number } }) => void;
  onPinchMove?: (event: { scale: number; center: { x: number; y: number }; delta: number }) => void;
  onPinchEnd?: (event: { scale: number; center: { x: number; y: number } }) => void;
  onPanStart?: (event: { x: number; y: number }) => void;
  onPanMove?: (event: { x: number; y: number; deltaX: number; deltaY: number }) => void;
  onPanEnd?: (event: { x: number; y: number; velocity: { x: number; y: number } }) => void;
  onTap?: (event: { x: number; y: number }) => void;
  onDoubleTap?: (event: { x: number; y: number }) => void;
  onLongPress?: (event: { x: number; y: number }) => void;
  onSwipe?: (event: { direction: 'left' | 'right' | 'up' | 'down'; velocity: number }) => void;
  pinchThreshold?: number;
  panThreshold?: number;
  longPressDelay?: number;
  doubleTapDelay?: number;
  swipeThreshold?: number;
  enabled?: boolean;
}

export const useTouchGestures = (options: UseTouchGesturesOptions = {}) => {
  const {
    onPinchStart,
    onPinchMove,
    onPinchEnd,
    onPanStart,
    onPanMove,
    onPanEnd,
    onTap,
    onDoubleTap,
    onLongPress,
    onSwipe,
    pinchThreshold = 10,
    panThreshold = 5,
    longPressDelay = 500,
    doubleTapDelay = 300,
    swipeThreshold = 50,
    enabled = true
  } = options;

  const [gestureState, setGestureState] = useState<GestureState>({
    isPinching: false,
    isPanning: false,
    isLongPress: false,
    scale: 1,
    rotation: 0,
    translateX: 0,
    translateY: 0,
    velocity: { x: 0, y: 0 },
    center: { x: 0, y: 0 }
  });

  const touchesRef = useRef<TouchList | null>(null);
  const gestureStartRef = useRef<{
    touches: TouchPoint[];
    scale: number;
    rotation: number;
    center: { x: number; y: number };
    timestamp: number;
  } | null>(null);
  const lastTapRef = useRef<{ x: number; y: number; timestamp: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const panStartRef = useRef<{ x: number; y: number; timestamp: number } | null>(null);

  // Helper functions
  const getTouchPoints = (touches: TouchList): TouchPoint[] => {
    return Array.from(touches).map(touch => ({
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    }));
  };

  const getDistance = (touch1: TouchPoint, touch2: TouchPoint): number => {
    const dx = touch1.x - touch2.x;
    const dy = touch1.y - touch2.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getCenter = (touches: TouchPoint[]): { x: number; y: number } => {
    const x = touches.reduce((sum, touch) => sum + touch.x, 0) / touches.length;
    const y = touches.reduce((sum, touch) => sum + touch.y, 0) / touches.length;
    return { x, y };
  };

  const getAngle = (touch1: TouchPoint, touch2: TouchPoint): number => {
    return Math.atan2(touch2.y - touch1.y, touch2.x - touch1.x) * (180 / Math.PI);
  };

  const calculateVelocity = (start: TouchPoint, end: TouchPoint): { x: number; y: number } => {
    const timeDiff = Math.max(end.timestamp - start.timestamp, 1);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    return {
      x: dx / timeDiff,
      y: dy / timeDiff
    };
  };

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;

    const touches = getTouchPoints(e.touches);
    touchesRef.current = e.touches;
    clearLongPressTimer();

    if (touches.length === 1) {
      // Single touch - potential tap, pan, or long press
      const touch = touches[0];
      panStartRef.current = { x: touch.x, y: touch.y, timestamp: touch.timestamp };
      
      // Start long press timer
      longPressTimerRef.current = setTimeout(() => {
        setGestureState(prev => ({ ...prev, isLongPress: true }));
        onLongPress?.({ x: touch.x, y: touch.y });
      }, longPressDelay);

    } else if (touches.length === 2) {
      // Two touches - potential pinch
      const distance = getDistance(touches[0], touches[1]);
      const center = getCenter(touches);
      const angle = getAngle(touches[0], touches[1]);
      
      gestureStartRef.current = {
        touches,
        scale: 1,
        rotation: angle,
        center,
        timestamp: Date.now()
      };
      
      setGestureState(prev => ({
        ...prev,
        isPinching: true,
        center
      }));
      
      onPinchStart?.({ scale: 1, center });
    }
  }, [enabled, onLongPress, onPinchStart, longPressDelay, clearLongPressTimer]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled) return;

    const touches = getTouchPoints(e.touches);
    clearLongPressTimer();

    if (touches.length === 1 && panStartRef.current) {
      // Single touch movement - panning
      const touch = touches[0];
      const deltaX = touch.x - panStartRef.current.x;
      const deltaY = touch.y - panStartRef.current.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      if (distance > panThreshold && !gestureState.isPanning) {
        setGestureState(prev => ({ ...prev, isPanning: true }));
        onPanStart?.({ x: panStartRef.current!.x, y: panStartRef.current!.y });
      }
      
      if (gestureState.isPanning) {
        const velocity = calculateVelocity(panStartRef.current, touch);
        setGestureState(prev => ({
          ...prev,
          translateX: deltaX,
          translateY: deltaY,
          velocity
        }));
        onPanMove?.({ x: touch.x, y: touch.y, deltaX, deltaY });
      }
      
    } else if (touches.length === 2 && gestureStartRef.current) {
      // Two touches - pinching
      const distance = getDistance(touches[0], touches[1]);
      const startDistance = getDistance(gestureStartRef.current.touches[0], gestureStartRef.current.touches[1]);
      const scale = distance / startDistance;
      const center = getCenter(touches);
      const scaleDelta = scale - gestureState.scale;
      
      if (Math.abs(scaleDelta) > 0.01) {
        setGestureState(prev => ({
          ...prev,
          scale,
          center
        }));
        onPinchMove?.({ scale, center, delta: scaleDelta });
      }
    }
  }, [enabled, gestureState.isPanning, gestureState.scale, onPanStart, onPanMove, onPinchMove, panThreshold, clearLongPressTimer]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!enabled) return;

    const touches = getTouchPoints(e.changedTouches);
    clearLongPressTimer();

    if (gestureState.isPinching && e.touches.length < 2) {
      // End pinching
      setGestureState(prev => ({
        ...prev,
        isPinching: false
      }));
      onPinchEnd?.({ scale: gestureState.scale, center: gestureState.center });
      gestureStartRef.current = null;
      
    } else if (gestureState.isPanning && e.touches.length === 0) {
      // End panning
      setGestureState(prev => ({
        ...prev,
        isPanning: false
      }));
      onPanEnd?.({
        x: touches[0].x,
        y: touches[0].y,
        velocity: gestureState.velocity
      });
      panStartRef.current = null;
      
      // Check for swipe gesture
      if (panStartRef.current) {
        const deltaX = touches[0].x - panStartRef.current.x;
        const deltaY = touches[0].y - panStartRef.current.y;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        const maxDelta = Math.max(absX, absY);
        
        if (maxDelta > swipeThreshold) {
          const velocity = Math.sqrt(gestureState.velocity.x ** 2 + gestureState.velocity.y ** 2);
          let direction: 'left' | 'right' | 'up' | 'down';
          
          if (absX > absY) {
            direction = deltaX > 0 ? 'right' : 'left';
          } else {
            direction = deltaY > 0 ? 'down' : 'up';
          }
          
          onSwipe?.({ direction, velocity });
        }
      }
      
    } else if (e.touches.length === 0 && !gestureState.isPanning && !gestureState.isPinching && !gestureState.isLongPress) {
      // Tap gesture
      const touch = touches[0];
      const now = Date.now();
      
      if (lastTapRef.current && now - lastTapRef.current.timestamp < doubleTapDelay) {
        // Double tap
        const distance = getDistance(touch, lastTapRef.current);
        if (distance < panThreshold) {
          onDoubleTap?.({ x: touch.x, y: touch.y });
          lastTapRef.current = null;
          return;
        }
      }
      
      // Single tap
      onTap?.({ x: touch.x, y: touch.y });
      lastTapRef.current = { x: touch.x, y: touch.y, timestamp: now };
    }
    
    // Reset long press state
    if (gestureState.isLongPress) {
      setGestureState(prev => ({ ...prev, isLongPress: false }));
    }
  }, [enabled, gestureState, onPinchEnd, onPanEnd, onSwipe, onTap, onDoubleTap, swipeThreshold, doubleTapDelay, panThreshold, clearLongPressTimer]);

  const resetGesture = useCallback(() => {
    setGestureState({
      isPinching: false,
      isPanning: false,
      isLongPress: false,
      scale: 1,
      rotation: 0,
      translateX: 0,
      translateY: 0,
      velocity: { x: 0, y: 0 },
      center: { x: 0, y: 0 }
    });
    gestureStartRef.current = null;
    panStartRef.current = null;
    lastTapRef.current = null;
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const bindGestures = useCallback(() => ({
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchEnd,
    style: {
      touchAction: 'none',
      userSelect: 'none' as const
    }
  }), [handleTouchStart, handleTouchMove, handleTouchEnd]);

  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, [clearLongPressTimer]);

  return {
    gestureState,
    bindGestures,
    resetGesture
  };
};
