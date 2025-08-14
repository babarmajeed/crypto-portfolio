import { renderHook, act } from '@testing-library/react';
import { useSwipe } from '../useSwipe';
import { TOUCH_EVENTS } from '../../types/responsive.types';
import * as responsiveUtils from '../../utils/responsive.utils';

// Mock the utility functions
jest.mock('../../utils/responsive.utils', () => ({
  calculateDistance: jest.fn(),
  calculateVelocity: jest.fn(),
  getSwipeDirection: jest.fn(),
  isTouchSupported: jest.fn(),
  throttle: jest.fn((fn) => fn)
}));

const mockTouchEvent = {
  type: 'touchstart',
  touches: [{ clientX: 100, clientY: 100 }],
  changedTouches: [{ clientX: 100, clientY: 100 }],
  target: document.body,
  preventDefault: jest.fn()
} as any;

const mockMouseEvent = {
  type: 'mousedown',
  clientX: 100,
  clientY: 100,
  target: document.body,
  preventDefault: jest.fn()
} as any;

beforeEach(() => {
  jest.clearAllMocks();
  
  // Setup default mocks
  (responsiveUtils.isTouchSupported as jest.Mock).mockReturnValue(true);
  (responsiveUtils.calculateDistance as jest.Mock).mockReturnValue(50);
  (responsiveUtils.calculateVelocity as jest.Mock).mockReturnValue(0.5);
  (responsiveUtils.getSwipeDirection as jest.Mock).mockReturnValue('right');

  // Mock Date.now for consistent timing
  jest.spyOn(Date, 'now').mockReturnValue(1000);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useSwipe', () => {
  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useSwipe());

    expect(result.current.isSupported).toBe(true);
    expect(result.current.isActive).toBe(false);
    expect(result.current.currentSwipe).toBe(null);
    expect(typeof result.current.bind).toBe('function');
  });

  it('should handle touch start event', () => {
    const onSwipeStart = jest.fn();
    const { result } = renderHook(() => useSwipe({ onSwipeStart }));
    const handlers = result.current.bind();

    act(() => {
      handlers.onTouchStart(mockTouchEvent);
    });

    expect(result.current.isActive).toBe(true);
    expect(onSwipeStart).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'swipestart',
        startX: 100,
        startY: 100,
        endX: 100,
        endY: 100
      })
    );
  });

  it('should handle touch move event', () => {
    const onSwipeChange = jest.fn();
    const { result } = renderHook(() => useSwipe({ onSwipeChange }));
    const handlers = result.current.bind();

    // Start swipe
    act(() => {
      handlers.onTouchStart(mockTouchEvent);
    });

    // Move touch
    const moveEvent = {
      ...mockTouchEvent,
      type: 'touchmove',
      touches: [{ clientX: 150, clientY: 100 }]
    };

    act(() => {
      handlers.onTouchMove(moveEvent);
    });

    expect(onSwipeChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'swipechange',
        startX: 100,
        startY: 100,
        endX: 150,
        endY: 100
      })
    );
  });

  it('should handle successful swipe right', () => {
    const onSwipeEnd = jest.fn();
    const onSwipeRight = jest.fn();
    
    (responsiveUtils.calculateDistance as jest.Mock).mockReturnValue(100); // Above min distance
    (responsiveUtils.calculateVelocity as jest.Mock).mockReturnValue(0.5); // Above min velocity
    (responsiveUtils.getSwipeDirection as jest.Mock).mockReturnValue('right');

    const { result } = renderHook(() => useSwipe({ 
      onSwipeEnd, 
      onSwipeRight,
      minDistance: 50,
      minVelocity: 0.3
    }));
    const handlers = result.current.bind();

    // Start swipe
    act(() => {
      handlers.onTouchStart(mockTouchEvent);
    });

    // End swipe
    const endEvent = {
      ...mockTouchEvent,
      type: 'touchend',
      touches: [],
      changedTouches: [{ clientX: 200, clientY: 100 }]
    };

    act(() => {
      handlers.onTouchEnd(endEvent);
    });

    expect(onSwipeEnd).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'swipeend',
        direction: 'right'
      })
    );
    expect(onSwipeRight).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'right'
      })
    );
  });

  it('should handle swipe left', () => {
    const onSwipeLeft = jest.fn();
    
    (responsiveUtils.calculateDistance as jest.Mock).mockReturnValue(100);
    (responsiveUtils.calculateVelocity as jest.Mock).mockReturnValue(0.5);
    (responsiveUtils.getSwipeDirection as jest.Mock).mockReturnValue('left');

    const { result } = renderHook(() => useSwipe({ onSwipeLeft }));
    const handlers = result.current.bind();

    act(() => {
      handlers.onTouchStart(mockTouchEvent);
    });

    const endEvent = {
      ...mockTouchEvent,
      type: 'touchend',
      touches: [],
      changedTouches: [{ clientX: 0, clientY: 100 }]
    };

    act(() => {
      handlers.onTouchEnd(endEvent);
    });

    expect(onSwipeLeft).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'left'
      })
    );
  });

  it('should handle swipe up', () => {
    const onSwipeUp = jest.fn();
    
    (responsiveUtils.calculateDistance as jest.Mock).mockReturnValue(100);
    (responsiveUtils.calculateVelocity as jest.Mock).mockReturnValue(0.5);
    (responsiveUtils.getSwipeDirection as jest.Mock).mockReturnValue('up');

    const { result } = renderHook(() => useSwipe({ onSwipeUp }));
    const handlers = result.current.bind();

    act(() => {
      handlers.onTouchStart(mockTouchEvent);
    });

    const endEvent = {
      ...mockTouchEvent,
      type: 'touchend',
      touches: [],
      changedTouches: [{ clientX: 100, clientY: 0 }]
    };

    act(() => {
      handlers.onTouchEnd(endEvent);
    });

    expect(onSwipeUp).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'up'
      })
    );
  });

  it('should handle swipe down', () => {
    const onSwipeDown = jest.fn();
    
    (responsiveUtils.calculateDistance as jest.Mock).mockReturnValue(100);
    (responsiveUtils.calculateVelocity as jest.Mock).mockReturnValue(0.5);
    (responsiveUtils.getSwipeDirection as jest.Mock).mockReturnValue('down');

    const { result } = renderHook(() => useSwipe({ onSwipeDown }));
    const handlers = result.current.bind();

    act(() => {
      handlers.onTouchStart(mockTouchEvent);
    });

    const endEvent = {
      ...mockTouchEvent,
      type: 'touchend',
      touches: [],
      changedTouches: [{ clientX: 100, clientY: 200 }]
    };

    act(() => {
      handlers.onTouchEnd(endEvent);
    });

    expect(onSwipeDown).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'down'
      })
    );
  });

  it('should cancel swipe if distance is too small', () => {
    const onSwipeCancel = jest.fn();
    const onSwipeEnd = jest.fn();
    
    (responsiveUtils.calculateDistance as jest.Mock).mockReturnValue(20); // Below min distance
    (responsiveUtils.calculateVelocity as jest.Mock).mockReturnValue(0.5);

    const { result } = renderHook(() => useSwipe({ 
      onSwipeCancel, 
      onSwipeEnd,
      minDistance: 50
    }));
    const handlers = result.current.bind();

    act(() => {
      handlers.onTouchStart(mockTouchEvent);
    });

    const endEvent = {
      ...mockTouchEvent,
      type: 'touchend',
      touches: [],
      changedTouches: [{ clientX: 120, clientY: 100 }]
    };

    act(() => {
      handlers.onTouchEnd(endEvent);
    });

    expect(onSwipeCancel).toHaveBeenCalled();
    expect(onSwipeEnd).not.toHaveBeenCalled();
  });

  it('should cancel swipe if velocity is too low', () => {
    const onSwipeCancel = jest.fn();
    
    (responsiveUtils.calculateDistance as jest.Mock).mockReturnValue(100);
    (responsiveUtils.calculateVelocity as jest.Mock).mockReturnValue(0.1); // Below min velocity

    const { result } = renderHook(() => useSwipe({ 
      onSwipeCancel,
      minVelocity: 0.3
    }));
    const handlers = result.current.bind();

    act(() => {
      handlers.onTouchStart(mockTouchEvent);
    });

    const endEvent = {
      ...mockTouchEvent,
      type: 'touchend',
      touches: [],
      changedTouches: [{ clientX: 200, clientY: 100 }]
    };

    act(() => {
      handlers.onTouchEnd(endEvent);
    });

    expect(onSwipeCancel).toHaveBeenCalled();
  });

  it('should cancel swipe if time exceeds maxTime', () => {
    const onSwipeCancel = jest.fn();
    
    (responsiveUtils.calculateDistance as jest.Mock).mockReturnValue(100);
    (responsiveUtils.calculateVelocity as jest.Mock).mockReturnValue(0.5);

    // Mock different times for start and end
    jest.spyOn(Date, 'now')
      .mockReturnValueOnce(1000)  // Start time
      .mockReturnValue(3000);     // End time (2000ms later, exceeds maxTime)

    const { result } = renderHook(() => useSwipe({ 
      onSwipeCancel,
      maxTime: 1500
    }));
    const handlers = result.current.bind();

    act(() => {
      handlers.onTouchStart(mockTouchEvent);
    });

    const endEvent = {
      ...mockTouchEvent,
      type: 'touchend',
      touches: [],
      changedTouches: [{ clientX: 200, clientY: 100 }]
    };

    act(() => {
      handlers.onTouchEnd(endEvent);
    });

    expect(onSwipeCancel).toHaveBeenCalled();
  });

  it('should handle touch cancel event', () => {
    const onSwipeCancel = jest.fn();
    const { result } = renderHook(() => useSwipe({ onSwipeCancel }));
    const handlers = result.current.bind();

    // Start swipe
    act(() => {
      handlers.onTouchStart(mockTouchEvent);
    });

    expect(result.current.isActive).toBe(true);

    // Cancel swipe
    act(() => {
      handlers.onTouchCancel(mockTouchEvent);
    });

    expect(result.current.isActive).toBe(false);
    expect(onSwipeCancel).toHaveBeenCalled();
  });

  it('should handle mouse events when touch is not supported', () => {
    (responsiveUtils.isTouchSupported as jest.Mock).mockReturnValue(false);
    
    const onSwipeStart = jest.fn();
    const { result } = renderHook(() => useSwipe({ onSwipeStart }));
    const handlers = result.current.bind();

    act(() => {
      handlers.onMouseDown(mockMouseEvent);
    });

    expect(result.current.isActive).toBe(true);
    expect(onSwipeStart).toHaveBeenCalled();
  });

  it('should prevent default when preventDefault is true', () => {
    const { result } = renderHook(() => useSwipe({ preventDefault: true }));
    const handlers = result.current.bind();

    act(() => {
      handlers.onTouchStart(mockTouchEvent);
    });

    expect(mockTouchEvent.preventDefault).toHaveBeenCalled();
  });

  it('should not handle events when disabled', () => {
    const onSwipeStart = jest.fn();
    const { result } = renderHook(() => useSwipe({ onSwipeStart, disabled: true }));
    const handlers = result.current.bind();

    act(() => {
      handlers.onTouchStart(mockTouchEvent);
    });

    expect(result.current.isActive).toBe(false);
    expect(onSwipeStart).not.toHaveBeenCalled();
  });

  it('should handle errors in event handlers gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    (responsiveUtils.calculateDistance as jest.Mock).mockImplementation(() => {
      throw new Error('Test error');
    });

    const { result } = renderHook(() => useSwipe());
    const handlers = result.current.bind();

    expect(() => {
      handlers.onTouchStart(mockTouchEvent);
    }).not.toThrow();

    expect(consoleSpy).toHaveBeenCalledWith('Error in touch start handler:', expect.any(Error));

    consoleSpy.mockRestore();
  });

  it('should validate distance constraints with maxDistance', () => {
    const onSwipeCancel = jest.fn();
    
    (responsiveUtils.calculateDistance as jest.Mock).mockReturnValue(200); // Exceeds max distance
    (responsiveUtils.calculateVelocity as jest.Mock).mockReturnValue(0.5);

    const { result } = renderHook(() => useSwipe({ 
      onSwipeCancel,
      minDistance: 50,
      maxDistance: 150
    }));
    const handlers = result.current.bind();

    act(() => {
      handlers.onTouchStart(mockTouchEvent);
    });

    const endEvent = {
      ...mockTouchEvent,
      type: 'touchend',
      touches: [],
      changedTouches: [{ clientX: 300, clientY: 100 }]
    };

    act(() => {
      handlers.onTouchEnd(endEvent);
    });

    expect(onSwipeCancel).toHaveBeenCalled();
  });

  it('should handle mouse move and up events globally when not touch supported', () => {
    (responsiveUtils.isTouchSupported as jest.Mock).mockReturnValue(false);
    
    const onSwipeEnd = jest.fn();
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    
    (responsiveUtils.calculateDistance as jest.Mock).mockReturnValue(100);
    (responsiveUtils.calculateVelocity as jest.Mock).mockReturnValue(0.5);
    (responsiveUtils.getSwipeDirection as jest.Mock).mockReturnValue('right');

    renderHook(() => useSwipe({ onSwipeEnd }));

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'mousemove',
      expect.any(Function),
      expect.objectContaining({ passive: true })
    );
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'mouseup',
      expect.any(Function),
      expect.objectContaining({ passive: true })
    );

    addEventListenerSpy.mockRestore();
  });

  it('should not setup global mouse listeners when touch is supported', () => {
    (responsiveUtils.isTouchSupported as jest.Mock).mockReturnValue(true);
    
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    
    renderHook(() => useSwipe());

    expect(addEventListenerSpy).not.toHaveBeenCalledWith(
      'mousemove',
      expect.any(Function),
      expect.any(Object)
    );

    addEventListenerSpy.mockRestore();
  });
});