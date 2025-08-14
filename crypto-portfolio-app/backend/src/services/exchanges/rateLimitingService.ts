import { EventEmitter } from 'events';
import { loggingService } from '../loggingService';
import { cacheService } from '../cacheService';
import { prisma } from '../../config/database';

interface RateLimitRule {
  exchange: string;
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  maxRequests: number;
  windowMs: number;
  weight?: number;
  resetTime?: number;
  burstAllowed?: boolean;
  burstLimit?: number;
}

interface RateLimitStatus {
  exchange: string;
  endpoint?: string;
  currentRequests: number;
  maxRequests: number;
  windowMs: number;
  resetTime: number;
  remaining: number;
  retryAfter?: number;
  isBlocked: boolean;
  weight: number;
}

interface ExchangeRateLimit {
  exchange: string;
  globalLimit: RateLimitRule;
  endpointLimits: Map<string, RateLimitRule>;
  ipLimits?: RateLimitRule;
  userLimits?: Map<string, RateLimitRule>;
}

interface RequestRecord {
  timestamp: number;
  endpoint: string;
  method: string;
  weight: number;
  userId?: string;
  success: boolean;
  rateLimited: boolean;
}

class RateLimitingService extends EventEmitter {
  private rateLimits = new Map<string, ExchangeRateLimit>();
  private requestHistory = new Map<string, RequestRecord[]>();
  private blockedUntil = new Map<string, number>();
  private burstCounters = new Map<string, { count: number; resetTime: number }>();

  constructor() {
    super();
    this.setMaxListeners(100);
    this.initializeExchangeRateLimits();
  }

  private initializeExchangeRateLimits(): void {
    // Binance rate limits
    const binanceRateLimits: ExchangeRateLimit = {
      exchange: 'binance',
      globalLimit: {
        exchange: 'binance',
        maxRequests: 1200,
        windowMs: 60000, // 1 minute
        weight: 1,
        burstAllowed: true,
        burstLimit: 100
      },
      endpointLimits: new Map([
        ['orders', {
          exchange: 'binance',
          endpoint: 'orders',
          method: 'POST',
          maxRequests: 10,
          windowMs: 1000, // 1 second
          weight: 1
        }],
        ['account', {
          exchange: 'binance',
          endpoint: 'account',
          method: 'GET',
          maxRequests: 5,
          windowMs: 1000,
          weight: 10
        }],
        ['ticker/24hr', {
          exchange: 'binance',
          endpoint: 'ticker/24hr',
          method: 'GET',
          maxRequests: 40,
          windowMs: 1000,
          weight: 1
        }],
        ['depth', {
          exchange: 'binance',
          endpoint: 'depth',
          method: 'GET',
          maxRequests: 50,
          windowMs: 1000,
          weight: 1
        }]
      ])
    };

    // Coinbase rate limits
    const coinbaseRateLimits: ExchangeRateLimit = {
      exchange: 'coinbase',
      globalLimit: {
        exchange: 'coinbase',
        maxRequests: 10000,
        windowMs: 3600000, // 1 hour
        weight: 1
      },
      endpointLimits: new Map([
        ['orders', {
          exchange: 'coinbase',
          endpoint: 'orders',
          method: 'POST',
          maxRequests: 5,
          windowMs: 1000,
          weight: 1
        }],
        ['accounts', {
          exchange: 'coinbase',
          endpoint: 'accounts',
          method: 'GET',
          maxRequests: 25,
          windowMs: 1000,
          weight: 1
        }],
        ['products', {
          exchange: 'coinbase',
          endpoint: 'products',
          method: 'GET',
          maxRequests: 100,
          windowMs: 60000, // 1 minute
          weight: 1
        }]
      ])
    };

    // Kraken rate limits
    const krakenRateLimits: ExchangeRateLimit = {
      exchange: 'kraken',
      globalLimit: {
        exchange: 'kraken',
        maxRequests: 1,
        windowMs: 1000, // 1 second
        weight: 1
      },
      endpointLimits: new Map([
        ['AddOrder', {
          exchange: 'kraken',
          endpoint: 'AddOrder',
          method: 'POST',
          maxRequests: 1,
          windowMs: 2000, // 2 seconds for orders
          weight: 1
        }],
        ['Balance', {
          exchange: 'kraken',
          endpoint: 'Balance',
          method: 'POST',
          maxRequests: 1,
          windowMs: 1000,
          weight: 1
        }],
        ['Ticker', {
          exchange: 'kraken',
          endpoint: 'Ticker',
          method: 'GET',
          maxRequests: 1,
          windowMs: 1000,
          weight: 1
        }],
        ['Depth', {
          exchange: 'kraken',
          endpoint: 'Depth',
          method: 'GET',
          maxRequests: 1,
          windowMs: 1000,
          weight: 1
        }]
      ])
    };

    // KuCoin rate limits
    const kucoinRateLimits: ExchangeRateLimit = {
      exchange: 'kucoin',
      globalLimit: {
        exchange: 'kucoin',
        maxRequests: 100,
        windowMs: 10000, // 10 seconds
        weight: 1
      },
      endpointLimits: new Map([
        ['orders', {
          exchange: 'kucoin',
          endpoint: 'orders',
          method: 'POST',
          maxRequests: 45,
          windowMs: 10000,
          weight: 1
        }],
        ['accounts', {
          exchange: 'kucoin',
          endpoint: 'accounts',
          method: 'GET',
          maxRequests: 100,
          windowMs: 10000,
          weight: 1
        }],
        ['symbols', {
          exchange: 'kucoin',
          endpoint: 'symbols',
          method: 'GET',
          maxRequests: 100,
          windowMs: 10000,
          weight: 1
        }],
        ['market/orderbook', {
          exchange: 'kucoin',
          endpoint: 'market/orderbook',
          method: 'GET',
          maxRequests: 100,
          windowMs: 10000,
          weight: 1
        }]
      ])
    };

    this.rateLimits.set('binance', binanceRateLimits);
    this.rateLimits.set('coinbase', coinbaseRateLimits);
    this.rateLimits.set('kraken', krakenRateLimits);
    this.rateLimits.set('kucoin', kucoinRateLimits);

    loggingService.info('Rate limiting service initialized', {
      exchanges: Array.from(this.rateLimits.keys()),
      totalRules: Array.from(this.rateLimits.values())
        .reduce((sum, limit) => sum + limit.endpointLimits.size + 1, 0)
    });
  }

