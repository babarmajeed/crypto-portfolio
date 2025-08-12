# ADR-004: Caching Strategy

## Status
Accepted

## Context
Our crypto portfolio application requires an efficient caching strategy to handle:
- Real-time cryptocurrency price data with high read frequency
- Portfolio calculations that are computationally expensive
- User session data for authentication
- API response caching to reduce external service calls
- Rate limiting counters and temporary data storage
- WebSocket connection state management

Performance requirements:
- Sub-millisecond response times for price data
- Sub-100ms response times for portfolio queries
- Support for 10,000+ concurrent users
- 99.9% cache availability
- Horizontal scaling capability

## Decision
We will implement a **multi-layered caching strategy** using Redis as the primary caching technology with the following layers:

1. **L1 Cache**: Application-level in-memory cache (Node.js)
2. **L2 Cache**: Redis distributed cache cluster
3. **CDN Cache**: CloudFlare for static assets and API responses
4. **Database Query Cache**: PostgreSQL query result caching

## Rationale

### Redis as Primary Cache

**Why Redis:**
- **Performance**: Sub-millisecond latency for most operations
- **Data Structures**: Rich set of data types (strings, hashes, lists, sets, sorted sets)
- **Persistence**: Optional durability with RDB and AOF
- **Clustering**: Native horizontal scaling support
- **Pub/Sub**: Real-time messaging capabilities
- **Atomic Operations**: ACID-like guarantees for cache operations
- **Memory Efficiency**: Optimized memory usage and compression

**Redis Cluster Configuration:**
```yaml
cluster:
  nodes: 6 (3 masters, 3 replicas)
  memory_per_node: 8GB
  persistence: RDB + AOF
  maxmemory_policy: allkeys-lru
```

### Multi-Layer Cache Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer                            │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     CDN Cache                              │
│                  (CloudFlare)                              │
│                   TTL: 1-60 minutes                        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   L1 Cache (Local)                         │
│                 Node.js Memory                             │
│                  TTL: 5-30 seconds                         │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   L2 Cache (Redis)                         │
│                Distributed Cache                           │
│                 TTL: 1-60 minutes                          │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Database Layer                            │
│            PostgreSQL + MongoDB                            │
└─────────────────────────────────────────────────────────────┘
```

## Cache Strategy by Data Type

### 1. Real-time Price Data

**Cache Pattern**: Write-through with TTL
**TTL**: 60 seconds
**Data Structure**: Redis Hash

```typescript
// Cache key pattern: price:{symbol}:USD
interface PriceCache {
  price: number;
  volume24h: number;
  change24h: number;
  timestamp: number;
  source: string;
}

class PriceCacheService {
  async getPrice(symbol: string): Promise<PriceCache | null> {
    // L1 Cache check
    const localPrice = this.localCache.get(`price:${symbol}`);
    if (localPrice && !this.isExpired(localPrice, 30000)) {
      return localPrice;
    }

    // L2 Cache check (Redis)
    const cachedPrice = await this.redis.hgetall(`price:${symbol}:USD`);
    if (cachedPrice && Object.keys(cachedPrice).length > 0) {
      // Update L1 cache
      this.localCache.set(`price:${symbol}`, cachedPrice, 30000);
      return cachedPrice;
    }

    // Cache miss - fetch from source
    const priceData = await this.fetchFromExchange(symbol);
    if (priceData) {
      // Store in Redis with TTL
      await this.redis.hmset(`price:${symbol}:USD`, priceData);
      await this.redis.expire(`price:${symbol}:USD`, 60);
      
      // Store in L1 cache
      this.localCache.set(`price:${symbol}`, priceData, 30000);
    }

    return priceData;
  }
}
```

### 2. Portfolio Calculations

**Cache Pattern**: Cache-aside with invalidation
**TTL**: 5 minutes (300 seconds)
**Data Structure**: Redis Hash

```typescript
interface PortfolioSummary {
  totalValue: number;
  totalGainLoss: number;
  percentageChange: number;
  lastUpdated: number;
  holdings: Array<{
    symbol: string;
    quantity: number;
    value: number;
    gainLoss: number;
  }>;
}

class PortfolioCacheService {
  async getPortfolioSummary(userId: string): Promise<PortfolioSummary | null> {
    const cacheKey = `portfolio:summary:${userId}`;
    
    // Check Redis cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Calculate from database
    const summary = await this.calculatePortfolioSummary(userId);
    if (summary) {
      // Cache for 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify(summary));
    }

    return summary;
  }

