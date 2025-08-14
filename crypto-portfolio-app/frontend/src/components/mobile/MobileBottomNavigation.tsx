import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { navigation } from '../layout/navigationConfig';

interface MobileBottomNavigationProps {
  className?: string;
  maxItems?: number;
}

const MobileBottomNavigation: React.FC<MobileBottomNavigationProps> = ({
  className = '',
  maxItems = 5
}) => {
  const location = useLocation();
  
  // Get main navigation items (no children)
  const bottomNavItems = navigation
    .filter(item => !item.children || item.children.length === 0)
    .slice(0, maxItems);

  return (
    <nav className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 safe-area-pb z-40 ${className}`}>
      <div className="flex justify-around items-center h-16 px-2">
        {bottomNavItems.map((item) => {
          const isActive = location.pathname === item.href;
          
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive: linkActive }) => `
                flex flex-col items-center justify-center flex-1 py-2 px-1 transition-all duration-200
                ${linkActive 
                  ? 'text-primary-600 dark:text-primary-400' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }
              `}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <item.icon className={`w-6 h-6 mb-1 ${isActive ? 'scale-110' : ''} transition-transform duration-200`} />
              <span className={`text-xs font-medium truncate max-w-full ${isActive ? 'font-semibold' : ''}`}>
                {item.name}
              </span>
              
              {/* Active indicator */}
              {isActive && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-primary-500 rounded-b-full" />
              )}
            </NavLink>
          );
        })}
      </div>
      
      {/* Safe area padding for devices with home indicator */}
      <div className="h-safe-area-inset-bottom bg-white dark:bg-gray-800" />
    </nav>
  );
};

export default MobileBottomNavigation;