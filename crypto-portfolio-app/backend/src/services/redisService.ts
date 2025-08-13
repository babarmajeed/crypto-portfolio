import Redis from 'ioredis';
import { logger } from '../utils/logger';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  compress?: boolean;
}

interface PriceData {
  price: number;
  change24h?: number;
  volume24h?: number;
  marketCap?: number;
  lastUpdated: string;
}

interface PortfolioCache {
  totalValue: number;
  totalCost: number;
  holdings: Array<{
    symbol: string;
    quantity: number;
    value: number;
  }>;
  lastUpdated: string;
}

interface RateLimitData {
  count: number;
  resetTime: number;
}

export class RedisService {
  private client: Redis;
  private isConnected: boolean = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    this.client = new Redis(redisUrl, {
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Connected to Redis');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      logger.error('Redis connection error:', error);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      logger.warn('Redis connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      logger.info('Reconnecting to Redis...');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.isConnected = true;
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
      this.isConnected = false;
      logger.info('Redis disconnected');
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
    }
  }

  /**
   * Generic cache methods
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) return null;

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Error getting key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, options: CacheOptions = {}): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      const serializedValue = JSON.stringify(value);
      
      if (options.ttl) {
        await this.client.setex(key, options.ttl, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
      
      return true;
    } catch (error) {
      logger.error(`Error setting key ${key}:`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error(`Error deleting key ${key}:`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Error checking existence of key ${key}:`, error);
      return false;
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      await this.client.expire(key, seconds);
      return true;
    } catch (error) {
      logger.error(`Error setting expiry for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Price caching methods
   */
  async cachePrice(symbol: string, priceData: PriceData): Promise<boolean> {
    const key = `price:${symbol.toUpperCase()}`;
    return this.set(key, priceData, { ttl: 300 }); // 5 minutes TTL
  }

  async getCachedPrice(symbol: string): Promise<PriceData | null> {
    const key = `price:${symbol.toUpperCase()}`;
    return this.get<PriceData>(key);
  }

  async cacheMultiplePrices(prices: Record<string, PriceData>): Promise<void> {
    if (!this.isConnected) return;

    const pipeline = this.client.pipeline();
    
    Object.entries(prices).forEach(([symbol, priceData]) => {
      const key = `price:${symbol.toUpperCase()}`;
      pipeline.setex(key, 300, JSON.stringify(priceData));
    });

    try {
      await pipeline.exec();
    } catch (error) {
      logger.error('Error caching multiple prices:', error);
    }
  }

  /**
   * Portfolio caching methods
   */
  async cachePortfolio(portfolioId: string, portfolioData: PortfolioCache): Promise<boolean> {
    const key = `portfolio:${portfolioId}`;
    return this.set(key, portfolioData, { ttl: 600 }); // 10 minutes TTL
  }

  async getCachedPortfolio(portfolioId: string): Promise<PortfolioCache | null> {
    const key = `portfolio:${portfolioId}`;
    return this.get<PortfolioCache>(key);
  }

  async invalidatePortfolioCache(portfolioId: string): Promise<boolean> {
    const key = `portfolio:${portfolioId}`;
    return this.del(key);
  }

  /**
   * Market data caching
   */
  async cacheMarketData(data: any): Promise<boolean> {
    const key = 'market:overview';
    return this.set(key, data, { ttl: 300 }); // 5 minutes TTL
  }

  async getCachedMarketData(): Promise<any> {
    const key = 'market:overview';
    return this.get(key);
  }

  /**
   * User session management
   */
  async storeSession(sessionId: string, sessionData: any, ttl: number = 86400): Promise<boolean> {
    const key = `session:${sessionId}`;
    return this.set(key, sessionData, { ttl });
  }

  async getSession(sessionId: string): Promise<any> {
    const key = `session:${sessionId}`;
    return this.get(key);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const key = `session:${sessionId}`;
    return this.del(key);
  }

  async extendSession(sessionId: string, ttl: number = 86400): Promise<boolean> {
    const key = `session:${sessionId}`;
    return this.expire(key, ttl);
  }

