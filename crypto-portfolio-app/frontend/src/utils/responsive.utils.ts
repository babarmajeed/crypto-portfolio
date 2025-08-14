// Utility functions for responsive design and touch interactions

import { 
  Breakpoint, 
  DeviceInfo, 
  ScreenSize, 
  DEFAULT_BREAKPOINTS, 
  DEVICE_THRESHOLDS,
  TouchPoint,
  SwipeDirection,
  ResponsiveError
} from '../types/responsive.types';

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(this: any, ...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    };
    
    const callNow = immediate && !timeout;
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func.apply(this, args);
  };
}

/**
 * Throttle function for high-frequency events
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Get current screen size information
 */
export function getScreenSize(): ScreenSize {
  const screen = window.screen;
  const pixelRatio = window.devicePixelRatio || 1;
  
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    pixelRatio
  };
}

/**
 * Detect device information
 */
export function getDeviceInfo(): DeviceInfo {
  const userAgent = navigator.userAgent.toLowerCase();
  const screen = getScreenSize();
  
  // Detect device type
  const isMobile = screen.width <= DEVICE_THRESHOLDS.MOBILE_MAX_WIDTH;
  const isTablet = screen.width > DEVICE_THRESHOLDS.MOBILE_MAX_WIDTH && 
                   screen.width <= DEVICE_THRESHOLDS.TABLET_MAX_WIDTH;
  
  let deviceType: DeviceInfo['type'] = 'desktop';
  if (isMobile) deviceType = 'mobile';
  else if (isTablet) deviceType = 'tablet';
  
  // Detect orientation
  const orientation = screen.width > screen.height ? 'landscape' : 'portrait';
  
  // Detect touch capability
  const isTouchDevice = 'ontouchstart' in window || 
                       navigator.maxTouchPoints > 0 ||
                       (navigator as any).msMaxTouchPoints > 0;
  
  // Detect retina display
  const isRetina = screen.pixelRatio >= DEVICE_THRESHOLDS.RETINA_MIN_RATIO;
  
  // Detect Safari notch (iPhone X and newer)
  const hasSafariNotch = 'CSS' in window && 
                        CSS.supports('padding-top', 'env(safe-area-inset-top)') &&
                        /iphone|ipod|ipad/i.test(userAgent);
  
  // Detect hover capability
  const hasHover = window.matchMedia('(hover: hover)').matches;
  
  // Detect platform
  let platform = 'unknown';
  if (/android/i.test(userAgent)) platform = 'android';
  else if (/iphone|ipad|ipod/i.test(userAgent)) platform = 'ios';
  else if (/windows/i.test(userAgent)) platform = 'windows';
  else if (/mac/i.test(userAgent)) platform = 'mac';
  else if (/linux/i.test(userAgent)) platform = 'linux';
  
  return {
    type: deviceType,
    orientation,
    isTouchDevice,
    isRetina,
    hasSafariNotch,
    hasHover,
    platform,
    userAgent: navigator.userAgent
  };
}

/**
 * Find the current breakpoint based on screen width
 */
export function getCurrentBreakpoint(
  width: number = window.innerWidth,
  breakpoints: Breakpoint[] = DEFAULT_BREAKPOINTS
): Breakpoint {
  const sortedBreakpoints = [...breakpoints].sort((a, b) => a.min - b.min);
  
  for (const breakpoint of sortedBreakpoints) {
    if (width >= breakpoint.min && (!breakpoint.max || width <= breakpoint.max)) {
      return breakpoint;
    }
  }
  
  // Return the largest breakpoint if no match found
  return sortedBreakpoints[sortedBreakpoints.length - 1];
}

/**
 * Check if current width matches a breakpoint
 */
export function isBreakpoint(
  breakpointName: string,
  width: number = window.innerWidth,
  breakpoints: Breakpoint[] = DEFAULT_BREAKPOINTS
): boolean {
  const breakpoint = breakpoints.find(bp => bp.name === breakpointName);
  if (!breakpoint) {
    console.warn(`Breakpoint "${breakpointName}" not found`);
    return false;
  }
  
  return width >= breakpoint.min && (!breakpoint.max || width <= breakpoint.max);
}

/**
 * Check if current width is at least the specified breakpoint
 */
export function isAtLeastBreakpoint(
  breakpointName: string,
  width: number = window.innerWidth,
  breakpoints: Breakpoint[] = DEFAULT_BREAKPOINTS
): boolean {
  const breakpoint = breakpoints.find(bp => bp.name === breakpointName);
  if (!breakpoint) {
    console.warn(`Breakpoint "${breakpointName}" not found`);
    return false;
  }
  
  return width >= breakpoint.min;
}

/**
 * Check if current width is at most the specified breakpoint
 */
export function isAtMostBreakpoint(
  breakpointName: string,
  width: number = window.innerWidth,
  breakpoints: Breakpoint[] = DEFAULT_BREAKPOINTS
): boolean {
  const breakpoint = breakpoints.find(bp => bp.name === breakpointName);
  if (!breakpoint) {
    console.warn(`Breakpoint "${breakpointName}" not found`);
    return false;
  }
  
  return !breakpoint.max || width <= breakpoint.max;
}

/**
 * Check if a media query matches
 */
export function matchesMediaQuery(query: string): boolean {
  try {
    return window.matchMedia(query).matches;
  } catch (error) {
    console.warn('Invalid media query:', query);
    return false;
  }
}

/**
 * Convert touch list to array of touch points
 */
