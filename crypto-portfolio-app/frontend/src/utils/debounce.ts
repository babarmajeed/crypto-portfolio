import React from 'react';

/**
 * Debounce function to limit the rate of function execution
 * Useful for search inputs to avoid excessive API calls
 * 
 * @param func Function to debounce
 * @param delay Delay in milliseconds
 * @param immediate Execute immediately on first call
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number,
  immediate = false
): T & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastCallTime = 0;

  const debounced = ((...args: Parameters<T>): any => {
    const now = Date.now();
    const shouldCallImmediately = immediate && !timeoutId;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (shouldCallImmediately) {
      lastCallTime = now;
      return func(...args);
    }

    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (!immediate || now - lastCallTime >= delay) {
        lastCallTime = now;
        func(...args);
      }
    }, delay);
  }) as T & { cancel: () => void };

  // Add cancel method to clear pending executions
  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

/**
 * Throttle function to limit function execution to at most once per interval
 * Good for scroll events and resize handlers
 * 
 * @param func Function to throttle
 * @param limit Time limit in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): T & { cancel: () => void } {
  let inThrottle: boolean = false;
  let timeoutId: NodeJS.Timeout | null = null;

  const throttled = ((...args: Parameters<T>): any => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      
      timeoutId = setTimeout(() => {
        inThrottle = false;
        timeoutId = null;
      }, limit);
    }
  }) as T & { cancel: () => void };

  throttled.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
      inThrottle = false;
    }
  };

  return throttled;
}

/**
 * Simple debounce for basic use cases
 */
export function simpleDebounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout | null = null;

  const debounced = ((...args: Parameters<T>): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  }) as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}