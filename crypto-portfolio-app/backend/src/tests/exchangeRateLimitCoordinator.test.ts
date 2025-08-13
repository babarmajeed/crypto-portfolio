import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { exchangeRateLimitCoordinator } from '../services/exchangeRateLimitCoordinator';
import { redisService } from '../services/redisService';

// Mock Redis service
jest.mock('../services/redisService');
const mockRedisService = redisService as jest.Mocked<typeof redisService>;

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('ExchangeRateLimitCoordinator', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock Redis client
    mockRedisService.getClient = jest.fn().mockReturnValue({
      on: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
    });

    mockRedisService.healthCheck = jest.fn().mockResolvedValue({
      status: 'healthy',
      connected: true,
      latency: 10,
    });

    await exchangeRateLimitCoordinator.initialize();
  });

  afterEach(async () => {
    jest.useRealTimers();
    await exchangeRateLimitCoordinator.shutdown();
    jest.resetAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      expect(mockRedisService.getClient).toHaveBeenCalled();
    });

    it('should not initialize twice', async () => {
      const initCalls = mockRedisService.getClient.mock.calls.length;
      await exchangeRateLimitCoordinator.initialize();
      
      // Should not call getClient again
      expect(mockRedisService.getClient).toHaveBeenCalledTimes(initCalls);
    });
  });

  describe('queueRequest', () => {
    it('should queue and process requests', async () => {
      const requestPromise = exchangeRateLimitCoordinator.queueRequest(
        'binance',
        'ticker/price',
        { symbol: 'BTCUSDT' },
        1
      );

      // Advance timers to trigger queue processing
      jest.advanceTimersByTime(1000);

      const result = await requestPromise;

      expect(result).toBeDefined();
      expect(result.exchange).toBe('binance');
      expect(result.method).toBe('ticker/price');
    });

    it('should reject requests for unsupported exchanges', async () => {
      await expect(
        exchangeRateLimitCoordinator.queueRequest(
          'unsupported-exchange',
          'test',
          {},
          1
        )
      ).rejects.toThrow('Exchange unsupported-exchange is not supported');
    });

    it('should handle requests with different priorities', async () => {
      const lowPriorityPromise = exchangeRateLimitCoordinator.queueRequest(
        'binance',
        'low-priority',
        {},
        1
      );

      const highPriorityPromise = exchangeRateLimitCoordinator.queueRequest(
        'binance',
        'high-priority',
        {},
        5
      );

      jest.advanceTimersByTime(1000);

      const [lowResult, highResult] = await Promise.all([
        lowPriorityPromise,
        highPriorityPromise,
      ]);

      expect(lowResult).toBeDefined();
      expect(highResult).toBeDefined();
    });

    it('should handle concurrent requests', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(
          exchangeRateLimitCoordinator.queueRequest(
            'binance',
            `request-${i}`,
            { id: i },
            1
          )
        );
      }

      jest.advanceTimersByTime(5000); // Advance time to process all requests

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.method).toBe(`request-${index}`);
        expect(result.params.id).toBe(index);
      });
    });
  });

  describe('queue management', () => {
    it('should return correct queue length', async () => {
      // Queue several requests without processing
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          exchangeRateLimitCoordinator.queueRequest(
            'binance',
            `request-${i}`,
            {},
            1
          )
        );
      }

      const queueLength = await exchangeRateLimitCoordinator.getQueueLength('binance');
      expect(queueLength).toBeGreaterThan(0);

      // Process requests
      jest.advanceTimersByTime(5000);
      await Promise.all(promises);

      const finalQueueLength = await exchangeRateLimitCoordinator.getQueueLength('binance');
      expect(finalQueueLength).toBe(0);
    });

    it('should clear queue when requested', async () => {
      // Queue several requests
      for (let i = 0; i < 5; i++) {
        exchangeRateLimitCoordinator.queueRequest(
          'binance',
          `request-${i}`,
          {},
          1
        );
      }

      const clearedCount = await exchangeRateLimitCoordinator.clearQueue('binance');
      expect(clearedCount).toBe(5);

      const queueLength = await exchangeRateLimitCoordinator.getQueueLength('binance');
      expect(queueLength).toBe(0);
    });

    it('should provide queue statistics', async () => {
      // Queue some requests
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          exchangeRateLimitCoordinator.queueRequest(
            'binance',
            `request-${i}`,
            {},
            1
          )
        );
      }

      const stats = await exchangeRateLimitCoordinator.getQueueStats('binance');
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('processing');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('completed');

      // Process requests
      jest.advanceTimersByTime(5000);
      await Promise.all(promises);

      const finalStats = await exchangeRateLimitCoordinator.getQueueStats('binance');
      expect(finalStats!.completed).toBeGreaterThan(0);
    });
  });

  describe('rate limiting', () => {
    it('should respect rate limits', async () => {
      // Mock rate limiter to reject after first request
      let callCount = 0;
      const mockLimiter = {
        consume: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount > 1) {
            const error = new Error('Rate limit exceeded');
            (error as any).remainingPoints = 0;
            (error as any).msBeforeNext = 1000;
            throw error;
          }
          return { totalHits: callCount, remainingPoints: 10 };
        }),
      };

      // Replace the limiter (this is a simplified test approach)
      (exchangeRateLimitCoordinator as any).limiters.set('binance', mockLimiter);

      const request1 = exchangeRateLimitCoordinator.queueRequest(
        'binance',
        'request1',
        {},
        1
      );

      const request2 = exchangeRateLimitCoordinator.queueRequest(
        'binance',
        'request2',
        {},
        1
      );

      jest.advanceTimersByTime(5000);

      const [result1, result2] = await Promise.all([request1, request2]);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(mockLimiter.consume).toHaveBeenCalledTimes(2);
    });

    it('should get rate limit status', async () => {
      const status = await exchangeRateLimitCoordinator.getRateLimitStatus('binance');
      
      expect(status).toBeDefined();
      expect(status).toHaveProperty('allowed');
      expect(status).toHaveProperty('totalRequests');
      expect(status).toHaveProperty('remainingRequests');
      expect(status).toHaveProperty('resetTime');
    });
  });

  describe('pause and resume', () => {
    it('should pause and resume queue processing', async () => {
      // Pause the queue
      await exchangeRateLimitCoordinator.pause('binance');

      // Queue a request
      const requestPromise = exchangeRateLimitCoordinator.queueRequest(
        'binance',
        'paused-request',
        {},
        1
      );

      // Advance time - request should not be processed
      jest.advanceTimersByTime(2000);

      const queueLength = await exchangeRateLimitCoordinator.getQueueLength('binance');
      expect(queueLength).toBeGreaterThan(0);

      // Resume the queue
      await exchangeRateLimitCoordinator.resume('binance');

      // Advance time - request should now be processed
      jest.advanceTimersByTime(2000);

      const result = await requestPromise;
      expect(result).toBeDefined();
      expect(result.method).toBe('paused-request');
    });
  });

  describe('error handling', () => {
    it('should handle API errors with retries', async () => {
      // Mock the API call to fail initially
      const originalMethod = (exchangeRateLimitCoordinator as any).makeExchangeApiCall;
      let callCount = 0;
      
      (exchangeRateLimitCoordinator as any).makeExchangeApiCall = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Temporary API error');
        }
        return originalMethod.call(exchangeRateLimitCoordinator, {
          exchangeName: 'binance',
          method: 'retry-test',
          params: {},
        });
      });

      const requestPromise = exchangeRateLimitCoordinator.queueRequest(
        'binance',
        'retry-test',
        {},
        1
      );

      jest.advanceTimersByTime(10000); // Allow time for retries

      const result = await requestPromise;
      expect(result).toBeDefined();
      expect(callCount).toBeGreaterThanOrEqual(3);
    });

    it('should fail after maximum retries', async () => {
      // Mock the API call to always fail
      (exchangeRateLimitCoordinator as any).makeExchangeApiCall = jest.fn().mockImplementation(() => {
        throw new Error('Persistent API error');
      });

      const requestPromise = exchangeRateLimitCoordinator.queueRequest(
        'binance',
        'failing-test',
        {},
        1
      );

      jest.advanceTimersByTime(30000); // Allow time for all retries

      await expect(requestPromise).rejects.toThrow('Max retries exceeded');
    });
  });

  describe('health check', () => {
    it('should report healthy status', async () => {
      const isHealthy = await exchangeRateLimitCoordinator.isHealthy();
      expect(isHealthy).toBe(true);
    });

    it('should report unhealthy when Redis is unavailable', async () => {
      mockRedisService.healthCheck = jest.fn().mockResolvedValue({
        status: 'unhealthy',
        connected: false,
      });

      const isHealthy = await exchangeRateLimitCoordinator.isHealthy();
      expect(isHealthy).toBe(false);
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      // Queue some requests
      for (let i = 0; i < 3; i++) {
        exchangeRateLimitCoordinator.queueRequest(
          'binance',
          `request-${i}`,
          {},
          1
        );
      }

      await exchangeRateLimitCoordinator.shutdown();

      // Verify queues are cleared
      const queueLength = await exchangeRateLimitCoordinator.getQueueLength('binance');
      expect(queueLength).toBe(0);
    });
  });

  describe('events', () => {
    it('should emit events for request lifecycle', async () => {
      const events: string[] = [];
      
      exchangeRateLimitCoordinator.on('requestQueued', () => events.push('queued'));
      exchangeRateLimitCoordinator.on('requestCompleted', () => events.push('completed'));

      const requestPromise = exchangeRateLimitCoordinator.queueRequest(
        'binance',
        'event-test',
        {},
        1
      );

      jest.advanceTimersByTime(2000);
      await requestPromise;

      expect(events).toContain('queued');
      expect(events).toContain('completed');
    });

    it('should emit rate limit exceeded events', async () => {
      const events: any[] = [];
      
      exchangeRateLimitCoordinator.on('rateLimitExceeded', (data) => events.push(data));

      // Mock rate limiter to always exceed
      const mockLimiter = {
        consume: jest.fn().mockImplementation(() => {
          const error = new Error('Rate limit exceeded');
          (error as any).remainingPoints = 0;
          (error as any).msBeforeNext = 1000;
          throw error;
        }),
      };

      (exchangeRateLimitCoordinator as any).limiters.set('binance', mockLimiter);

      const requestPromise = exchangeRateLimitCoordinator.queueRequest(
        'binance',
        'rate-limit-test',
        {},
        1
      );

      jest.advanceTimersByTime(5000);
      await requestPromise;

      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toHaveProperty('exchangeName', 'binance');
    });
  });
});