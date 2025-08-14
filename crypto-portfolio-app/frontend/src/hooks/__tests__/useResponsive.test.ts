import { renderHook, act } from '@testing-library/react';
import { useResponsive } from '../useResponsive';
import { DEFAULT_BREAKPOINTS } from '../../types/responsive.types';
import * as responsiveUtils from '../../utils/responsive.utils';

// Mock the utility functions
jest.mock('../../utils/responsive.utils', () => ({
  debounce: jest.fn((fn) => fn),
  getScreenSize: jest.fn(),
  getDeviceInfo: jest.fn(),
  getCurrentBreakpoint: jest.fn(),
  isBreakpoint: jest.fn(),
  isAtLeastBreakpoint: jest.fn(),
  isAtMostBreakpoint: jest.fn(),
  matchesMediaQuery: jest.fn(),
  detectFeatureSupport: jest.fn(),
  createResponsiveError: jest.fn(),
  validateBreakpoints: jest.fn()
}));

// Mock window methods
const mockMatchMedia = jest.fn();
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();

const mockScreenSize = {
  width: 1024,
  height: 768,
  availWidth: 1024,
  availHeight: 768,
  pixelRatio: 1
};

const mockDeviceInfo = {
  type: 'desktop' as const,
  orientation: 'landscape' as const,
  isTouchDevice: false,
  isRetina: false,
  hasSafariNotch: false,
  hasHover: true,
  platform: 'unknown',
  userAgent: 'test-agent'
};

const mockBreakpoint = {
  name: 'lg',
  min: 992,
  max: 1199
};

beforeEach(() => {
  // Reset all mocks
  jest.clearAllMocks();
  
  // Mock window properties
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: mockMatchMedia
  });
  
  Object.defineProperty(window, 'addEventListener', {
    writable: true,
    value: mockAddEventListener
  });
  
  Object.defineProperty(window, 'removeEventListener', {
    writable: true,
    value: mockRemoveEventListener
  });

  // Setup default mock returns
  (responsiveUtils.getScreenSize as jest.Mock).mockReturnValue(mockScreenSize);
  (responsiveUtils.getDeviceInfo as jest.Mock).mockReturnValue(mockDeviceInfo);
  (responsiveUtils.getCurrentBreakpoint as jest.Mock).mockReturnValue(mockBreakpoint);
  (responsiveUtils.validateBreakpoints as jest.Mock).mockReturnValue(true);
  (responsiveUtils.detectFeatureSupport as jest.Mock).mockReturnValue(true);
  (responsiveUtils.matchesMediaQuery as jest.Mock).mockReturnValue(false);
  (responsiveUtils.isBreakpoint as jest.Mock).mockReturnValue(false);
  (responsiveUtils.isAtLeastBreakpoint as jest.Mock).mockReturnValue(false);
  (responsiveUtils.isAtMostBreakpoint as jest.Mock).mockReturnValue(false);
  
  mockMatchMedia.mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn()
  });
});

