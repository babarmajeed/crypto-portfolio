# Redis Caching Layer Architecture

## Overview
Multi-layered caching strategy using Redis for real-time price data, session management, and application performance optimization.

## Cache Architecture Design

### Redis Cluster Configuration

```yaml
# Production Redis Cluster
redis:
  cluster:
    enabled: true
    nodes: 6
    replicas: 1
    node-timeout: 15000
    fail-timeout: 5000
  
  # Memory configuration
  memory:
    maxmemory: 8gb
    maxmemory-policy: allkeys-lru
    
  # Persistence
  persistence:
    rdb:
      enabled: true
      save: "900 1 300 10 60 10000"
    aof:
      enabled: true
      appendfsync: everysec
      auto-aof-rewrite-percentage: 100
      auto-aof-rewrite-min-size: 64mb
```

### Cache Layer Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     L1 Cache (Local)                       │
│                   Node.js Memory Cache                     │
│                     TTL: 5-30 seconds                      │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     L2 Cache (Redis)                       │
│                  Distributed Cache Layer                   │
│                    TTL: 1-60 minutes                       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Database Layer                          │
│              PostgreSQL + MongoDB + APIs                   │
└─────────────────────────────────────────────────────────────┘
```

## Cache Patterns and Use Cases

### 1. Real-time Price Data Cache

**Cache-Aside Pattern for Market Data:**

```typescript
interface PriceData {
  symbol: string;
  price: number;
  volume24h: number;
  change24h: number;
  timestamp: number;
  source: string;
}

class PriceCache {
  private redis: RedisCluster;
  private localCache: Map<string, { data: PriceData; expires: number }>;

  async getPrice(symbol: string): Promise<PriceData | null> {
    // L1 Cache check (local memory)
    const localCached = this.getFromLocalCache(symbol);
    if (localCached && localCached.expires > Date.now()) {
      return localCached.data;
    }

    // L2 Cache check (Redis)
    const cacheKey = `price:${symbol}:USD`;
    const cached = await this.redis.hgetall(cacheKey);
    
    if (cached && Object.keys(cached).length > 0) {
      const priceData = this.deserializePriceData(cached);
      
      // Update L1 cache
      this.setLocalCache(symbol, priceData, 30000); // 30 seconds
      
      return priceData;
    }

    // Cache miss - fetch from source
    const priceData = await this.fetchFromExchange(symbol);
    
    if (priceData) {
      // Store in Redis with TTL
      await this.redis.hmset(cacheKey, this.serializePriceData(priceData));
      await this.redis.expire(cacheKey, 60); // 1 minute TTL
      
      // Store in local cache
      this.setLocalCache(symbol, priceData, 30000);
    }

    return priceData;
  }

  async updatePrice(symbol: string, priceData: PriceData): Promise<void> {
    const cacheKey = `price:${symbol}:USD`;
    
    // Update Redis
    await this.redis.hmset(cacheKey, this.serializePriceData(priceData));
    await this.redis.expire(cacheKey, 60);
    
    // Update local cache
    this.setLocalCache(symbol, priceData, 30000);
    
    // Publish to subscribers
    await this.redis.publish(`price_update:${symbol}`, JSON.stringify(priceData));
  }
}
```

### 2. Portfolio Data Cache

**Write-Through Pattern for Portfolio Calculations:**

```typescript
interface PortfolioSummary {
  userId: string;
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

class PortfolioCache {
  private redis: RedisCluster;

