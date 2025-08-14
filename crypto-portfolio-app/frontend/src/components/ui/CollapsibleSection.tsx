import React, { useState, useRef, useEffect } from 'react';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  isOpenByDefault?: boolean;
  onToggle?: (isOpen: boolean) => void;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  icon?: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  isOpenByDefault = false,
  onToggle,
  className = '',
  headerClassName = '',
  contentClassName = '',
  icon,
  badge,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(isOpenByDefault);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(isOpen ? contentRef.current.scrollHeight : 0);
    }
  }, [isOpen, children]);

  const handleToggle = () => {
    if (disabled) return;
    
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    onToggle?.(newIsOpen);
  };

  return (
    <div className={`collapsible-section ${className}`}>
      {/* Header */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between p-4 text-left
          bg-white border border-gray-200 rounded-lg
          hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500
          transition-all duration-200 ease-in-out
          ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
          ${isOpen ? 'rounded-b-none border-b-0' : ''}
          ${headerClassName}
        `}
        aria-expanded={isOpen}
        aria-controls={`collapsible-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex-shrink-0 text-gray-600">
              {icon}
            </div>
          )}
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {title}
            </h3>
            {badge && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {badge}
              </span>
            )}
          </div>
        </div>

        {/* Toggle Icon */}
        <div 
          className={`
            flex-shrink-0 transition-transform duration-200 ease-in-out
            ${isOpen ? 'rotate-180' : 'rotate-0'}
          `}
        >
          <svg 
            className="w-5 h-5 text-gray-600" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M19 9l-7 7-7-7" 
            />
          </svg>
        </div>
      </button>

      {/* Content */}
      <div
        id={`collapsible-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
        className={`
          overflow-hidden transition-all duration-300 ease-in-out
          ${isOpen ? 'border-l border-r border-b border-gray-200 rounded-b-lg' : ''}
        `}
        style={{ height: contentHeight }}
        aria-hidden={!isOpen}
      >
        <div 
          ref={contentRef}
          className={`
            bg-white p-4
            ${contentClassName}
          `}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default CollapsibleSection;