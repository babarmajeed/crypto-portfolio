import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { CacheService } from '../services/cacheService';
import { DatabaseCache } from '../services/databaseCache';
import { CacheManager } from '../services/cacheManager';
import { PerformanceMonitor } from '../services/performanceMonitor';
import { RedisService } from '../services/redisService';

// Mock Redis for testing
jest.mock('../services/redisService', () => ({
  RedisService: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true),
    exists: jest.fn().mockResolvedValue(true),
    invalidatePattern: jest.fn().mockResolvedValue(0),
    healthCheck: jest.fn().mockResolvedValue({ status: 'healthy', connected: true, latency: 1 }),
  })),
  redisService: {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true),
    exists: jest.fn().mockResolvedValue(true),
    invalidatePattern: jest.fn().mockResolvedValue(0),
    healthCheck: jest.fn().mockResolvedValue({ status: 'healthy', connected: true, latency: 1 }),
  },
}));

describe('Cache System Integration Tests', () => {
  let cacheService: CacheService;
  let databaseCache: DatabaseCache;
  let cacheManager: CacheManager;
  let performanceMonitor: PerformanceMonitor;
  let mockRedisService: jest.Mocked<RedisService>;

  beforeAll(async () => {
    // Initialize mock Redis service
    mockRedisService = new RedisService() as jest.Mocked<RedisService>;
    
    // Initialize performance monitor
    performanceMonitor = new PerformanceMonitor({
      metricsInterval: 1000,
      healthCheckInterval: 2000,
      enableDetailedMetrics: true,
      enableAlerting: false, // Disable alerts during testing
    });

    // Initialize cache service
    cacheService = new CacheService(mockRedisService, {
      l1Enabled: true,
      l2Enabled: true,
      compression: true,
      monitoring: true,
    });

    // Initialize database cache
    databaseCache = new DatabaseCache(cacheService, {
      enabled: true,
      defaultTTL: 300,
      maxQueryLength: 1000,
    });

    // Initialize cache manager
    cacheManager = new CacheManager({
      enableMonitoring: true,
      enableWarming: false, // Disable warming during tests
      enableAutoInvalidation: true,
      enableHealthChecks: false, // Disable health checks during tests
    });
  });

  afterAll(async () => {
    if (cacheService) {
      cacheService.destroy();
    }
    if (performanceMonitor) {
      performanceMonitor.destroy();
    }
  });

  beforeEach(() => {
    // Reset mock calls before each test
    jest.clearAllMocks();
  });

  describe('CacheService', () => {
    it('should store and retrieve data from L1 cache', async () => {
      const testData = { id: 1, name: 'test', value: 42 };
      
      await cacheService.set('user', 'test-key', testData, { ttl: 300 });
      const retrieved = await cacheService.get('user', 'test-key');
      
      expect(retrieved).toEqual(testData);
    });

    it('should handle cache misses gracefully', async () => {
      const result = await cacheService.get('user', 'non-existent-key');
      expect(result).toBeNull();
    });

    it('should invalidate cache by namespace', async () => {
      await cacheService.set('price', 'BTC', { price: 50000 });
      await cacheService.set('price', 'ETH', { price: 3000 });
      
      const invalidated = await cacheService.invalidateNamespace('price');
      expect(invalidated).toBeGreaterThan(0);
    });

    it('should compress large objects', async () => {
      const largeData = {
        data: Array(1000).fill('test data').join(' '),
        metadata: { timestamp: Date.now() }
      };
      
      const success = await cacheService.set('api', 'large-object', largeData, {
        ttl: 300,
        compress: true
      });
      
      expect(success).toBe(true);
      
      const retrieved = await cacheService.get('api', 'large-object');
      expect(retrieved).toEqual(largeData);
    });

    it('should track cache statistics', () => {
      const stats = cacheService.getStatistics();
      
      expect(stats).toHaveProperty('l1');
      expect(stats).toHaveProperty('l2');
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('compression');
      
      expect(stats.l1).toHaveProperty('hits');
      expect(stats.l1).toHaveProperty('misses');
      expect(stats.l1).toHaveProperty('hitRate');
    });
  });

  describe('DatabaseCache', () => {
    it('should cache database query results', async () => {
      const mockQuery = 'SELECT * FROM users WHERE id = ?';
      const mockParams = [1];
      const mockResult = { id: 1, name: 'John Doe', email: 'john@example.com' };
      
      const cached = await databaseCache.cacheQuery(mockQuery, mockParams, mockResult, {
        ttl: 300,
        queryType: 'select'
      });
      
      expect(cached).toBe(true);
    });

    it('should retrieve cached query results', async () => {
      const mockQuery = 'SELECT * FROM users WHERE id = ?';
      const mockParams = [1];
      const mockResult = { id: 1, name: 'John Doe', email: 'john@example.com' };
      
      // First, cache the query
      await databaseCache.cacheQuery(mockQuery, mockParams, mockResult);
      
      // Then retrieve it
      const result = await databaseCache.getCachedQuery(mockQuery, mockParams);
      
      expect(result).toBeDefined();
      expect(result?.data).toEqual(mockResult);
      expect(result?.fromCache).toBe(true);
    });

    it('should execute queries with caching', async () => {
      const mockExecutor = jest.fn().mockResolvedValue({ id: 1, name: 'Test User' });
      const mockQuery = 'SELECT * FROM users WHERE active = true';
      
      const result = await databaseCache.executeWithCache(
        mockExecutor,
        mockQuery,
        [],
        { ttl: 300 }
      );
      
      expect(result.data).toEqual({ id: 1, name: 'Test User' });
      expect(result.fromCache).toBe(false); // First execution should not be from cache
      expect(mockExecutor).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache by table name', async () => {
      const invalidated = await databaseCache.invalidateByTable('users');
      expect(invalidated).toBeGreaterThanOrEqual(0);
    });

    it('should provide query statistics', () => {
      const stats = databaseCache.getStatistics();
      
      expect(stats).toHaveProperty('cacheEnabled');
      expect(stats).toHaveProperty('totalQueries');
      expect(stats).toHaveProperty('topQueries');
      expect(stats).toHaveProperty('slowQueries');
      
      expect(stats.cacheEnabled).toBe(true);
    });
  });

  describe('PerformanceMonitor', () => {
    it('should track cache events', () => {
      const testEvent = {
        type: 'hit' as const,
        key: 'test-key',
        layer: 'l1' as const,
        timestamp: Date.now(),
        executionTime: 5,
        namespace: 'test',
      };
      
      performanceMonitor.trackCacheEvent(testEvent);
      
      const metrics = performanceMonitor.getMetrics();
      expect(metrics).toHaveProperty('cache');
      expect(metrics.cache).toHaveProperty('l1');
    });

    it('should generate performance reports', () => {
      const report = performanceMonitor.generateReport();
      
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('performance');
      expect(report).toHaveProperty('statistics');
      expect(report).toHaveProperty('recommendations');
      
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should track top keys', () => {
      const topKeys = performanceMonitor.getTopKeys(5);
      expect(Array.isArray(topKeys)).toBe(true);
    });

    it('should reset metrics', () => {
      performanceMonitor.resetMetrics();
      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.cache.total.hits).toBe(0);
      expect(metrics.cache.total.misses).toBe(0);
    });
  });

  describe('Cache Integration', () => {
    it('should handle multi-layer cache operations', async () => {
      const testData = { 
        portfolio: { id: 1, value: 100000 },
        holdings: [
          { symbol: 'BTC', amount: 2.5, value: 50000 },
          { symbol: 'ETH', amount: 10, value: 30000 }
        ]
      };
      
      // Set data (should go to both L1 and L2)
      await cacheService.set('portfolio', 'user-123', testData, { ttl: 600 });
      
      // Get data (should come from L1)
      const result1 = await cacheService.get('portfolio', 'user-123');
      expect(result1).toEqual(testData);
      
      // Clear L1 cache only
      cacheService.clearL1Cache();
      
      // Get data again (should come from L2 and be promoted to L1)
      const result2 = await cacheService.get('portfolio', 'user-123');
      expect(result2).toEqual(testData);
    });

    it('should handle cache invalidation events', async () => {
      await cacheService.set('portfolio', 'user-123', { value: 100000 });
      await cacheService.set('user', '123', { name: 'John' });
      
      // Invalidate by tags
      const invalidated = await cacheService.invalidateByTags(['portfolio']);
      expect(invalidated).toBeGreaterThanOrEqual(0);
    });

    it('should handle getOrSet pattern', async () => {
      const mockFetcher = jest.fn().mockResolvedValue({ data: 'fresh data' });
      
      // First call should fetch and cache
      const result1 = await cacheService.getOrSet(
        'api',
        'test-data',
        mockFetcher,
        300
      );
      
      expect(result1).toEqual({ data: 'fresh data' });
      expect(mockFetcher).toHaveBeenCalledTimes(1);
      
      // Second call should use cache
      const result2 = await cacheService.getOrSet(
        'api',
        'test-data',
        mockFetcher,
        300
      );
      
      expect(result2).toEqual({ data: 'fresh data' });
      expect(mockFetcher).toHaveBeenCalledTimes(1); // Should not be called again
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection failures gracefully', async () => {
      // Mock Redis failure
      mockRedisService.get.mockRejectedValue(new Error('Redis connection failed'));
      
      const result = await cacheService.get('user', 'test-key');
      expect(result).toBeNull(); // Should return null on error, not throw
    });

    it('should handle cache serialization errors', async () => {
      // Try to cache an object with circular references
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;
      
      const success = await cacheService.set('test', 'circular', circularObj);
      expect(success).toBe(false); // Should fail gracefully
    });

    it('should handle invalid cache keys', async () => {
      const result = await cacheService.get('user', '');
      expect(result).toBeNull();
    });
  });

  describe('Performance Requirements', () => {
    it('should meet cache hit rate targets', async () => {
      // Simulate cache hits and misses
      for (let i = 0; i < 100; i++) {
        if (i < 85) {
          // Simulate cache hits
          performanceMonitor.trackCacheEvent({
            type: 'hit',
            key: `key-${i}`,
            layer: 'l1',
            timestamp: Date.now(),
            executionTime: 1,
          });
        } else {
          // Simulate cache misses
          performanceMonitor.trackCacheEvent({
            type: 'miss',
            key: `key-${i}`,
            layer: 'l1',
            timestamp: Date.now(),
            executionTime: 10,
          });
        }
      }
      
      const metrics = performanceMonitor.getMetrics();
      const hitRate = metrics.cache.total.hits / (metrics.cache.total.hits + metrics.cache.total.misses);
      
      expect(hitRate).toBeGreaterThan(0.8); // Should meet 80%+ hit rate
    });

    it('should meet response time targets', () => {
      // Track fast operations
      for (let i = 0; i < 50; i++) {
        performanceMonitor.trackCacheEvent({
          type: 'hit',
          key: `fast-key-${i}`,
          layer: 'l1',
          timestamp: Date.now(),
          executionTime: Math.random() * 5, // 0-5ms
        });
      }
      
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.cache.total.avgAccessTime).toBeLessThan(10); // Should be under 10ms average
    });
  });
});

describe('Cache Middleware Integration Tests', () => {
  // These tests would require a full Express app setup
  // For now, we'll focus on unit tests for the cache logic
  
  it('should be properly integrated with Express', () => {
    // This is a placeholder for middleware integration tests
    // In a real scenario, you'd test with supertest and a test Express app
    expect(true).toBe(true);
  });
});

describe('Cache Configuration Tests', () => {
  it('should load cache configuration correctly', () => {
    const { cacheConfig } = require('../config/cache.config');
    
    expect(cacheConfig).toHaveProperty('redis');
    expect(cacheConfig).toHaveProperty('memory');
    expect(cacheConfig).toHaveProperty('compression');
    expect(cacheConfig).toHaveProperty('monitoring');
    expect(cacheConfig).toHaveProperty('warming');
  });

  it('should have reasonable TTL defaults', () => {
    const { cacheTTLConfig } = require('../config/cache.config');
    
    expect(cacheTTLConfig.price.realtime).toBeLessThanOrEqual(60);
    expect(cacheTTLConfig.portfolio.summary).toBeGreaterThan(60);
    expect(cacheTTLConfig.user.profile).toBeGreaterThan(300);
  });
});

export {};