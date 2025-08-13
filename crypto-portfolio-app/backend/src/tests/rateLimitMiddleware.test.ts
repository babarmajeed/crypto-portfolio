import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware';
import { rateLimitService } from '../services/rateLimitService';
import { rateLimitMonitor } from '../monitoring/rateLimitMonitor';

// Mock dependencies
jest.mock('../services/rateLimitService');
jest.mock('../monitoring/rateLimitMonitor');
jest.mock('../services/auditService');
jest.mock('../utils/logger');

const mockRateLimitService = rateLimitService as jest.Mocked<typeof rateLimitService>;
const mockRateLimitMonitor = rateLimitMonitor as jest.Mocked<typeof rateLimitMonitor>;

interface MockRequest extends Partial<Request> {
  user?: {
    userId: string;
    email: string;
    role: UserRole;
  };
  headers: Record<string, string>;
  path: string;
  method: string;
  ip?: string;
}

interface MockResponse extends Partial<Response> {
  status: jest.Mock;
  json: jest.Mock;
  set: jest.Mock;
}

describe('RateLimitMiddleware', () => {
  let mockReq: MockRequest;
  let mockRes: MockResponse;
  let mockNext: jest.Mock<NextFunction>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      headers: {
        'user-agent': 'test-agent',
        'x-forwarded-for': '192.168.1.1',
      },
      path: '/api/test',
      method: 'GET',
      ip: '192.168.1.1',
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    // Mock service methods
    mockRateLimitService.initialize = jest.fn().mockResolvedValue(undefined);
    mockRateLimitService.getUserTier = jest.fn().mockResolvedValue(UserRole.BASIC);
    mockRateLimitService.checkRateLimit = jest.fn().mockResolvedValue({
      allowed: true,
      totalRequests: 1,
      remainingRequests: 99,
      resetTime: new Date(Date.now() + 60000),
      userTier: 'BASIC',
    });
    mockRateLimitService.getRateLimitHeaders = jest.fn().mockResolvedValue({
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '99',
      'X-RateLimit-Reset': new Date(Date.now() + 60000).toISOString(),
      'X-RateLimit-Tier': 'BASIC',
    });

    mockRateLimitMonitor.startMonitoring = jest.fn().mockResolvedValue(undefined);
    mockRateLimitMonitor.recordRequest = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('apiLimiter', () => {
    it('should allow requests within rate limits', async () => {
      await rateLimitMiddleware.apiLimiter(mockReq as any, mockRes as any, mockNext);

      expect(mockRateLimitService.checkRateLimit).toHaveBeenCalledWith(
        'ip:192.168.1.1',
        UserRole.BASIC,
        '/api/test'
      );
      expect(mockRes.set).toHaveBeenCalledWith('X-RateLimit-Limit', '100');
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block requests exceeding rate limits', async () => {
      mockRateLimitService.checkRateLimit = jest.fn().mockResolvedValue({
        allowed: false,
        totalRequests: 101,
        remainingRequests: 0,
        retryAfter: 60,
        resetTime: new Date(Date.now() + 60000),
        userTier: 'BASIC',
      });

      await rateLimitMiddleware.apiLimiter(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Too many requests. Please try again later.',
          retryAfter: 60,
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should use user ID for authenticated requests', async () => {
      mockReq.user = {
        userId: 'user-123',
        email: 'test@example.com',
        role: UserRole.PREMIUM,
      };

      await rateLimitMiddleware.apiLimiter(mockReq as any, mockRes as any, mockNext);

      expect(mockRateLimitService.checkRateLimit).toHaveBeenCalledWith(
        'user:user-123',
        UserRole.PREMIUM,
        '/api/test'
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should record monitoring data', async () => {
      await rateLimitMiddleware.apiLimiter(mockReq as any, mockRes as any, mockNext);

      expect(mockRateLimitMonitor.recordRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'ip:192.168.1.1',
          endpoint: '/api/test',
          method: 'GET',
          userTier: 'BASIC',
          blocked: false,
        })
      );
    });

    it('should handle service errors gracefully', async () => {
      mockRateLimitService.checkRateLimit = jest.fn().mockRejectedValue(
        new Error('Service unavailable')
      );

      await rateLimitMiddleware.apiLimiter(mockReq as any, mockRes as any, mockNext);

      // Should continue on error
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('authLimiter', () => {
    it('should apply stricter limits for authentication endpoints', async () => {
      mockReq.path = '/api/auth/login';

      await rateLimitMiddleware.authLimiter(mockReq as any, mockRes as any, mockNext);

      expect(mockRateLimitService.checkRateLimit).toHaveBeenCalledWith(
        'auth:192.168.1.1',
        'ANONYMOUS',
        '/api/auth/login'
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should block authentication attempts exceeding limits', async () => {
      mockRateLimitService.checkRateLimit = jest.fn().mockResolvedValue({
        allowed: false,
        totalRequests: 21,
        remainingRequests: 0,
        retryAfter: 900,
        resetTime: new Date(Date.now() + 900000),
        userTier: 'ANONYMOUS',
      });

      await rateLimitMiddleware.authLimiter(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Too many authentication attempts, please try again later.',
          retryAfter: 900,
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('IP address detection', () => {
    it('should detect IP from x-forwarded-for header', async () => {
      mockReq.headers['x-forwarded-for'] = '203.0.113.1, 203.0.113.2';

      await rateLimitMiddleware.apiLimiter(mockReq as any, mockRes as any, mockNext);

      expect(mockRateLimitService.checkRateLimit).toHaveBeenCalledWith(
        'ip:203.0.113.1',
        UserRole.BASIC,
        '/api/test'
      );
    });

    it('should detect IP from x-real-ip header', async () => {
      delete mockReq.headers['x-forwarded-for'];
      mockReq.headers['x-real-ip'] = '203.0.113.3';

      await rateLimitMiddleware.apiLimiter(mockReq as any, mockRes as any, mockNext);

      expect(mockRateLimitService.checkRateLimit).toHaveBeenCalledWith(
        'ip:203.0.113.3',
        UserRole.BASIC,
        '/api/test'
      );
    });

    it('should fall back to socket remote address', async () => {
      delete mockReq.headers['x-forwarded-for'];
      delete mockReq.headers['x-real-ip'];
      delete mockReq.ip;
      (mockReq as any).socket = { remoteAddress: '203.0.113.4' };

      await rateLimitMiddleware.apiLimiter(mockReq as any, mockRes as any, mockNext);

      expect(mockRateLimitService.checkRateLimit).toHaveBeenCalledWith(
        'ip:203.0.113.4',
        UserRole.BASIC,
        '/api/test'
      );
    });

    it('should handle unknown IP gracefully', async () => {
      delete mockReq.headers['x-forwarded-for'];
      delete mockReq.headers['x-real-ip'];
      delete mockReq.ip;
      (mockReq as any).socket = {};

      await rateLimitMiddleware.apiLimiter(mockReq as any, mockRes as any, mockNext);

      expect(mockRateLimitService.checkRateLimit).toHaveBeenCalledWith(
        'ip:unknown',
        UserRole.BASIC,
        '/api/test'
      );
    });
  });

  describe('rate limit headers', () => {
    it('should set all required rate limit headers', async () => {
      await rateLimitMiddleware.apiLimiter(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.set).toHaveBeenCalledWith('X-RateLimit-Limit', '100');
      expect(mockRes.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '99');
      expect(mockRes.set).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
      expect(mockRes.set).toHaveBeenCalledWith('X-RateLimit-Tier', 'BASIC');
    });

    it('should not set undefined headers', async () => {
      mockRateLimitService.getRateLimitHeaders = jest.fn().mockResolvedValue({
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '99',
        'X-RateLimit-Reset': new Date().toISOString(),
        'X-RateLimit-Tier': 'BASIC',
        'X-RateLimit-RetryAfter': undefined,
      });

      await rateLimitMiddleware.apiLimiter(mockReq as any, mockRes as any, mockNext);

      expect(mockRes.set).not.toHaveBeenCalledWith('X-RateLimit-RetryAfter', undefined);
    });
  });

  describe('user tier handling', () => {
    it('should handle admin users', async () => {
      mockReq.user = {
        userId: 'admin-123',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
      };

      mockRateLimitService.getUserTier = jest.fn().mockResolvedValue(UserRole.ADMIN);

      await rateLimitMiddleware.apiLimiter(mockReq as any, mockRes as any, mockNext);

      expect(mockRateLimitService.checkRateLimit).toHaveBeenCalledWith(
        'user:admin-123',
        UserRole.ADMIN,
        '/api/test'
      );
    });

    it('should handle premium users', async () => {
      mockReq.user = {
        userId: 'premium-123',
        email: 'premium@example.com',
        role: UserRole.PREMIUM,
      };

      mockRateLimitService.getUserTier = jest.fn().mockResolvedValue(UserRole.PREMIUM);

      await rateLimitMiddleware.apiLimiter(mockReq as any, mockRes as any, mockNext);

      expect(mockRateLimitService.checkRateLimit).toHaveBeenCalledWith(
        'user:premium-123',
        UserRole.PREMIUM,
        '/api/test'
      );
    });

    it('should handle unauthenticated users as anonymous', async () => {
      delete mockReq.user;

      mockRateLimitService.getUserTier = jest.fn().mockResolvedValue('ANONYMOUS');

      await rateLimitMiddleware.apiLimiter(mockReq as any, mockRes as any, mockNext);

      expect(mockRateLimitService.getUserTier).toHaveBeenCalledWith(undefined, undefined);
    });
  });

  describe('health check', () => {
    it('should return healthy status when services are healthy', async () => {
      mockRateLimitService.isServiceHealthy = jest.fn().mockResolvedValue(true);
      mockRateLimitMonitor.isHealthy = jest.fn().mockResolvedValue(true);

      const isHealthy = await rateLimitMiddleware.isHealthy();

      expect(isHealthy).toBe(true);
    });

    it('should return unhealthy status when services are unhealthy', async () => {
      mockRateLimitService.isServiceHealthy = jest.fn().mockResolvedValue(false);
      mockRateLimitMonitor.isHealthy = jest.fn().mockResolvedValue(true);

      const isHealthy = await rateLimitMiddleware.isHealthy();

      expect(isHealthy).toBe(false);
    });

    it('should handle health check errors', async () => {
      mockRateLimitService.isServiceHealthy = jest.fn().mockRejectedValue(
        new Error('Health check failed')
      );

      const isHealthy = await rateLimitMiddleware.isHealthy();

      expect(isHealthy).toBe(false);
    });
  });

  describe('stats', () => {
    it('should return rate limiter statistics', async () => {
      const mockMetrics = [
        {
          identifier: 'user:123',
          totalRequests: 50,
          allowedRequests: 48,
          blockedRequests: 2,
          averageResponseTime: 120,
          lastRequest: new Date(),
          userTier: 'BASIC',
          endpoint: '/api/test',
        },
      ];

      const mockAnalytics = {
        period: '24h',
        totalRequests: 1000,
        blockedRequests: 50,
        uniqueUsers: 25,
        topEndpoints: [],
        tierBreakdown: {},
      };

      mockRateLimitMonitor.getMetrics = jest.fn().mockResolvedValue(mockMetrics);
      mockRateLimitMonitor.getAnalytics = jest.fn().mockResolvedValue(mockAnalytics);
      mockRateLimitMonitor.getActiveAlerts = jest.fn().mockResolvedValue([]);

      const stats = await rateLimitMiddleware.getStats();

      expect(stats).toHaveProperty('metrics');
      expect(stats).toHaveProperty('analytics');
      expect(stats).toHaveProperty('activeAlerts');
      expect(stats).toHaveProperty('isHealthy');
      expect(stats.metrics).toEqual(mockMetrics);
      expect(stats.analytics).toEqual(mockAnalytics);
    });

    it('should filter stats by identifier', async () => {
      const mockMetrics = [
        {
          identifier: 'user:123',
          totalRequests: 50,
          allowedRequests: 48,
          blockedRequests: 2,
          averageResponseTime: 120,
          lastRequest: new Date(),
          userTier: 'BASIC',
          endpoint: '/api/test',
        },
        {
          identifier: 'user:456',
          totalRequests: 30,
          allowedRequests: 30,
          blockedRequests: 0,
          averageResponseTime: 100,
          lastRequest: new Date(),
          userTier: 'PREMIUM',
          endpoint: '/api/test',
        },
      ];

      mockRateLimitMonitor.getMetrics = jest.fn().mockResolvedValue(mockMetrics);

      const stats = await rateLimitMiddleware.getStats('user:123');

      expect(stats.metrics).toHaveLength(1);
      expect(stats.metrics[0].identifier).toBe('user:123');
    });

    it('should handle stats errors gracefully', async () => {
      mockRateLimitMonitor.getMetrics = jest.fn().mockRejectedValue(
        new Error('Stats unavailable')
      );

      const stats = await rateLimitMiddleware.getStats();

      expect(stats).toBeNull();
    });
  });

  describe('shutdown', () => {
    it('should shutdown monitoring gracefully', async () => {
      mockRateLimitMonitor.stopMonitoring = jest.fn().mockResolvedValue(undefined);

      await rateLimitMiddleware.shutdown();

      expect(mockRateLimitMonitor.stopMonitoring).toHaveBeenCalled();
    });

    it('should handle shutdown errors', async () => {
      mockRateLimitMonitor.stopMonitoring = jest.fn().mockRejectedValue(
        new Error('Shutdown failed')
      );

      // Should not throw
      await expect(rateLimitMiddleware.shutdown()).resolves.toBeUndefined();
    });
  });
});