  async invalidatePortfolioCache(userId: string): Promise<void> {
    const patterns = [
      `portfolio:summary:${userId}`,
      `portfolio:holdings:${userId}`,
      `portfolio:performance:${userId}:*`
    ];

    for (const pattern of patterns) {
      if (pattern.includes('*')) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } else {
        await this.redis.del(pattern);
      }
    }
  }
}
```

### 3. Session Management

**Cache Pattern**: Write-through
**TTL**: 1 hour (3600 seconds)
**Data Structure**: Redis String with JSON

```typescript
interface UserSession {
  userId: string;
  email: string;
  roles: string[];
  lastActivity: number;
  ipAddress: string;
  deviceInfo: string;
}

class SessionCacheService {
  async createSession(sessionId: string, sessionData: UserSession): Promise<void> {
    const sessionKey = `session:${sessionId}`;
    
    await this.redis.setex(
      sessionKey,
      3600, // 1 hour
      JSON.stringify(sessionData)
    );

    // Track active sessions for user
    const userSessionsKey = `user:sessions:${sessionData.userId}`;
    await this.redis.sadd(userSessionsKey, sessionId);
    await this.redis.expire(userSessionsKey, 3600);
  }

  async getSession(sessionId: string): Promise<UserSession | null> {
    const sessionKey = `session:${sessionId}`;
    const sessionData = await this.redis.get(sessionKey);
    
    if (!sessionData) {
      return null;
    }

    // Extend session TTL on access
    await this.redis.expire(sessionKey, 3600);
    
    return JSON.parse(sessionData);
  }
}
```

### 4. Rate Limiting

**Cache Pattern**: Counter with TTL
**TTL**: Based on rate limit window
**Data Structure**: Redis String (counter)

```typescript
class RateLimitCache {
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Math.floor(Date.now() / 1000);
    const window = Math.floor(now / windowSeconds) * windowSeconds;
    const rateLimitKey = `rate_limit:${key}:${window}`;

    // Use Redis pipeline for atomic operations
    const pipeline = this.redis.pipeline();
    pipeline.incr(rateLimitKey);
    pipeline.expire(rateLimitKey, windowSeconds);
    
    const results = await pipeline.exec();
    const count = results[0][1] as number;

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetTime: window + windowSeconds
    };
  }
}
```

### 5. API Response Caching

**Cache Pattern**: Cache-aside with ETag support
**TTL**: Variable based on endpoint
**Data Structure**: Redis String with metadata

```typescript
class APIResponseCache {
  async cacheResponse(
    cacheKey: string,
    response: any,
    ttlSeconds: number,
    etag?: string
  ): Promise<void> {
    const cacheData = {
      data: response,
      etag: etag || this.generateETag(response),
      cachedAt: Date.now(),
      ttl: ttlSeconds
    };

    await this.redis.setex(
      cacheKey,
      ttlSeconds,
      JSON.stringify(cacheData)
    );
  }

  async getCachedResponse(cacheKey: string): Promise<{
    data: any;
    etag: string;
    hit: boolean;
  } | null> {
    const cached = await this.redis.get(cacheKey);
    
    if (!cached) {
      return null;
    }

    const cacheData = JSON.parse(cached);
    
    return {
      data: cacheData.data,
      etag: cacheData.etag,
      hit: true
    };
  }
}
```

## Cache Invalidation Strategy

### Event-Driven Invalidation

```typescript
class CacheInvalidationService {
  private eventBus: EventBus;

  constructor() {
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.eventBus.on('portfolio.updated', this.handlePortfolioUpdate.bind(this));
    this.eventBus.on('price.updated', this.handlePriceUpdate.bind(this));
    this.eventBus.on('user.logout', this.handleUserLogout.bind(this));
  }

  private async handlePortfolioUpdate(event: PortfolioUpdateEvent): Promise<void> {
    const userId = event.userId;
    
    // Invalidate portfolio-related caches
    await this.invalidatePattern(`portfolio:*:${userId}`);
    
    // Notify other instances via Redis pub/sub
    await this.redis.publish('cache:invalidate', JSON.stringify({
      pattern: `portfolio:*:${userId}`,
      reason: 'portfolio_updated'
    }));
  }

