// Responsive design type definitions for mobile and touch interactions

export interface Breakpoint {
  name: string;
  min: number;
  max?: number;
}

export interface ScreenSize {
  width: number;
  height: number;
  availWidth: number;
  availHeight: number;
  pixelRatio: number;
}

export interface DeviceInfo {
  type: 'mobile' | 'tablet' | 'desktop';
  orientation: 'portrait' | 'landscape';
  isTouchDevice: boolean;
  isRetina: boolean;
  hasSafariNotch: boolean;
  hasHover: boolean;
  platform: string;
  userAgent: string;
}

export interface ResponsiveState {
  screenSize: ScreenSize;
  deviceInfo: DeviceInfo;
  breakpoint: Breakpoint;
  isDesktop: boolean;
  isTablet: boolean;
  isMobile: boolean;
  isPortrait: boolean;
  isLandscape: boolean;
}

export interface UseResponsiveReturn extends ResponsiveState {
  matches: (query: string) => boolean;
  isBreakpoint: (breakpointName: string) => boolean;
  isAtLeast: (breakpointName: string) => boolean;
  isAtMost: (breakpointName: string) => boolean;
  refresh: () => void;
}

export interface TouchPoint {
  identifier: number;
  clientX: number;
  clientY: number;
  pageX: number;
  pageY: number;
  screenX: number;
  screenY: number;
  radiusX?: number;
  radiusY?: number;
  rotationAngle?: number;
  force?: number;
}

export interface TouchEvent extends Event {
  touches: TouchList;
  changedTouches: TouchList;
  targetTouches: TouchList;
}

export interface TapEvent {
  type: 'tap' | 'doubletap';
  target: EventTarget | null;
  clientX: number;
  clientY: number;
  timestamp: number;
  duration: number;
}

export interface PinchEvent {
  type: 'pinchstart' | 'pinchchange' | 'pinchend';
  scale: number;
  deltaScale: number;
  centerX: number;
  centerY: number;
  touches: TouchPoint[];
}

export interface GestureEvent {
  type: 'gesturestart' | 'gesturechange' | 'gestureend';
  scale: number;
  rotation: number;
  target: EventTarget | null;
}

export interface TouchHookOptions {
  onTap?: (event: TapEvent) => void;
  onDoubleTap?: (event: TapEvent) => void;
  onPinchStart?: (event: PinchEvent) => void;
  onPinchChange?: (event: PinchEvent) => void;
  onPinchEnd?: (event: PinchEvent) => void;
  onGestureStart?: (event: GestureEvent) => void;
  onGestureChange?: (event: GestureEvent) => void;
  onGestureEnd?: (event: GestureEvent) => void;
  doubleTapDelay?: number;
  tapThreshold?: number;
  pinchThreshold?: number;
  preventDefaultTouches?: boolean;
  preventDefaultGestures?: boolean;
  disabled?: boolean;
}

export interface UseTouchReturn {
  isSupported: boolean;
  isActive: boolean;
  currentTouches: TouchPoint[];
  lastTap: TapEvent | null;
  lastPinch: PinchEvent | null;
  bind: () => {
    onTouchStart: (event: TouchEvent) => void;
    onTouchMove: (event: TouchEvent) => void;
    onTouchEnd: (event: TouchEvent) => void;
    onTouchCancel: (event: TouchEvent) => void;
  };
}

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

export interface SwipeEvent {
  type: 'swipestart' | 'swipechange' | 'swipeend' | 'swipecancel';
  direction: SwipeDirection;
  distance: number;
  deltaX: number;
  deltaY: number;
  velocity: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration: number;
  target: EventTarget | null;
}

export interface SwipeHookOptions {
  onSwipeStart?: (event: SwipeEvent) => void;
  onSwipeChange?: (event: SwipeEvent) => void;
  onSwipeEnd?: (event: SwipeEvent) => void;
  onSwipeCancel?: (event: SwipeEvent) => void;
  onSwipeLeft?: (event: SwipeEvent) => void;
  onSwipeRight?: (event: SwipeEvent) => void;
  onSwipeUp?: (event: SwipeEvent) => void;
  onSwipeDown?: (event: SwipeEvent) => void;
  minDistance?: number;
  maxDistance?: number;
  minVelocity?: number;
  maxTime?: number;
  threshold?: number;
  preventDefault?: boolean;
  disabled?: boolean;
}

export interface UseSwipeReturn {
  isSupported: boolean;
  isActive: boolean;
  currentSwipe: SwipeEvent | null;
  bind: () => {
    onTouchStart: (event: TouchEvent) => void;
    onTouchMove: (event: TouchEvent) => void;
    onTouchEnd: (event: TouchEvent) => void;
    onTouchCancel: (event: TouchEvent) => void;
    onMouseDown: (event: MouseEvent) => void;
    onMouseMove: (event: MouseEvent) => void;
    onMouseUp: (event: MouseEvent) => void;
  };
}

export interface ResponsiveHookOptions {
  breakpoints?: Breakpoint[];
  debounceDelay?: number;
  enableOrientationChange?: boolean;
  enableVisibilityChange?: boolean;
  enableDeviceMotion?: boolean;
}

// Default breakpoints following popular CSS framework conventions
export const DEFAULT_BREAKPOINTS: Breakpoint[] = [
  { name: 'xs', min: 0, max: 575 },
  { name: 'sm', min: 576, max: 767 },
  { name: 'md', min: 768, max: 991 },
  { name: 'lg', min: 992, max: 1199 },
  { name: 'xl', min: 1200, max: 1399 },
  { name: 'xxl', min: 1400 }
];

// Touch event constants
export const TOUCH_EVENTS = {
  TAP_THRESHOLD: 10, // pixels
  DOUBLE_TAP_DELAY: 300, // milliseconds
  PINCH_THRESHOLD: 0.1, // scale difference
  SWIPE_MIN_DISTANCE: 30, // pixels
  SWIPE_MAX_TIME: 1000, // milliseconds
  SWIPE_MIN_VELOCITY: 0.3 // pixels per millisecond
} as const;

// Device type detection thresholds
export const DEVICE_THRESHOLDS = {
  MOBILE_MAX_WIDTH: 767,
  TABLET_MAX_WIDTH: 1024,
  RETINA_MIN_RATIO: 1.5
} as const;

// Error types
export interface ResponsiveError extends Error {
  code: 'UNSUPPORTED_FEATURE' | 'INVALID_BREAKPOINT' | 'TOUCH_NOT_SUPPORTED' | 'GESTURE_NOT_SUPPORTED';
  feature?: string;
  details?: Record<string, any>;
}

export class TouchNotSupportedError extends Error implements ResponsiveError {
  code: 'TOUCH_NOT_SUPPORTED' = 'TOUCH_NOT_SUPPORTED';
  constructor(message = 'Touch events are not supported on this device') {
    super(message);
    this.name = 'TouchNotSupportedError';
  }
}

export class GestureNotSupportedError extends Error implements ResponsiveError {
  code: 'GESTURE_NOT_SUPPORTED' = 'GESTURE_NOT_SUPPORTED';
  constructor(message = 'Gesture events are not supported on this browser') {
    super(message);
    this.name = 'GestureNotSupportedError';
  }
}

export class UnsupportedFeatureError extends Error implements ResponsiveError {
  code: 'UNSUPPORTED_FEATURE' = 'UNSUPPORTED_FEATURE';
  feature?: string;
  
  constructor(feature: string, message?: string) {
    super(message || `Feature "${feature}" is not supported`);
    this.name = 'UnsupportedFeatureError';
    this.feature = feature;
  }
}