  async checkRateLimit(
    exchange: string,
    endpoint: string = 'default',
    method: string = 'GET',
    userId?: string,
    weight: number = 1
  ): Promise<RateLimitStatus> {
    const exchangeLimits = this.rateLimits.get(exchange);
    if (!exchangeLimits) {
      throw new Error(`Rate limits not configured for exchange: ${exchange}`);
    }

    const now = Date.now();
    const cacheKey = `ratelimit:${exchange}:${endpoint}:${method}:${userId || 'global'}`;

    try {
      // Check if currently blocked
      const blockedUntil = this.blockedUntil.get(cacheKey);
      if (blockedUntil && now < blockedUntil) {
        return this.createBlockedStatus(exchange, endpoint, method, exchangeLimits, blockedUntil);
      }

      // Get applicable rate limit rule
      const rule = this.getApplicableRule(exchangeLimits, endpoint, method);
      const effectiveWeight = weight * (rule.weight || 1);

      // Check current request count
      const currentCount = await this.getCurrentRequestCount(cacheKey, rule.windowMs);
      const remaining = Math.max(0, rule.maxRequests - currentCount - effectiveWeight);

      const status: RateLimitStatus = {
        exchange,
        endpoint,
        currentRequests: currentCount,
        maxRequests: rule.maxRequests,
        windowMs: rule.windowMs,
        resetTime: now + rule.windowMs,
        remaining,
        isBlocked: remaining <= 0,
        weight: effectiveWeight
      };

      // Check burst limits if applicable
      if (rule.burstAllowed && rule.burstLimit) {
        const burstStatus = this.checkBurstLimit(cacheKey, rule, effectiveWeight);
        if (burstStatus.isBlocked) {
          status.isBlocked = true;
          status.retryAfter = burstStatus.retryAfter;
        }
      }

      if (status.isBlocked) {
        const retryAfter = rule.windowMs;
        this.blockedUntil.set(cacheKey, now + retryAfter);
        status.retryAfter = retryAfter;

        this.emit('rate-limit-exceeded', {
          exchange,
          endpoint,
          method,
          userId,
          currentRequests: currentCount,
          maxRequests: rule.maxRequests,
          retryAfter
        });

        loggingService.warn('Rate limit exceeded', {
          exchange,
          endpoint,
          method,
          userId,
          currentRequests: currentCount,
          maxRequests: rule.maxRequests,
          weight: effectiveWeight
        });
      }

      return status;

    } catch (error: any) {
      loggingService.error('Rate limit check failed', {
        exchange,
        endpoint,
        method,
        userId,
        error: error.message
      });

      // Return permissive status on error
      return {
        exchange,
        endpoint,
        currentRequests: 0,
        maxRequests: 1000,
        windowMs: 60000,
        resetTime: now + 60000,
        remaining: 1000,
        isBlocked: false,
        weight: 1
      };
    }
  }