  private async handlePriceUpdate(event: PriceUpdateEvent): Promise<void> {
    const symbol = event.symbol;
    
    // Invalidate price caches
    await this.redis.del(`price:${symbol}:USD`);
    
    // Invalidate dependent portfolio caches
    const affectedUsers = await this.getUsersWithSymbol(symbol);
    for (const userId of affectedUsers) {
      await this.invalidatePattern(`portfolio:*:${userId}`);
    }
  }
}
```

### Time-Based Invalidation (TTL)

```typescript
const cacheTTLConfig = {
  // Real-time data
  prices: 60,              // 1 minute
  market_status: 300,      // 5 minutes
  
  // User data
  portfolio_summary: 300,  // 5 minutes
  user_profile: 1800,      // 30 minutes
  user_preferences: 3600,  // 1 hour
  
  // Static-ish data
  exchange_info: 3600,     // 1 hour
  cryptocurrency_list: 7200, // 2 hours
  
  // Session data
  user_sessions: 3600,     // 1 hour
  api_tokens: 1800,        // 30 minutes
  
  // Rate limiting
  rate_limits: 60,         // 1 minute (based on window)
  
  // Analytics
  portfolio_analytics: 900, // 15 minutes
  market_analytics: 600,   // 10 minutes
};
```

## Performance Optimization

### Memory Optimization

```typescript
class CacheOptimization {
  // Use appropriate Redis data structures
  private optimizeDataStructure(data: any): string {
    // For small objects, use JSON strings
    if (this.isSmallObject(data)) {
      return JSON.stringify(data);
    }
    
    // For large objects with known structure, use Redis hashes
    if (this.isStructuredData(data)) {
      return this.serializeAsHash(data);
    }
    
    // For arrays, use Redis lists
    if (Array.isArray(data)) {
      return this.serializeAsList(data);
    }
    
    return JSON.stringify(data);
  }

  // Compress large cache values
  private async compressValue(value: string): Promise<string> {
    if (value.length > 1024) { // 1KB threshold
      return zlib.deflateSync(value).toString('base64');
    }
    return value;
  }

  // Pipeline operations for better performance
  private async batchCacheOperations(operations: CacheOperation[]): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    for (const op of operations) {
      switch (op.type) {
        case 'set':
          pipeline.setex(op.key, op.ttl, op.value);
          break;
        case 'del':
          pipeline.del(op.key);
          break;
        case 'expire':
          pipeline.expire(op.key, op.ttl);
          break;
      }
    }
    
    await pipeline.exec();
  }
}
```

### Connection Pooling

```typescript
class RedisConnectionManager {
  private cluster: Cluster;
  private readonly config = {
    enableOfflineQueue: false,
    connectTimeout: 10000,
    commandTimeout: 5000,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    keepAlive: 30000,
    
    // Connection pool settings
    poolSize: 50,
    acquireTimeout: 10000,
    
    // Cluster specific
    enableReadyCheck: true,
    redisOptions: {
      commandTimeout: 5000,
      lazyConnect: true
    }
  };

  constructor() {
    this.cluster = new Redis.Cluster([
      { host: 'redis-1', port: 6379 },
      { host: 'redis-2', port: 6379 },
      { host: 'redis-3', port: 6379 },
      { host: 'redis-4', port: 6379 },
      { host: 'redis-5', port: 6379 },
      { host: 'redis-6', port: 6379 }
    ], this.config);
  }
}
```

## Monitoring and Observability

### Cache Metrics

```typescript
class CacheMetrics {
  private prometheus: any;

  constructor() {
    this.setupMetrics();
  }

  private setupMetrics(): void {
    this.cacheHitRate = new this.prometheus.Histogram({
      name: 'cache_hit_rate',
      help: 'Cache hit rate by cache type',
      labelNames: ['cache_type', 'cache_key_pattern']
    });

    this.cacheOperationDuration = new this.prometheus.Histogram({
      name: 'cache_operation_duration_seconds',
      help: 'Duration of cache operations',
      labelNames: ['operation', 'cache_type']
    });

    this.cacheMemoryUsage = new this.prometheus.Gauge({
      name: 'cache_memory_usage_bytes',
      help: 'Memory usage by cache instance',
      labelNames: ['instance', 'database']
    });
  }

  recordCacheHit(cacheType: string, keyPattern: string): void {
    this.cacheHitRate.observe({ cache_type: cacheType, cache_key_pattern: keyPattern }, 1);
  }

