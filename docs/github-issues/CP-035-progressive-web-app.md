# CP-035: Progressive Web App (PWA) Implementation

## Overview
Transform the crypto portfolio application into a full-featured Progressive Web App with offline capabilities, push notifications, app-like experience, and installable functionality across all platforms.

## Objectives
- Implement PWA core features (service worker, manifest, caching)
- Add offline functionality for essential features
- Enable app installation on mobile and desktop
- Implement background sync and push notifications

## Acceptance Criteria
- [ ] Service worker implementation with caching strategies
- [ ] Web app manifest for installable experience
- [ ] Offline functionality for portfolio viewing and basic features
- [ ] Background data synchronization
- [ ] Push notification support
- [ ] App-like navigation and user experience
- [ ] Automatic updates and cache management
- [ ] Performance optimization for mobile networks
- [ ] Cross-platform installation support
- [ ] Lighthouse PWA score above 90

## Technical Implementation

### File Structure
```
public/
  manifest.json
  sw.js
src/
  service-worker/
    sw-template.js
    cache-strategies.js
    background-sync.js
    push-notifications.js
  pwa/
    PWAPrompt.jsx
    InstallButton.jsx
    OfflineIndicator.jsx
    UpdateAvailable.jsx
  hooks/
    usePWA.js
    useOnlineStatus.js
    useInstallPrompt.js
  utils/
    pwa-utils.js
    cache-utils.js
```

### Web App Manifest
```json
// public/manifest.json
{
  "name": "Crypto Portfolio Tracker",
  "short_name": "CryptoPortfolio",
  "description": "Track and manage your cryptocurrency investments with real-time data and analytics",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#007bff",
  "orientation": "portrait-primary",
  "scope": "/",
  "lang": "en-US",
  "categories": ["finance", "productivity", "utilities"],
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/desktop-dashboard.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide",
      "label": "Portfolio Dashboard"
    },
    {
      "src": "/screenshots/mobile-portfolio.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "Mobile Portfolio View"
    }
  ],
  "shortcuts": [
    {
      "name": "Portfolio Overview",
      "short_name": "Portfolio",
      "description": "View your portfolio summary",
      "url": "/portfolio",
      "icons": [
        {
          "src": "/icons/shortcut-portfolio.png",
          "sizes": "96x96"
        }
      ]
    },
    {
      "name": "Price Alerts",
      "short_name": "Alerts",
      "description": "Manage your price alerts",
      "url": "/alerts",
      "icons": [
        {
          "src": "/icons/shortcut-alerts.png",
          "sizes": "96x96"
        }
      ]
    },
    {
      "name": "Market Watch",
      "short_name": "Market",
      "description": "View market data",
      "url": "/market",
      "icons": [
        {
          "src": "/icons/shortcut-market.png",
          "sizes": "96x96"
        }
      ]
    }
  ],
  "related_applications": [
    {
      "platform": "play",
      "url": "https://play.google.com/store/apps/details?id=com.cryptoportfolio.app",
      "id": "com.cryptoportfolio.app"
    }
  ],
  "prefer_related_applications": false
}
```

### Service Worker Template
```javascript
// src/service-worker/sw-template.js
const CACHE_NAME = 'crypto-portfolio-v1.0.0';
const API_CACHE_NAME = 'crypto-portfolio-api-v1.0.0';
const IMAGE_CACHE_NAME = 'crypto-portfolio-images-v1.0.0';

const STATIC_ASSETS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/offline.html'
];

const API_ENDPOINTS = [
  '/api/portfolio',
  '/api/assets',
  '/api/transactions'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== API_CACHE_NAME && 
                cacheName !== IMAGE_CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests with network-first strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Handle image requests with cache-first strategy
  if (request.destination === 'image') {
    event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE_NAME));
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(navigationStrategy(request));
    return;
  }

  // Handle static assets with cache-first strategy
  event.respondWith(cacheFirstStrategy(request, CACHE_NAME));
});

// Network-first strategy for API calls
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache:', error);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response for API calls
    return new Response(JSON.stringify({
      error: 'Offline',
      message: 'This data is not available offline'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Cache-first strategy for static assets and images
async function cacheFirstStrategy(request, cacheName = CACHE_NAME) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Failed to fetch from network:', error);
    
    // Return placeholder for failed image requests
    if (request.destination === 'image') {
      return new Response(`
        <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="200" fill="#f0f0f0"/>
          <text x="100" y="100" text-anchor="middle" font-size="14" fill="#666">
            Image unavailable
          </text>
        </svg>
      `, {
        headers: { 'Content-Type': 'image/svg+xml' }
      });
    }
    
    throw error;
  }
}

// Navigation strategy with offline page fallback
async function navigationStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Navigation failed, showing offline page:', error);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return caches.match('/offline.html');
  }
}

// Background sync for data updates
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'portfolio-sync') {
    event.waitUntil(syncPortfolioData());
  }
  
  if (event.tag === 'price-alerts-sync') {
    event.waitUntil(syncPriceAlerts());
  }
});

async function syncPortfolioData() {
  try {
    console.log('Syncing portfolio data in background...');
    
    const response = await fetch('/api/portfolio');
    if (response.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put('/api/portfolio', response.clone());
      
      // Notify clients about the update
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'PORTFOLIO_SYNC_COMPLETE',
          data: 'Portfolio data updated'
        });
      });
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

async function syncPriceAlerts() {
  try {
    console.log('Syncing price alerts in background...');
    
    const response = await fetch('/api/price-alerts');
    if (response.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put('/api/price-alerts', response.clone());
    }
  } catch (error) {
    console.error('Price alerts sync failed:', error);
  }
}

// Push notification handler
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  let notificationData = {
    title: 'Crypto Portfolio',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'default'
  };

  if (event.data) {
    try {
      notificationData = { ...notificationData, ...event.data.json() };
    } catch (error) {
      console.error('Error parsing push data:', error);
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    data: notificationData.data,
    actions: notificationData.actions,
    requireInteraction: notificationData.requireInteraction || false,
    silent: notificationData.silent || false
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window/tab open with the target URL
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        
        // If not, open a new window/tab
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
```

