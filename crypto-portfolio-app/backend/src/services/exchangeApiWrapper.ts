import { EventEmitter } from 'events';
import { exchangeRateLimitCoordinator } from './exchangeRateLimitCoordinator';
import { logger } from '../utils/logger';
import { EXCHANGE_RATE_LIMITS } from '../config/rateLimitConfig';

interface ExchangeApiCall {
  exchange: string;
  method: string;
  params: any;
  options?: {
    priority?: number;
    timeout?: number;
    retries?: number;
  };
}

interface ExchangeApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata: {
    exchange: string;
    method: string;
    duration: number;
    retryCount: number;
    rateLimit?: {
      remaining: number;
      resetTime: Date;
    };
  };
}

interface ExchangeApiError extends Error {
  code: string;
  exchange: string;
  method: string;
  retryable: boolean;
  rateLimited: boolean;
}

export class ExchangeApiWrapper extends EventEmitter {
  private readonly defaultTimeout = 30000; // 30 seconds
  private readonly defaultPriority = 1;
  private exchangeClients: Map<string, any> = new Map();

  async initialize(): Promise<void> {
    try {
      await exchangeRateLimitCoordinator.initialize();
      logger.info('Exchange API wrapper initialized');
    } catch (error) {
      logger.error('Failed to initialize exchange API wrapper:', error);
      throw error;
    }
  }

  // Main method for making rate-limited API calls
  async call<T = any>(apiCall: ExchangeApiCall): Promise<ExchangeApiResponse<T>> {
    const startTime = Date.now();
    const { exchange, method, params, options = {} } = apiCall;
    
    const callOptions = {
      priority: options.priority || this.defaultPriority,
      timeout: options.timeout || this.defaultTimeout,
      retries: options.retries || 3,
    };

    try {
      this.validateExchange(exchange);

      // Queue the request through the rate limit coordinator
      const result = await Promise.race([
        exchangeRateLimitCoordinator.queueRequest(
          exchange,
          method,
          params,
          callOptions.priority
        ),
        this.createTimeoutPromise(callOptions.timeout),
      ]);

      const duration = Date.now() - startTime;

      // Get current rate limit status
      const rateLimitStatus = await exchangeRateLimitCoordinator.getRateLimitStatus(exchange);

      const response: ExchangeApiResponse<T> = {
        success: true,
        data: result,
        metadata: {
          exchange,
          method,
          duration,
          retryCount: 0,
          rateLimit: rateLimitStatus ? {
            remaining: rateLimitStatus.remainingRequests,
            resetTime: rateLimitStatus.resetTime,
          } : undefined,
        },
      };

      this.emit('apiCallSuccess', response.metadata);
      return response;

    } catch (error) {
      const duration = Date.now() - startTime;
      const apiError = this.createExchangeApiError(error, exchange, method);

      const response: ExchangeApiResponse<T> = {
        success: false,
        error: apiError.message,
        metadata: {
          exchange,
          method,
          duration,
          retryCount: 0,
        },
      };

      this.emit('apiCallError', { ...response.metadata, error: apiError });
      return response;
    }
  }

  // Batch API calls with automatic prioritization
  async batchCall<T = any>(
    apiCalls: ExchangeApiCall[],
    options: {
      maxConcurrency?: number;
      failFast?: boolean;
    } = {}
  ): Promise<ExchangeApiResponse<T>[]> {
    const { maxConcurrency = 5, failFast = false } = options;
    
    // Sort by priority (higher first)
    const sortedCalls = apiCalls.sort((a, b) => 
      (b.options?.priority || 1) - (a.options?.priority || 1)
    );

    const results: ExchangeApiResponse<T>[] = [];
    const semaphore = new Semaphore(maxConcurrency);

    const promises = sortedCalls.map(async (apiCall, index) => {
      await semaphore.acquire();
      
      try {
        const result = await this.call<T>(apiCall);
        results[index] = result;

        if (failFast && !result.success) {
          throw new Error(`Batch call failed at index ${index}: ${result.error}`);
        }

        return result;
      } finally {
        semaphore.release();
      }
    });

    try {
      await Promise.all(promises);
      return results;
    } catch (error) {
      logger.error('Batch API call failed:', error);
      throw error;
    }
  }

  // High-priority API call (bypasses normal queue)
  async emergencyCall<T = any>(apiCall: ExchangeApiCall): Promise<ExchangeApiResponse<T>> {
    return this.call<T>({
      ...apiCall,
      options: {
        ...apiCall.options,
        priority: 100, // Maximum priority
      },
    });
  }

  // Exchange-specific helper methods

  async getBinancePrice(symbol: string): Promise<ExchangeApiResponse> {
    return this.call({
      exchange: 'binance',
      method: 'ticker/price',
      params: { symbol },
      options: { priority: 2 },
    });
  }

  async getCoinbasePrice(productId: string): Promise<ExchangeApiResponse> {
    return this.call({
      exchange: 'coinbase',
      method: 'products/ticker',
      params: { product_id: productId },
      options: { priority: 2 },
    });
  }

  async getKrakenPrice(pair: string): Promise<ExchangeApiResponse> {
    return this.call({
      exchange: 'kraken',
      method: 'Ticker',
      params: { pair },
      options: { priority: 2 },
    });
  }

