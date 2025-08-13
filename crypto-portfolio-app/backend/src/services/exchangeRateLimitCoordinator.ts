import { RateLimiterRedis } from 'rate-limiter-flexible';
import { EventEmitter } from 'events';
import { redisService } from './redisService';
import { logger } from '../utils/logger';
import {
  ExchangeQueueItem,
  ExchangeRateLimitConfig,
  RateLimitResult,
} from '../types/rateLimit.types';
import { EXCHANGE_RATE_LIMITS, REDIS_KEYS } from '../config/rateLimitConfig';

interface ExchangeRequest {
  id: string;
  exchangeName: string;
  method: string;
  params: any;
  priority: number;
  callback: (error: Error | null, result?: any) => void;
  timestamp: Date;
  retryCount: number;
}

interface QueueStats {
  pending: number;
  processing: number;
  failed: number;
  completed: number;
}

export class ExchangeRateLimitCoordinator extends EventEmitter {
  private limiters: Map<string, RateLimiterRedis> = new Map();
  private queues: Map<string, ExchangeRequest[]> = new Map();
  private processing: Map<string, Set<string>> = new Map();
  private stats: Map<string, QueueStats> = new Map();
  private isInitialized = false;
  private processingIntervals: Map<string, NodeJS.Timeout> = new Map();

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.createExchangeLimiters();
      await this.startQueueProcessors();
      