describe('useResponsive', () => {
  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useResponsive());

    expect(result.current.screenSize).toEqual(mockScreenSize);
    expect(result.current.deviceInfo).toEqual(mockDeviceInfo);
    expect(result.current.breakpoint).toEqual(mockBreakpoint);
    expect(result.current.isDesktop).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isPortrait).toBe(false);
    expect(result.current.isLandscape).toBe(true);
  });

  it('should handle mobile device correctly', () => {
    const mobileDeviceInfo = {
      ...mockDeviceInfo,
      type: 'mobile' as const,
      orientation: 'portrait' as const
    };

    (responsiveUtils.getDeviceInfo as jest.Mock).mockReturnValue(mobileDeviceInfo);

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isDesktop).toBe(false);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isPortrait).toBe(true);
    expect(result.current.isLandscape).toBe(false);
  });

  it('should handle tablet device correctly', () => {
    const tabletDeviceInfo = {
      ...mockDeviceInfo,
      type: 'tablet' as const
    };

    (responsiveUtils.getDeviceInfo as jest.Mock).mockReturnValue(tabletDeviceInfo);

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isDesktop).toBe(false);
    expect(result.current.isTablet).toBe(true);
    expect(result.current.isMobile).toBe(false);
  });

  it('should use custom breakpoints when provided', () => {
    const customBreakpoints = [
      { name: 'small', min: 0, max: 599 },
      { name: 'large', min: 600 }
    ];

    renderHook(() => useResponsive({ breakpoints: customBreakpoints }));

    expect(responsiveUtils.getCurrentBreakpoint).toHaveBeenCalledWith(
      mockScreenSize.width,
      customBreakpoints
    );
  });

  it('should fallback to default breakpoints when validation fails', () => {
    (responsiveUtils.validateBreakpoints as jest.Mock).mockReturnValue(false);

    renderHook(() => useResponsive({ breakpoints: [] }));

    expect(responsiveUtils.getCurrentBreakpoint).toHaveBeenCalledWith(
      mockScreenSize.width,
      DEFAULT_BREAKPOINTS
    );
  });

  it('should handle initialization errors gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    (responsiveUtils.getScreenSize as jest.Mock).mockImplementation(() => {
      throw new Error('Test error');
    });

    const { result } = renderHook(() => useResponsive());

    // Should return safe defaults
    expect(result.current.screenSize.width).toBe(1024);
    expect(result.current.screenSize.height).toBe(768);
    expect(result.current.isDesktop).toBe(true);

    consoleSpy.mockRestore();
  });

  it('should provide matches function', () => {
    (responsiveUtils.matchesMediaQuery as jest.Mock).mockReturnValue(true);

    const { result } = renderHook(() => useResponsive());

    const matches = result.current.matches('(min-width: 768px)');

    expect(matches).toBe(true);
    expect(responsiveUtils.matchesMediaQuery).toHaveBeenCalledWith('(min-width: 768px)');
  });

  it('should handle matches function errors gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    (responsiveUtils.matchesMediaQuery as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid query');
    });

    const { result } = renderHook(() => useResponsive());

    const matches = result.current.matches('invalid-query');

    expect(matches).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error matching media query:', 
      'invalid-query', 
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it('should provide isBreakpoint function', () => {
    (responsiveUtils.isBreakpoint as jest.Mock).mockReturnValue(true);

    const { result } = renderHook(() => useResponsive());

    const isBreakpoint = result.current.isBreakpoint('md');

    expect(isBreakpoint).toBe(true);
    expect(responsiveUtils.isBreakpoint).toHaveBeenCalledWith(
      'md',
      mockScreenSize.width,
      DEFAULT_BREAKPOINTS
    );
  });

  it('should provide isAtLeast function', () => {
    (responsiveUtils.isAtLeastBreakpoint as jest.Mock).mockReturnValue(true);

    const { result } = renderHook(() => useResponsive());

    const isAtLeast = result.current.isAtLeast('md');

    expect(isAtLeast).toBe(true);
    expect(responsiveUtils.isAtLeastBreakpoint).toHaveBeenCalledWith(
      'md',
      mockScreenSize.width,
      DEFAULT_BREAKPOINTS
    );
  });

  it('should provide isAtMost function', () => {
    (responsiveUtils.isAtMostBreakpoint as jest.Mock).mockReturnValue(true);

    const { result } = renderHook(() => useResponsive());

    const isAtMost = result.current.isAtMost('lg');

    expect(isAtMost).toBe(true);
    expect(responsiveUtils.isAtMostBreakpoint).toHaveBeenCalledWith(
      'lg',
      mockScreenSize.width,
      DEFAULT_BREAKPOINTS
    );
  });

  it('should provide refresh function', () => {
    const { result } = renderHook(() => useResponsive());

    // Clear previous calls
    jest.clearAllMocks();

    act(() => {
      result.current.refresh();
    });

    expect(responsiveUtils.getScreenSize).toHaveBeenCalled();
    expect(responsiveUtils.getDeviceInfo).toHaveBeenCalled();
    expect(responsiveUtils.getCurrentBreakpoint).toHaveBeenCalled();
  });

  it('should setup event listeners on mount', () => {
    renderHook(() => useResponsive());

    expect(mockAddEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
      expect.objectContaining({ passive: true })
    );
  });

  it('should setup orientation change listener when enabled', () => {
    const mockOrientation = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };

    Object.defineProperty(screen, 'orientation', {
      value: mockOrientation,
      writable: true
    });

    renderHook(() => useResponsive({ enableOrientationChange: true }));

    expect(mockOrientation.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
      expect.any(Object)
    );
  });

  it('should not setup orientation change listener when disabled', () => {
    const mockOrientation = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };

    Object.defineProperty(screen, 'orientation', {
      value: mockOrientation,
      writable: true
    });

    renderHook(() => useResponsive({ enableOrientationChange: false }));

    expect(mockOrientation.addEventListener).not.toHaveBeenCalled();
  });

  it('should setup visibility change listener when enabled', () => {
    const mockAddEventListener = jest.fn();
    Object.defineProperty(document, 'addEventListener', {
      value: mockAddEventListener,
      writable: true
    });

    renderHook(() => useResponsive({ enableVisibilityChange: true }));

    expect(mockAddEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
      expect.objectContaining({ passive: true })
    );
  });

  it('should handle feature detection failure gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    (responsiveUtils.detectFeatureSupport as jest.Mock).mockReturnValue(false);

    renderHook(() => useResponsive());

    // Should not throw and continue working
    expect(consoleSpy).toHaveBeenCalledWith(
      'Responsive hook initialization error:',
      expect.any(Object)
    );

    consoleSpy.mockRestore();
  });

  it('should use custom debounce delay', () => {
    const customDebounceDelay = 200;
    
    renderHook(() => useResponsive({ debounceDelay: customDebounceDelay }));

    expect(responsiveUtils.debounce).toHaveBeenCalledWith(
      expect.any(Function),
      customDebounceDelay
    );
  });

  it('should cleanup event listeners on unmount', () => {
    const abortController = {
      abort: jest.fn(),
      signal: { aborted: false }
    };

    // Mock AbortController
    global.AbortController = jest.fn(() => abortController) as any;

    const { unmount } = renderHook(() => useResponsive());

    unmount();

    expect(abortController.abort).toHaveBeenCalled();
  });
});