  async getPortfolioSummary(userId: string): Promise<PortfolioSummary | null> {
    const cacheKey = `portfolio:summary:${userId}`;
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

**Session Store with Redis:**

```typescript
interface UserSession {
  userId: string;
  email: string;
  roles: string[];
  lastActivity: number;
  ipAddress: string;
  userAgent: string;
}

class SessionStore {
  private redis: RedisCluster;
  private sessionTTL = 3600; // 1 hour

  async createSession(sessionId: string, sessionData: UserSession): Promise<void> {
    const sessionKey = `session:${sessionId}`;
    
    await this.redis.setex(
      sessionKey,
      this.sessionTTL,
      JSON.stringify(sessionData)
    );

    // Track active sessions for user
    const userSessionsKey = `user:sessions:${sessionData.userId}`;
    await this.redis.sadd(userSessionsKey, sessionId);
    await this.redis.expire(userSessionsKey, this.sessionTTL);
  }

  async getSession(sessionId: string): Promise<UserSession | null> {
    const sessionKey = `session:${sessionId}`;
    const sessionData = await this.redis.get(sessionKey);
    
    if (!sessionData) {
      return null;
    }

    // Extend session TTL on access
    await this.redis.expire(sessionKey, this.sessionTTL);
    
    return JSON.parse(sessionData);
  }

  async destroySession(sessionId: string): Promise<void> {
    const sessionKey = `session:${sessionId}`;
    const sessionData = await this.getSession(sessionId);
    
    if (sessionData) {
      // Remove from user's active sessions
      const userSessionsKey = `user:sessions:${sessionData.userId}`;
      await this.redis.srem(userSessionsKey, sessionId);
    }

    await this.redis.del(sessionKey);
  }

  async destroyAllUserSessions(userId: string): Promise<void> {
    const userSessionsKey = `user:sessions:${userId}`;
    const sessionIds = await this.redis.smembers(userSessionsKey);
    
    const pipeline = this.redis.pipeline();
    
    for (const sessionId of sessionIds) {
      pipeline.del(`session:${sessionId}`);
    }
    
    pipeline.del(userSessionsKey);
    await pipeline.exec();
  }
}
```

### 4. Rate Limiting

**Token Bucket Rate Limiting:**

```typescript
class RateLimiter {
  private redis: RedisCluster;

  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Math.floor(Date.now() / 1000);
    const window = Math.floor(now / windowSeconds) * windowSeconds;
    const rateLimitKey = `rate_limit:${key}:${window}`;

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

  async checkApiRateLimit(
    userId: string,
    endpoint: string
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = `api:${userId}:${endpoint}`;
    
    // Different limits per endpoint
    const limits = {
      '/api/portfolio': { limit: 100, window: 60 }, // 100 per minute
      '/api/prices': { limit: 1000, window: 60 },   // 1000 per minute
      '/api/transactions': { limit: 50, window: 60 } // 50 per minute
    };

    const config = limits[endpoint] || { limit: 60, window: 60 };
    
    return this.checkRateLimit(key, config.limit, config.window);
  }
}
```

### 5. WebSocket Connection Tracking

**Connection Management:**

```typescript
class WebSocketConnectionCache {
  private redis: RedisCluster;

  async addConnection(userId: string, connectionId: string, subscriptions: string[]): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    // Track user connections
    pipeline.sadd(`ws:user:${userId}`, connectionId);
    pipeline.expire(`ws:user:${userId}`, 3600);
    
    // Store connection metadata
    pipeline.hmset(`ws:connection:${connectionId}`, {
      userId,
      connectedAt: Date.now(),
      subscriptions: JSON.stringify(subscriptions)
    });
    pipeline.expire(`ws:connection:${connectionId}`, 3600);
    
    // Add to subscription groups
    for (const subscription of subscriptions) {
      pipeline.sadd(`ws:subscription:${subscription}`, connectionId);
      pipeline.expire(`ws:subscription:${subscription}`, 3600);
    }
    
    await pipeline.exec();
  }

  async removeConnection(connectionId: string): Promise<void> {
    const connectionData = await this.redis.hgetall(`ws:connection:${connectionId}`);
    
    if (!connectionData.userId) {
      return;
    }

    const pipeline = this.redis.pipeline();
    const subscriptions = JSON.parse(connectionData.subscriptions || '[]');
    
    // Remove from user connections
    pipeline.srem(`ws:user:${connectionData.userId}`, connectionId);
    
    // Remove from subscriptions
    for (const subscription of subscriptions) {
      pipeline.srem(`ws:subscription:${subscription}`, connectionId);
    }
    
    // Remove connection metadata
    pipeline.del(`ws:connection:${connectionId}`);
    
    await pipeline.exec();
  }

  async getUserConnections(userId: string): Promise<string[]> {
    return this.redis.smembers(`ws:user:${userId}`);
  }

  async getSubscriptionConnections(subscription: string): Promise<string[]> {
    return this.redis.smembers(`ws:subscription:${subscription}`);
  }
}
```

## Cache Invalidation Strategy

### Event-Driven Cache Invalidation

```typescript
class CacheInvalidationService {
  private redis: RedisCluster;
  private eventBus: EventBus;

  constructor() {
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.eventBus.on('portfolio.updated', this.handlePortfolioUpdate.bind(this));
    this.eventBus.on('price.updated', this.handlePriceUpdate.bind(this));
    this.eventBus.on('transaction.created', this.handleTransactionCreated.bind(this));
  }

  private async handlePortfolioUpdate(event: PortfolioUpdateEvent): Promise<void> {
    const userId = event.userId;
    
    // Invalidate portfolio-related caches
    const keysToInvalidate = [
      `portfolio:summary:${userId}`,
      `portfolio:holdings:${userId}`,
      `portfolio:performance:${userId}:*`
    ];

    await this.invalidateKeys(keysToInvalidate);
  }

  private async handlePriceUpdate(event: PriceUpdateEvent): Promise<void> {
    const symbol = event.symbol;
    
    // Update price cache
    await this.redis.hmset(`price:${symbol}:USD`, {
      price: event.price,
      volume24h: event.volume24h,
      change24h: event.change24h,
      timestamp: Date.now()
    });
    
    // Invalidate dependent caches
    const affectedPortfolios = await this.getPortfoliosWithSymbol(symbol);
    
    for (const userId of affectedPortfolios) {
      await this.handlePortfolioUpdate({ userId, symbol } as PortfolioUpdateEvent);
    }
  }

  private async invalidateKeys(patterns: string[]): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    for (const pattern of patterns) {
      if (pattern.includes('*')) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          keys.forEach(key => pipeline.del(key));
        }
      } else {
        pipeline.del(pattern);
      }
    }
    
    await pipeline.exec();
  }
}
```

## Performance Monitoring

### Cache Metrics Collection

```typescript
class CacheMetrics {
  private redis: RedisCluster;
  
  async collectMetrics(): Promise<CacheMetricsData> {
    const info = await this.redis.info();
    const stats = this.parseRedisInfo(info);
    
    return {
      hitRate: this.calculateHitRate(stats),
      memoryUsage: stats.used_memory,
      memoryPeak: stats.used_memory_peak,
      connectedClients: stats.connected_clients,
      totalCommandsProcessed: stats.total_commands_processed,
      keyspaceHits: stats.keyspace_hits,
      keyspaceMisses: stats.keyspace_misses,
      evictedKeys: stats.evicted_keys,
      expiredKeys: stats.expired_keys
    };
  }

  private calculateHitRate(stats: any): number {
    const hits = parseInt(stats.keyspace_hits || '0');
    const misses = parseInt(stats.keyspace_misses || '0');
    const total = hits + misses;
    
    return total > 0 ? (hits / total) * 100 : 0;
  }
}
```

## Cache Configuration by Environment

### Development Environment
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
    sessions: 3600    # 1 hour
```

### Production Environment
```yaml
redis:
  cluster:
    enabled: true
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

This caching architecture provides:
- **High Performance**: Multi-level caching with local and distributed layers
- **Scalability**: Redis clustering for horizontal scaling
- **Reliability**: Persistence and replication for data durability
- **Flexibility**: Different TTL strategies for different data types
- **Monitoring**: Comprehensive metrics and alerting capabilities