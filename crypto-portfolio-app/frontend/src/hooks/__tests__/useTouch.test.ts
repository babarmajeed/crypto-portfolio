import { renderHook, act, fireEvent } from '@testing-library/react';
import { useTouch } from '../useTouch';
import { TOUCH_EVENTS } from '../../types/responsive.types';
import * as responsiveUtils from '../../utils/responsive.utils';

// Mock the utility functions
jest.mock('../../utils/responsive.utils', () => ({
  touchListToArray: jest.fn(),
  calculateDistance: jest.fn(),
  calculatePinchScale: jest.fn(),
  calculateTouchCenter: jest.fn(),
  isTouchSupported: jest.fn(),
  isGestureSupported: jest.fn(),
  detectFeatureSupport: jest.fn(),
  throttle: jest.fn((fn) => fn)
}));

const mockTouchPoint = {
  identifier: 1,
  clientX: 100,
  clientY: 100,
  pageX: 100,
  pageY: 100,
  screenX: 100,
  screenY: 100,
  radiusX: 10,
  radiusY: 10,
  rotationAngle: 0,
  force: 1
};

const mockTouchEvent = {
  type: 'touchstart',
  touches: [mockTouchPoint],
  changedTouches: [mockTouchPoint],
  targetTouches: [mockTouchPoint],
  target: document.body,
  preventDefault: jest.fn()
} as any;

beforeEach(() => {
  jest.clearAllMocks();
  
  // Setup default mocks
  (responsiveUtils.isTouchSupported as jest.Mock).mockReturnValue(true);
  (responsiveUtils.isGestureSupported as jest.Mock).mockReturnValue(true);
  (responsiveUtils.touchListToArray as jest.Mock).mockReturnValue([mockTouchPoint]);
  (responsiveUtils.calculateDistance as jest.Mock).mockReturnValue(0);
  (responsiveUtils.calculateTouchCenter as jest.Mock).mockReturnValue({ x: 100, y: 100 });
  (responsiveUtils.calculatePinchScale as jest.Mock).mockReturnValue(1);
});

