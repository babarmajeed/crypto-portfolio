import React from 'react';

interface HamburgerMenuProps {
  isOpen: boolean;
  onClick: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  ariaLabel?: string;
}

const HamburgerMenu: React.FC<HamburgerMenuProps> = ({
  isOpen,
  onClick,
  className = '',
  size = 'md',
  color,
  ariaLabel = 'Toggle navigation menu'
}) => {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  const lineHeight = {
    sm: 'h-0.5',
    md: 'h-0.5',
    lg: 'h-1'
  };

  const getLineClasses = (lineNumber: number) => {
    const baseClasses = `block ${lineHeight[size]} bg-current transform transition-all duration-300 ease-in-out`;
    
    if (!isOpen) {
      return `${baseClasses} ${lineNumber === 2 ? 'my-1' : ''}`;
    }

    // Animation classes when open
    switch (lineNumber) {
      case 1:
        return `${baseClasses} rotate-45 translate-y-1.5`;
      case 2:
        return `${baseClasses} opacity-0`;
      case 3:
        return `${baseClasses} -rotate-45 -translate-y-1.5`;
      default:
        return baseClasses;
    }
  };

  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center justify-center p-2 rounded-md 
        text-gray-600 dark:text-gray-300 
        hover:text-gray-900 dark:hover:text-white 
        hover:bg-gray-100 dark:hover:bg-gray-700 
        focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500
        transition-colors duration-200
        ${className}
      `}
      aria-label={ariaLabel}
      aria-expanded={isOpen}
      style={{ color }}
    >
      <div className={`relative ${sizeClasses[size]}`}>
        <span className={getLineClasses(1)} />
        <span className={getLineClasses(2)} />
        <span className={getLineClasses(3)} />
      </div>
      
      {/* Screen reader text */}
      <span className="sr-only">
        {isOpen ? 'Close menu' : 'Open menu'}
      </span>
    </button>
  );
};

export default HamburgerMenu;