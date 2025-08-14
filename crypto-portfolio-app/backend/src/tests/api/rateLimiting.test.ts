import request from 'supertest';
import { app } from '../../app';
import { rateLimitingService } from '../../services/exchanges/rateLimitingService';
import { redis } from '../../config/redis';
import jwt from 'jsonwebtoken';

// Mock external dependencies
jest.mock('../../config/redis');
jest.mock('../../services/auditService');
jest.mock('../../services/loggingService');

describe('Rate Limiting API', () => {
  let authToken: string;
  const mockUserId = 'test-user-123';

  beforeAll(() => {
    // Create a test JWT token
    authToken = jwt.sign(
      { id: mockUserId, email: 'test@example.com' },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset rate limiting service state
    rateLimitingService['requestCounts'].clear();
    rateLimitingService['requestHistory'].clear();
  });

  afterAll(async () => {
    // Clean up any connections
    await redis?.quit?.();
  });

  describe('POST /api/rate-limiting/check', () => {
    it('should check rate limit status successfully', async () => {
      const response = await request(app)
        .post('/api/rate-limiting/check')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'binance',
          endpoint: '/api/v3/ticker/price',
          method: 'GET',
          weight: 1
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('rateLimitStatus');
      expect(response.body.data).toHaveProperty('allowed');
      expect(response.body.data.rateLimitStatus).toHaveProperty('isBlocked');
      expect(response.body.data.rateLimitStatus).toHaveProperty('remainingRequests');
    });

    it('should reject invalid exchange', async () => {
      const response = await request(app)
        .post('/api/rate-limiting/check')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'invalid-exchange',
          endpoint: '/test',
          method: 'GET'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Exchange must be one of');
    });

    it('should handle missing exchange parameter', async () => {
      const response = await request(app)
        .post('/api/rate-limiting/check')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          endpoint: '/test',
          method: 'GET'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Exchange must be one of');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/rate-limiting/check')
        .send({
          exchange: 'binance',
          endpoint: '/test'
        });

      expect(response.status).toBe(401);
    });

    it('should handle weight parameter validation', async () => {
      const response = await request(app)
        .post('/api/rate-limiting/check')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'binance',
          endpoint: '/test',
          weight: 150 // Invalid weight > 100
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Weight must be between 1 and 100');
    });
  });

  describe('POST /api/rate-limiting/record', () => {
    it('should record request successfully', async () => {
      const response = await request(app)
        .post('/api/rate-limiting/record')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'binance',
          endpoint: '/api/v3/ticker/price',
          method: 'GET',
          weight: 1,
          success: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Request recorded successfully');
      expect(response.body.data.exchange).toBe('binance');
    });

    it('should handle failed request recording', async () => {
      const response = await request(app)
        .post('/api/rate-limiting/record')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'kraken',
          endpoint: '/0/public/Ticker',
          method: 'GET',
          weight: 1,
          success: false
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.exchange).toBe('kraken');
    });

    it('should use default values for optional parameters', async () => {
      const response = await request(app)
        .post('/api/rate-limiting/record')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'coinbase'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.endpoint).toBe('default');
      expect(response.body.data.method).toBe('GET');
      expect(response.body.data.weight).toBe(1);
    });
  });

  describe('POST /api/rate-limiting/wait', () => {
    it('should wait for rate limit availability', async () => {
      const response = await request(app)
        .post('/api/rate-limiting/wait')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'binance',
          endpoint: '/api/v3/order',
          method: 'POST',
          weight: 1
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('waitTime');
      expect(typeof response.body.data.waitTime).toBe('number');
    });

    it('should validate exchange parameter', async () => {
      const response = await request(app)
        .post('/api/rate-limiting/wait')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'invalid-exchange'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/rate-limiting/status/:exchange', () => {
    it('should get rate limit status for specific exchange', async () => {
      const response = await request(app)
        .get('/api/rate-limiting/status/binance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.exchange).toBe('binance');
      expect(response.body.data).toHaveProperty('statuses');
      expect(Array.isArray(response.body.data.statuses)).toBe(true);
    });

    it('should handle unsupported exchange', async () => {
      const response = await request(app)
        .get('/api/rate-limiting/status/unsupported')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Unsupported exchange');
    });
  });

  describe('GET /api/rate-limiting/status/all', () => {
    it('should get rate limit status for all exchanges', async () => {
      const response = await request(app)
        .get('/api/rate-limiting/status/all')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('exchanges');
      expect(Array.isArray(response.body.data.exchanges)).toBe(true);
      expect(response.body.data.exchanges.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/rate-limiting/history/:exchange', () => {
    it('should get request history for exchange', async () => {
      // First record some requests
      await request(app)
        .post('/api/rate-limiting/record')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'binance',
          endpoint: '/api/v3/ticker/price',
          method: 'GET'
        });

      const response = await request(app)
        .get('/api/rate-limiting/history/binance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.exchange).toBe('binance');
      expect(Array.isArray(response.body.data.history)).toBe(true);
    });

    it('should handle limit query parameter', async () => {
      const response = await request(app)
        .get('/api/rate-limiting/history/binance?limit=50')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should validate limit parameter', async () => {
      const response = await request(app)
        .get('/api/rate-limiting/history/binance?limit=2000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Limit must be between 1 and 1000');
    });
  });

  describe('GET /api/rate-limiting/statistics', () => {
    it('should get rate limiting statistics', async () => {
      const response = await request(app)
        .get('/api/rate-limiting/statistics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('statistics');
      expect(response.body.data.statistics).toHaveProperty('totalRequests');
      expect(response.body.data.statistics).toHaveProperty('rateLimitedRequests');
      expect(response.body.data.statistics).toHaveProperty('successRate');
    });
  });

  describe('GET /api/rate-limiting/config/:exchange', () => {
    it('should get rate limit configuration for exchange', async () => {
      const response = await request(app)
        .get('/api/rate-limiting/config/binance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.exchange).toBe('binance');
      expect(response.body.data).toHaveProperty('globalLimit');
      expect(response.body.data).toHaveProperty('endpointLimits');
    });
  });

  describe('GET /api/rate-limiting/config/all', () => {
    it('should get rate limit configuration for all exchanges', async () => {
      const response = await request(app)
        .get('/api/rate-limiting/config/all')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('rateLimits');
      expect(response.body.data).toHaveProperty('exchangeCount');
    });
  });

  describe('PUT /api/rate-limiting/config/:exchange', () => {
    it('should update rate limit configuration', async () => {
      const response = await request(app)
        .put('/api/rate-limiting/config/binance')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          endpoint: '/api/v3/test',
          method: 'GET',
          maxRequests: 100,
          windowMs: 60000,
          weight: 1,
          burstAllowed: true,
          burstLimit: 150
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Rate limit updated successfully');
    });

    it('should validate required parameters', async () => {
      const response = await request(app)
        .put('/api/rate-limiting/config/binance')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          endpoint: '/api/v3/test'
          // Missing maxRequests and windowMs
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Missing required parameters');
    });
  });

  describe('DELETE /api/rate-limiting/cache/:exchange', () => {
    it('should clear rate limit cache for exchange', async () => {
      const response = await request(app)
        .delete('/api/rate-limiting/cache/binance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Rate limit cache cleared successfully');
    });
  });

  describe('DELETE /api/rate-limiting/cache/all', () => {
    it('should clear all rate limit cache', async () => {
      const response = await request(app)
        .delete('/api/rate-limiting/cache/all')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Rate limit cache cleared successfully');
    });
  });

  describe('GET /api/rate-limiting/exchanges/supported', () => {
    it('should get supported exchanges', async () => {
      const response = await request(app)
        .get('/api/rate-limiting/exchanges/supported')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.exchanges)).toBe(true);
      expect(response.body.data.exchanges).toContain('binance');
      expect(response.body.data.exchanges).toContain('coinbase');
      expect(response.body.data.exchanges).toContain('kraken');
      expect(response.body.data.exchanges).toContain('kucoin');
    });
  });

  describe('POST /api/rate-limiting/maintenance/cleanup', () => {
    it('should cleanup old data', async () => {
      const response = await request(app)
        .post('/api/rate-limiting/maintenance/cleanup')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Old rate limiting data cleaned up successfully');
    });
  });

  describe('Rate Limit Enforcement', () => {
    it('should enforce rate limits on endpoints', async () => {
      // Make multiple rapid requests to trigger rate limiting
      const requests = Array(65).fill(null).map(() =>
        request(app)
          .post('/api/rate-limiting/check')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ exchange: 'binance' })
      );

      const responses = await Promise.all(requests);
      
      // Should have some rate limited responses
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Exchange-specific Behavior', () => {
    const exchanges = ['binance', 'coinbase', 'kraken', 'kucoin'];

    exchanges.forEach(exchange => {
      describe(`${exchange} rate limiting`, () => {
        it(`should handle ${exchange} rate limit checking`, async () => {
          const response = await request(app)
            .post('/api/rate-limiting/check')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              exchange,
              endpoint: 'default',
              method: 'GET',
              weight: 1
            });

          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);
          expect(response.body.data.rateLimitStatus).toHaveProperty('exchange', exchange);
        });

        it(`should get ${exchange} configuration`, async () => {
          const response = await request(app)
            .get(`/api/rate-limiting/config/${exchange}`)
            .set('Authorization', `Bearer ${authToken}`);

          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);
          expect(response.body.data.exchange).toBe(exchange);
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      // Mock service to throw error
      jest.spyOn(rateLimitingService, 'checkRateLimit').mockRejectedValueOnce(
        new Error('Service unavailable')
      );

      const response = await request(app)
        .post('/api/rate-limiting/check')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'binance',
          endpoint: '/test'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to check rate limit');
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/rate-limiting/check')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'binance',
          method: 'INVALID_METHOD'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});