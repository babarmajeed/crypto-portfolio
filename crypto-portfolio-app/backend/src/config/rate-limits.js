/**
 * Rate Limit Configuration for Exchange APIs
 * Exchange-specific rate limits and endpoint configurations
 */

export const RATE_LIMITS = {
  binance: {
    // Default rate limit for all endpoints
    default: { 
      requestsPerInterval: 1200, 
      intervalMs: 60000, // 1 minute
      burstSize: 100 // Allow burst up to 100 requests
    },
    
    // Specific endpoint limits
    '/api/v3/ticker/price': { 
      requestsPerInterval: 40, 
      intervalMs: 1000 // 40 per second
    },
    '/api/v3/ticker/24hr': { 
      requestsPerInterval: 40, 
      intervalMs: 1000 // 40 per second
    },
    '/api/v3/ticker/bookTicker': { 
      requestsPerInterval: 40, 
      intervalMs: 1000 // 40 per second
    },
    '/api/v3/depth': { 
      requestsPerInterval: 20, 
      intervalMs: 1000 // 20 per second
    },
    '/api/v3/klines': { 
      requestsPerInterval: 20, 
      intervalMs: 1000 // 20 per second
    },
    '/api/v3/avgPrice': { 
      requestsPerInterval: 20, 
      intervalMs: 1000 // 20 per second
    },
    
    // Account endpoints (require API key)
    '/api/v3/account': { 
      requestsPerInterval: 20, 
      intervalMs: 1000, // 20 per second
      weight: 10
    },
    '/api/v3/myTrades': { 
      requestsPerInterval: 20, 
      intervalMs: 1000, // 20 per second
      weight: 10
    },
    '/api/v3/openOrders': { 
      requestsPerInterval: 80, 
      intervalMs: 1000, // 80 per second
      weight: 3
    },
    '/api/v3/allOrders': { 
      requestsPerInterval: 20, 
      intervalMs: 1000, // 20 per second
      weight: 10
    },
    
    // Trading endpoints
    '/api/v3/order': { 
      requestsPerInterval: 10, 
      intervalMs: 1000, // 10 per second
      weight: 1
    },
    '/api/v3/order/test': { 
      requestsPerInterval: 50, 
      intervalMs: 1000, // 50 per second
      weight: 1
    }
  },

  coinbase: {
    // Default rate limit
    default: { 
      requestsPerInterval: 10000, 
      intervalMs: 3600000, // 10k per hour
      burstSize: 100
    },
    
    // Public endpoints
    '/products': { 
      requestsPerInterval: 100, 
      intervalMs: 60000 // 100 per minute
    },
    '/products/ticker': { 
      requestsPerInterval: 100, 
      intervalMs: 60000 // 100 per minute
    },
    '/products/stats': { 
      requestsPerInterval: 100, 
      intervalMs: 60000 // 100 per minute
    },
    '/products/candles': { 
      requestsPerInterval: 100, 
      intervalMs: 60000 // 100 per minute
    },
    '/products/book': { 
      requestsPerInterval: 100, 
      intervalMs: 60000 // 100 per minute
    },
    '/products/trades': { 
      requestsPerInterval: 100, 
      intervalMs: 60000 // 100 per minute
    },
    
    // Private endpoints
    '/accounts': { 
      requestsPerInterval: 25, 
      intervalMs: 1000 // 25 per second
    },
    '/accounts/ledger': { 
      requestsPerInterval: 25, 
      intervalMs: 1000 // 25 per second
    },
    '/accounts/holds': { 
      requestsPerInterval: 25, 
      intervalMs: 1000 // 25 per second
    },
    '/orders': { 
      requestsPerInterval: 5, 
      intervalMs: 1000 // 5 per second
    },
    '/orders/history': { 
      requestsPerInterval: 25, 
      intervalMs: 1000 // 25 per second
    },
    '/fills': { 
      requestsPerInterval: 25, 
      intervalMs: 1000 // 25 per second
    }
  },

  kraken: {
    // Default rate limit
    default: { 
      requestsPerInterval: 20, 
      intervalMs: 1000, // 20 per second
      burstSize: 5
    },
    
    // Public endpoints
    '/0/public/Time': { 
      requestsPerInterval: 100, 
      intervalMs: 1000 // No specific limit
    },
    '/0/public/SystemStatus': { 
      requestsPerInterval: 100, 
      intervalMs: 1000 // No specific limit
    },
    '/0/public/AssetPairs': { 
      requestsPerInterval: 100, 
      intervalMs: 1000 // No specific limit
    },
    '/0/public/Assets': { 
      requestsPerInterval: 100, 
      intervalMs: 1000 // No specific limit
    },
    '/0/public/Ticker': { 
      requestsPerInterval: 20, 
      intervalMs: 1000 // Standard limit
    },
    '/0/public/OHLC': { 
      requestsPerInterval: 20, 
      intervalMs: 1000 // Standard limit
    },
    '/0/public/Depth': { 
      requestsPerInterval: 20, 
      intervalMs: 1000 // Standard limit
    },
    '/0/public/Trades': { 
      requestsPerInterval: 20, 
      intervalMs: 1000 // Standard limit
    },
    '/0/public/Spread': { 
      requestsPerInterval: 20, 
      intervalMs: 1000 // Standard limit
    },
    
    // Private endpoints (stricter limits)
    '/0/private/Balance': { 
      requestsPerInterval: 2, 
      intervalMs: 1000 // 2 per second
    },
    '/0/private/TradeBalance': { 
      requestsPerInterval: 2, 
      intervalMs: 1000 // 2 per second
    },
    '/0/private/OpenOrders': { 
      requestsPerInterval: 2, 
      intervalMs: 1000 // 2 per second
    },
    '/0/private/ClosedOrders': { 
      requestsPerInterval: 2, 
      intervalMs: 1000 // 2 per second
    },
    '/0/private/QueryOrders': { 
      requestsPerInterval: 2, 
      intervalMs: 1000 // 2 per second
    },
    '/0/private/TradesHistory': { 
      requestsPerInterval: 2, 
      intervalMs: 1000 // 2 per second
    },
    '/0/private/QueryTrades': { 
      requestsPerInterval: 2, 
      intervalMs: 1000 // 2 per second
    },
    '/0/private/OpenPositions': { 
      requestsPerInterval: 2, 
      intervalMs: 1000 // 2 per second
    },
    '/0/private/Ledgers': { 
      requestsPerInterval: 2, 
      intervalMs: 1000 // 2 per second
    },
    '/0/private/QueryLedgers': { 
      requestsPerInterval: 2, 
      intervalMs: 1000 // 2 per second
    },
    '/0/private/TradeVolume': { 
      requestsPerInterval: 2, 
      intervalMs: 1000 // 2 per second
    },
    
    // Trading endpoints (most restrictive)
    '/0/private/AddOrder': { 
      requestsPerInterval: 1, 
      intervalMs: 1000 // 1 per second
    },
    '/0/private/CancelOrder': { 
      requestsPerInterval: 1, 
      intervalMs: 1000 // 1 per second
    },
    '/0/private/CancelAll': { 
      requestsPerInterval: 1, 
      intervalMs: 1000 // 1 per second
    },
    '/0/private/CancelAllOrdersAfter': { 
      requestsPerInterval: 1, 
      intervalMs: 1000 // 1 per second
    }
  },

  kucoin: {
    // Default rate limit
    default: { 
      requestsPerInterval: 100, 
      intervalMs: 1000, // 100 per second
      burstSize: 50
    },
    
    // Public endpoints
    '/api/v1/time': { 
      requestsPerInterval: 100, 
      intervalMs: 1000 // No specific limit
    },
    '/api/v1/status': { 
      requestsPerInterval: 100, 
      intervalMs: 1000 // No specific limit
    },
    '/api/v1/symbols': { 
      requestsPerInterval: 100, 
      intervalMs: 1000 // No specific limit
    },
    '/api/v1/currencies': { 
      requestsPerInterval: 100, 
      intervalMs: 1000 // No specific limit
    },
    '/api/v1/market/orderbook/level1': { 
      requestsPerInterval: 100, 
      intervalMs: 1000 // Standard limit
    },
    '/api/v1/market/orderbook/level2_20': { 
      requestsPerInterval: 100, 
      intervalMs: 1000 // Standard limit
    },
    '/api/v1/market/orderbook/level2_100': { 
      requestsPerInterval: 100, 
      intervalMs: 1000 // Standard limit
    },
    '/api/v1/market/histories': { 
      requestsPerInterval: 100, 
      intervalMs: 1000 // Standard limit
    },
    '/api/v1/market/candles': { 
      requestsPerInterval: 100, 
      intervalMs: 1000 // Standard limit
    },
    '/api/v1/market/stats': { 
      requestsPerInterval: 100, 
      intervalMs: 1000 // Standard limit
    },
    '/api/v1/market/allTickers': { 
      requestsPerInterval: 100, 
      intervalMs: 1000 // Standard limit
    },
    
    // Private endpoints
    '/api/v1/accounts': { 
      requestsPerInterval: 40, 
      intervalMs: 1000 // 40 per second
    },
    '/api/v1/accounts/ledgers': { 
      requestsPerInterval: 40, 
      intervalMs: 1000 // 40 per second
    },
    '/api/v1/deposits': { 
      requestsPerInterval: 40, 
      intervalMs: 1000 // 40 per second
    },
    '/api/v1/withdrawals': { 
      requestsPerInterval: 40, 
      intervalMs: 1000 // 40 per second
    },
    '/api/v1/orders': { 
      requestsPerInterval: 30, 
      intervalMs: 1000 // 30 per second
    },
    '/api/v1/limit/orders': { 
      requestsPerInterval: 30, 
      intervalMs: 1000 // 30 per second
    },
    '/api/v1/orders/recent': { 
      requestsPerInterval: 30, 
      intervalMs: 1000 // 30 per second
    },
    '/api/v1/fills': { 
      requestsPerInterval: 30, 
      intervalMs: 1000 // 30 per second
    },
    '/api/v1/limit/fills': { 
      requestsPerInterval: 30, 
      intervalMs: 1000 // 30 per second
    },
    
    // Trading endpoints
    '/api/v1/orders': { // POST - place order
      requestsPerInterval: 45, 
      intervalMs: 1000 // 45 per second
    },
    '/api/v1/orders/multi': { // POST - place multiple orders
      requestsPerInterval: 3, 
      intervalMs: 1000 // 3 per second
    },
    '/api/v1/orders/client-order': { // DELETE - cancel by client OID
      requestsPerInterval: 60, 
      intervalMs: 1000 // 60 per second
    }
  }
};

