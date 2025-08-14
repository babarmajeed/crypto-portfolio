import React, { useEffect, useCallback, useRef } from 'react';
import { useSwipe } from '../../hooks/useSwipe';
import { useResponsive } from '../../hooks/useResponsive';

export interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  position?: 'left' | 'right';
  width?: string | number;
  children: React.ReactNode;
  className?: string;
  backdrop?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnSwipe?: boolean;
  swipeThreshold?: number;
}

const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  position = 'left',
  width = '85%',
  children,
  className = '',
  backdrop = true,
  closeOnBackdropClick = true,
  closeOnSwipe = true,
  swipeThreshold = 50
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const { isMobile, isTablet } = useResponsive();

  // Swipe handler for closing drawer
  const swipeHandlers = useSwipe({
    threshold: swipeThreshold,
    onSwipe: (direction) => {
      if (!closeOnSwipe || !isOpen) return;
      
      // Close drawer on swipe away from edge
      if ((position === 'left' && direction === 'left') || 
          (position === 'right' && direction === 'right')) {
        onClose();
      }
    }
  });

  // Handle backdrop click
  const handleBackdropClick = useCallback((event: React.MouseEvent) => {
    if (closeOnBackdropClick && event.target === event.currentTarget) {
      onClose();
    }
  }, [closeOnBackdropClick, onClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      // Prevent body scroll when drawer is open
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.removeEventListener('keydown', handleEscapeKey);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, onClose]);

  // Focus management
  useEffect(() => {
    if (isOpen && drawerRef.current) {
      // Focus first focusable element in drawer
      const focusableElements = drawerRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstFocusable = focusableElements[0] as HTMLElement;
      if (firstFocusable) {
        firstFocusable.focus();
      }
    }
  }, [isOpen]);

  // Don't render on desktop
  if (!isMobile && !isTablet) {
    return null;
  }

  const drawerWidth = typeof width === 'number' ? `${width}px` : width;
  const maxWidth = width === '85%' ? '320px' : 'none';

  return (
    <div 
      className={`navigation-drawer-overlay ${isOpen ? 'open' : ''}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-hidden={!isOpen}
    >
      {backdrop && <div className="drawer-backdrop" />}
      
      <div
        ref={drawerRef}
        className={`navigation-drawer ${position} ${isOpen ? 'open' : ''} ${className}`}
        style={{ 
          width: drawerWidth,
          maxWidth 
        }}
        {...(closeOnSwipe ? swipeHandlers : {})}
        role="navigation"
        aria-label="Navigation menu"
      >
        {/* Drawer Handle */}
        <div className="drawer-handle" aria-hidden="true">
          <div className="handle-line" />
        </div>

        {/* Drawer Content */}
        <div className="drawer-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default NavigationDrawer;