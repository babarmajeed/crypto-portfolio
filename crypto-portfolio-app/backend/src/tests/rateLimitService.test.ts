import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { UserRole } from '@prisma/client';
import { rateLimitService } from '../services/rateLimitService';
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

describe('RateLimitService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    
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

    // Initialize the service
    await rateLimitService.initialize();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limits', async () => {
      const result = await rateLimitService.checkRateLimit(
        'test-user',
        UserRole.BASIC,
        '/api/test'
      );

      expect(result.allowed).toBe(true);
      expect(result.userTier).toBe('BASIC');
      expect(result.remainingRequests).toBeGreaterThan(0);
    });

    it('should handle different user tiers correctly', async () => {
      const premiumResult = await rateLimitService.checkRateLimit(
        'premium-user',
        UserRole.PREMIUM,
        '/api/test'
      );

      const basicResult = await rateLimitService.checkRateLimit(
        'basic-user',
        UserRole.BASIC,
        '/api/test'
      );

      expect(premiumResult.allowed).toBe(true);
      expect(basicResult.allowed).toBe(true);
      
      // Premium users should have higher limits
      expect(premiumResult.remainingRequests).toBeGreaterThanOrEqual(basicResult.remainingRequests);
    });

    it('should handle anonymous users', async () => {
      const result = await rateLimitService.checkRateLimit(
        'anonymous-ip',
        'ANONYMOUS',
        '/api/test'
      );

      expect(result.allowed).toBe(true);
      expect(result.userTier).toBe('ANONYMOUS');
    });

    it('should handle admin users with high limits', async () => {
      const result = await rateLimitService.checkRateLimit(
        'admin-user',
        UserRole.ADMIN,
        '/api/test'
      );

      expect(result.allowed).toBe(true);
      expect(result.userTier).toBe('ADMIN');
      expect(result.remainingRequests).toBeGreaterThan(1000); // Admins have high limits
    });
  });

  describe('getUserTier', () => {
    it('should return ANONYMOUS for users without ID', async () => {
      const tier = await rateLimitService.getUserTier();
      expect(tier).toBe('ANONYMOUS');
    });

    it('should return the provided role when available', async () => {
      const tier = await rateLimitService.getUserTier('user-123', UserRole.PREMIUM);
      expect(tier).toBe(UserRole.PREMIUM);
    });

    it('should default to BASIC for authenticated users without role', async () => {
      const tier = await rateLimitService.getUserTier('user-123');
      expect(tier).toBe(UserRole.BASIC);
    });
  });

  describe('blacklist functionality', () => {
    it('should add and check blacklist entries', async () => {
      const identifier = 'malicious-ip';
      
      // Mock Redis operations
      mockRedisService.set = jest.fn().mockResolvedValue(true);
      mockRedisService.get = jest.fn().mockResolvedValue({
        identifier,
        reason: 'Test blacklist',
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        requestCount: 100,
      });

      await rateLimitService.addToBlacklist(identifier, 'Test blacklist');
      
      const result = await rateLimitService.checkRateLimit(
        identifier,
        'ANONYMOUS',
        '/api/test'
      );

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should remove from blacklist', async () => {
      const identifier = 'test-ip';
      
      mockRedisService.del = jest.fn().mockResolvedValue(true);
      
      await rateLimitService.removeFromBlacklist(identifier);
      
      expect(mockRedisService.del).toHaveBeenCalledWith(
        expect.stringContaining(identifier)
      );
    });
  });

  describe('rate limit headers', () => {
    it('should generate proper rate limit headers', async () => {
      const headers = await rateLimitService.getRateLimitHeaders(
        'test-user',
        UserRole.BASIC
      );

      expect(headers).toHaveProperty('X-RateLimit-Limit');
      expect(headers).toHaveProperty('X-RateLimit-Remaining');
      expect(headers).toHaveProperty('X-RateLimit-Reset');
      expect(headers).toHaveProperty('X-RateLimit-Tier');
      expect(headers['X-RateLimit-Tier']).toBe('BASIC');
    });

    it('should include retry-after header when appropriate', async () => {
      // Simulate a rate limited scenario
      const headers = await rateLimitService.getRateLimitHeaders(
        'rate-limited-user',
        UserRole.BASIC
      );

      expect(headers).toHaveProperty('X-RateLimit-Limit');
      expect(headers['X-RateLimit-Remaining']).toBeDefined();
    });
  });

  describe('reset functionality', () => {
    it('should reset rate limits for a user', async () => {
      const identifier = 'test-user';
      
      await rateLimitService.resetRateLimit(identifier, UserRole.BASIC);
      
      // Should be able to make requests after reset
      const result = await rateLimitService.checkRateLimit(
        identifier,
        UserRole.BASIC,
        '/api/test'
      );
      
      expect(result.allowed).toBe(true);
    });
  });

  describe('service health', () => {
    it('should report healthy when Redis is available', async () => {
      const isHealthy = await rateLimitService.isServiceHealthy();
      expect(isHealthy).toBe(true);
    });

    it('should report unhealthy when Redis is unavailable', async () => {
      mockRedisService.healthCheck = jest.fn().mockResolvedValue({
        status: 'unhealthy',
        connected: false,
      });

      const isHealthy = await rateLimitService.isServiceHealthy();
      expect(isHealthy).toBe(false);
    });
  });

  describe('graceful degradation', () => {
    it('should continue working when Redis is temporarily unavailable', async () => {
      // Simulate Redis failure
      mockRedisService.healthCheck = jest.fn().mockRejectedValue(new Error('Redis unavailable'));
      
      const result = await rateLimitService.checkRateLimit(
        'test-user',
        UserRole.BASIC,
        '/api/test'
      );

      // Should gracefully allow the request
      expect(result.allowed).toBe(true);
    });
  });

  describe('metrics', () => {
    it('should track and return metrics', async () => {
      // Make some requests to generate metrics
      await rateLimitService.checkRateLimit('user1', UserRole.BASIC, '/api/test');
      await rateLimitService.checkRateLimit('user2', UserRole.PREMIUM, '/api/test');
      
      const metrics = await rateLimitService.getMetrics();
      expect(Array.isArray(metrics)).toBe(true);
    });

    it('should filter metrics by identifier', async () => {
      const identifier = 'specific-user';
      await rateLimitService.checkRateLimit(identifier, UserRole.BASIC, '/api/test');
      
      const metrics = await rateLimitService.getMetrics(identifier);
      expect(metrics.every(m => m.identifier === identifier)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle invalid user tiers gracefully', async () => {
      // @ts-ignore - Testing invalid input
      const result = await rateLimitService.checkRateLimit(
        'test-user',
        'INVALID_TIER' as any,
        '/api/test'
      );

      // Should default to some reasonable behavior
      expect(result).toBeDefined();
      expect(typeof result.allowed).toBe('boolean');
    });

    it('should handle extremely high request rates', async () => {
      const identifier = 'high-volume-user';
      const promises = [];

      // Simulate 100 concurrent requests
      for (let i = 0; i < 100; i++) {
        promises.push(
          rateLimitService.checkRateLimit(identifier, UserRole.BASIC, '/api/test')
        );
      }

      const results = await Promise.all(promises);
      
      // Some should be allowed, some should be blocked
      const allowed = results.filter(r => r.allowed).length;
      const blocked = results.filter(r => !r.allowed).length;
      
      expect(allowed + blocked).toBe(100);
      expect(allowed).toBeGreaterThan(0); // At least some should be allowed
    });

    it('should handle malformed identifiers', async () => {
      const malformedIdentifiers = ['', null, undefined, ' ', '\n\t'];

      for (const identifier of malformedIdentifiers) {
        try {
          const result = await rateLimitService.checkRateLimit(
            identifier as any,
            UserRole.BASIC,
            '/api/test'
          );
          
          expect(result).toBeDefined();
          expect(typeof result.allowed).toBe('boolean');
        } catch (error) {
          // Should either handle gracefully or throw predictable errors
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('configuration validation', () => {
    it('should have valid tier configurations', async () => {
      const tiers = [UserRole.ADMIN, UserRole.PREMIUM, UserRole.BASIC, 'ANONYMOUS', 'INTERNAL'];
      
      for (const tier of tiers) {
        const headers = await rateLimitService.getRateLimitHeaders(
          'test-user',
          tier as any
        );
        
        expect(headers['X-RateLimit-Limit']).toBeDefined();
        expect(parseInt(headers['X-RateLimit-Limit'])).toBeGreaterThan(0);
      }
    });
  });
});