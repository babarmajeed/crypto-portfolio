/**
 * CP-034: Mobile-First Responsive Utilities
 * 
 * TypeScript utilities for responsive behavior and mobile-first development
 */

// Breakpoint definitions matching Tailwind config
export const BREAKPOINTS = {
  xs: 320,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1400,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

// Touch target size constants
export const TOUCH_TARGETS = {
  min: 44,
  comfortable: 48,
  large: 56,
  xl: 64,
} as const;

// Mobile-first media query utilities
export const createMediaQuery = (breakpoint: Breakpoint): string => {
  return `(min-width: ${BREAKPOINTS[breakpoint]}px)`;
};

export const createMaxMediaQuery = (breakpoint: Breakpoint): string => {
  const maxWidth = BREAKPOINTS[breakpoint] - 1;
  return `(max-width: ${maxWidth}px)`;
};

// Responsive value utilities
export type ResponsiveValue<T> = {
  xs?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  xxl?: T;
};

/**
 * Get responsive value based on current screen size
 */
export const getResponsiveValue = <T>(
  values: ResponsiveValue<T>,
  currentWidth: number
): T | undefined => {
  const breakpointEntries = Object.entries(BREAKPOINTS)
    .map(([key, value]) => ({ breakpoint: key as Breakpoint, width: value }))
    .sort((a, b) => b.width - a.width);

  for (const { breakpoint } of breakpointEntries) {
    if (currentWidth >= BREAKPOINTS[breakpoint] && values[breakpoint] !== undefined) {
      return values[breakpoint];
    }
  }

  // Return the smallest defined value as fallback
  const smallestBreakpoint = breakpointEntries[breakpointEntries.length - 1];
  return values[smallestBreakpoint.breakpoint];
};

// Hook for responsive values (React)
import { useState, useEffect } from 'react';

export const useResponsiveValue = <T>(values: ResponsiveValue<T>): T | undefined => {
  const [currentValue, setCurrentValue] = useState<T | undefined>(() => {
    if (typeof window !== 'undefined') {
      return getResponsiveValue(values, window.innerWidth);
    }
    return values.xs; // Default to xs on server
  });

  useEffect(() => {
    const handleResize = () => {
      setCurrentValue(getResponsiveValue(values, window.innerWidth));
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Set initial value

    return () => window.removeEventListener('resize', handleResize);
  }, [values]);

  return currentValue;
};

// Current breakpoint detection
export const useCurrentBreakpoint = (): Breakpoint => {
  const [currentBreakpoint, setCurrentBreakpoint] = useState<Breakpoint>(() => {
    if (typeof window === 'undefined') return 'xs';
    
    const width = window.innerWidth;
    const breakpointEntries = Object.entries(BREAKPOINTS)
      .map(([key, value]) => ({ breakpoint: key as Breakpoint, width: value }))
      .sort((a, b) => b.width - a.width);

    for (const { breakpoint, width: breakpointWidth } of breakpointEntries) {
      if (width >= breakpointWidth) {
        return breakpoint;
      }
    }
    return 'xs';
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const breakpointEntries = Object.entries(BREAKPOINTS)
        .map(([key, value]) => ({ breakpoint: key as Breakpoint, width: value }))
        .sort((a, b) => b.width - a.width);

      for (const { breakpoint, width: breakpointWidth } of breakpointEntries) {
        if (width >= breakpointWidth) {
          setCurrentBreakpoint(breakpoint);
          return;
        }
      }
      setCurrentBreakpoint('xs');
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return currentBreakpoint;
};

// Media query matching hooks
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handleChange = () => setMatches(mediaQuery.matches);

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
};

export const useIsMobile = (): boolean => {
  return useMediaQuery(createMaxMediaQuery('md'));
};

export const useIsTablet = (): boolean => {
  return useMediaQuery(`${createMediaQuery('md')} and ${createMaxMediaQuery('lg')}`);
};

export const useIsDesktop = (): boolean => {
  return useMediaQuery(createMediaQuery('lg'));
};

// Device detection utilities
export const isTouchDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

export const isIOSDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

export const isAndroidDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android/.test(navigator.userAgent);
};

export const hasSafeArea = (): boolean => {
  if (typeof window === 'undefined') return false;
  return CSS.supports('padding-top: env(safe-area-inset-top)');
};

// Container query utilities
export const createContainerQuery = (minWidth: number): string => {
  return `(min-width: ${minWidth}px)`;
};

export const useContainerQuery = (
  containerRef: React.RefObject<HTMLElement>,
  minWidth: number
): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        setMatches(width >= minWidth);
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef, minWidth]);

  return matches;
};