  async getKuCoinPrice(symbol: string): Promise<ExchangeApiResponse> {
    return this.call({
      exchange: 'kucoin',
      method: 'market/orderbook/level1',
      params: { symbol },
      options: { priority: 2 },
    });
  }

  // Portfolio synchronization methods
  async syncPortfolio(exchange: string, apiCredentials: any): Promise<ExchangeApiResponse> {
    return this.call({
      exchange,
      method: 'account/portfolio',
      params: { credentials: apiCredentials },
      options: { 
        priority: 3, // High priority for portfolio sync
        timeout: 60000, // 1 minute timeout
      },
    });
  }

  async getOrderHistory(exchange: string, apiCredentials: any, params: any): Promise<ExchangeApiResponse> {
    return this.call({
      exchange,
      method: 'orders/history',
      params: { credentials: apiCredentials, ...params },
      options: { priority: 2 },
    });
  }

  async getTradeHistory(exchange: string, apiCredentials: any, params: any): Promise<ExchangeApiResponse> {
    return this.call({
      exchange,
      method: 'trades/history',
      params: { credentials: apiCredentials, ...params },
      options: { priority: 2 },
    });
  }

  // Market data methods
  async getMarketData(
    exchanges: string[],
    symbols: string[]
  ): Promise<Map<string, ExchangeApiResponse[]>> {
    const results = new Map<string, ExchangeApiResponse[]>();

    const calls: ExchangeApiCall[] = [];
    for (const exchange of exchanges) {
      for (const symbol of symbols) {
        calls.push({
          exchange,
          method: 'market/ticker',
          params: { symbol },
          options: { priority: 1 },
        });
      }
    }

    const responses = await this.batchCall(calls);
    
    // Group results by exchange
    let index = 0;
    for (const exchange of exchanges) {
      const exchangeResults: ExchangeApiResponse[] = [];
      for (const symbol of symbols) {
        if (responses[index]) {
          exchangeResults.push(responses[index]);
        }
        index++;
      }
      results.set(exchange, exchangeResults);
    }

    return results;
  }

  // Monitoring and statistics methods
  async getQueueStatistics(): Promise<any> {
    const stats = new Map();
    
    for (const exchange of Object.keys(EXCHANGE_RATE_LIMITS)) {
      const queueStats = await exchangeRateLimitCoordinator.getQueueStats(exchange);
      const rateLimitStatus = await exchangeRateLimitCoordinator.getRateLimitStatus(exchange);
      
      stats.set(exchange, {
        queue: queueStats,
        rateLimit: rateLimitStatus,
      });
    }

    return Object.fromEntries(stats);
  }

  async getHealthStatus(): Promise<{ [exchange: string]: boolean }> {
    const health: { [exchange: string]: boolean } = {};

    for (const exchange of Object.keys(EXCHANGE_RATE_LIMITS)) {
      try {
        // Test a simple API call to check health
        const response = await this.call({
          exchange,
          method: 'ping',
          params: {},
          options: { priority: 1, timeout: 5000 },
        });
        health[exchange] = response.success;
      } catch (error) {
        health[exchange] = false;
      }
    }

    return health;
  }

  // Administrative methods
  async clearQueue(exchange: string): Promise<number> {
    return exchangeRateLimitCoordinator.clearQueue(exchange);
  }

  async pauseExchange(exchange: string): Promise<void> {
    await exchangeRateLimitCoordinator.pause(exchange);
    logger.info(`Paused API calls for ${exchange}`);
  }

  async resumeExchange(exchange: string): Promise<void> {
    await exchangeRateLimitCoordinator.resume(exchange);
    logger.info(`Resumed API calls for ${exchange}`);
  }

  // Helper methods
  private validateExchange(exchange: string): void {
    if (!EXCHANGE_RATE_LIMITS[exchange]) {
      throw new Error(`Unsupported exchange: ${exchange}`);
    }
  }

  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`API call timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  private createExchangeApiError(
    error: any,
    exchange: string,
    method: string
  ): ExchangeApiError {
    const apiError = new Error(error.message || 'Unknown exchange API error') as ExchangeApiError;
    apiError.name = 'ExchangeApiError';
    apiError.code = error.code || 'UNKNOWN_ERROR';
    apiError.exchange = exchange;
    apiError.method = method;
    apiError.retryable = this.isRetryableError(error);
    apiError.rateLimited = this.isRateLimitError(error);

    return apiError;
  }

  private isRetryableError(error: any): boolean {
    // Network errors, temporary server errors, etc.
    const retryableCodes = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'NETWORK_ERROR',
      'RATE_LIMIT_EXCEEDED',
    ];

    const retryableStatusCodes = [429, 500, 502, 503, 504];

    return (
      retryableCodes.includes(error.code) ||
      retryableStatusCodes.includes(error.status) ||
      retryableStatusCodes.includes(error.statusCode)
    );
  }

  private isRateLimitError(error: any): boolean {
    return (
      error.code === 'RATE_LIMIT_EXCEEDED' ||
      error.status === 429 ||
      error.statusCode === 429 ||
      (error.message && error.message.toLowerCase().includes('rate limit'))
    );
  }
}

// Simple semaphore implementation for concurrency control
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift()!;
      resolve();
    } else {
      this.permits++;
    }
  }
}

// Export singleton instance
export const exchangeApiWrapper = new ExchangeApiWrapper();