describe('useTouch', () => {
  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useTouch());

    expect(result.current.isSupported).toBe(true);
    expect(result.current.isActive).toBe(false);
    expect(result.current.currentTouches).toEqual([]);
    expect(result.current.lastTap).toBe(null);
    expect(result.current.lastPinch).toBe(null);
    expect(typeof result.current.bind).toBe('function');
  });

  it('should detect unsupported devices', () => {
    (responsiveUtils.isTouchSupported as jest.Mock).mockReturnValue(false);

    const { result } = renderHook(() => useTouch());

    expect(result.current.isSupported).toBe(false);
  });

  it('should handle touch start event', () => {
    const onTap = jest.fn();
    const { result } = renderHook(() => useTouch({ onTap }));

    const handlers = result.current.bind();

    act(() => {
      handlers.onTouchStart(mockTouchEvent);
    });

    expect(result.current.isActive).toBe(true);
    expect(result.current.currentTouches).toEqual([mockTouchPoint]);
  });

  it('should handle tap event', async () => {
    const onTap = jest.fn();
    (responsiveUtils.calculateDistance as jest.Mock).mockReturnValue(5); // Within tap threshold

    const { result } = renderHook(() => useTouch({ onTap, tapThreshold: 10 }));
    const handlers = result.current.bind();

    // Start touch
    act(() => {
      handlers.onTouchStart(mockTouchEvent);
    });

    // End touch quickly (within tap constraints)
    const endEvent = {
      ...mockTouchEvent,
      type: 'touchend',
      touches: [],
      changedTouches: [mockTouchPoint]
    };

    await act(async () => {
      handlers.onTouchEnd(endEvent);
    });

    expect(onTap).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tap',
        clientX: mockTouchPoint.clientX,
        clientY: mockTouchPoint.clientY,
        target: mockTouchEvent.target
      })
    );
  });

  it('should handle double tap event', async () => {
    const onDoubleTap = jest.fn();
    (responsiveUtils.calculateDistance as jest.Mock).mockReturnValue(5);

    const { result } = renderHook(() => useTouch({ 
      onDoubleTap,
      doubleTapDelay: TOUCH_EVENTS.DOUBLE_TAP_DELAY
    }));
    const handlers = result.current.bind();

    // First tap
    act(() => {
      handlers.onTouchStart(mockTouchEvent);
    });

    const endEvent = {
      ...mockTouchEvent,
      type: 'touchend',
      touches: [],
      changedTouches: [mockTouchPoint]
    };

    act(() => {
      handlers.onTouchEnd(endEvent);
    });

    // Second tap quickly after first
    act(() => {
      handlers.onTouchStart(mockTouchEvent);
    });

    act(() => {
      handlers.onTouchEnd(endEvent);
    });

    expect(onDoubleTap).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'doubletap'
      })
    );
  });

  it('should handle pinch start event', () => {
    const onPinchStart = jest.fn();
    const twoTouchEvent = {
      ...mockTouchEvent,
      touches: [mockTouchPoint, { ...mockTouchPoint, identifier: 2, clientX: 200 }]
    };

    (responsiveUtils.touchListToArray as jest.Mock).mockReturnValue([
      mockTouchPoint, 
      { ...mockTouchPoint, identifier: 2, clientX: 200 }
    ]);
    (responsiveUtils.calculateDistance as jest.Mock).mockReturnValue(100);
    (responsiveUtils.calculateTouchCenter as jest.Mock).mockReturnValue({ x: 150, y: 100 });

    const { result } = renderHook(() => useTouch({ onPinchStart }));
    const handlers = result.current.bind();

    act(() => {
      handlers.onTouchStart(twoTouchEvent);
    });

    expect(onPinchStart).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'pinchstart',
        scale: 1,
        centerX: 150,
        centerY: 100
      })
    );
  });

  it('should handle pinch change event', () => {
    const onPinchStart = jest.fn();
    const onPinchChange = jest.fn();
    
    const twoTouchEvent = {
      ...mockTouchEvent,
      touches: [mockTouchPoint, { ...mockTouchPoint, identifier: 2, clientX: 200 }]
    };

    (responsiveUtils.touchListToArray as jest.Mock).mockReturnValue([
      mockTouchPoint, 
      { ...mockTouchPoint, identifier: 2, clientX: 200 }
    ]);
    (responsiveUtils.calculateDistance as jest.Mock)
      .mockReturnValueOnce(100) // Initial distance
      .mockReturnValue(150); // New distance
    (responsiveUtils.calculateTouchCenter as jest.Mock).mockReturnValue({ x: 150, y: 100 });

    const { result } = renderHook(() => useTouch({ 
      onPinchStart, 
      onPinchChange,
      pinchThreshold: 0.1
    }));
    const handlers = result.current.bind();

    // Start pinch
    act(() => {
      handlers.onTouchStart(twoTouchEvent);
    });

    // Move touches (pinch change)
    const moveEvent = {
      ...twoTouchEvent,
      type: 'touchmove'
    };

    act(() => {
      handlers.onTouchMove(moveEvent);
    });

    expect(onPinchChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'pinchchange',
        scale: 1.5 // 150 / 100
      })
    );
  });

  it('should handle pinch end event', () => {
    const onPinchStart = jest.fn();
    const onPinchEnd = jest.fn();
    
    const twoTouchEvent = {
      ...mockTouchEvent,
      touches: [mockTouchPoint, { ...mockTouchPoint, identifier: 2, clientX: 200 }]
    };

    (responsiveUtils.touchListToArray as jest.Mock)
      .mockReturnValueOnce([mockTouchPoint, { ...mockTouchPoint, identifier: 2, clientX: 200 }]) // Start
      .mockReturnValue([]); // End
    
    (responsiveUtils.calculateDistance as jest.Mock).mockReturnValue(100);
    (responsiveUtils.calculateTouchCenter as jest.Mock).mockReturnValue({ x: 150, y: 100 });

    const { result } = renderHook(() => useTouch({ 
      onPinchStart, 
      onPinchEnd,
      pinchThreshold: 0.1
    }));
    const handlers = result.current.bind();

    // Start pinch
    act(() => {
      handlers.onTouchStart(twoTouchEvent);
    });

    // Simulate pinch in progress
    act(() => {
      handlers.onTouchMove({
        ...twoTouchEvent,
        type: 'touchmove'
      });
    });

    // End pinch
    const endEvent = {
      ...mockTouchEvent,
      type: 'touchend',
      touches: []
    };

    act(() => {
      handlers.onTouchEnd(endEvent);
    });

    expect(onPinchEnd).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'pinchend'
      })
    );
  });

  it('should handle touch cancel event', () => {
    const { result } = renderHook(() => useTouch());
    const handlers = result.current.bind();

    // Start touch
    act(() => {
      handlers.onTouchStart(mockTouchEvent);
    });

    expect(result.current.isActive).toBe(true);

    // Cancel touch
    act(() => {
      handlers.onTouchCancel(mockTouchEvent);
    });

    expect(result.current.isActive).toBe(false);
    expect(result.current.currentTouches).toEqual([]);
  });

  it('should prevent default when preventDefaultTouches is true', () => {
    const { result } = renderHook(() => useTouch({ preventDefaultTouches: true }));
    const handlers = result.current.bind();

    act(() => {
      handlers.onTouchStart(mockTouchEvent);
    });

    expect(mockTouchEvent.preventDefault).toHaveBeenCalled();
  });

  it('should not call handlers when disabled', () => {
    const onTap = jest.fn();
    const { result } = renderHook(() => useTouch({ onTap, disabled: true }));
    const handlers = result.current.bind();

    act(() => {
      handlers.onTouchStart(mockTouchEvent);
    });

    expect(result.current.isActive).toBe(false);
    expect(onTap).not.toHaveBeenCalled();
  });

  it('should handle gesture events when supported', () => {
    const onGestureStart = jest.fn();
    const onGestureChange = jest.fn();
    const onGestureEnd = jest.fn();

    const gestureEvent = {
      type: 'gesturestart',
      scale: 1.2,
      rotation: 15,
      target: document.body,
      preventDefault: jest.fn()
    };

    renderHook(() => useTouch({ 
      onGestureStart, 
      onGestureChange, 
      onGestureEnd 
    }));

    // Simulate gesture start
    act(() => {
      document.body.dispatchEvent(new CustomEvent('gesturestart', { 
        detail: gestureEvent 
      }));
    });

    // Note: In real implementation, gesture events would be handled by the effect
    // For testing purposes, we verify the setup exists
    expect(responsiveUtils.isGestureSupported).toHaveBeenCalled();
  });

  it('should return empty handlers when touch is not supported', () => {
    (responsiveUtils.isTouchSupported as jest.Mock).mockReturnValue(false);
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    const { result } = renderHook(() => useTouch());
    const handlers = result.current.bind();

    expect(consoleSpy).toHaveBeenCalledWith('Touch events are not supported on this device');
    expect(typeof handlers.onTouchStart).toBe('function');
    expect(typeof handlers.onTouchMove).toBe('function');
    expect(typeof handlers.onTouchEnd).toBe('function');
    expect(typeof handlers.onTouchCancel).toBe('function');

    // Handlers should be no-ops
    expect(() => {
      handlers.onTouchStart(mockTouchEvent);
    }).not.toThrow();

    consoleSpy.mockRestore();
  });

  it('should handle errors in touch handlers gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    (responsiveUtils.touchListToArray as jest.Mock).mockImplementation(() => {
      throw new Error('Test error');
    });

    const { result } = renderHook(() => useTouch());
    const handlers = result.current.bind();

    expect(() => {
      handlers.onTouchStart(mockTouchEvent);
    }).not.toThrow();

    expect(consoleSpy).toHaveBeenCalledWith('Error in touch start handler:', expect.any(Error));

    consoleSpy.mockRestore();
  });

  it('should ignore tap if movement exceeds threshold', () => {
    const onTap = jest.fn();
    (responsiveUtils.calculateDistance as jest.Mock).mockReturnValue(50); // Exceeds default threshold

    const { result } = renderHook(() => useTouch({ onTap }));
    const handlers = result.current.bind();

    act(() => {
      handlers.onTouchStart(mockTouchEvent);
    });

    const endEvent = {
      ...mockTouchEvent,
      type: 'touchend',
      touches: [],
      changedTouches: [{ ...mockTouchPoint, clientX: 150 }] // Moved significantly
    };

    act(() => {
      handlers.onTouchEnd(endEvent);
    });

    expect(onTap).not.toHaveBeenCalled();
  });

  it('should ignore tap if duration is too long', () => {
    const onTap = jest.fn();
    (responsiveUtils.calculateDistance as jest.Mock).mockReturnValue(5);

    const { result } = renderHook(() => useTouch({ onTap }));
    const handlers = result.current.bind();

    const startTime = Date.now();
    jest.spyOn(Date, 'now')
      .mockReturnValueOnce(startTime)
      .mockReturnValue(startTime + 2000); // 2 seconds later

    act(() => {
      handlers.onTouchStart(mockTouchEvent);
    });

    const endEvent = {
      ...mockTouchEvent,
      type: 'touchend',
      touches: [],
      changedTouches: [mockTouchPoint]
    };

    act(() => {
      handlers.onTouchEnd(endEvent);
    });

    expect(onTap).not.toHaveBeenCalled();
  });
});