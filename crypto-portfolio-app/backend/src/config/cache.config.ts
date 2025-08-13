import { CacheConfig } from '../types/cache.types';

export const cacheConfig: CacheConfig = {
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'crypto-portfolio:',
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000'),
    lazyConnect: true,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    maxReconnectTime: 10000,
  },
  memory: {
    maxSize: parseInt(process.env.L1_CACHE_MAX_SIZE || '100'), // 100MB
    ttl: parseInt(process.env.L1_CACHE_TTL || '300'), // 5 minutes
    checkPeriod: parseInt(process.env.L1_CACHE_CHECK_PERIOD || '30'), // 30 seconds
  },
  compression: {
    enabled: process.env.CACHE_COMPRESSION_ENABLED === 'true',
    threshold: parseInt(process.env.CACHE_COMPRESSION_THRESHOLD || '1024'), // 1KB
    algorithm: (process.env.CACHE_COMPRESSION_ALGORITHM as 'gzip' | 'brotli' | 'deflate') || 'gzip',
  },
  monitoring: {
    enabled: process.env.CACHE_MONITORING_ENABLED !== 'false',
    metricsInterval: parseInt(process.env.CACHE_METRICS_INTERVAL || '30'), // 30 seconds
    healthCheckInterval: parseInt(process.env.CACHE_HEALTH_CHECK_INTERVAL || '60'), // 60 seconds
    slowQueryThreshold: parseInt(process.env.CACHE_SLOW_QUERY_THRESHOLD || '100'), // 100ms
  },
  warming: {
    enabled: process.env.CACHE_WARMING_ENABLED === 'true',
    strategies: (process.env.CACHE_WARMING_STRATEGIES?.split(',') as Array<'startup' | 'scheduled' | 'predictive'>) || ['startup'],
    batchSize: parseInt(process.env.CACHE_WARMING_BATCH_SIZE || '100'),
    concurrency: parseInt(process.env.CACHE_WARMING_CONCURRENCY || '5'),
  },
};

// TTL configurations for different data types
export const cacheTTLConfig = {
  price: {
    realtime: 30, // 30 seconds for real-time prices
    snapshot: 300, // 5 minutes for snapshot prices
    historical: 3600, // 1 hour for historical data
  },
  portfolio: {
    summary: 300, // 5 minutes for portfolio summary
    holdings: 600, // 10 minutes for holdings data
    performance: 900, // 15 minutes for performance metrics
    analytics: 1800, // 30 minutes for analytics
  },
  user: {
    profile: 1800, // 30 minutes for user profile
    preferences: 3600, // 1 hour for preferences
    sessions: 86400, // 24 hours for session data
    permissions: 3600, // 1 hour for permissions
  },
  exchange: {
    info: 3600, // 1 hour for exchange information
    pairs: 7200, // 2 hours for trading pairs
    fees: 14400, // 4 hours for fee structure
    limits: 7200, // 2 hours for limits
  },
  market: {
    overview: 300, // 5 minutes for market overview
    trending: 600, // 10 minutes for trending data
    news: 900, // 15 minutes for news
    events: 1800, // 30 minutes for events
  },
  ratelimit: {
    api: 60, // 1 minute for API rate limits
    exchange: 300, // 5 minutes for exchange rate limits
    websocket: 60, // 1 minute for WebSocket rate limits
  },
  database: {
    select: 300, // 5 minutes for SELECT queries
    aggregates: 900, // 15 minutes for aggregate queries
    analytics: 1800, // 30 minutes for analytics queries
    reports: 3600, // 1 hour for reports
  },
  api: {
    public: 300, // 5 minutes for public endpoints
    private: 60, // 1 minute for private endpoints
    admin: 30, // 30 seconds for admin endpoints
    health: 30, // 30 seconds for health checks
  },
};