/**
 * Exchange-specific configurations
 */
export const EXCHANGE_CONFIG = {
  binance: {
    baseUrl: 'https://api.binance.com',
    wsUrl: 'wss://stream.binance.com:9443/ws',
    weightBasedLimiting: true,
    maxWeight: 1200,
    weightResetInterval: 60000
  },
  
  coinbase: {
    baseUrl: 'https://api.pro.coinbase.com',
    wsUrl: 'wss://ws-feed.pro.coinbase.com',
    sandboxBaseUrl: 'https://api-public.sandbox.pro.coinbase.com',
    sandboxWsUrl: 'wss://ws-feed-public.sandbox.pro.coinbase.com',
    weightBasedLimiting: false
  },
  
  kraken: {
    baseUrl: 'https://api.kraken.com',
    wsUrl: 'wss://ws.kraken.com',
    wsAuthUrl: 'wss://ws-auth.kraken.com',
    weightBasedLimiting: false,
    strictRateLimiting: true
  },
  
  kucoin: {
    baseUrl: 'https://api.kucoin.com',
    sandboxBaseUrl: 'https://openapi-sandbox.kucoin.com',
    wsUrl: null, // Obtained dynamically from API
    weightBasedLimiting: false
  }
};

/**
 * Global rate limiting settings
 */
