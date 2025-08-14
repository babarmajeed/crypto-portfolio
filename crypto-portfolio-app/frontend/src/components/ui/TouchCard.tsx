import React, { useState, useRef } from 'react';

interface TouchCardProps {
  children: React.ReactNode;
  onClick?: () => void;
  onLongPress?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  className?: string;
  pressableClassName?: string;
  disabled?: boolean;
  longPressDelay?: number;
  swipeThreshold?: number;
}

export const TouchCard: React.FC<TouchCardProps> = ({
  children,
  onClick,
  onLongPress,
  onSwipeLeft,
  onSwipeRight,
  className = '',
  pressableClassName = '',
  disabled = false,
  longPressDelay = 500,
  swipeThreshold = 100
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0, time: 0 });
  const longPressTimer = useRef<NodeJS.Timeout>();
  const hasLongPressed = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;

    const touch = e.touches[0];
    setIsPressed(true);
    setTouchStart({
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    });
    hasLongPressed.current = false;

    // Start long press timer
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        hasLongPressed.current = true;
        setIsPressed(false);
        onLongPress();
      }, longPressDelay);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled) return;

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStart.x);
    const deltaY = Math.abs(touch.clientY - touchStart.y);

    // Clear long press if finger moved too much
    if (deltaX > 10 || deltaY > 10) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (disabled) return;

    setIsPressed(false);
    
    // Clear long press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }

    // Don't trigger other actions if long press occurred
    if (hasLongPressed.current) {
      return;
    }

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = Math.abs(touch.clientY - touchStart.y);
    const deltaTime = Date.now() - touchStart.time;

    // Check for swipe gestures
    if (Math.abs(deltaX) > swipeThreshold && deltaY < 50 && deltaTime < 300) {
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight();
        return;
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
        return;
      }
    }

    // Handle regular tap
    if (Math.abs(deltaX) < 10 && deltaY < 10 && deltaTime < 300 && onClick) {
      onClick();
    }
  };

  const handleMouseDown = () => {
    if (disabled) return;
    setIsPressed(true);
  };

  const handleMouseUp = () => {
    if (disabled) return;
    setIsPressed(false);
  };

  const handleMouseLeave = () => {
    if (disabled) return;
    setIsPressed(false);
  };

  return (
    <div
      className={`
        touch-card select-none transition-all duration-150 ease-out
        ${isPressed ? 'scale-[0.98] opacity-90' : 'scale-100 opacity-100'}
        ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
        ${isPressed ? pressableClassName : ''}
        ${className}
      `}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
    >
      {children}
    </div>
  );
};

export default TouchCard;