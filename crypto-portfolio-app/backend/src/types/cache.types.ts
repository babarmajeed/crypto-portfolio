export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  compress?: boolean;
  namespace?: string;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  totalOperations: number;
  hitRate: number;
  memoryUsage: number;
  connectionCount: number;
  avgResponseTime: number;
  timestamp: number;
}

export interface CacheConfig {
  redis: {
    url: string;
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
    connectTimeout?: number;
    lazyConnect?: boolean;
    retryDelayOnFailover?: number;
    maxRetriesPerRequest?: number;
    enableReadyCheck?: boolean;
    maxReconnectTime?: number;
  };
  memory: {
    maxSize: number; // Maximum size in MB for L1 cache
    ttl: number; // Default TTL for memory cache
    checkPeriod: number; // Cleanup check period in seconds
  };
  compression: {
    enabled: boolean;
    threshold: number; // Compress objects larger than this size (bytes)
    algorithm: 'gzip' | 'brotli' | 'deflate';
  };
  monitoring: {
    enabled: boolean;
    metricsInterval: number; // Metrics collection interval in seconds
    healthCheckInterval: number; // Health check interval in seconds
    slowQueryThreshold: number; // Log slow queries above this threshold (ms)
  };
  warming: {
    enabled: boolean;
    strategies: Array<'startup' | 'scheduled' | 'predictive'>;
    batchSize: number;
    concurrency: number;
  };
}

export interface CacheEntry<T = any> {
  value: T;
  timestamp: number;
  ttl: number;
  size: number;
  accessCount: number;
  lastAccessed: number;
  tags?: string[];
  namespace?: string;
  compressed?: boolean;
  checksum?: string;
}

export interface DatabaseCacheOptions extends CacheOptions {
  queryType?: 'select' | 'insert' | 'update' | 'delete';
  invalidateOnWrite?: boolean;
  cacheKey?: string;
  dependencies?: string[];
}

export interface DatabaseCacheResult<T = any> {
  data: T;
  fromCache: boolean;
  cacheKey: string;
  executionTime: number;
  queryHash: string;
}

export interface PerformanceMetrics {
  timestamp: number;
  cache: {
    l1: {
      hits: number;
      misses: number;
      size: number;
      items: number;
      hitRate: number;
      avgAccessTime: number;
    };
    l2: {
      hits: number;
      misses: number;
      size: number;
      items: number;
      hitRate: number;
      avgAccessTime: number;
    };
    total: {
      hits: number;
      misses: number;
      hitRate: number;
      avgAccessTime: number;
    };
  };
  database: {
    totalQueries: number;
    cachedQueries: number;
    cacheHitRate: number;
    avgQueryTime: number;
    slowQueries: number;
  };
  api: {
    totalRequests: number;
    cachedResponses: number;
    cacheHitRate: number;
    avgResponseTime: number;
    compressionRatio: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
    arrayBuffers: number;
    cacheMemoryUsage: number;
  };
  system: {
    cpuUsage: number;
    loadAverage: number[];
    uptime: number;
    freeMemory: number;
    totalMemory: number;
  };
}

export interface CacheWarmingJob {
  id: string;
  type: 'startup' | 'scheduled' | 'predictive';
  keys: string[];
  priority: 'low' | 'medium' | 'high';
  batchSize: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  progress?: number;
  error?: string;
}

export interface CacheInvalidationRule {
  pattern: string;
  tags?: string[];
  namespace?: string;
  strategy: 'immediate' | 'lazy' | 'scheduled';
  dependencies?: string[];
  condition?: (key: string, value: any) => boolean;
}

export interface ApiCacheOptions extends CacheOptions {
  etag?: boolean;
  vary?: string[];
  staleWhileRevalidate?: boolean;
  staleIfError?: boolean;
  mustRevalidate?: boolean;
  maxAge?: number;
  sMaxAge?: number;
  public?: boolean;
  private?: boolean;
  noCache?: boolean;
  noStore?: boolean;
}

export interface CacheEventData {
  type: 'hit' | 'miss' | 'set' | 'delete' | 'expire' | 'evict' | 'error';
  key: string;
  namespace?: string;
  size?: number;
  ttl?: number;
  timestamp: number;
  layer: 'l1' | 'l2' | 'database' | 'api';
  executionTime?: number;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface CacheHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    redis: {
      connected: boolean;
      latency: number;
      memoryUsage: number;
      connectionCount: number;
    };
    memory: {
      usage: number;
      itemCount: number;
      evictionRate: number;
    };
    performance: {
      hitRate: number;
      avgResponseTime: number;
      errorRate: number;
    };
  };
  timestamp: number;
  uptime: number;
}

export interface CacheStatistics {
  totalOperations: number;
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  errors: number;
  hitRate: number;
  missRate: number;
  errorRate: number;
  avgResponseTime: number;
  memoryUsage: {
    l1: number;
    l2: number;
    total: number;
  };
  compressionStats: {
    enabled: boolean;
    totalCompressed: number;
    compressionRatio: number;
    timeSaved: number;
  };
  topKeys: Array<{
    key: string;
    hits: number;
    size: number;
    lastAccessed: number;
  }>;
  timestamps: {
    startTime: number;
    lastReset: number;
    uptime: number;
  };
}

// Query result types for different data categories
export interface PriceData {
  price: number;
  change24h?: number;
  volume24h?: number;
  marketCap?: number;
  lastUpdated: string;
  source: string;
}

export interface PortfolioData {
  id: string;
  userId: string;
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPercent: number;
  holdings: Array<{
    symbol: string;
    quantity: number;
    averagePrice: number;
    currentPrice: number;
    value: number;
    pnl: number;
    pnlPercent: number;
  }>;
  lastUpdated: string;
}

export interface UserData {
  id: string;
  email: string;
  username: string;
  profile: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
    timezone?: string;
    currency?: string;
  };
  preferences: {
    theme: string;
    language: string;
    notifications: Record<string, boolean>;
  };
  lastLogin: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExchangeData {
  id: string;
  name: string;
  displayName: string;
  logo?: string;
  status: 'active' | 'inactive' | 'maintenance';
  supportedPairs: string[];
  fees: {
    maker: number;
    taker: number;
    withdrawal: Record<string, number>;
  };
  limits: {
    min: Record<string, number>;
    max: Record<string, number>;
  };
  lastUpdated: string;
}

export interface RateLimitData {
  count: number;
  remaining: number;
  resetTime: number;
  windowSize: number;
  identifier: string;
}

// Cache layer types
export type CacheLayer = 'l1' | 'l2' | 'database' | 'api';
export type CacheOperation = 'get' | 'set' | 'delete' | 'exists' | 'expire' | 'invalidate';
export type CacheNamespace = 'price' | 'portfolio' | 'user' | 'exchange' | 'market' | 'session' | 'ratelimit' | 'query' | 'api';

// Event callback types
export type CacheEventCallback = (event: CacheEventData) => void | Promise<void>;
export type CacheErrorCallback = (error: Error, operation: CacheOperation, key: string) => void | Promise<void>;
export type CacheMetricsCallback = (metrics: CacheMetrics) => void | Promise<void>;