// Responsive grid columns calculation
export const getResponsiveColumns = (
  containerWidth: number,
  minItemWidth: number,
  gap: number = 16
): number => {
  const availableWidth = containerWidth - gap;
  const columns = Math.floor(availableWidth / (minItemWidth + gap));
  return Math.max(1, columns);
};

export const useResponsiveColumns = (
  containerRef: React.RefObject<HTMLElement>,
  minItemWidth: number,
  gap: number = 16
): number => {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateColumns = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const newColumns = getResponsiveColumns(containerWidth, minItemWidth, gap);
        setColumns(newColumns);
      }
    };

    const resizeObserver = new ResizeObserver(updateColumns);
    resizeObserver.observe(containerRef.current);

    // Initial calculation
    updateColumns();

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef, minItemWidth, gap]);

  return columns;
};

// Safe area utilities
export const getSafeAreaInsets = () => {
  if (typeof window === 'undefined') {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }

  const computedStyle = getComputedStyle(document.documentElement);
  
  return {
    top: parseInt(computedStyle.getPropertyValue('--safe-area-inset-top')) || 0,
    bottom: parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom')) || 0,
    left: parseInt(computedStyle.getPropertyValue('--safe-area-inset-left')) || 0,
    right: parseInt(computedStyle.getPropertyValue('--safe-area-inset-right')) || 0,
  };
};

// Viewport size utilities
export const getViewportSize = () => {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0 };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
};

export const useViewportSize = () => {
  const [size, setSize] = useState(getViewportSize);

  useEffect(() => {
    const handleResize = () => {
      setSize(getViewportSize());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
};

// Responsive font size utilities
export const getResponsiveFontSize = (
  baseSize: number,
  scaleRatio: number = 1.2,
  breakpoint: Breakpoint = 'md'
): { mobile: string; desktop: string } => {
  const mobileSize = baseSize;
  const desktopSize = baseSize * scaleRatio;

  return {
    mobile: `${mobileSize}rem`,
    desktop: `${desktopSize}rem`,
  };
};

// CSS-in-JS responsive utilities
export const createResponsiveStyles = (styles: ResponsiveValue<React.CSSProperties>) => {
  const breakpointEntries = Object.entries(BREAKPOINTS);
  
  return breakpointEntries.reduce((acc, [breakpoint, width]) => {
    const breakpointKey = breakpoint as Breakpoint;
    const breakpointStyles = styles[breakpointKey];
    
    if (breakpointStyles) {
      if (breakpoint === 'xs') {
        // Base styles for xs
        Object.assign(acc, breakpointStyles);
      } else {
        // Media query styles for larger breakpoints
        const mediaQuery = `@media ${createMediaQuery(breakpointKey)}`;
        acc[mediaQuery] = breakpointStyles;
      }
    }
    
    return acc;
  }, {} as any);
};

// Touch feedback utilities
export const addTouchFeedback = (element: HTMLElement) => {
  const handleTouchStart = () => {
    element.style.transform = 'scale(0.98)';
    element.style.transition = 'transform 0.1s ease';
  };

  const handleTouchEnd = () => {
    element.style.transform = 'scale(1)';
  };

  element.addEventListener('touchstart', handleTouchStart, { passive: true });
  element.addEventListener('touchend', handleTouchEnd, { passive: true });
  element.addEventListener('touchcancel', handleTouchEnd, { passive: true });

  return () => {
    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchend', handleTouchEnd);
    element.removeEventListener('touchcancel', handleTouchEnd);
  };
};

// Accessibility utilities for mobile
export const ensureMinimumTouchTarget = (size: number): number => {
  return Math.max(size, TOUCH_TARGETS.min);
};

export const formatResponsiveClassName = (
  base: string,
  responsive: ResponsiveValue<string>
): string => {
  const classes = [base];
  
  Object.entries(responsive).forEach(([breakpoint, value]) => {
    if (value) {
      const prefix = breakpoint === 'xs' ? '' : `${breakpoint}:`;
      classes.push(`${prefix}${value}`);
    }
  });
  
  return classes.join(' ');
};

// Performance optimization utilities
export const debounceResize = (callback: () => void, delay: number = 150) => {
  let timeoutId: NodeJS.Timeout;
  
  return () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(callback, delay);
  };
};

export const throttleResize = (callback: () => void, delay: number = 150) => {
  let isThrottled = false;
  
  return () => {
    if (!isThrottled) {
      callback();
      isThrottled = true;
      setTimeout(() => {
        isThrottled = false;
      }, delay);
    }
  };
};