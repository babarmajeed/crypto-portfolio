import { useEffect, useRef, useCallback } from 'react';

interface PerformanceOptions {
  enableRAF?: boolean;
  debounceDelay?: number;
  throttleDelay?: number;
  enableIntersectionObserver?: boolean;
  enableLazyLoading?: boolean;
}

export const usePerformanceOptimization = (options: PerformanceOptions = {}) => {
  const {
    enableRAF = true,
    debounceDelay = 300,
    throttleDelay = 100,
    enableIntersectionObserver = true,
    enableLazyLoading = true
  } = options;

  const rafRef = useRef<number>();
  const throttleRef = useRef<NodeJS.Timeout>();
  const debounceRef = useRef<NodeJS.Timeout>();

  // Request Animation Frame wrapper
  const requestAnimationFrame = useCallback((callback: () => void) => {
    if (!enableRAF) {
      callback();
      return;
    }

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    
    rafRef.current = window.requestAnimationFrame(callback);
  }, [enableRAF]);

  // Debounce function
  const debounce = useCallback(<T extends any[]>(
    func: (...args: T) => void,
    delay: number = debounceDelay
  ) => {
    return (...args: T) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      
      debounceRef.current = setTimeout(() => func(...args), delay);
    };
  }, [debounceDelay]);

  // Throttle function
  const throttle = useCallback(<T extends any[]>(
    func: (...args: T) => void,
    delay: number = throttleDelay
  ) => {
    let isThrottled = false;
    
    return (...args: T) => {
      if (isThrottled) return;
      
      func(...args);
      isThrottled = true;
      
      throttleRef.current = setTimeout(() => {
        isThrottled = false;
      }, delay);
    };
  }, [throttleDelay]);

  // Intersection Observer for lazy loading
  const createIntersectionObserver = useCallback((
    callback: (entries: IntersectionObserverEntry[]) => void,
    options?: IntersectionObserverInit
  ) => {
    if (!enableIntersectionObserver || !window.IntersectionObserver) {
      return null;
    }

    const defaultOptions: IntersectionObserverInit = {
      root: null,
      rootMargin: '50px',
      threshold: 0.1,
      ...options
    };

    return new IntersectionObserver(callback, defaultOptions);
  }, [enableIntersectionObserver]);

  // Lazy loading hook
  const useLazyLoading = useCallback((
    ref: React.RefObject<HTMLElement>,
    onVisible: () => void,
    options?: IntersectionObserverInit
  ) => {
    useEffect(() => {
      if (!enableLazyLoading || !ref.current) return;

      const observer = createIntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              onVisible();
              observer?.unobserve(entry.target);
            }
          });
        },
        options
      );

      if (observer) {
        observer.observe(ref.current);
        
        return () => {
          observer.disconnect();
        };
      }
    }, [ref, onVisible, options]);
  }, [enableLazyLoading, createIntersectionObserver]);

  // Performance measurement
  const measurePerformance = useCallback((
    name: string,
    fn: () => void | Promise<void>
  ) => {
    const start = performance.now();
    
    const result = fn();
    
    if (result instanceof Promise) {
      return result.then((value) => {
        const end = performance.now();
        console.log(`${name} took ${end - start} milliseconds`);
        return value;
      });
    } else {
      const end = performance.now();
      console.log(`${name} took ${end - start} milliseconds`);
      return result;
    }
  }, []);

  // Memory optimization - cleanup function
  const cleanup = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    if (throttleRef.current) {
      clearTimeout(throttleRef.current);
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
  }, []);

  // Auto-cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    requestAnimationFrame,
    debounce,
    throttle,
    createIntersectionObserver,
    useLazyLoading,
    measurePerformance,
    cleanup
  };
};

// Hook for detecting device capabilities
export const useDeviceCapabilities = () => {
  const getDeviceInfo = useCallback(() => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const hasHover = window.matchMedia('(hover: hover)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const connection = (navigator as any).connection;
    
    return {
      isTouchDevice,
      hasHover,
      prefersReducedMotion,
      isSlowConnection: connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g',
      memory: (performance as any).memory || null,
      hardwareConcurrency: navigator.hardwareConcurrency || 1,
      devicePixelRatio: window.devicePixelRatio || 1
    };
  }, []);

  return { getDeviceInfo };
};

export default usePerformanceOptimization;