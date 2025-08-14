// Service Worker for Crypto Portfolio PWA
const CACHE_NAME = 'crypto-portfolio-v1.0.0';
const CACHE_SUFFIX = Date.now();
const DYNAMIC_CACHE = `crypto-portfolio-dynamic-${CACHE_SUFFIX}`;
const API_CACHE = `crypto-portfolio-api-${CACHE_SUFFIX}`;
const STATIC_CACHE = `crypto-portfolio-static-${CACHE_SUFFIX}`;

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/offline.html'
];

// API endpoints to cache
const API_PATTERNS = [
  /\/api\/portfolio/,
  /\/api\/assets/,
  /\/api\/transactions/,
  /\/api\/markets/,
  /\/api\/user/
];

// External API patterns
const EXTERNAL_API_PATTERNS = [
  /https:\/\/api\.coingecko\.com/,
  /https:\/\/api\.coinmarketcap\.com/,
  /https:\/\/api\.binance\.com/
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('📦 Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('✅ Service Worker: Installation complete');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Service Worker: Installation failed', error);
      })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName.startsWith('crypto-portfolio-') && 
                !cacheName.includes(CACHE_SUFFIX)) {
              console.log('🗑️ Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker: Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle requests with caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // Handle different types of requests
  if (isStaticAsset(request)) {
    event.respondWith(handleStaticAsset(request));
  } else if (isAPIRequest(request)) {
    event.respondWith(handleAPIRequest(request));
  } else if (isExternalAPI(request)) {
    event.respondWith(handleExternalAPI(request));
  } else {
    event.respondWith(handleDynamicRequest(request));
  }
});

// Check if request is for static asset
function isStaticAsset(request) {
  const url = new URL(request.url);
  return STATIC_ASSETS.some(asset => url.pathname === asset) ||
         url.pathname.startsWith('/static/') ||
         url.pathname.startsWith('/icons/') ||
         url.pathname.endsWith('.png') ||
         url.pathname.endsWith('.jpg') ||
         url.pathname.endsWith('.svg') ||
         url.pathname.endsWith('.css') ||
         url.pathname.endsWith('.js');
}

// Check if request is for internal API
function isAPIRequest(request) {
  return API_PATTERNS.some(pattern => pattern.test(request.url));
}

// Check if request is for external API
function isExternalAPI(request) {
  return EXTERNAL_API_PATTERNS.some(pattern => pattern.test(request.url));
}

// Handle static assets with Cache First strategy
async function handleStaticAsset(request) {
  try {
    const cache = await caches.open(STATIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('Static asset fetch failed:', error);
    return new Response('Asset not available offline', { status: 503 });
  }
}

// Handle API requests with Network First strategy
async function handleAPIRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache for API request');
    const cache = await caches.open(API_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Data not available offline',
        offline: true,
        cached: false
      }), 
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle external API requests with Cache First + Network Fallback
async function handleExternalAPI(request) {
  try {
    const cache = await caches.open(API_CACHE);
    const cachedResponse = await cache.match(request);
    
    // Return cached version if available and not too old (5 minutes)
    if (cachedResponse) {
      const cacheDate = new Date(cachedResponse.headers.get('sw-cache-date') || 0);
      const isStale = Date.now() - cacheDate.getTime() > 5 * 60 * 1000;
      
      if (!isStale) {
        return cachedResponse;
      }
    }
    
    // Try network
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      const headers = new Headers(responseClone.headers);
      headers.set('sw-cache-date', new Date().toISOString());
      
      const modifiedResponse = new Response(responseClone.body, {
        status: responseClone.status,
        statusText: responseClone.statusText,
        headers: headers
      });
      
      cache.put(request, modifiedResponse);
      return networkResponse;
    }
    
    // Network failed, return cached if available
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw new Error('Network failed and no cache available');
  } catch (error) {
    console.error('External API fetch failed:', error);
    return new Response(
      JSON.stringify({ 
        error: 'External data not available offline',
        offline: true 
      }), 
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle dynamic requests with Network First strategy
async function handleDynamicRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlineResponse = await caches.match('/offline.html');
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    return new Response('Page not available offline', { status: 503 });
  }
}

// Background sync for failed requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'portfolio-sync') {
    event.waitUntil(syncPortfolioData());
  } else if (event.tag === 'transaction-sync') {
    event.waitUntil(syncTransactionData());
  }
});

// Sync portfolio data when back online
async function syncPortfolioData() {
  try {
    console.log('🔄 Background sync: Syncing portfolio data');
    
    const pendingData = await getStoredData('pendingPortfolioUpdates');
    if (pendingData && pendingData.length > 0) {
      for (const data of pendingData) {
        await fetch('/api/portfolio/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }
      
      await clearStoredData('pendingPortfolioUpdates');
      console.log('✅ Background sync: Portfolio data synced');
    }
  } catch (error) {
    console.error('❌ Background sync failed:', error);
  }
}

// Sync transaction data when back online
async function syncTransactionData() {
  try {
    console.log('🔄 Background sync: Syncing transaction data');
    
    const pendingTransactions = await getStoredData('pendingTransactions');
    if (pendingTransactions && pendingTransactions.length > 0) {
      for (const transaction of pendingTransactions) {
        await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(transaction)
        });
      }
      
      await clearStoredData('pendingTransactions');
      console.log('✅ Background sync: Transaction data synced');
    }
  } catch (error) {
    console.error('❌ Background sync failed:', error);
  }
}

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('📱 Push notification received');
  
  const options = {
    body: 'Check your portfolio updates',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    tag: 'portfolio-update',
    requireInteraction: false,
    actions: [
      {
        action: 'view',
        title: 'View Portfolio',
        icon: '/icons/portfolio-96x96.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/close-96x96.png'
      }
    ]
  };

  if (event.data) {
    const data = event.data.json();
    options.body = data.message || options.body;
    options.tag = data.tag || options.tag;
    
    if (data.requireInteraction) {
      options.requireInteraction = true;
    }
  }

  event.waitUntil(
    self.registration.showNotification('Crypto Portfolio', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/portfolio')
    );
  } else if (event.action === 'dismiss') {
    // Just close the notification
    return;
  } else {
    // Default click action
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Periodic background sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'portfolio-update') {
    event.waitUntil(updatePortfolioCache());
  }
});

// Update portfolio cache periodically
async function updatePortfolioCache() {
  try {
    console.log('⏰ Periodic sync: Updating portfolio cache');
    
    const response = await fetch('/api/portfolio/summary');
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put('/api/portfolio/summary', response.clone());
    }
    
    // Update market data
    const marketResponse = await fetch('/api/markets/trending');
    if (marketResponse.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put('/api/markets/trending', marketResponse.clone());
    }
    
    console.log('✅ Periodic sync: Cache updated');
  } catch (error) {
    console.error('❌ Periodic sync failed:', error);
  }
}

// Utility functions for IndexedDB operations
async function getStoredData(key) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CryptoPortfolioDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['pendingData'], 'readonly');
      const store = transaction.objectStore('pendingData');
      const getRequest = store.get(key);
      
      getRequest.onsuccess = () => resolve(getRequest.result?.data);
      getRequest.onerror = () => reject(getRequest.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingData')) {
        db.createObjectStore('pendingData', { keyPath: 'key' });
      }
    };
  });
}

async function clearStoredData(key) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CryptoPortfolioDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['pendingData'], 'readwrite');
      const store = transaction.objectStore('pendingData');
      const deleteRequest = store.delete(key);
      
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };
  });
}

// Handle skip waiting message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('🚀 Service Worker: Loaded and ready');