import { useState, useEffect, useCallback } from 'react';

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
export type Orientation = 'portrait' | 'landscape';

export interface ScreenSize {
  width: number;
  height: number;
}

export interface ResponsiveState {
  screenSize: ScreenSize;
  breakpoint: Breakpoint;
  orientation: Orientation;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isSmallMobile: boolean;
  isLargeMobile: boolean;
  isPortrait: boolean;
  isLandscape: boolean;
  isTouchDevice: boolean;
  supportsHover: boolean;
  pixelRatio: number;
}

const BREAKPOINTS = {
  xs: 320,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1400,
} as const;

const DEBOUNCE_DELAY = 150; // ms

// Utility function to get current breakpoint
const getBreakpoint = (width: number): Breakpoint => {
  if (width < BREAKPOINTS.sm) return 'xs';
  if (width < BREAKPOINTS.md) return 'sm';
  if (width < BREAKPOINTS.lg) return 'md';
  if (width < BREAKPOINTS.xl) return 'lg';
  if (width < BREAKPOINTS.xxl) return 'xl';
  return 'xxl';
};

// Utility function to detect touch capability
const detectTouchDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-ignore - Legacy IE support
    navigator.msMaxTouchPoints > 0
  );
};

// Utility function to detect hover capability
const detectHoverSupport = (): boolean => {
  if (typeof window === 'undefined') return true;
  
  return window.matchMedia('(hover: hover)').matches;
};

// Debounce utility for resize events
const debounce = <T extends (...args: any[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void => {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * Custom hook for responsive design and device detection
 * Provides comprehensive information about screen size, device type, and capabilities
 */
export const useResponsive = (): ResponsiveState => {
  const getInitialState = useCallback((): ResponsiveState => {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const height = typeof window !== 'undefined' ? window.innerHeight : 800;
    const breakpoint = getBreakpoint(width);
    const orientation: Orientation = width > height ? 'landscape' : 'portrait';
    const isTouchDevice = detectTouchDevice();
    const supportsHover = detectHoverSupport();
    const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    return {
      screenSize: { width, height },
      breakpoint,
      orientation,
      isMobile: width < BREAKPOINTS.md,
      isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
      isDesktop: width >= BREAKPOINTS.lg,
      isSmallMobile: width < BREAKPOINTS.sm,
      isLargeMobile: width >= BREAKPOINTS.sm && width < BREAKPOINTS.md,
      isPortrait: orientation === 'portrait',
      isLandscape: orientation === 'landscape',
      isTouchDevice,
      supportsHover,
      pixelRatio,
    };
  }, []);

  const [state, setState] = useState<ResponsiveState>(getInitialState);

  // Handle resize events with debouncing
  const handleResize = useCallback(
    debounce(() => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const breakpoint = getBreakpoint(width);
      const orientation: Orientation = width > height ? 'landscape' : 'portrait';

      setState(prevState => ({
        ...prevState,
        screenSize: { width, height },
        breakpoint,
        orientation,
        isMobile: width < BREAKPOINTS.md,
        isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
        isDesktop: width >= BREAKPOINTS.lg,
        isSmallMobile: width < BREAKPOINTS.sm,
        isLargeMobile: width >= BREAKPOINTS.sm && width < BREAKPOINTS.md,
        isPortrait: orientation === 'portrait',
        isLandscape: orientation === 'landscape',
      }));
    }, DEBOUNCE_DELAY),
    []
  );

  // Handle orientation change events
  const handleOrientationChange = useCallback(() => {
    // Small delay to ensure window dimensions are updated
    setTimeout(handleResize, 100);
  }, [handleResize]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Add event listeners
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [handleResize, handleOrientationChange]);

  return state;
};

/**
 * Hook for media query matching
 * Provides a way to match CSS media queries in JavaScript
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQueryList = window.matchMedia(query);
    const handleChange = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };

    // Modern browsers
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', handleChange);
      return () => mediaQueryList.removeEventListener('change', handleChange);
    }
    // Legacy browsers
    else {
      // @ts-ignore - Legacy support
      mediaQueryList.addListener(handleChange);
      // @ts-ignore - Legacy support
      return () => mediaQueryList.removeListener(handleChange);
    }
  }, [query]);

  return matches;
};

/**
 * Hook for breakpoint-specific values
 * Returns different values based on current breakpoint
 */
export const useBreakpointValue = <T>(values: Partial<Record<Breakpoint, T>>): T | undefined => {
  const { breakpoint } = useResponsive();
  
  // Try to find exact match first
  if (values[breakpoint] !== undefined) {
    return values[breakpoint];
  }
  
  // Fallback to largest available breakpoint that's smaller or equal
  const breakpointOrder: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'];
  const currentIndex = breakpointOrder.indexOf(breakpoint);
  
  for (let i = currentIndex; i >= 0; i--) {
    const bp = breakpointOrder[i];
    if (values[bp] !== undefined) {
      return values[bp];
    }
  }
  
  return undefined;
};

/**
 * Hook for responsive container sizing
 * Returns appropriate container classes based on screen size
 */
export const useResponsiveContainer = (): string => {
  const { breakpoint } = useResponsive();
  
  const containerClasses = {
    xs: 'w-full px-4',
    sm: 'w-full px-4',
    md: 'w-full px-6 max-w-3xl mx-auto',
    lg: 'w-full px-8 max-w-5xl mx-auto',
    xl: 'w-full px-8 max-w-6xl mx-auto',
    xxl: 'w-full px-8 max-w-7xl mx-auto',
  };
  
  return containerClasses[breakpoint];
};

/**
 * Hook for responsive grid columns
 * Returns appropriate grid column count based on screen size
 */
export const useResponsiveColumns = (
  config: Partial<Record<Breakpoint, number>> = {}
): number => {
  const defaultConfig: Record<Breakpoint, number> = {
    xs: 1,
    sm: 2,
    md: 2,
    lg: 3,
    xl: 4,
    xxl: 4,
  };
  
  const mergedConfig = { ...defaultConfig, ...config };
  const { breakpoint } = useResponsive();
  
  return mergedConfig[breakpoint];
};

// Export utility functions for external use
export { BREAKPOINTS, getBreakpoint, detectTouchDevice, detectHoverSupport };

export default useResponsive;