  async recordRequest(
    exchange: string,
    endpoint: string = 'default',
    method: string = 'GET',
    userId?: string,
    weight: number = 1,
    success: boolean = true
  ): Promise<void> {
    const now = Date.now();
    const cacheKey = `ratelimit:${exchange}:${endpoint}:${method}:${userId || 'global'}`;
    
    try {
      const exchangeLimits = this.rateLimits.get(exchange);
      if (!exchangeLimits) {
        return;
      }

      const rule = this.getApplicableRule(exchangeLimits, endpoint, method);
      const effectiveWeight = weight * (rule.weight || 1);

      // Record in cache
      await this.incrementRequestCount(cacheKey, rule.windowMs, effectiveWeight);

      // Record in history for analytics
      const historyKey = `${exchange}:${userId || 'global'}`;
      const history = this.requestHistory.get(historyKey) || [];
      
      const record: RequestRecord = {
        timestamp: now,
        endpoint,
        method,
        weight: effectiveWeight,
        userId,
        success,
        rateLimited: false
      };

      history.push(record);

      // Keep only recent history (last hour)
      const cutoff = now - 3600000;
      const recentHistory = history.filter(r => r.timestamp > cutoff);
      this.requestHistory.set(historyKey, recentHistory);

      this.emit('request-recorded', {
        exchange,
        endpoint,
        method,
        userId,
        weight: effectiveWeight,
        success
      });

    } catch (error: any) {
      loggingService.error('Failed to record request', {
        exchange,
        endpoint,
        method,
        userId,
        error: error.message
      });
    }
  }

  async waitForRateLimit(
    exchange: string,
    endpoint: string = 'default',
    method: string = 'GET',
    userId?: string,
    weight: number = 1
  ): Promise<void> {
    const status = await this.checkRateLimit(exchange, endpoint, method, userId, weight);
    
    if (status.isBlocked && status.retryAfter) {
      loggingService.info('Waiting for rate limit reset', {
        exchange,
        endpoint,
        method,
        userId,
        retryAfter: status.retryAfter,
        weight
      });

      this.emit('rate-limit-wait', {
        exchange,
        endpoint,
        method,
        userId,
        waitTime: status.retryAfter
      });

      await new Promise(resolve => setTimeout(resolve, status.retryAfter));
    }
  }

  async waitForExchangeAvailability(exchange: string, weight: number = 1): Promise<void> {
    return this.waitForRateLimit(exchange, 'default', 'GET', undefined, weight);
  }

  private getApplicableRule(
    exchangeLimits: ExchangeRateLimit,
    endpoint: string,
    method: string
  ): RateLimitRule {
    // Check endpoint-specific limits first
    const endpointRule = exchangeLimits.endpointLimits.get(endpoint);
    if (endpointRule && (!endpointRule.method || endpointRule.method === method)) {
      return endpointRule;
    }

    // Fall back to global limit
    return exchangeLimits.globalLimit;
  }

  private async getCurrentRequestCount(cacheKey: string, windowMs: number): Promise<number> {
    try {
      const cached = await cacheService.get(cacheKey);
      if (!cached) {
        return 0;
      }

      const data = JSON.parse(cached);
      const now = Date.now();
      
      // Check if window has expired
      if (now - data.timestamp > windowMs) {
        await cacheService.delete(cacheKey);
        return 0;
      }

      return data.count || 0;
    } catch (error) {
      return 0;
    }
  }

