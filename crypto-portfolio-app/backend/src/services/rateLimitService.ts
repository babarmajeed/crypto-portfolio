import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { UserRole } from '@prisma/client';
import { redisService } from './redisService';
import { logger } from '../utils/logger';
import {
  RateLimitConfig,
  RateLimitResult,
  RateLimitMetrics,
  BlacklistEntry,
  UserTierConfig,
  RateLimitHeaders,
  RateLimiterOptions,
} from '../types/rateLimit.types';
import {
  USER_TIER_LIMITS,
  HOURLY_LIMITS,
  DAILY_LIMITS,
  BLACKLIST_CONFIG,
  REDIS_KEYS,
  DEFAULT_CONFIG,
} from '../config/rateLimitConfig';

class RateLimitService {
  private limiters: Map<string, RateLimiterRedis | RateLimiterMemory> = new Map();
  private blacklist: Set<string> = new Set();
  private metrics: Map<string, RateLimitMetrics> = new Map();
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize rate limiters for different user tiers
      await this.createLimiters();
      
      // Load blacklist from Redis
      await this.loadBlacklist();
      
      // Start cleanup interval
      this.startCleanupInterval();
      
      this.isInitialized = true;
      logger.info('Rate limiting service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize rate limiting service:', error);
      throw error;
    }
  }

  private async createLimiters(): Promise<void> {
    const redisClient = redisService.getClient();
    
    // Create limiters for each user tier - minute limits
    for (const [tier, config] of Object.entries(USER_TIER_LIMITS)) {
      const limiterKey = `minute_${tier}`;
      this.limiters.set(limiterKey, new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: `${REDIS_KEYS.RATE_LIMIT}:${limiterKey}`,
        points: config.requests,
        duration: Math.floor(config.windowMs / 1000),
        blockDuration: Math.floor((config.blockDuration || 0) / 1000),
        execEvenly: true,
      }));
    }

    // Create limiters for hourly limits
    for (const [tier, config] of Object.entries(HOURLY_LIMITS)) {
      const limiterKey = `hour_${tier}`;
      this.limiters.set(limiterKey, new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: `${REDIS_KEYS.RATE_LIMIT}:${limiterKey}`,
        points: config.requests,
        duration: Math.floor(config.windowMs / 1000),
        execEvenly: true,
      }));
    }

    // Create limiters for daily limits
    for (const [tier, config] of Object.entries(DAILY_LIMITS)) {
      const limiterKey = `day_${tier}`;
      this.limiters.set(limiterKey, new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: `${REDIS_KEYS.RATE_LIMIT}:${limiterKey}`,
        points: config.requests,
        duration: Math.floor(config.windowMs / 1000),
        execEvenly: true,
      }));
    }

    // Fallback memory limiters when Redis is unavailable
    if (DEFAULT_CONFIG.gracefulMode) {
      for (const [tier, config] of Object.entries(USER_TIER_LIMITS)) {
        const limiterKey = `memory_${tier}`;
        this.limiters.set(limiterKey, new RateLimiterMemory({
          points: config.requests,
          duration: Math.floor(config.windowMs / 1000),
          blockDuration: Math.floor((config.blockDuration || 0) / 1000),
        }));
      }
    }
  }

  async checkRateLimit(
    identifier: string,
    userTier: UserRole | 'ANONYMOUS' | 'INTERNAL',
    endpoint?: string
  ): Promise<RateLimitResult> {
    await this.ensureInitialized();

    // Check if identifier is blacklisted
    if (this.isBlacklisted(identifier)) {
      const blacklistEntry = await this.getBlacklistEntry(identifier);
      return {
        allowed: false,
        totalRequests: 0,
        remainingRequests: 0,
        retryAfter: blacklistEntry ? Math.floor((blacklistEntry.expiresAt.getTime() - Date.now()) / 1000) : 3600,
        resetTime: blacklistEntry?.expiresAt || new Date(Date.now() + 3600000),
        userTier: userTier.toString(),
      };
    }

    try {
      // Check all time windows (minute, hour, day)
      const results = await Promise.all([
        this.checkLimiter(`minute_${userTier}`, identifier),
        this.checkLimiter(`hour_${userTier}`, identifier),
        this.checkLimiter(`day_${userTier}`, identifier),
      ]);

      // Find the most restrictive result
      const restrictiveResult = results.find(result => !result.allowed) || results[0];
      
      // Update metrics
      await this.updateMetrics(identifier, userTier.toString(), endpoint, restrictiveResult.allowed);
      
      // Check for blacklist conditions
      if (!restrictiveResult.allowed) {
        await this.checkBlacklistConditions(identifier);
      }

      return {
        ...restrictiveResult,
        userTier: userTier.toString(),
      };
    } catch (error) {
      logger.error('Rate limit check failed:', error);
      
      // Graceful fallback
      if (DEFAULT_CONFIG.gracefulMode) {
        try {
          return await this.checkLimiter(`memory_${userTier}`, identifier);
        } catch (fallbackError) {
          logger.error('Fallback rate limiter also failed:', fallbackError);
          // Allow request on complete failure
          return {
            allowed: true,
            totalRequests: 1,
            remainingRequests: 999,
            resetTime: new Date(Date.now() + 60000),
            userTier: userTier.toString(),
          };
        }
      }
      throw error;
    }
  }

  private async checkLimiter(limiterKey: string, identifier: string): Promise<RateLimitResult> {
    const limiter = this.limiters.get(limiterKey);
    if (!limiter) {
      throw new Error(`Limiter ${limiterKey} not found`);
    }

    try {
      const result = await limiter.consume(identifier);
      return {
        allowed: true,
        totalRequests: result.totalHits,
        remainingRequests: result.remainingPoints || 0,
        resetTime: new Date(Date.now() + (result.msBeforeNext || 0)),
      };
    } catch (rejRes: any) {
      return {
        allowed: false,
        totalRequests: rejRes.totalHits || 0,
        remainingRequests: rejRes.remainingPoints || 0,
        retryAfter: Math.floor((rejRes.msBeforeNext || 0) / 1000),
        resetTime: new Date(Date.now() + (rejRes.msBeforeNext || 0)),
      };
    }
  }

  async getUserTier(userId?: string, role?: UserRole): Promise<UserRole | 'ANONYMOUS' | 'INTERNAL'> {
    if (!userId) return 'ANONYMOUS';
    if (role) return role;
    
    // Default to BASIC if no role specified
    return UserRole.BASIC;
  }

  async addToBlacklist(identifier: string, reason: string, duration: number = BLACKLIST_CONFIG.durations.medium): Promise<void> {
    if (!BLACKLIST_CONFIG.enabled) return;
    
    const expiresAt = new Date(Date.now() + duration);
    const blacklistEntry: BlacklistEntry = {
      identifier,
      reason,
      expiresAt,
      createdAt: new Date(),
      requestCount: 0,
    };

    this.blacklist.add(identifier);
    await redisService.set(
      `${REDIS_KEYS.BLACKLIST}:${identifier}`,
      blacklistEntry,
      { ttl: Math.floor(duration / 1000) }
    );

    logger.warn(`Added ${identifier} to blacklist`, { reason, duration });
  }

  async removeFromBlacklist(identifier: string): Promise<void> {
    this.blacklist.delete(identifier);
    await redisService.del(`${REDIS_KEYS.BLACKLIST}:${identifier}`);
    logger.info(`Removed ${identifier} from blacklist`);
  }

  private isBlacklisted(identifier: string): boolean {
    // Check whitelist first
    if (BLACKLIST_CONFIG.whitelist.includes(identifier)) {
      return false;
    }
    return this.blacklist.has(identifier);
  }

  private async getBlacklistEntry(identifier: string): Promise<BlacklistEntry | null> {
    return await redisService.get<BlacklistEntry>(`${REDIS_KEYS.BLACKLIST}:${identifier}`);
  }

  private async loadBlacklist(): Promise<void> {
    try {
      const keys = await redisService.keys(`${REDIS_KEYS.BLACKLIST}:*`);
      for (const key of keys) {
        const identifier = key.replace(`${REDIS_KEYS.BLACKLIST}:`, '');
        const entry = await redisService.get<BlacklistEntry>(key);
        if (entry && entry.expiresAt > new Date()) {
          this.blacklist.add(identifier);
        }
      }
      logger.info(`Loaded ${this.blacklist.size} blacklisted identifiers`);
    } catch (error) {
      logger.error('Failed to load blacklist:', error);
    }
  }

  async resetRateLimit(identifier: string, userTier: UserRole | 'ANONYMOUS' | 'INTERNAL'): Promise<void> {
    try {
      const limiterKeys = [`minute_${userTier}`, `hour_${userTier}`, `day_${userTier}`];
      
      for (const limiterKey of limiterKeys) {
        const limiter = this.limiters.get(limiterKey);
        if (limiter && 'delete' in limiter) {
          await (limiter as any).delete(identifier);
        }
      }
      
      logger.info(`Reset rate limits for ${identifier} (${userTier})`);
    } catch (error) {
      logger.error('Failed to reset rate limits:', error);
    }
  }

  async getRateLimitHeaders(identifier: string, userTier: UserRole | 'ANONYMOUS' | 'INTERNAL'): Promise<RateLimitHeaders> {
    await this.ensureInitialized();
    
    const config = USER_TIER_LIMITS[userTier as keyof UserTierConfig];
    const limiter = this.limiters.get(`minute_${userTier}`);
    
    if (!limiter || !config) {
      return {
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '99',
        'X-RateLimit-Reset': new Date(Date.now() + 60000).toISOString(),
        'X-RateLimit-Tier': userTier.toString(),
      };
    }

    try {
      const result = await (limiter as any).get(identifier);
      const remaining = Math.max(0, config.requests - (result?.totalHits || 0));
      const resetTime = new Date(Date.now() + (result?.msBeforeNext || 60000));

      const headers: RateLimitHeaders = {
        'X-RateLimit-Limit': config.requests.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': resetTime.toISOString(),
        'X-RateLimit-Tier': userTier.toString(),
      };

      if (result?.msBeforeNext) {
        headers['X-RateLimit-RetryAfter'] = Math.ceil(result.msBeforeNext / 1000).toString();
      }

      return headers;
    } catch (error) {
      logger.error('Failed to get rate limit headers:', error);
      return {
        'X-RateLimit-Limit': config.requests.toString(),
        'X-RateLimit-Remaining': config.requests.toString(),
        'X-RateLimit-Reset': new Date(Date.now() + config.windowMs).toISOString(),
        'X-RateLimit-Tier': userTier.toString(),
      };
    }
  }

  private async updateMetrics(
    identifier: string,
    userTier: string,
    endpoint?: string,
    allowed: boolean = true
  ): Promise<void> {
    const key = `${identifier}:${userTier}:${endpoint || 'unknown'}`;
    const existing = this.metrics.get(key) || {
      identifier,
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      averageResponseTime: 0,
      lastRequest: new Date(),
      userTier,
      endpoint,
    };

    existing.totalRequests++;
    if (allowed) {
      existing.allowedRequests++;
    } else {
      existing.blockedRequests++;
    }
    existing.lastRequest = new Date();

    this.metrics.set(key, existing);

    // Store in Redis for persistence
    await redisService.set(
      `${REDIS_KEYS.MONITORING}:${key}`,
      existing,
      { ttl: DEFAULT_CONFIG.monitoringRetention / 1000 }
    );
  }

  private async checkBlacklistConditions(identifier: string): Promise<void> {
    if (!BLACKLIST_CONFIG.enabled || BLACKLIST_CONFIG.whitelist.includes(identifier)) {
      return;
    }

    const metrics = Array.from(this.metrics.values())
      .filter(m => m.identifier === identifier);
    
    if (metrics.length === 0) return;

    const totalRequests = metrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const blockedRequests = metrics.reduce((sum, m) => sum + m.blockedRequests, 0);
    const errorRate = (blockedRequests / totalRequests) * 100;
    
    // Check thresholds
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentMetrics = metrics.filter(m => m.lastRequest.getTime() > oneMinuteAgo);
    const recentRequests = recentMetrics.reduce((sum, m) => sum + m.totalRequests, 0);

    let duration = 0;
    let reason = '';

    if (recentRequests > BLACKLIST_CONFIG.thresholds.requestsPerMinute) {
      duration = BLACKLIST_CONFIG.durations.heavy;
      reason = `Excessive requests: ${recentRequests}/min`;
    } else if (errorRate > BLACKLIST_CONFIG.thresholds.errorRate) {
      duration = BLACKLIST_CONFIG.durations.medium;
      reason = `High error rate: ${errorRate.toFixed(1)}%`;
    } else if (blockedRequests > BLACKLIST_CONFIG.thresholds.consecutiveBlocks) {
      duration = BLACKLIST_CONFIG.durations.light;
      reason = `Consecutive blocks: ${blockedRequests}`;
    }

    if (duration > 0) {
      await this.addToBlacklist(identifier, reason, duration);
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private startCleanupInterval(): void {
    setInterval(async () => {
      try {
        await this.cleanupExpiredEntries();
      } catch (error) {
        logger.error('Cleanup interval error:', error);
      }
    }, DEFAULT_CONFIG.cleanupInterval);
  }

  private async cleanupExpiredEntries(): Promise<void> {
    try {
      // Clean up blacklist
      const blacklistKeys = await redisService.keys(`${REDIS_KEYS.BLACKLIST}:*`);
      for (const key of blacklistKeys) {
        const entry = await redisService.get<BlacklistEntry>(key);
        if (entry && entry.expiresAt <= new Date()) {
          const identifier = key.replace(`${REDIS_KEYS.BLACKLIST}:`, '');
          await this.removeFromBlacklist(identifier);
        }
      }

      // Clean up old metrics
      const cutoffTime = Date.now() - DEFAULT_CONFIG.monitoringRetention;
      for (const [key, metrics] of this.metrics.entries()) {
        if (metrics.lastRequest.getTime() < cutoffTime) {
          this.metrics.delete(key);
        }
      }

      logger.debug('Rate limit cleanup completed');
    } catch (error) {
      logger.error('Error during rate limit cleanup:', error);
    }
  }

  async getMetrics(identifier?: string): Promise<RateLimitMetrics[]> {
    if (identifier) {
      return Array.from(this.metrics.values())
        .filter(m => m.identifier === identifier);
    }
    return Array.from(this.metrics.values());
  }

  async getBlacklistedIdentifiers(): Promise<string[]> {
    return Array.from(this.blacklist);
  }

  async isServiceHealthy(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      const healthCheck = await redisService.healthCheck();
      return healthCheck.status === 'healthy';
    } catch (error) {
      logger.error('Rate limit service health check failed:', error);
      return false;
    }
  }
}

export const rateLimitService = new RateLimitService();