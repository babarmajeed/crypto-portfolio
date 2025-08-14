import React, { useState } from 'react';
import { TouchCard } from './TouchCard';

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
  active?: boolean;
}

interface MobileNavigationProps {
  items: NavigationItem[];
  onItemClick: (item: NavigationItem) => void;
  className?: string;
  position?: 'bottom' | 'top';
  showLabels?: boolean;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  items,
  onItemClick,
  className = '',
  position = 'bottom',
  showLabels = true
}) => {
  const [pressedItem, setPressedItem] = useState<string | null>(null);

  const handleItemPress = (item: NavigationItem) => {
    setPressedItem(item.id);
    setTimeout(() => setPressedItem(null), 150);
    onItemClick(item);
  };

  return (
    <nav
      className={`
        fixed left-0 right-0 z-50 bg-white border-t border-gray-200 
        ${position === 'bottom' ? 'bottom-0' : 'top-0'}
        ${position === 'top' ? 'border-t-0 border-b' : ''}
        safe-area-padding
        ${className}
      `}
    >
      <div className="flex justify-around items-center px-2 py-1">
        {items.map((item) => (
          <TouchCard
            key={item.id}
            onClick={() => handleItemPress(item)}
            className="flex-1 max-w-[80px]"
            pressableClassName="scale-95"
          >
            <div
              className={`
                flex flex-col items-center justify-center py-2 px-1 rounded-lg
                transition-all duration-200 ease-in-out min-h-[48px]
                ${item.active 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-600 hover:text-gray-900'
                }
                ${pressedItem === item.id ? 'bg-gray-100' : ''}
              `}
            >
              {/* Icon Container */}
              <div className="relative flex items-center justify-center mb-1">
                <div className={`
                  w-6 h-6 flex items-center justify-center
                  ${item.active ? 'text-blue-600' : 'text-gray-600'}
                `}>
                  {item.icon}
                </div>
                
                {/* Badge */}
                {item.badge && (
                  <div className="absolute -top-2 -right-2">
                    <span className="
                      inline-flex items-center justify-center 
                      px-1.5 py-0.5 text-xs font-medium 
                      bg-red-500 text-white rounded-full 
                      min-w-[18px] h-[18px]
                    ">
                      {item.badge}
                    </span>
                  </div>
                )}
              </div>

              {/* Label */}
              {showLabels && (
                <span className={`
                  text-xs font-medium text-center leading-tight
                  ${item.active ? 'text-blue-600' : 'text-gray-600'}
                `}>
                  {item.label}
                </span>
              )}

              {/* Active Indicator */}
              {item.active && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2">
                  <div className="w-4 h-0.5 bg-blue-600 rounded-full"></div>
                </div>
              )}
            </div>
          </TouchCard>
        ))}
      </div>

      {/* Safe area spacer for devices with home indicators */}
      <div className="h-safe-area-inset-bottom"></div>
    </nav>
  );
};

// Floating Action Button for mobile
interface FloatingActionButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  className?: string;
  position?: {
    bottom?: string;
    right?: string;
    left?: string;
    top?: string;
  };
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'success' | 'danger';
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  icon,
  onClick,
  className = '',
  position = { bottom: '24px', right: '24px' },
  size = 'large',
  color = 'primary'
}) => {
  const sizeClasses = {
    small: 'w-12 h-12',
    medium: 'w-14 h-14',
    large: 'w-16 h-16'
  };

  const colorClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white'
  };

  return (
    <TouchCard
      onClick={onClick}
      className="fixed z-50"
      style={position}
      pressableClassName="scale-90"
    >
      <button
        className={`
          ${sizeClasses[size]} ${colorClasses[color]}
          rounded-full shadow-lg hover:shadow-xl
          flex items-center justify-center
          transition-all duration-200 ease-in-out
          focus:outline-none focus:ring-4 focus:ring-opacity-50
          ${className}
        `}
      >
        {icon}
      </button>
    </TouchCard>
  );
};

// Bottom sheet component for mobile
interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  height?: 'auto' | 'half' | 'full';
  className?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  children,
  title,
  height = 'auto',
  className = ''
}) => {
  const heightClasses = {
    auto: 'max-h-[80vh]',
    half: 'h-1/2',
    full: 'h-full'
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div className={`
        fixed bottom-0 left-0 right-0 z-50
        bg-white rounded-t-2xl shadow-2xl
        ${heightClasses[height]}
        transform transition-transform duration-300 ease-out
        ${isOpen ? 'translate-y-0' : 'translate-y-full'}
        ${className}
      `}>
        {/* Handle */}
        <div className="flex justify-center py-3">
          <div className="w-8 h-1 bg-gray-300 rounded-full"></div>
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <TouchCard onClick={onClose}>
              <button className="p-2 text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </TouchCard>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>

        {/* Safe area spacer */}
        <div className="h-safe-area-inset-bottom bg-white"></div>
      </div>
    </>
  );
};

export default MobileNavigation;