  private async incrementRequestCount(cacheKey: string, windowMs: number, weight: number): Promise<void> {
    try {
      const now = Date.now();
      const cached = await cacheService.get(cacheKey);
      
      let count = weight;
      if (cached) {
        const data = JSON.parse(cached);
        if (now - data.timestamp <= windowMs) {
          count = data.count + weight;
        }
      }

      const data = {
        count,
        timestamp: now
      };

      const ttlSeconds = Math.ceil(windowMs / 1000);
      await cacheService.set(cacheKey, JSON.stringify(data), ttlSeconds);
    } catch (error: any) {
      loggingService.warn('Failed to increment request count', {
        cacheKey,
        error: error.message
      });
    }
  }

  private checkBurstLimit(
    cacheKey: string,
    rule: RateLimitRule,
    weight: number
  ): { isBlocked: boolean; retryAfter?: number } {
    if (!rule.burstAllowed || !rule.burstLimit) {
      return { isBlocked: false };
    }

    const now = Date.now();
    const burstKey = `${cacheKey}:burst`;
    const burst = this.burstCounters.get(burstKey);

    if (!burst || now - burst.resetTime > 10000) { // 10 second burst window
      this.burstCounters.set(burstKey, {
        count: weight,
        resetTime: now
      });
      return { isBlocked: false };
    }

    const newCount = burst.count + weight;
    if (newCount > rule.burstLimit) {
      const retryAfter = 10000 - (now - burst.resetTime);
      return {
        isBlocked: true,
        retryAfter: Math.max(retryAfter, 1000)
      };
    }

    burst.count = newCount;
    return { isBlocked: false };
  }

  private createBlockedStatus(
    exchange: string,
    endpoint: string,
    method: string,
    exchangeLimits: ExchangeRateLimit,
    blockedUntil: number
  ): RateLimitStatus {
    const rule = this.getApplicableRule(exchangeLimits, endpoint, method);
    const retryAfter = blockedUntil - Date.now();

    return {
      exchange,
      endpoint,
      currentRequests: rule.maxRequests,
      maxRequests: rule.maxRequests,
      windowMs: rule.windowMs,
      resetTime: blockedUntil,
      remaining: 0,
      isBlocked: true,
      retryAfter: Math.max(retryAfter, 0),
      weight: rule.weight || 1
    };
  }

  async getRateLimitStatus(exchange: string, userId?: string): Promise<RateLimitStatus[]> {
    const exchangeLimits = this.rateLimits.get(exchange);
    if (!exchangeLimits) {
      throw new Error(`Rate limits not configured for exchange: ${exchange}`);
    }

    const statuses: RateLimitStatus[] = [];

    // Global limit status
    const globalStatus = await this.checkRateLimit(exchange, 'default', 'GET', userId);
    statuses.push(globalStatus);

    // Endpoint-specific statuses
    for (const [endpoint, rule] of exchangeLimits.endpointLimits) {
      const endpointStatus = await this.checkRateLimit(
        exchange,
        endpoint,
        rule.method || 'GET',
        userId
      );
      statuses.push(endpointStatus);
    }

    return statuses;
  }

