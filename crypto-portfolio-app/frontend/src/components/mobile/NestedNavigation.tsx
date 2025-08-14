import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Home } from 'lucide-react';

interface NestedNavigationItem {
  id: string;
  name: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children?: NestedNavigationItem[];
  badge?: string | number;
  description?: string;
}

interface NestedNavigationProps {
  items: NestedNavigationItem[];
  onItemClick?: (item: NestedNavigationItem) => void;
  className?: string;
  maxDepth?: number;
}

interface NavigationState {
  currentItems: NestedNavigationItem[];
  breadcrumb: Array<{ name: string; items: NestedNavigationItem[] }>;
  animationDirection: 'forward' | 'backward' | null;
}

const NestedNavigation: React.FC<NestedNavigationProps> = ({
  items,
  onItemClick,
  className = '',
  maxDepth = 3
}) => {
  const [state, setState] = useState<NavigationState>({
    currentItems: items,
    breadcrumb: [{ name: 'Menu', items }],
    animationDirection: null
  });
  
  const [isAnimating, setIsAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const navigateToChildren = (item: NestedNavigationItem) => {
    if (!item.children || item.children.length === 0) {
      onItemClick?.(item);
      return;
    }

    if (state.breadcrumb.length >= maxDepth) return;

    setIsAnimating(true);
    setState(prev => ({
      currentItems: item.children!,
      breadcrumb: [...prev.breadcrumb, { name: item.name, items: item.children! }],
      animationDirection: 'forward'
    }));
  };

  const navigateBack = () => {
    if (state.breadcrumb.length <= 1) return;

    setIsAnimating(true);
    const newBreadcrumb = state.breadcrumb.slice(0, -1);
    const parentItems = newBreadcrumb[newBreadcrumb.length - 1].items;

    setState(prev => ({
      currentItems: parentItems,
      breadcrumb: newBreadcrumb,
      animationDirection: 'backward'
    }));
  };

  const navigateToRoot = () => {
    if (state.breadcrumb.length <= 1) return;

    setIsAnimating(true);
    setState({
      currentItems: items,
      breadcrumb: [{ name: 'Menu', items }],
      animationDirection: 'backward'
    });
  };

  // Handle animation completion
  useEffect(() => {
    if (isAnimating) {
      const timer = setTimeout(() => {
        setIsAnimating(false);
        setState(prev => ({ ...prev, animationDirection: null }));
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isAnimating]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.breadcrumb.length > 1) {
        navigateBack();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state.breadcrumb.length]);

  const getAnimationClasses = () => {
    if (!isAnimating) return '';
    
    const baseClasses = 'transition-transform duration-300 ease-in-out';
    
    switch (state.animationDirection) {
      case 'forward':
        return `${baseClasses} transform -translate-x-full`;
      case 'backward':
        return `${baseClasses} transform translate-x-full`;
      default:
        return '';
    }
  };

  return (
    <div className={`nested-navigation ${className}`}>
      {/* Breadcrumb Navigation */}
      {state.breadcrumb.length > 1 && (
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <button
              onClick={navigateToRoot}
              className="p-1 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              aria-label="Go to main menu"
            >
              <Home className="w-4 h-4" />
            </button>
            
            <ChevronRight className="w-4 h-4 text-gray-400" />
            
            <div className="flex items-center space-x-1 flex-1 min-w-0">
              {state.breadcrumb.slice(1, -1).map((crumb, index) => (
                <React.Fragment key={index}>
                  <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {crumb.name}
                  </span>
                  <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                </React.Fragment>
              ))}
              
              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {state.breadcrumb[state.breadcrumb.length - 1].name}
              </span>
            </div>
          </div>
          
          <button
            onClick={navigateBack}
            className="ml-2 p-2 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Navigation Items */}
      <div
        ref={containerRef}
        className="relative overflow-hidden"
      >
        <div className={`${getAnimationClasses()}`}>
          <nav className="py-2" role="navigation">
            {state.currentItems.map((item) => {
              const hasChildren = item.children && item.children.length > 0;
              
              return (
                <button
                  key={item.id}
                  onClick={() => navigateToChildren(item)}
                  className="w-full flex items-center justify-between p-4 text-left transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none group"
                  disabled={isAnimating}
                >
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    {/* Icon */}
                    {item.icon && (
                      <div className="flex-shrink-0">
                        <item.icon className="w-6 h-6 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200" />
                      </div>
                    )}
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-medium text-gray-900 dark:text-white truncate">
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
                  </div>
                  
                  {/* Navigation indicator */}
                  <div className="flex-shrink-0 ml-4">
                    {hasChildren ? (
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                    ) : (
                      <div className="w-2 h-2 bg-primary-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
        
        {/* Loading overlay during animation */}
        {isAnimating && (
          <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-50 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      
      {/* Empty state */}
      {state.currentItems.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">No items available</p>
        </div>
      )}
    </div>
  );
};

export default NestedNavigation;