// PWA utility functions for offline functionality and background sync

export interface OfflineQueue {
  id: string;
  type: 'portfolio' | 'transaction' | 'settings' | 'alert';
  data: any;
  timestamp: number;
  retryCount: number;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
}

export interface CacheStrategy {
  name: string;
  maxAge: number; // in milliseconds
  maxEntries?: number;
  purgeOnQuotaError?: boolean;
}

export const CACHE_STRATEGIES: Record<string, CacheStrategy> = {
  STATIC: {
    name: 'static-assets',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    maxEntries: 100
  },
  API: {
    name: 'api-cache',
    maxAge: 5 * 60 * 1000, // 5 minutes
    maxEntries: 50,
    purgeOnQuotaError: true
  },
  DYNAMIC: {
    name: 'dynamic-content',
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    maxEntries: 30
  },
  EXTERNAL_API: {
    name: 'external-api',
    maxAge: 15 * 60 * 1000, // 15 minutes
    maxEntries: 25
  }
};

// Check if the app is running as a PWA
export const isPWA = (): boolean => {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone ||
    document.referrer.includes('android-app://')
  );
};

// Check if browser supports PWA features
export const isPWASupported = (): boolean => {
  return (
    'serviceWorker' in navigator &&
    'indexedDB' in window &&
    'caches' in window &&
    'PushManager' in window
  );
};

// Get PWA installation readiness
export const getPWAReadiness = (): {
  supported: boolean;
  installable: boolean;
  installed: boolean;
  features: {
    serviceWorker: boolean;
    indexedDB: boolean;
    caches: boolean;
    pushManager: boolean;
    notifications: boolean;
    backgroundSync: boolean;
  };
} => {
  const features = {
    serviceWorker: 'serviceWorker' in navigator,
    indexedDB: 'indexedDB' in window,
    caches: 'caches' in window,
    pushManager: 'PushManager' in window,
    notifications: 'Notification' in window,
    backgroundSync: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype
  };

  return {
    supported: Object.values(features).every(Boolean),
    installable: isPWASupported(),
    installed: isPWA(),
    features
  };
};

// Queue offline requests
export const queueOfflineRequest = async (request: Omit<OfflineQueue, 'id' | 'timestamp' | 'retryCount'>): Promise<void> => {
  const queueItem: OfflineQueue = {
    ...request,
    id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    retryCount: 0
  };

  try {
    const stored = localStorage.getItem('offline-queue');
    const queue: OfflineQueue[] = stored ? JSON.parse(stored) : [];
    queue.push(queueItem);
    localStorage.setItem('offline-queue', JSON.stringify(queue));
    
    // Try to register background sync if available
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const registration = await navigator.serviceWorker.ready;
      if ('sync' in registration) {
        await registration.sync.register(`offline-sync-${request.type}`);
      }
    }
  } catch (error) {
    console.error('Failed to queue offline request:', error);
  }
};

// Get queued offline requests
export const getOfflineQueue = (): OfflineQueue[] => {
  try {
    const stored = localStorage.getItem('offline-queue');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to get offline queue:', error);
    return [];
  }
};

// Clear offline queue
export const clearOfflineQueue = (): void => {
  try {
    localStorage.removeItem('offline-queue');
  } catch (error) {
    console.error('Failed to clear offline queue:', error);
  }
};

// Process offline queue when back online
export const processOfflineQueue = async (): Promise<{ success: number; failed: number }> => {
  const queue = getOfflineQueue();
  let success = 0;
  let failed = 0;
  const failedItems: OfflineQueue[] = [];

  for (const item of queue) {
    try {
      const response = await fetch(item.endpoint, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: item.method !== 'GET' ? JSON.stringify(item.data) : undefined
      });

      if (response.ok) {
        success++;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error(`Failed to sync offline item ${item.id}:`, error);
      
      // Retry logic
      if (item.retryCount < 3) {
        failedItems.push({
          ...item,
          retryCount: item.retryCount + 1
        });
      }
      failed++;
    }
  }

  // Update queue with failed items for retry
  if (failedItems.length > 0) {
    localStorage.setItem('offline-queue', JSON.stringify(failedItems));
  } else {
    clearOfflineQueue();
  }

  return { success, failed };
};

