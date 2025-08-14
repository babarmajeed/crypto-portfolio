import React, { useRef, useState, useCallback } from 'react';

interface SwipeGesturesProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  preventDefaultTouchmove?: boolean;
  className?: string;
}

interface TouchData {
  startX: number;
  startY: number;
  startTime: number;
}

const SwipeGestures: React.FC<SwipeGesturesProps> = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
  preventDefaultTouchmove = false,
  className = ''
}) => {
  const touchDataRef = useRef<TouchData | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchDataRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now()
    };
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (preventDefaultTouchmove) {
      e.preventDefault();
    }
  }, [preventDefaultTouchmove]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchDataRef.current) return;

    const touch = e.changedTouches[0];
    const { startX, startY, startTime } = touchDataRef.current;
    
    const endX = touch.clientX;
    const endY = touch.clientY;
    const endTime = Date.now();
    
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const deltaTime = endTime - startTime;
    
    // Ignore if touch was too slow (likely not a swipe)
    if (deltaTime > 1000) {
      setIsDragging(false);
      touchDataRef.current = null;
      return;
    }
    
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    
    // Determine if this is a horizontal or vertical swipe
    if (absDeltaX > absDeltaY) {
      // Horizontal swipe
      if (absDeltaX > threshold) {
        if (deltaX > 0) {
          onSwipeRight?.();
        } else {
          onSwipeLeft?.();
        }
      }
    } else {
      // Vertical swipe
      if (absDeltaY > threshold) {
        if (deltaY > 0) {
          onSwipeDown?.();
        } else {
          onSwipeUp?.();
        }
      }
    }
    
    setIsDragging(false);
    touchDataRef.current = null;
  }, [threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  const handleTouchCancel = useCallback(() => {
    setIsDragging(false);
    touchDataRef.current = null;
  }, []);

  return (
    <div
      className={className}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      style={{
        touchAction: preventDefaultTouchmove ? 'none' : 'auto',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none'
      }}
    >
      {children}
    </div>
  );
};

export default SwipeGestures;