import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTouchGestures } from '../../hooks/useTouchGestures';
import { useTouchChart } from './TouchChartProvider';
import { Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

interface TimePeriod {
  id: string;
  label: string;
  shortLabel: string;
  duration: number; // in milliseconds
  description: string;
}

interface GesturePeriodSelectorProps {
  onPeriodChange?: (period: TimePeriod) => void;
  onCustomRangeSelect?: (start: Date, end: Date) => void;
  currentPeriod?: TimePeriod;
  availablePeriods?: TimePeriod[];
  showCustomRange?: boolean;
  maxDate?: Date;
  minDate?: Date;
  className?: string;
  compact?: boolean;
}

const DEFAULT_PERIODS: TimePeriod[] = [
  { id: '1h', label: '1 Hour', shortLabel: '1H', duration: 60 * 60 * 1000, description: 'Last 1 hour' },
  { id: '4h', label: '4 Hours', shortLabel: '4H', duration: 4 * 60 * 60 * 1000, description: 'Last 4 hours' },
  { id: '1d', label: '1 Day', shortLabel: '1D', duration: 24 * 60 * 60 * 1000, description: 'Last 24 hours' },
  { id: '3d', label: '3 Days', shortLabel: '3D', duration: 3 * 24 * 60 * 60 * 1000, description: 'Last 3 days' },
  { id: '1w', label: '1 Week', shortLabel: '1W', duration: 7 * 24 * 60 * 60 * 1000, description: 'Last week' },
  { id: '1m', label: '1 Month', shortLabel: '1M', duration: 30 * 24 * 60 * 60 * 1000, description: 'Last month' },
  { id: '3m', label: '3 Months', shortLabel: '3M', duration: 90 * 24 * 60 * 60 * 1000, description: 'Last 3 months' },
  { id: '6m', label: '6 Months', shortLabel: '6M', duration: 180 * 24 * 60 * 60 * 1000, description: 'Last 6 months' },
  { id: '1y', label: '1 Year', shortLabel: '1Y', duration: 365 * 24 * 60 * 60 * 1000, description: 'Last year' },
  { id: 'all', label: 'All Time', shortLabel: 'ALL', duration: Infinity, description: 'All available data' }
];

export const GesturePeriodSelector: React.FC<GesturePeriodSelectorProps> = ({
  onPeriodChange,
  onCustomRangeSelect,
  currentPeriod,
  availablePeriods = DEFAULT_PERIODS,
  showCustomRange = true,
  maxDate = new Date(),
  minDate = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000), // 5 years ago
  className = '',
  compact = false
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>(
    currentPeriod || availablePeriods.find(p => p.id === '1d') || availablePeriods[0]
  );
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [swipeStartIndex, setSwipeStartIndex] = useState(0);
  
  const selectorRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const { setTimeRange } = useTouchChart();

  // Update selected period when current period changes
  useEffect(() => {
    if (currentPeriod) {
      setSelectedPeriod(currentPeriod);
    }
  }, [currentPeriod]);

  // Calculate time range for selected period
  const calculateTimeRange = useCallback((period: TimePeriod): { start: Date; end: Date } => {
    const end = new Date(Math.min(maxDate.getTime(), Date.now()));
    let start: Date;
    
    if (period.duration === Infinity) {
      start = new Date(minDate);
    } else {
      start = new Date(end.getTime() - period.duration);
      start = new Date(Math.max(minDate.getTime(), start.getTime()));
    }
    
    return { start, end };
  }, [maxDate, minDate]);

  // Handle period selection
  const handlePeriodSelect = useCallback((period: TimePeriod) => {
    setSelectedPeriod(period);
    const timeRange = calculateTimeRange(period);
    setTimeRange(timeRange);
    onPeriodChange?.(period);
  }, [calculateTimeRange, setTimeRange, onPeriodChange]);

  // Handle custom range selection
  const handleCustomRangeApply = useCallback(() => {
    if (!customStartDate || !customEndDate) return;
    
    const start = new Date(customStartDate);
    const end = new Date(customEndDate);
    
    if (start > end) return;
    
    // Clamp to available date range
    const clampedStart = new Date(Math.max(minDate.getTime(), start.getTime()));
    const clampedEnd = new Date(Math.min(maxDate.getTime(), end.getTime()));
    
    setTimeRange({ start: clampedStart, end: clampedEnd });
    onCustomRangeSelect?.(clampedStart, clampedEnd);
    setShowCustomPicker(false);
    
    // Create a custom period for display
    const customPeriod: TimePeriod = {
      id: 'custom',
      label: 'Custom Range',
      shortLabel: 'CUSTOM',
      duration: clampedEnd.getTime() - clampedStart.getTime(),
      description: `${clampedStart.toLocaleDateString()} - ${clampedEnd.toLocaleDateString()}`
    };
    setSelectedPeriod(customPeriod);
  }, [customStartDate, customEndDate, minDate, maxDate, setTimeRange, onCustomRangeSelect]);

  // Swipe gesture handling for period navigation
  const { bindGestures } = useTouchGestures({
    onSwipe: ({ direction }) => {
      const currentIndex = availablePeriods.findIndex(p => p.id === selectedPeriod.id);
      let newIndex = currentIndex;
      
      if (direction === 'left' && currentIndex < availablePeriods.length - 1) {
        newIndex = currentIndex + 1;
      } else if (direction === 'right' && currentIndex > 0) {
        newIndex = currentIndex - 1;
      }
      
      if (newIndex !== currentIndex) {
        handlePeriodSelect(availablePeriods[newIndex]);
      }
    },
    onPanStart: ({ x }) => {
      setIsDragging(true);
      const currentIndex = availablePeriods.findIndex(p => p.id === selectedPeriod.id);
      setSwipeStartIndex(currentIndex);
    },
    onPanEnd: ({ velocity }) => {
      setIsDragging(false);
      
      // Quick swipe detection
      if (Math.abs(velocity.x) > 0.5) {
        const currentIndex = availablePeriods.findIndex(p => p.id === selectedPeriod.id);
        let newIndex = currentIndex;
        
        if (velocity.x < 0 && currentIndex < availablePeriods.length - 1) {
          newIndex = currentIndex + 1;
        } else if (velocity.x > 0 && currentIndex > 0) {
          newIndex = currentIndex - 1;
        }
        
        if (newIndex !== currentIndex) {
          handlePeriodSelect(availablePeriods[newIndex]);
        }
      }
    },
    swipeThreshold: 30,
    enabled: true
  });

  // Navigate to previous period
  const navigatePrevious = useCallback(() => {
    const currentIndex = availablePeriods.findIndex(p => p.id === selectedPeriod.id);
    if (currentIndex > 0) {
      handlePeriodSelect(availablePeriods[currentIndex - 1]);
    }
  }, [selectedPeriod.id, availablePeriods, handlePeriodSelect]);

  // Navigate to next period
  const navigateNext = useCallback(() => {
    const currentIndex = availablePeriods.findIndex(p => p.id === selectedPeriod.id);
    if (currentIndex < availablePeriods.length - 1) {
      handlePeriodSelect(availablePeriods[currentIndex + 1]);
    }
  }, [selectedPeriod.id, availablePeriods, handlePeriodSelect]);

  // Quick access periods for mobile
  const quickAccessPeriods = useMemo(() => {
    const mobile = ['1h', '1d', '1w', '1m', '1y'];
    return availablePeriods.filter(p => mobile.includes(p.id));
  }, [availablePeriods]);

  // Format date for input
  const formatDateForInput = useCallback((date: Date): string => {
    return date.toISOString().split('T')[0];
  }, []);

  // Initialize custom date inputs
  useEffect(() => {
    const { start, end } = calculateTimeRange(selectedPeriod);
    setCustomStartDate(formatDateForInput(start));
    setCustomEndDate(formatDateForInput(end));
  }, [selectedPeriod, calculateTimeRange, formatDateForInput]);

  if (compact) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        {/* Navigation arrows */}
        <button
          onClick={navigatePrevious}
          className="p-1 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={availablePeriods.findIndex(p => p.id === selectedPeriod.id) === 0}
          aria-label="Previous time period"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Current period display */}
        <div 
          className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm font-medium min-w-[60px] text-center cursor-pointer"
          {...bindGestures()}
          title={selectedPeriod.description}
        >
          {selectedPeriod.shortLabel}
        </div>

        <button
          onClick={navigateNext}
          className="p-1 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={availablePeriods.findIndex(p => p.id === selectedPeriod.id) === availablePeriods.length - 1}
          aria-label="Next time period"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Mobile Quick Access */}
      <div className="sm:hidden">
        <div className="flex flex-wrap gap-2 mb-3">
          {quickAccessPeriods.map((period) => (
            <button
              key={period.id}
              onClick={() => handlePeriodSelect(period)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPeriod.id === period.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              aria-label={period.description}
            >
              {period.shortLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop/Tablet Full Selector */}
      <div className="hidden sm:block">
        <div 
          ref={scrollContainerRef}
          className={`flex items-center space-x-2 overflow-x-auto scrollbar-hide pb-2 ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          {...bindGestures()}
        >
          {availablePeriods.map((period) => (
            <button
              key={period.id}
              onClick={() => handlePeriodSelect(period)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPeriod.id === period.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              aria-label={period.description}
              title={period.description}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Range Selector */}
      {showCustomRange && (
        <div className="mt-3">
          <button
            onClick={() => setShowCustomPicker(!showCustomPicker)}
            className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <Calendar className="w-4 h-4" />
            <span>Custom Range</span>
          </button>

          {showCustomPicker && (
            <div className="mt-2 p-4 bg-gray-50 rounded-lg border">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="start-date" className="block text-xs font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    id="start-date"
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    min={formatDateForInput(minDate)}
                    max={formatDateForInput(maxDate)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="end-date" className="block text-xs font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    id="end-date"
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    min={customStartDate || formatDateForInput(minDate)}
                    max={formatDateForInput(maxDate)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => setShowCustomPicker(false)}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCustomRangeApply}
                  disabled={!customStartDate || !customEndDate || new Date(customStartDate) > new Date(customEndDate)}
                  className="px-4 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Current Selection Info */}
      <div className="mt-3 text-xs text-gray-500 flex items-center space-x-2">
        <Clock className="w-3 h-3" />
        <span>{selectedPeriod.description}</span>
        {isDragging && (
          <span className="text-blue-600 font-medium">Swipe to change period</span>
        )}
      </div>

      {/* Touch Instructions */}
      {'ontouchstart' in window && (
        <div className="mt-2 text-xs text-gray-400">
          Swipe left/right to navigate periods
        </div>
      )}
    </div>
  );
};