### PWA Hook
```javascript
// hooks/usePWA.js
import { useState, useEffect } from 'react';

export const usePWA = () => {
  const [isInstallable, setIsInstallable] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Check if app is already installed
    const checkInstallStatus = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isPWA = window.navigator.standalone || isStandalone;
      
      setIsInstalled(isPWA);
    };

    checkInstallStatus();

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setIsInstallable(true);
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setInstallPrompt(null);
    };

    // Listen for service worker updates
    const handleServiceWorkerUpdate = () => {
      setIsUpdateAvailable(true);
    };

    // Listen for online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Service worker message listener
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'UPDATE_AVAILABLE') {
          handleServiceWorkerUpdate();
        }
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) return false;

    try {
      const result = await installPrompt.prompt();
      console.log('Install prompt result:', result);
      
      if (result.outcome === 'accepted') {
        setIsInstallable(false);
        setInstallPrompt(null);
        return true;
      }
    } catch (error) {
      console.error('Error during installation:', error);
    }
    
    return false;
  };

  const updateApp = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          window.location.reload();
        }
      } catch (error) {
        console.error('Error updating app:', error);
      }
    }
  };

  const enablePushNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Push notifications not supported');
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        throw new Error('Service worker not registered');
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.REACT_APP_VAPID_PUBLIC_KEY
      });

      // Send subscription to server
      await fetch('/api/push-subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(subscription)
      });

      return subscription;
    } catch (error) {
      console.error('Error enabling push notifications:', error);
      throw error;
    }
  };

  return {
    isInstallable,
    isInstalled,
    isUpdateAvailable,
    isOnline,
    installApp,
    updateApp,
    enablePushNotifications
  };
};
```

### Install Prompt Component
```jsx
// pwa/InstallButton.jsx
import React, { useState } from 'react';
import { usePWA } from '../hooks/usePWA';

const InstallButton = ({ className = '', children }) => {
  const [isInstalling, setIsInstalling] = useState(false);
  const { isInstallable, installApp, isInstalled } = usePWA();

  const handleInstall = async () => {
    setIsInstalling(true);
    
    try {
      const success = await installApp();
      if (success) {
        // Show success message
        console.log('App installed successfully');
      }
    } catch (error) {
      console.error('Installation failed:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  if (isInstalled || !isInstallable) {
    return null;
  }

  return (
    <button
      onClick={handleInstall}
      disabled={isInstalling}
      className={`install-button ${className}`}
      aria-label="Install app"
    >
      {isInstalling ? (
        <>
          <span className="install-spinner"></span>
          Installing...
        </>
      ) : (
        children || (
          <>
            📱 Install App
          </>
        )
      )}
    </button>
  );
};

export default InstallButton;
```

### Offline Indicator Component
```jsx
// pwa/OfflineIndicator.jsx
import React, { useState, useEffect } from 'react';
import { usePWA } from '../hooks/usePWA';

const OfflineIndicator = () => {
  const [showNotification, setShowNotification] = useState(false);
  const { isOnline } = usePWA();

  useEffect(() => {
    if (!isOnline) {
      setShowNotification(true);
    } else {
      // Hide notification after coming back online
      const timer = setTimeout(() => {
        setShowNotification(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  if (!showNotification) {
    return null;
  }

  return (
    <div className={`offline-indicator ${isOnline ? 'online' : 'offline'}`}>
      <div className="offline-content">
        <span className="offline-icon">
          {isOnline ? '✓' : '📶'}
        </span>
        <span className="offline-text">
          {isOnline ? 'Back online' : 'You\'re offline. Some features may be limited.'}
        </span>
        {!isOnline && (
          <button
            onClick={() => setShowNotification(false)}
            className="offline-close"
            aria-label="Close notification"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

export default OfflineIndicator;
```

## Testing Requirements
- PWA audit using Lighthouse
- Offline functionality testing
- Installation testing across platforms
- Push notification testing
- Service worker caching strategy testing

## Dependencies
- Depends on: CP-034 (Mobile Responsive Design)
- Depends on: CP-033 (Notification System)
- Blocks: All mobile and offline features

## Time Estimate
**Beginner**: 10-12 days
**Intermediate**: 6-8 days
**Advanced**: 4-6 days

## Required Skills
- Service Worker APIs
- PWA concepts and best practices
- Caching strategies
- Push notification implementation
- Web App Manifest configuration