export function touchListToArray(touchList: TouchList): TouchPoint[] {
  const touches: TouchPoint[] = [];
  
  for (let i = 0; i < touchList.length; i++) {
    const touch = touchList[i];
    touches.push({
      identifier: touch.identifier,
      clientX: touch.clientX,
      clientY: touch.clientY,
      pageX: touch.pageX,
      pageY: touch.pageY,
      screenX: touch.screenX,
      screenY: touch.screenY,
      radiusX: (touch as any).radiusX,
      radiusY: (touch as any).radiusY,
      rotationAngle: (touch as any).rotationAngle,
      force: (touch as any).force
    });
  }
  
  return touches;
}

/**
 * Calculate distance between two points
 */
export function calculateDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

/**
 * Calculate velocity between two points over time
 */
export function calculateVelocity(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  time: number
): number {
  if (time === 0) return 0;
  const distance = calculateDistance(startX, startY, endX, endY);
  return distance / time;
}

/**
 * Determine swipe direction based on deltas
 */
export function getSwipeDirection(
  deltaX: number,
  deltaY: number,
  threshold: number = 30
): SwipeDirection | null {
  const absDeltaX = Math.abs(deltaX);
  const absDeltaY = Math.abs(deltaY);
  
  if (Math.max(absDeltaX, absDeltaY) < threshold) {
    return null;
  }
  
  if (absDeltaX > absDeltaY) {
    return deltaX > 0 ? 'right' : 'left';
  } else {
    return deltaY > 0 ? 'down' : 'up';
  }
}

/**
 * Calculate pinch scale from two touch points
 */
export function calculatePinchScale(
  touches1: TouchPoint[],
  touches2: TouchPoint[]
): number {
  if (touches1.length < 2 || touches2.length < 2) {
    return 1;
  }
  
  const distance1 = calculateDistance(
    touches1[0].clientX,
    touches1[0].clientY,
    touches1[1].clientX,
    touches1[1].clientY
  );
  
  const distance2 = calculateDistance(
    touches2[0].clientX,
    touches2[0].clientY,
    touches2[1].clientX,
    touches2[1].clientY
  );
  
  return distance2 / distance1;
}

/**
 * Calculate center point of multiple touches
 */
export function calculateTouchCenter(touches: TouchPoint[]): { x: number; y: number } {
  if (touches.length === 0) {
    return { x: 0, y: 0 };
  }
  
  const sum = touches.reduce(
    (acc, touch) => ({
      x: acc.x + touch.clientX,
      y: acc.y + touch.clientY
    }),
    { x: 0, y: 0 }
  );
  
  return {
    x: sum.x / touches.length,
    y: sum.y / touches.length
  };
}

/**
 * Check if touch events are supported
 */
export function isTouchSupported(): boolean {
  return 'ontouchstart' in window || 
         navigator.maxTouchPoints > 0 ||
         (navigator as any).msMaxTouchPoints > 0;
}

/**
 * Check if gesture events are supported
 */
export function isGestureSupported(): boolean {
  return 'ongesturestart' in window;
}

/**
 * Check if a specific CSS feature is supported
 */
export function isCSSFeatureSupported(property: string, value: string): boolean {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') {
    return false;
  }
  
  try {
    return CSS.supports(property, value);
  } catch (error) {
    return false;
  }
}

/**
 * Safe feature detection with error handling
 */
export function detectFeatureSupport(feature: string): boolean {
  try {
    switch (feature) {
      case 'touch':
        return isTouchSupported();
      case 'gesture':
        return isGestureSupported();
      case 'devicePixelRatio':
        return typeof window.devicePixelRatio === 'number';
      case 'matchMedia':
        return typeof window.matchMedia === 'function';
      case 'orientation':
        return 'orientation' in window || 'orientation' in screen;
      case 'deviceMotion':
        return 'DeviceMotionEvent' in window;
      case 'deviceOrientation':
        return 'DeviceOrientationEvent' in window;
      case 'vibration':
        return 'vibrate' in navigator;
      case 'fullscreen':
        return 'requestFullscreen' in document.documentElement ||
               'webkitRequestFullscreen' in document.documentElement ||
               'mozRequestFullScreen' in document.documentElement ||
               'msRequestFullscreen' in document.documentElement;
      default:
        console.warn(`Unknown feature: ${feature}`);
        return false;
    }
  } catch (error) {
    console.error(`Error detecting feature support for ${feature}:`, error);
    return false;
  }
}

/**
 * Create a responsive error with additional context
 */
export function createResponsiveError(
  code: ResponsiveError['code'],
  message: string,
  feature?: string,
  details?: Record<string, any>
): ResponsiveError {
  const error = new Error(message) as ResponsiveError;
  error.name = 'ResponsiveError';
  error.code = code;
  error.feature = feature;
  error.details = details;
  return error;
}

/**
 * Validate breakpoints configuration
 */
export function validateBreakpoints(breakpoints: Breakpoint[]): boolean {
  if (!Array.isArray(breakpoints) || breakpoints.length === 0) {
    return false;
  }
  
  for (let i = 0; i < breakpoints.length; i++) {
    const bp = breakpoints[i];
    
    if (!bp.name || typeof bp.min !== 'number' || bp.min < 0) {
      return false;
    }
    
    if (bp.max !== undefined && (typeof bp.max !== 'number' || bp.max < bp.min)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get safe area insets for devices with notches
 */
export function getSafeAreaInsets(): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const defaults = { top: 0, right: 0, bottom: 0, left: 0 };
  
  if (!isCSSFeatureSupported('padding-top', 'env(safe-area-inset-top)')) {
    return defaults;
  }
  
  try {
    const computedStyle = getComputedStyle(document.documentElement);
    
    return {
      top: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-top)')) || 0,
      right: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-right)')) || 0,
      bottom: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-bottom)')) || 0,
      left: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-left)')) || 0
    };
  } catch (error) {
    return defaults;
  }
}