// Cache warming configuration
export const cacheWarmingConfig = {
  startup: {
    enabled: true,
    keys: [
      'exchange:*',
      'market:overview',
      'price:BTC',
      'price:ETH',
      'price:popular',
    ],
    priority: 'high' as const,
    timeout: 30000, // 30 seconds
  },
  scheduled: {
    enabled: false,
    schedule: '0 */5 * * * *', // Every 5 minutes
    keys: [
      'price:*',
      'portfolio:active',
      'market:trending',
    ],
    priority: 'medium' as const,
  },
  predictive: {
    enabled: false,
    minAccessCount: 10,
    windowSize: 3600, // 1 hour
    predictionThreshold: 0.7,
    priority: 'low' as const,
  },
};

// Cache invalidation rules
export const cacheInvalidationRules = {
  portfolio: {
    patterns: ['portfolio:*', 'user:*/portfolios'],
    triggers: ['transaction_created', 'portfolio_updated', 'price_updated'],
    strategy: 'immediate' as const,
  },
  prices: {
    patterns: ['price:*', 'market:*'],
    triggers: ['price_feed_update', 'market_data_update'],
    strategy: 'lazy' as const,
  },
  user: {
    patterns: ['user:*', 'session:*'],
    triggers: ['user_updated', 'preferences_changed', 'logout'],
    strategy: 'immediate' as const,
  },
  exchange: {
    patterns: ['exchange:*'],
    triggers: ['exchange_maintenance', 'fees_updated', 'pairs_updated'],
    strategy: 'scheduled' as const,
  },
};

// Performance thresholds
export const performanceThresholds = {
  cache: {
    hitRate: {
      excellent: 0.95,
      good: 0.85,
      acceptable: 0.70,
    },
    responseTime: {
      excellent: 1, // 1ms
      good: 5, // 5ms
      acceptable: 10, // 10ms
    },
    errorRate: {
      excellent: 0.001, // 0.1%
      good: 0.01, // 1%
      acceptable: 0.05, // 5%
    },
  },
  memory: {
    usage: {
      excellent: 0.6, // 60%
      good: 0.8, // 80%
      acceptable: 0.9, // 90%
    },
    evictionRate: {
      excellent: 0.01, // 1%
      good: 0.05, // 5%
      acceptable: 0.1, // 10%
    },
  },
  redis: {
    latency: {
      excellent: 1, // 1ms
      good: 5, // 5ms
      acceptable: 10, // 10ms
    },
    memoryUsage: {
      excellent: 0.7, // 70%
      good: 0.85, // 85%
      acceptable: 0.95, // 95%
    },
    connectionCount: {
      max: 100,
      warning: 80,
    },
  },
  api: {
    compressionRatio: {
      excellent: 0.3, // 70% reduction
      good: 0.5, // 50% reduction
      acceptable: 0.7, // 30% reduction
    },
    responseTimeImprovement: {
      excellent: 0.8, // 80% improvement
      good: 0.6, // 60% improvement
      acceptable: 0.4, // 40% improvement
    },
  },
};

// Development and production specific configurations
export const environmentConfig = {
  development: {
    cache: {
      enabled: true,
      debugging: true,
      verboseLogging: true,
    },
    redis: {
      db: 1, // Use separate DB for development
    },
    monitoring: {
      metricsInterval: 10, // More frequent metrics in dev
      healthCheckInterval: 30,
    },
  },
  test: {
    cache: {
      enabled: false, // Disable caching in tests by default
      debugging: true,
    },
    redis: {
      db: 2, // Separate DB for tests
    },
    memory: {
      maxSize: 10, // Smaller memory cache for tests
    },
  },
  production: {
    cache: {
      enabled: true,
      debugging: false,
      verboseLogging: false,
    },
    compression: {
      enabled: true,
    },
    warming: {
      enabled: true,
      strategies: ['startup', 'predictive'],
    },
    monitoring: {
      enabled: true,
      metricsInterval: 60,
      healthCheckInterval: 120,
    },
  },
};

// Get environment-specific configuration
export function getEnvironmentConfig() {
  const env = process.env.NODE_ENV || 'development';
  return {
    ...cacheConfig,
    ...environmentConfig[env as keyof typeof environmentConfig],
  };
}