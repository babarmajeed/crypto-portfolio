import React, { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';

interface TouchNavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  description?: string;
}

interface TouchNavigationProps {
  items: TouchNavigationItem[];
  className?: string;
  onItemClick?: (item: TouchNavigationItem) => void;
}

const TouchNavigation: React.FC<TouchNavigationProps> = ({
  items,
  className = '',
  onItemClick
}) => {
  const [pressedItem, setPressedItem] = useState<string | null>(null);
  const [ripples, setRipples] = useState<Array<{ id: string; x: number; y: number; size: number }>>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent, item: TouchNavigationItem) => {
    setPressedItem(item.name);
    
    // Create ripple effect
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const size = Math.max(rect.width, rect.height) * 1.5;
    
    const rippleId = `ripple-${Date.now()}`;
    setRipples(prev => [...prev, { id: rippleId, x, y, size }]);
    
    // Remove ripple after animation
    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== rippleId));
    }, 600);
  };

  const handleTouchEnd = () => {
    setTimeout(() => setPressedItem(null), 100);
  };

  const handleItemClick = (item: TouchNavigationItem) => {
    onItemClick?.(item);
  };

  // Haptic feedback for supported devices
  const triggerHaptic = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };

  return (
    <div ref={containerRef} className={`touch-navigation ${className}`}>
      <nav className="grid grid-cols-1 gap-1" role="navigation">
        {items.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) => `
              relative overflow-hidden block p-4 rounded-lg transition-all duration-200
              touch-none select-none
              ${isActive 
                ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 shadow-sm' 
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }
              ${pressedItem === item.name ? 'scale-95 bg-gray-200 dark:bg-gray-600' : ''}
            `}
            onTouchStart={(e) => {
              handleTouchStart(e, item);
              triggerHaptic();
            }}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onClick={() => handleItemClick(item)}
            style={{
              WebkitTapHighlightColor: 'transparent',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none'
            }}
          >
            {/* Ripple effects */}
            {ripples.map((ripple) => (
              <div
                key={ripple.id}
                className="absolute pointer-events-none bg-white dark:bg-gray-300 rounded-full opacity-30 animate-ping"
                style={{
                  left: ripple.x - ripple.size / 2,
                  top: ripple.y - ripple.size / 2,
                  width: ripple.size,
                  height: ripple.size,
                  animationDuration: '0.6s'
                }}
              />
            ))}
            
            <div className="flex items-center space-x-4">
              {/* Icon */}
              <div className="flex-shrink-0">
                <item.icon className="w-7 h-7" />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-medium truncate">
                    {item.name}
                  </h3>
                  
                  {item.badge && (
                    <span className="ml-2 px-2 py-1 text-xs font-medium bg-primary-500 text-white rounded-full">
                      {item.badge}
                    </span>
                  )}
                </div>
                
                {item.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {item.description}
                  </p>
                )}
              </div>
              
              {/* Touch target indicator */}
              <div className="flex-shrink-0 w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full opacity-50" />
            </div>
            
            {/* Touch feedback overlay */}
            <div 
              className={`absolute inset-0 bg-black transition-opacity duration-100 pointer-events-none ${
                pressedItem === item.name ? 'opacity-5' : 'opacity-0'
              }`}
            />
          </NavLink>
        ))}
      </nav>
      
      {/* Accessibility announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {pressedItem && `Selected ${pressedItem}`}
      </div>
    </div>
  );
};

export default TouchNavigation;