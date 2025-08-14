import React from 'react';
import { useResponsive } from '../../hooks/useResponsive';

interface TimeframeSelectorProps {
  selectedTimeframe: string;
  onTimeframeChange: (timeframe: string) => void;
  className?: string;
}

interface TimeframeOption {
  value: string;
  label: string;
  shortLabel?: string;
  category: 'minutes' | 'hours' | 'days' | 'weeks';
}

const timeframeOptions: TimeframeOption[] = [
  // Minutes
  { value: '1m', label: '1 Minute', shortLabel: '1m', category: 'minutes' },
  { value: '3m', label: '3 Minutes', shortLabel: '3m', category: 'minutes' },
  { value: '5m', label: '5 Minutes', shortLabel: '5m', category: 'minutes' },
  { value: '15m', label: '15 Minutes', shortLabel: '15m', category: 'minutes' },
  { value: '30m', label: '30 Minutes', shortLabel: '30m', category: 'minutes' },
  
  // Hours
  { value: '1h', label: '1 Hour', shortLabel: '1h', category: 'hours' },
  { value: '2h', label: '2 Hours', shortLabel: '2h', category: 'hours' },
  { value: '4h', label: '4 Hours', shortLabel: '4h', category: 'hours' },
  { value: '6h', label: '6 Hours', shortLabel: '6h', category: 'hours' },
  { value: '8h', label: '8 Hours', shortLabel: '8h', category: 'hours' },
  { value: '12h', label: '12 Hours', shortLabel: '12h', category: 'hours' },
  
  // Days
  { value: '1d', label: '1 Day', shortLabel: '1d', category: 'days' },
  { value: '3d', label: '3 Days', shortLabel: '3d', category: 'days' },
  
  // Weeks
  { value: '1w', label: '1 Week', shortLabel: '1w', category: 'weeks' },
  { value: '1M', label: '1 Month', shortLabel: '1M', category: 'weeks' },
];

const popularTimeframes = ['5m', '15m', '1h', '4h', '1d', '1w'];

const TimeframeSelector: React.FC<TimeframeSelectorProps> = ({
  selectedTimeframe,
  onTimeframeChange,
  className = ''
}) => {
  const { isMobile, isTablet } = useResponsive();
  const isCompact = isMobile || isTablet;

  const handleTimeframeClick = (timeframe: string) => {
    onTimeframeChange(timeframe);
  };

  // Mobile dropdown version
  if (isCompact) {
    return (
      <div className={`relative ${className}`}>
        <select
          value={selectedTimeframe}
          onChange={(e) => handleTimeframeClick(e.target.value)}
          className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {timeframeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        
        {/* Custom dropdown arrow */}
        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    );
  }

  // Desktop button group version
  return (
    <div className={`timeframe-selector ${className}`}>
      {/* Popular timeframes - always visible */}
      <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {popularTimeframes.map((timeframe) => {
          const option = timeframeOptions.find(opt => opt.value === timeframe);
          if (!option) return null;

          return (
            <button
              key={timeframe}
              onClick={() => handleTimeframeClick(timeframe)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-all duration-200 ${
                selectedTimeframe === timeframe
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50'
              }`}
              title={option.label}
            >
              {option.shortLabel || option.label}
            </button>
          );
        })}
      </div>

      {/* Extended timeframes dropdown */}
      <div className="relative ml-2">
        <details className="group">
          <summary className="list-none cursor-pointer">
            <button className="flex items-center justify-center w-8 h-8 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </summary>

          <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 min-w-48">
            {/* Group timeframes by category */}
            {Object.entries(
              timeframeOptions.reduce((groups, option) => {
                const category = option.category;
                if (!groups[category]) groups[category] = [];
                groups[category].push(option);
                return groups;
              }, {} as Record<string, TimeframeOption[]>)
            ).map(([category, options]) => (
              <div key={category} className="p-2">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-2">
                  {category}
                </div>
                <div className="space-y-1">
                  {options.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        handleTimeframeClick(option.value);
                        // Close the dropdown
                        document.activeElement?.blur();
                      }}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                        selectedTimeframe === option.value
                          ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{option.label}</span>
                        {selectedTimeframe === option.value && (
                          <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
};

export default TimeframeSelector;