      this.isInitialized = true;
      logger.info('Exchange rate limit coordinator initialized');
    } catch (error) {
      logger.error('Failed to initialize exchange rate limit coordinator:', error);
      throw error;
    }
  }

  private async createExchangeLimiters(): Promise<void> {
    const redisClient = redisService.getClient();

    for (const [exchangeName, config] of Object.entries(EXCHANGE_RATE_LIMITS)) {
      const limiter = new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: `${REDIS_KEYS.RATE_LIMIT}:exchange:${exchangeName}`,
        points: config.limits.requests,
        duration: Math.floor(config.limits.window / 1000),
        blockDuration: 0, // We handle blocking manually
        execEvenly: true,
      });

      this.limiters.set(exchangeName, limiter);
      this.queues.set(exchangeName, []);
      this.processing.set(exchangeName, new Set());
      this.stats.set(exchangeName, {
        pending: 0,
        processing: 0,
        failed: 0,
        completed: 0,
      });

      logger.info(`Created rate limiter for ${exchangeName}`, {
        requests: config.limits.requests,
        window: config.limits.window,
      });
    }
  }

  private startQueueProcessors(): void {
    for (const exchangeName of Object.keys(EXCHANGE_RATE_LIMITS)) {
      const interval = setInterval(async () => {
        await this.processQueue(exchangeName);
      }, 1000); // Process every second

      this.processingIntervals.set(exchangeName, interval);
    }
  }

  async queueRequest(
    exchangeName: string,
    method: string,
    params: any,
    priority: number = 1
  ): Promise<any> {
    await this.ensureInitialized();

    if (!this.queues.has(exchangeName)) {
      throw new Error(`Exchange ${exchangeName} is not supported`);
    }

    return new Promise((resolve, reject) => {
      const request: ExchangeRequest = {
        id: `${exchangeName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        exchangeName,
        method,
        params,
        priority,
        callback: (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
        timestamp: new Date(),
        retryCount: 0,
      };

      const queue = this.queues.get(exchangeName)!;
      queue.push(request);
      
      // Sort by priority (higher priority first)
      queue.sort((a, b) => b.priority - a.priority);

      this.updateStats(exchangeName, 'pending', 1);
      
      this.emit('requestQueued', {
        exchangeName,
        requestId: request.id,
        queueLength: queue.length,
      });

      logger.debug(`Queued request for ${exchangeName}`, {
        method,
        requestId: request.id,
        queueLength: queue.length,
      });
    });
  }

  private async processQueue(exchangeName: string): Promise<void> {
    const queue = this.queues.get(exchangeName);
    const processing = this.processing.get(exchangeName);
    const limiter = this.limiters.get(exchangeName);

    if (!queue || !processing || !limiter || queue.length === 0) {
      return;
    }

    const config = EXCHANGE_RATE_LIMITS[exchangeName];
    if (!config) return;

    // Process multiple requests based on exchange capacity
    const maxConcurrent = Math.min(10, Math.floor(config.limits.requests / 10));
    const availableSlots = maxConcurrent - processing.size;

    if (availableSlots <= 0) {
      return;
    }

    const requestsToProcess = queue.splice(0, availableSlots);

    for (const request of requestsToProcess) {
      processing.add(request.id);
      this.updateStats(exchangeName, 'pending', -1);
      this.updateStats(exchangeName, 'processing', 1);

      // Process request asynchronously
      this.processRequest(request, config)
        .then((result) => {
          processing.delete(request.id);
          this.updateStats(exchangeName, 'processing', -1);
          this.updateStats(exchangeName, 'completed', 1);
          request.callback(null, result);
        })
        .catch((error) => {
          processing.delete(request.id);
          this.updateStats(exchangeName, 'processing', -1);
          this.handleRequestError(request, error, config);
        });
    }
  }

  private async processRequest(
    request: ExchangeRequest,
    config: ExchangeRateLimitConfig
  ): Promise<any> {
    const limiter = this.limiters.get(request.exchangeName);
    if (!limiter) {
      throw new Error(`No limiter found for ${request.exchangeName}`);
    }

    try {
      // Check rate limit
      await limiter.consume(request.exchangeName);

      // Simulate API call (replace with actual exchange API calls)
      const result = await this.makeExchangeApiCall(request);

      this.emit('requestCompleted', {
        exchangeName: request.exchangeName,
        requestId: request.id,
        method: request.method,
        duration: Date.now() - request.timestamp.getTime(),
      });

      return result;
    } catch (rateLimitError: any) {
      if (rateLimitError.remainingPoints !== undefined) {
        // Rate limit exceeded, calculate backoff
        const backoffMs = this.calculateBackoff(request.retryCount, config);
        
        this.emit('rateLimitExceeded', {
          exchangeName: request.exchangeName,
          requestId: request.id,
          retryAfter: rateLimitError.msBeforeNext,
          backoffMs,
        });

        // Wait for backoff period
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        
        // Retry the request
        return this.processRequest(request, config);
      }
      throw rateLimitError;
    }
  }

  private async makeExchangeApiCall(request: ExchangeRequest): Promise<any> {
    // This is a placeholder - implement actual exchange API calls here
    // Each exchange would have its own implementation
    
    const startTime = Date.now();
    
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      
      // Simulate occasional errors
      if (Math.random() < 0.05) { // 5% error rate
        throw new Error(`API error for ${request.exchangeName}: ${request.method}`);
      }

      const result = {
        exchange: request.exchangeName,
        method: request.method,
        params: request.params,
        data: `Mock data for ${request.method}`,
        timestamp: new Date(),
        processingTime: Date.now() - startTime,
      };

      logger.debug(`Exchange API call completed`, {
        exchange: request.exchangeName,
        method: request.method,
        duration: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      logger.error(`Exchange API call failed`, {
        exchange: request.exchangeName,
        method: request.method,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  private calculateBackoff(retryCount: number, config: ExchangeRateLimitConfig): number {
    const baseDelay = 1000; // 1 second base delay
    const backoff = Math.min(
      baseDelay * Math.pow(config.retry.backoffMultiplier, retryCount),
      config.retry.maxBackoffMs
    );

    // Add jitter if enabled
    if (config.retry.jitter) {
      const jitter = Math.random() * 0.1 * backoff; // 10% jitter
      return Math.floor(backoff + jitter);
    }

    return Math.floor(backoff);
  }

  private async handleRequestError(
    request: ExchangeRequest,
    error: Error,
    config: ExchangeRateLimitConfig
  ): Promise<void> {
    request.retryCount++;

    if (request.retryCount <= config.retry.maxRetries) {
      // Calculate backoff and retry
      const backoffMs = this.calculateBackoff(request.retryCount, config);
      
      this.emit('requestRetry', {
        exchangeName: request.exchangeName,
        requestId: request.id,
        retryCount: request.retryCount,
        backoffMs,
        error: error.message,
      });

      // Add back to queue with delay
      setTimeout(() => {
        const queue = this.queues.get(request.exchangeName);
        if (queue) {
          queue.unshift(request); // Add to front for retry
          this.updateStats(request.exchangeName, 'pending', 1);
        }
      }, backoffMs);

      this.updateStats(request.exchangeName, 'processing', -1);
    } else {
      // Max retries exceeded
      this.updateStats(request.exchangeName, 'processing', -1);
      this.updateStats(request.exchangeName, 'failed', 1);
      
      this.emit('requestFailed', {
        exchangeName: request.exchangeName,
        requestId: request.id,
        retryCount: request.retryCount,
        error: error.message,
      });

      request.callback(new Error(`Max retries exceeded for ${request.exchangeName}: ${error.message}`));
    }
  }

  private updateStats(exchangeName: string, metric: keyof QueueStats, delta: number): void {
    const stats = this.stats.get(exchangeName);
    if (stats) {
      stats[metric] = Math.max(0, stats[metric] + delta);
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  // Public methods

  async getQueueStats(exchangeName?: string): Promise<Map<string, QueueStats> | QueueStats | null> {
    if (exchangeName) {
      return this.stats.get(exchangeName) || null;
    }
    return this.stats;
  }

  async getQueueLength(exchangeName: string): Promise<number> {
    const queue = this.queues.get(exchangeName);
    return queue ? queue.length : 0;
  }

  async getRateLimitStatus(exchangeName: string): Promise<RateLimitResult | null> {
    const limiter = this.limiters.get(exchangeName);
    if (!limiter) return null;

    try {
      const result = await (limiter as any).get(exchangeName);
      const config = EXCHANGE_RATE_LIMITS[exchangeName];
      
      return {
        allowed: result ? result.remainingPoints > 0 : true,
        totalRequests: result ? result.totalHits : 0,
        remainingRequests: result ? result.remainingPoints : config.limits.requests,
        resetTime: new Date(Date.now() + (result?.msBeforeNext || 0)),
      };
    } catch (error) {
      logger.error(`Failed to get rate limit status for ${exchangeName}:`, error);
      return null;
    }
  }

  async clearQueue(exchangeName: string): Promise<number> {
    const queue = this.queues.get(exchangeName);
    if (!queue) return 0;

    const clearedCount = queue.length;
    queue.length = 0;
    
    this.updateStats(exchangeName, 'pending', -clearedCount);
    
    logger.info(`Cleared queue for ${exchangeName}`, { clearedCount });
    return clearedCount;
  }

  async pause(exchangeName: string): Promise<void> {
    const interval = this.processingIntervals.get(exchangeName);
    if (interval) {
      clearInterval(interval);
      this.processingIntervals.delete(exchangeName);
      logger.info(`Paused queue processing for ${exchangeName}`);
    }
  }

  async resume(exchangeName: string): Promise<void> {
    if (!this.processingIntervals.has(exchangeName)) {
      const interval = setInterval(async () => {
        await this.processQueue(exchangeName);
      }, 1000);

      this.processingIntervals.set(exchangeName, interval);
      logger.info(`Resumed queue processing for ${exchangeName}`);
    }
  }

  async shutdown(): Promise<void> {
    // Clear all processing intervals
    for (const interval of this.processingIntervals.values()) {
      clearInterval(interval);
    }
    this.processingIntervals.clear();

    // Clear all queues
    for (const [exchangeName, queue] of this.queues.entries()) {
      const clearedCount = queue.length;
      queue.length = 0;
      if (clearedCount > 0) {
        logger.warn(`Cleared ${clearedCount} pending requests for ${exchangeName} during shutdown`);
      }
    }

    this.isInitialized = false;
    logger.info('Exchange rate limit coordinator shut down');
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      
      // Check if Redis is accessible
      const redisHealth = await redisService.healthCheck();
      if (redisHealth.status !== 'healthy') {
        return false;
      }

      // Check if all expected limiters are available
      for (const exchangeName of Object.keys(EXCHANGE_RATE_LIMITS)) {
        if (!this.limiters.has(exchangeName)) {
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('Exchange coordinator health check failed:', error);
      return false;
    }
  }
}

// Singleton instance
export const exchangeRateLimitCoordinator = new ExchangeRateLimitCoordinator();