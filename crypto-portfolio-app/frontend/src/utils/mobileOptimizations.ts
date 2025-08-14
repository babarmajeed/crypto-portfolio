// Mobile-specific optimization utilities

export interface ViewportConfig {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  orientation: 'portrait' | 'landscape';
}

// Get current viewport configuration
export const getViewportConfig = (): ViewportConfig => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;
  const orientation = height > width ? 'portrait' : 'landscape';

  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop,
    orientation
  };
};

// Touch event helpers
export interface TouchGesture {
  type: 'tap' | 'longpress' | 'swipe' | 'pinch';
  direction?: 'left' | 'right' | 'up' | 'down';
  distance?: number;
  velocity?: number;
  scale?: number;
}

export const detectTouchGesture = (
  startTouch: Touch,
  endTouch: Touch,
  startTime: number,
  endTime: number
): TouchGesture => {
  const deltaX = endTouch.clientX - startTouch.clientX;
  const deltaY = endTouch.clientY - startTouch.clientY;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const duration = endTime - startTime;
  const velocity = distance / duration;

  // Long press detection
  if (distance < 10 && duration > 500) {
    return { type: 'longpress' };
  }

  // Tap detection
  if (distance < 10 && duration < 300) {
    return { type: 'tap' };
  }

  // Swipe detection
  if (distance > 50 && duration < 500) {
    const angle = Math.atan2(Math.abs(deltaY), Math.abs(deltaX)) * 180 / Math.PI;
    
    let direction: 'left' | 'right' | 'up' | 'down';
    if (angle < 45) {
      direction = deltaX > 0 ? 'right' : 'left';
    } else {
      direction = deltaY > 0 ? 'down' : 'up';
    }

    return {
      type: 'swipe',
      direction,
      distance,
      velocity
    };
  }

  // Default to tap
  return { type: 'tap' };
};

// Performance optimization for mobile
export const optimizeForMobile = () => {
  // Disable hover effects on touch devices
  if ('ontouchstart' in window) {
    document.documentElement.classList.add('touch-device');
  }

  // Add viewport meta tag if not present
  let viewportMeta = document.querySelector('meta[name="viewport"]');
  if (!viewportMeta) {
    viewportMeta = document.createElement('meta');
    viewportMeta.setAttribute('name', 'viewport');
    document.head.appendChild(viewportMeta);
  }
  
  viewportMeta.setAttribute(
    'content',
    'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover'
  );

  // Prevent zoom on input focus (iOS)
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      input.addEventListener('focus', () => {
        viewportMeta.setAttribute(
          'content',
          'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
        );
      });
      
      input.addEventListener('blur', () => {
        viewportMeta.setAttribute(
          'content',
          'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover'
        );
      });
    });
  }
};

// Safe area insets for modern mobile devices
export const getSafeAreaInsets = () => {
  const computedStyle = getComputedStyle(document.documentElement);
  
  return {
    top: computedStyle.getPropertyValue('env(safe-area-inset-top)') || '0px',
    right: computedStyle.getPropertyValue('env(safe-area-inset-right)') || '0px',
    bottom: computedStyle.getPropertyValue('env(safe-area-inset-bottom)') || '0px',
    left: computedStyle.getPropertyValue('env(safe-area-inset-left)') || '0px'
  };
};

// Responsive image loading
export const createResponsiveImageSrc = (
  basePath: string,
  sizes: { mobile: string; tablet: string; desktop: string },
  format: 'webp' | 'png' | 'jpg' = 'webp'
): string => {
  const viewport = getViewportConfig();
  let selectedSize: string;

  if (viewport.isMobile) {
    selectedSize = sizes.mobile;
  } else if (viewport.isTablet) {
    selectedSize = sizes.tablet;
  } else {
    selectedSize = sizes.desktop;
  }

  return `${basePath}-${selectedSize}.${format}`;
};

// Accessibility improvements for mobile
export const enhanceMobileAccessibility = () => {
  // Ensure focus is visible
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      document.documentElement.classList.add('keyboard-navigation');
    }
  });

  document.addEventListener('mousedown', () => {
    document.documentElement.classList.remove('keyboard-navigation');
  });

  // Improve touch target sizes
  const style = document.createElement('style');
  style.textContent = `
    @media (max-width: 768px) {
      button, a, input, select, textarea {
        min-height: 44px;
        min-width: 44px;
      }
      
      .touch-target {
        min-height: 44px;
        min-width: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
  `;
  document.head.appendChild(style);
};

// Memory management for mobile
export const mobileMemoryManager = {
  // Clear unused data from memory
  clearCache: () => {
    // Clear any cached data that's no longer needed
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          if (name.includes('old-') || name.includes('temp-')) {
            caches.delete(name);
          }
        });
      });
    }
  },

  // Monitor memory usage
  getMemoryUsage: () => {
    const memory = (performance as any).memory;
    if (memory) {
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      };
    }
    return null;
  },

  // Throttle updates based on memory usage
  shouldThrottleUpdates: () => {
    const memoryUsage = mobileMemoryManager.getMemoryUsage();
    if (memoryUsage && memoryUsage.percentage > 80) {
      return true;
    }
    
    // Check if device is low-end
    const hardwareConcurrency = navigator.hardwareConcurrency || 1;
    const deviceMemory = (navigator as any).deviceMemory || 1;
    
    return hardwareConcurrency < 4 || deviceMemory < 2;
  }
};

// Network optimization for mobile
export const mobileNetworkOptimization = {
  // Check connection type
  getConnectionType: () => {
    const connection = (navigator as any).connection;
    if (!connection) return null;
    
    return {
      type: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData
    };
  },

  // Determine if should load high-quality content
  shouldLoadHighQuality: () => {
    const connection = mobileNetworkOptimization.getConnectionType();
    if (!connection) return true;
    
    // Don't load high-quality on slow connections or when data saver is on
    const slowConnections = ['slow-2g', '2g'];
    return !slowConnections.includes(connection.type) && !connection.saveData;
  },

  // Preload critical resources
  preloadCriticalResources: (urls: string[]) => {
    urls.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      document.head.appendChild(link);
    });
  }
};

// Initialize all mobile optimizations
export const initializeMobileOptimizations = () => {
  optimizeForMobile();
  enhanceMobileAccessibility();
  
  // Clean up memory periodically
  setInterval(() => {
    if (mobileMemoryManager.shouldThrottleUpdates()) {
      mobileMemoryManager.clearCache();
    }
  }, 60000); // Every minute
};