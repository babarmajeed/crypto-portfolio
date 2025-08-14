import React from 'react';

interface SwipeIndicatorProps {
  sections: string[];
  currentSection: number;
  onSectionClick: (index: number) => void;
  className?: string;
}

export const SwipeIndicator: React.FC<SwipeIndicatorProps> = ({
  sections,
  currentSection,
  onSectionClick,
  className = ''
}) => {
  return (
    <div className={`flex justify-center items-center gap-2 py-4 ${className}`}>
      {/* Dots */}
      <div className="flex gap-1">
        {sections.map((_, index) => (
          <button
            key={index}
            onClick={() => onSectionClick(index)}
            className={`
              w-2 h-2 rounded-full transition-all duration-200
              ${
                index === currentSection
                  ? 'bg-blue-600 w-6'
                  : 'bg-gray-300 hover:bg-gray-400'
              }
            `}
            aria-label={`Go to ${sections[index]} section`}
          />
        ))}
      </div>

      {/* Section Labels (for tablet/desktop) */}
      <div className="hidden sm:flex gap-4 ml-6">
        {sections.map((section, index) => (
          <button
            key={section}
            onClick={() => onSectionClick(index)}
            className={`
              text-sm font-medium px-3 py-1 rounded-full transition-all duration-200
              ${
                index === currentSection
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }
            `}
          >
            {section}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SwipeIndicator;