  /**
   * Rate limiting
   */
  async incrementRateLimit(
    identifier: string,
    windowSeconds: number = 60,
    maxRequests: number = 100
  ): Promise<RateLimitData> {
    if (!this.isConnected) {
      return { count: 1, resetTime: Date.now() + (windowSeconds * 1000) };
    }

    const key = `rate_limit:${identifier}`;
    const now = Date.now();
    const resetTime = now + (windowSeconds * 1000);

    try {
      const pipeline = this.client.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, windowSeconds);
      
      const results = await pipeline.exec();
      const count = results?.[0]?.[1] as number || 1;

      return {
        count,
        resetTime,
      };
    } catch (error) {
      logger.error(`Error incrementing rate limit for ${identifier}:`, error);
      return { count: 1, resetTime };
    }
  }

  async getRateLimit(identifier: string): Promise<RateLimitData | null> {
    if (!this.isConnected) return null;

    const key = `rate_limit:${identifier}`;
    
    try {
      const [count, ttl] = await Promise.all([
        this.client.get(key),
        this.client.ttl(key),
      ]);

      if (!count) return null;

      return {
        count: parseInt(count, 10),
        resetTime: Date.now() + (ttl * 1000),
      };
    } catch (error) {
      logger.error(`Error getting rate limit for ${identifier}:`, error);
      return null;
    }
  }

  /**
   * Exchange API rate limiting
   */
  async checkExchangeRateLimit(exchangeName: string, apiKey: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    const identifier = `exchange:${exchangeName}:${apiKey.substring(0, 8)}`;
    const rateLimit = await this.incrementRateLimit(identifier, 60, 60); // 60 requests per minute
    
    return {
      allowed: rateLimit.count <= 60,
      remaining: Math.max(0, 60 - rateLimit.count),
      resetTime: rateLimit.resetTime,
    };
  }

  /**
   * WebSocket connection tracking
   */
  async trackWebSocketConnection(userId: string, connectionId: string): Promise<boolean> {
    const key = `ws:user:${userId}`;
    
    try {
      await this.client.sadd(key, connectionId);
      await this.client.expire(key, 3600); // 1 hour TTL
      return true;
    } catch (error) {
      logger.error(`Error tracking WebSocket connection:`, error);
      return false;
    }
  }

  async removeWebSocketConnection(userId: string, connectionId: string): Promise<boolean> {
    const key = `ws:user:${userId}`;
    
    try {
      await this.client.srem(key, connectionId);
      return true;
    } catch (error) {
      logger.error(`Error removing WebSocket connection:`, error);
      return false;
    }
  }

  async getUserWebSocketConnections(userId: string): Promise<string[]> {
    const key = `ws:user:${userId}`;
    
    try {
      return await this.client.smembers(key);
    } catch (error) {
      logger.error(`Error getting WebSocket connections:`, error);
      return [];
    }
  }

  /**
   * Background job queues (simple implementation)
   */
  async enqueueJob(queueName: string, jobData: any, delay: number = 0): Promise<boolean> {
    if (!this.isConnected) return false;

    const job = {
      id: `job_${Date.now()}_${Math.random()}`,
      data: jobData,
      createdAt: new Date().toISOString(),
      executeAt: new Date(Date.now() + (delay * 1000)).toISOString(),
    };

    try {
      const score = Date.now() + (delay * 1000);
      await this.client.zadd(`queue:${queueName}`, score, JSON.stringify(job));
      return true;
    } catch (error) {
      logger.error(`Error enqueuing job to ${queueName}:`, error);
      return false;
    }
  }

  async dequeueJob(queueName: string): Promise<any> {
    if (!this.isConnected) return null;

    try {
      const now = Date.now();
      const jobs = await this.client.zrangebyscore(`queue:${queueName}`, 0, now, 'LIMIT', 0, 1);
      
      if (jobs.length === 0) return null;

      const jobStr = jobs[0];
      await this.client.zrem(`queue:${queueName}`, jobStr);
      
      return JSON.parse(jobStr);
    } catch (error) {
      logger.error(`Error dequeuing job from ${queueName}:`, error);
      return null;
    }
  }

  /**
   * Caching patterns
   */
  async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttl: number = 300
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached) return cached;

    // Fetch fresh data
    const freshData = await fetchFunction();
    
    // Cache the result
    await this.set(key, freshData, { ttl });
    
    return freshData;
  }

  /**
   * Cache invalidation patterns
   */
  async invalidatePattern(pattern: string): Promise<number> {
    if (!this.isConnected) return 0;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;

      await this.client.del(...keys);
      return keys.length;
    } catch (error) {
      logger.error(`Error invalidating pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    connected: boolean;
    latency?: number;
  }> {
    if (!this.isConnected) {
      return {
        status: 'unhealthy',
        connected: false,
      };
    }

    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      return {
        status: 'healthy',
        connected: true,
        latency,
      };
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return {
        status: 'unhealthy',
        connected: false,
      };
    }
  }

  /**
   * Memory usage statistics
   */
  async getMemoryStats(): Promise<any> {
    if (!this.isConnected) return null;

    try {
      const info = await this.client.memory('usage');
      const stats = await this.client.info('memory');
      
      return {
        usage: info,
        stats: stats,
      };
    } catch (error) {
      logger.error('Error getting Redis memory stats:', error);
      return null;
    }
  }

  /**
   * Additional Redis operations needed by WebSocket rate limiting
   */
  async incr(key: string): Promise<number> {
    if (!this.isConnected) return 1;

    try {
      return await this.client.incr(key);
    } catch (error) {
      logger.error(`Error incrementing key ${key}:`, error);
      return 1;
    }
  }

  async decr(key: string): Promise<number> {
    if (!this.isConnected) return 0;

    try {
      return await this.client.decr(key);
    } catch (error) {
      logger.error(`Error decrementing key ${key}:`, error);
      return 0;
    }
  }

  async setex(key: string, seconds: number, value: string): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      await this.client.setex(key, seconds, value);
      return true;
    } catch (error) {
      logger.error(`Error setting key ${key} with expiry:`, error);
      return false;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.isConnected) return [];

    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error(`Error getting keys with pattern ${pattern}:`, error);
      return [];
    }
  }

  async ping(): Promise<string> {
    if (!this.isConnected) throw new Error('Redis not connected');

    try {
      return await this.client.ping();
    } catch (error) {
      logger.error('Error pinging Redis:', error);
      throw error;
    }
  }

  getClient(): Redis {
    return this.client;
  }
}

// Singleton instance
export const redisService = new RedisService();