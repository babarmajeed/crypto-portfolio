import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { navigation } from '../layout/navigationConfig';

interface MobileNavigationProps {
  isOpen?: boolean;
  onClose?: () => void;
  onNavigate?: () => void;
  className?: string;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavigationItem[];
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({
  isOpen,
  onClose,
  onNavigate,
  className = ''
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [startX, setStartX] = useState<number | null>(null);
  const [currentX, setCurrentX] = useState<number | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Handle touch gestures for swipe-to-close
  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setCurrentX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX === null) return;
    setCurrentX(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (startX === null || currentX === null) return;
    
    const diffX = startX - currentX;
    const threshold = 100; // Minimum swipe distance

    if (diffX > threshold) {
      onClose();
    }

    setStartX(null);
    setCurrentX(null);
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Focus the drawer when opened
      drawerRef.current?.focus();
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Close drawer on route change
  useEffect(() => {
    if (isOpen) {
      onClose();
    }
  }, [location.pathname, onClose]);

  const toggleExpanded = (itemName: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemName)) {
        newSet.delete(itemName);
      } else {
        newSet.add(itemName);
      }
      return newSet;
    });
  };

  const renderNavigationItem = (item: NavigationItem, level: number = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.name);
    const isActive = location.pathname === item.href;

    return (
      <div key={item.name} className="navigation-item-wrapper">
        {hasChildren ? (
          <button
            onClick={() => toggleExpanded(item.name)}
            className={`w-full flex items-center justify-between px-4 py-3 text-left transition-all duration-200 touch-none
              ${level > 0 ? 'pl-8' : 'pl-4'}
              ${isActive 
                ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 border-r-4 border-primary-500' 
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            aria-expanded={isExpanded}
            aria-label={`${item.name} menu, ${isExpanded ? 'collapse' : 'expand'}`}
          >
            <div className="flex items-center space-x-3">
              <item.icon className="w-6 h-6 flex-shrink-0" />
              <span className="font-medium text-base">{item.name}</span>
            </div>
            {hasChildren && (
              <ChevronDown 
                className={`w-5 h-5 transition-transform duration-200 ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              />
            )}
          </button>
        ) : (
          <NavLink
            to={item.href}
            className={({ isActive: linkActive }) => `
              flex items-center px-4 py-3 text-base font-medium transition-all duration-200 touch-none
              ${level > 0 ? 'pl-8' : 'pl-4'}
              ${linkActive 
                ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 border-r-4 border-primary-500' 
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }
            `}
            onClick={onClose}
          >
            <item.icon className="w-6 h-6 mr-3 flex-shrink-0" />
            <span>{item.name}</span>
          </NavLink>
        )}

        {hasChildren && isExpanded && (
          <div className="overflow-hidden">
            <div className="py-1 bg-gray-50 dark:bg-gray-800">
              {item.children!.map(child => renderNavigationItem(child, level + 1))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  const drawerContent = (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Navigation Drawer */}
      <div
        ref={drawerRef}
        className={`relative flex flex-col w-80 max-w-[85vw] bg-white dark:bg-gray-800 shadow-xl transform transition-transform duration-300 ease-in-out ${className}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation menu"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">CP</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Crypto Portfolio
            </h2>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            aria-label="Close navigation menu"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation Content */}
        <nav className="flex-1 overflow-y-auto py-2" role="navigation">
          {navigation.map(item => renderNavigationItem(item))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            <p>Crypto Portfolio v1.0.0</p>
            <p className="mt-1">Swipe left to close</p>
          </div>
        </div>

        {/* Swipe indicator */}
        {currentX !== null && startX !== null && (
          <div 
            className="absolute top-1/2 left-0 w-1 bg-primary-500 rounded-r transition-all duration-100"
            style={{ 
              height: '60px',
              transform: `translateY(-50%) translateX(${Math.max(0, startX - currentX)}px)`,
              opacity: Math.min(1, Math.max(0, (startX - currentX) / 100))
            }}
          />
        )}
      </div>
    </div>
  );

  // Render using portal for better z-index management
  return createPortal(drawerContent, document.body);
};

export default MobileNavigation;