// Cache management utilities
export const cacheHelpers = {
  // Check if a cache entry is stale
  isStale: (cacheDate: string, maxAge: number): boolean => {
    const date = new Date(cacheDate);
    return Date.now() - date.getTime() > maxAge;
  },

  // Get cache key with version
  getCacheKey: (url: string, version: string = '1.0.0'): string => {
    return `${url}?v=${version}`;
  },

  // Clean expired cache entries
  cleanExpiredCache: async (cacheName: string, maxAge: number): Promise<void> => {
    try {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      
      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          const cacheDate = response.headers.get('sw-cache-date');
          if (cacheDate && cacheHelpers.isStale(cacheDate, maxAge)) {
            await cache.delete(request);
          }
        }
      }
    } catch (error) {
      console.error('Failed to clean expired cache:', error);
    }
  },

  // Get cache usage statistics
  getCacheStats: async (): Promise<{
    quota: number;
    usage: number;
    available: number;
    percentage: number;
  }> => {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const quota = estimate.quota || 0;
        const usage = estimate.usage || 0;
        const available = quota - usage;
        const percentage = quota > 0 ? Math.round((usage / quota) * 100) : 0;
        
        return { quota, usage, available, percentage };
      }
    } catch (error) {
      console.error('Failed to get cache stats:', error);
    }
    
    return { quota: 0, usage: 0, available: 0, percentage: 0 };
  }
};

// Notification helpers
export const notificationHelpers = {
  // Request notification permission
  requestPermission: async (): Promise<NotificationPermission> => {
    if ('Notification' in window) {
      return await Notification.requestPermission();
    }
    return 'denied';
  },

  // Show local notification
  showNotification: async (title: string, options: NotificationOptions = {}): Promise<void> => {
    if ('serviceWorker' in navigator && 'Notification' in window) {
      const permission = await notificationHelpers.requestPermission();
      
      if (permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-96x96.png',
          ...options
        });
      }
    }
  },

  // Schedule notification for later
  scheduleNotification: async (title: string, options: NotificationOptions, delay: number): Promise<void> => {
    setTimeout(() => {
      notificationHelpers.showNotification(title, options);
    }, delay);
  }
};

// Background sync helpers
export const backgroundSync = {
  // Register background sync
  register: async (tag: string): Promise<void> => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if ('sync' in registration) {
          await registration.sync.register(tag);
        }
      } catch (error) {
        console.error('Background sync registration failed:', error);
      }
    }
  },

  // Store data for background sync
  storeForSync: async (key: string, data: any): Promise<void> => {
    try {
      const syncData = {
        data,
        timestamp: Date.now(),
        synced: false
      };
      
      localStorage.setItem(`bg-sync-${key}`, JSON.stringify(syncData));
      await backgroundSync.register(`sync-${key}`);
    } catch (error) {
      console.error('Failed to store data for background sync:', error);
    }
  },

  // Get stored sync data
  getSyncData: (key: string): any => {
    try {
      const stored = localStorage.getItem(`bg-sync-${key}`);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to get sync data:', error);
      return null;
    }
  },

  // Mark data as synced
  markSynced: (key: string): void => {
    try {
      const stored = backgroundSync.getSyncData(key);
      if (stored) {
        stored.synced = true;
        localStorage.setItem(`bg-sync-${key}`, JSON.stringify(stored));
      }
    } catch (error) {
      console.error('Failed to mark data as synced:', error);
    }
  }
};

// Export all utilities
export default {
  isPWA,
  isPWASupported,
  getPWAReadiness,
  queueOfflineRequest,
  getOfflineQueue,
  clearOfflineQueue,
  processOfflineQueue,
  cacheHelpers,
  notificationHelpers,
  backgroundSync,
  CACHE_STRATEGIES
};