export const GLOBAL_SETTINGS = {
  // Default settings applied to all exchanges
  defaultRetryCount: 3,
  defaultRetryDelay: 1000,
  maxRetryDelay: 30000,
  
  // Circuit breaker settings
  circuitBreakerFailureThreshold: 5,
  circuitBreakerRecoveryTimeout: 60000,
  
  // Queue settings
  defaultQueueMaxSize: 1000,
  defaultQueueTimeout: 300000, // 5 minutes
  
  // Emergency throttling
  emergencyThrottleRatio: 0.1, // 10% of normal rate
  emergencyThrottleDuration: 600000, // 10 minutes
  
  // Monitoring
  usageMonitoringWindow: 3600000, // 1 hour
  alertThresholds: {
    approachingLimit: 0.8,
    excessiveRateLimits: 0.3,
    highLatency: 5000
  }
};

/**
 * Priority levels for request queuing
 */
export const PRIORITY_LEVELS = {
  CRITICAL: 'critical',
  HIGH: 'high', 
  NORMAL: 'normal',
  LOW: 'low'
};

/**
 * Get rate limit configuration for specific exchange and endpoint
 */
export function getRateLimit(exchange, endpoint) {
  const exchangeConfig = RATE_LIMITS[exchange];
  if (!exchangeConfig) {
    throw new Error(`Unknown exchange: ${exchange}`);
  }
  
  return exchangeConfig[endpoint] || exchangeConfig.default;
}

/**
 * Get all supported exchanges
 */
export function getSupportedExchanges() {
  return Object.keys(RATE_LIMITS);
}

/**
 * Validate rate limit configuration
 */
export function validateRateLimitConfig(config) {
  const required = ['requestsPerInterval', 'intervalMs'];
  const missing = required.filter(field => !(field in config));
  
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
  
  if (config.requestsPerInterval <= 0 || config.intervalMs <= 0) {
    throw new Error('requestsPerInterval and intervalMs must be positive numbers');
  }
  
  return true;
}

export default RATE_LIMITS;