  recordCacheMiss(cacheType: string, keyPattern: string): void {
    this.cacheHitRate.observe({ cache_type: cacheType, cache_key_pattern: keyPattern }, 0);
  }

  async collectRedisMetrics(): Promise<void> {
    const info = await this.redis.info();
    const stats = this.parseRedisInfo(info);
    
    this.cacheMemoryUsage.set(
      { instance: 'redis-cluster', database: '0' },
      stats.used_memory
    );
  }
}
```

### Cache Health Checks

```typescript
class CacheHealthCheck {
  async checkCacheHealth(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkRedisConnectivity(),
      this.checkCachePerformance(),
      this.checkMemoryUsage(),
      this.checkClusterStatus()
    ]);

    const failures = checks.filter(result => result.status === 'rejected');
    
    return {
      status: failures.length === 0 ? 'healthy' : 'unhealthy',
      checks: checks.map((result, index) => ({
        name: ['connectivity', 'performance', 'memory', 'cluster'][index],
        status: result.status,
        details: result.status === 'fulfilled' ? result.value : result.reason
      }))
    };
  }

  private async checkRedisConnectivity(): Promise<boolean> {
    const start = Date.now();
    await this.redis.ping();
    const latency = Date.now() - start;
    
    if (latency > 100) {
      throw new Error(`Redis latency too high: ${latency}ms`);
    }
    
    return true;
  }

  private async checkCachePerformance(): Promise<boolean> {
    const testKey = `health_check_${Date.now()}`;
    const testValue = 'health_check_value';
    
    const start = Date.now();
    
    // Test write
    await this.redis.setex(testKey, 10, testValue);
    
    // Test read
    const result = await this.redis.get(testKey);
    
    // Cleanup
    await this.redis.del(testKey);
    
    const duration = Date.now() - start;
    
    if (duration > 50 || result !== testValue) {
      throw new Error(`Cache performance test failed: ${duration}ms`);
    }
    
    return true;
  }
}
```

## Cache Configuration by Environment

### Development
```yaml
redis:
  host: localhost
  port: 6379
  db: 0
  maxRetriesPerRequest: 3
  retryDelayOnFailover: 100
  enableOfflineQueue: false
  ttl:
    prices: 30        # 30 seconds
    portfolio: 60     # 1 minute
    sessions: 1800    # 30 minutes
```

### Staging
```yaml
redis:
  cluster:
    enabled: true
    nodes: 3
    enableReadyCheck: true
  maxRetriesPerRequest: 3
  retryDelayOnFailover: 100
  enableOfflineQueue: false
  ttl:
    prices: 60       # 1 minute
    portfolio: 300   # 5 minutes
    sessions: 3600   # 1 hour
```

### Production
```yaml
redis:
  cluster:
    enabled: true
    nodes: 6
    enableReadyCheck: true
    redisOptions:
      password: ${REDIS_PASSWORD}
      tls: {}
  maxRetriesPerRequest: 3
  retryDelayOnFailover: 100
  enableOfflineQueue: false
  ttl:
    prices: 60       # 1 minute
    portfolio: 300   # 5 minutes
    sessions: 3600   # 1 hour
    analytics: 1800  # 30 minutes
```

## Success Metrics

### Performance Targets
- **Cache Hit Rate**: > 95% for price data, > 90% for portfolio data
- **Cache Response Time**: < 1ms for Redis operations
- **Memory Efficiency**: < 80% memory usage per Redis node
- **Availability**: 99.9% cache availability

### Monitoring Alerts
- Cache hit rate drops below 85%
- Cache response time exceeds 5ms
- Memory usage exceeds 90%
- Redis cluster node failures

## Cost Optimization

### Memory Usage Strategy
```typescript
const memoryOptimization = {
  // Use efficient data structures
  dataStructures: {
    smallObjects: 'JSON string',      // < 1KB
    largeObjects: 'Redis hash',       // > 1KB
    lists: 'Redis list',
    counters: 'Redis string'
  },
  
  // Compression for large values
  compression: {
    threshold: 1024,    // 1KB
    algorithm: 'gzip'
  },
  
  // Eviction policy
  evictionPolicy: 'allkeys-lru',
  
  // Memory monitoring
  maxMemoryPolicy: 'warn-at-80-percent',
  alertThreshold: 90
};
```

This caching strategy provides a robust, scalable, and efficient foundation for our crypto portfolio application's performance requirements while maintaining data consistency and system reliability.