  async getRequestHistory(exchange: string, userId?: string, limit: number = 100): Promise<RequestRecord[]> {
    const historyKey = `${exchange}:${userId || 'global'}`;
    const history = this.requestHistory.get(historyKey) || [];
    
    return history
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  async updateRateLimit(exchange: string, rule: RateLimitRule): Promise<void> {
    const exchangeLimits = this.rateLimits.get(exchange);
    if (!exchangeLimits) {
      throw new Error(`Exchange not found: ${exchange}`);
    }

    if (rule.endpoint) {
      exchangeLimits.endpointLimits.set(rule.endpoint, rule);
    } else {
      exchangeLimits.globalLimit = rule;
    }

    this.emit('rate-limit-updated', { exchange, rule });
    
    loggingService.info('Rate limit updated', {
      exchange,
      endpoint: rule.endpoint || 'global',
      maxRequests: rule.maxRequests,
      windowMs: rule.windowMs
    });
  }

  async clearRateLimitCache(exchange?: string, endpoint?: string): Promise<void> {
    try {
      if (exchange && endpoint) {
        // Clear specific endpoint cache
        const pattern = `ratelimit:${exchange}:${endpoint}:*`;
        await this.clearCachePattern(pattern);
      } else if (exchange) {
        // Clear all cache for exchange
        const pattern = `ratelimit:${exchange}:*`;
        await this.clearCachePattern(pattern);
      } else {
        // Clear all rate limit cache
        const pattern = `ratelimit:*`;
        await this.clearCachePattern(pattern);
      }

      // Clear blocked until entries
      if (exchange) {
        for (const [key] of this.blockedUntil) {
          if (key.includes(exchange)) {
            this.blockedUntil.delete(key);
          }
        }
      } else {
        this.blockedUntil.clear();
      }

      // Clear burst counters
      if (exchange) {
        for (const [key] of this.burstCounters) {
          if (key.includes(exchange)) {
            this.burstCounters.delete(key);
          }
        }
      } else {
        this.burstCounters.clear();
      }

      this.emit('rate-limit-cache-cleared', { exchange, endpoint });

      loggingService.info('Rate limit cache cleared', { exchange, endpoint });

    } catch (error: any) {
      loggingService.error('Failed to clear rate limit cache', {
        exchange,
        endpoint,
        error: error.message
      });
      throw error;
    }
  }

  private async clearCachePattern(pattern: string): Promise<void> {
    // This would need to be implemented based on your cache service
    // For now, we'll just log the pattern
    loggingService.info('Would clear cache pattern', { pattern });
  }

  getExchangeRateLimits(exchange: string): ExchangeRateLimit | undefined {
    return this.rateLimits.get(exchange);
  }

  getAllExchangeRateLimits(): Map<string, ExchangeRateLimit> {
    return new Map(this.rateLimits);
  }

  getSupportedExchanges(): string[] {
    return Array.from(this.rateLimits.keys());
  }

  async getRateLimitingStats(): Promise<{
    totalRequests: number;
    rateLimitedRequests: number;
    successRate: number;
    topEndpoints: Array<{ endpoint: string; count: number }>;
    exchangeStats: Map<string, { requests: number; rateLimited: number }>;
  }> {
    let totalRequests = 0;
    let rateLimitedRequests = 0;
    const endpointCounts = new Map<string, number>();
    const exchangeStats = new Map<string, { requests: number; rateLimited: number }>();

    for (const [historyKey, history] of this.requestHistory) {
      const [exchange] = historyKey.split(':');
      
      if (!exchangeStats.has(exchange)) {
        exchangeStats.set(exchange, { requests: 0, rateLimited: 0 });
      }

      const stats = exchangeStats.get(exchange)!;

      for (const record of history) {
        totalRequests++;
        stats.requests++;

        if (record.rateLimited) {
          rateLimitedRequests++;
          stats.rateLimited++;
        }

        const endpointKey = `${exchange}:${record.endpoint}`;
        endpointCounts.set(endpointKey, (endpointCounts.get(endpointKey) || 0) + 1);
      }
    }

    const topEndpoints = Array.from(endpointCounts.entries())
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const successRate = totalRequests > 0 ? ((totalRequests - rateLimitedRequests) / totalRequests) * 100 : 100;

    return {
      totalRequests,
      rateLimitedRequests,
      successRate,
      topEndpoints,
      exchangeStats
    };
  }

  async cleanupOldData(): Promise<void> {
    const now = Date.now();
    const cutoff = now - 3600000; // 1 hour

    // Clean up request history
    for (const [key, history] of this.requestHistory) {
      const recentHistory = history.filter(r => r.timestamp > cutoff);
      if (recentHistory.length === 0) {
        this.requestHistory.delete(key);
      } else {
        this.requestHistory.set(key, recentHistory);
      }
    }

    // Clean up expired blocked entries
    for (const [key, blockedUntil] of this.blockedUntil) {
      if (now > blockedUntil) {
        this.blockedUntil.delete(key);
      }
    }

    // Clean up expired burst counters
    for (const [key, burst] of this.burstCounters) {
      if (now - burst.resetTime > 10000) {
        this.burstCounters.delete(key);
      }
    }

    this.emit('data-cleanup-completed', {
      historyEntriesRemoved: 0, // Would count in real implementation
      blockedEntriesCleared: 0,
      burstCountersCleared: 0
    });
  }
}

export const rateLimitingService = new RateLimitingService();