import request from 'supertest';
import { app } from '../../app';
import { rateLimitingService } from '../../services/exchanges/rateLimitingService';
import { redis } from '../../config/redis';
import jwt from 'jsonwebtoken';
import { RateLimitingService } from '../../services/exchanges/rateLimitingService';

// Mock external dependencies
jest.mock('../../config/redis');
jest.mock('../../services/auditService');
jest.mock('../../services/loggingService');

describe('Rate Limiting Integration Tests', () => {
  let authToken: string;
  const mockUserId = 'integration-test-user';
  let service: RateLimitingService;

  beforeAll(() => {
    // Create a test JWT token
    authToken = jwt.sign(
      { id: mockUserId, email: 'integration@example.com' },
      process.env.JWT_SECRET || 'test-secret'
    );
    service = rateLimitingService;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset service state
    service['requestCounts'].clear();
    service['requestHistory'].clear();
  });

  afterAll(async () => {
    await redis?.quit?.();
  });

  describe('Rate Limiting Flow Integration', () => {
    it('should handle complete rate limiting flow', async () => {
      const exchange = 'binance';
      const endpoint = '/api/v3/ticker/price';

      // Step 1: Check initial rate limit status
      const initialStatusResponse = await request(app)
        .get(`/api/rate-limiting/status/${exchange}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(initialStatusResponse.status).toBe(200);
      expect(initialStatusResponse.body.success).toBe(true);

      // Step 2: Check if request is allowed
      const checkResponse = await request(app)
        .post('/api/rate-limiting/check')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange,
          endpoint,
          method: 'GET',
          weight: 1
        });

      expect(checkResponse.status).toBe(200);
      expect(checkResponse.body.data.allowed).toBe(true);

      // Step 3: Record the request
      const recordResponse = await request(app)
        .post('/api/rate-limiting/record')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange,
          endpoint,
          method: 'GET',
          weight: 1,
          success: true
        });

      expect(recordResponse.status).toBe(200);
      expect(recordResponse.body.success).toBe(true);

      // Step 4: Check updated status
      const updatedStatusResponse = await request(app)
        .get(`/api/rate-limiting/status/${exchange}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(updatedStatusResponse.status).toBe(200);
      expect(updatedStatusResponse.body.success).toBe(true);

      // Step 5: Check request history
      const historyResponse = await request(app)
        .get(`/api/rate-limiting/history/${exchange}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(historyResponse.status).toBe(200);
      expect(historyResponse.body.data.history.length).toBeGreaterThan(0);
    });

    it('should handle rate limit enforcement correctly', async () => {
      const exchange = 'binance';
      const endpoint = '/api/v3/order';

      // Make requests up to the limit
      const maxRequests = 10;
      const requests = [];

      for (let i = 0; i < maxRequests + 5; i++) {
        requests.push(
          request(app)
            .post('/api/rate-limiting/check')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              exchange,
              endpoint,
              method: 'POST',
              weight: 1
            })
        );
      }

      const responses = await Promise.allSettled(requests);
      
      let allowedCount = 0;
      let blockedCount = 0;

      responses.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.body.data.allowed) {
          allowedCount++;
        } else if (result.status === 'fulfilled' && !result.value.body.data.allowed) {
          blockedCount++;
        }
      });

      expect(allowedCount).toBeGreaterThan(0);
      expect(blockedCount).toBeGreaterThan(0);
    });

    it('should handle burst limits correctly', async () => {
      const exchange = 'binance';
      const endpoint = '/api/v3/ticker/bookTicker';

      // Configure burst limits
      await request(app)
        .put(`/api/rate-limiting/config/${exchange}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          endpoint,
          method: 'GET',
          maxRequests: 5,
          windowMs: 10000,
          weight: 1,
          burstAllowed: true,
          burstLimit: 10
        });

      // Make burst requests
      const burstRequests = Array(12).fill(null).map(() =>
        request(app)
          .post('/api/rate-limiting/check')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            exchange,
            endpoint,
            method: 'GET',
            weight: 1
          })
      );

      const responses = await Promise.all(burstRequests);
      
      const allowedResponses = responses.filter(res => 
        res.body.data && res.body.data.allowed
      );
      
      // Should allow burst limit number of requests
      expect(allowedResponses.length).toBeGreaterThan(5);
      expect(allowedResponses.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Multi-Exchange Rate Limiting', () => {
    const exchanges = ['binance', 'coinbase', 'kraken', 'kucoin'];

    it('should handle independent rate limits per exchange', async () => {
      const requests = exchanges.map(exchange =>
        request(app)
          .post('/api/rate-limiting/check')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            exchange,
            endpoint: 'default',
            method: 'GET',
            weight: 1
          })
      );

      const responses = await Promise.all(requests);

      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.rateLimitStatus.exchange).toBe(exchanges[index]);
      });
    });

    it('should handle different weight values per exchange', async () => {
      const weightTests = [
        { exchange: 'binance', weight: 1 },
        { exchange: 'coinbase', weight: 2 },
        { exchange: 'kraken', weight: 5 },
        { exchange: 'kucoin', weight: 10 }
      ];

      const requests = weightTests.map(test =>
        request(app)
          .post('/api/rate-limiting/check')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            exchange: test.exchange,
            endpoint: 'default',
            method: 'GET',
            weight: test.weight
          })
      );

      const responses = await Promise.all(requests);

      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.data.rateLimitStatus.requestWeight).toBe(weightTests[index].weight);
      });
    });
  });

  describe('User-specific Rate Limiting', () => {
    it('should enforce separate limits per user', async () => {
      const user1Token = jwt.sign(
        { id: 'user1', email: 'user1@test.com' },
        process.env.JWT_SECRET || 'test-secret'
      );

      const user2Token = jwt.sign(
        { id: 'user2', email: 'user2@test.com' },
        process.env.JWT_SECRET || 'test-secret'
      );

      // User 1 makes requests
      const user1Requests = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/rate-limiting/check')
          .set('Authorization', `Bearer ${user1Token}`)
          .send({
            exchange: 'binance',
            endpoint: '/api/v3/ticker/price',
            method: 'GET',
            weight: 1
          })
      );

      // User 2 makes requests
      const user2Requests = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/rate-limiting/check')
          .set('Authorization', `Bearer ${user2Token}`)
          .send({
            exchange: 'binance',
            endpoint: '/api/v3/ticker/price',
            method: 'GET',
            weight: 1
          })
      );

      const [user1Responses, user2Responses] = await Promise.all([
        Promise.all(user1Requests),
        Promise.all(user2Requests)
      ]);

      // Both users should be able to make requests independently
      user1Responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      user2Responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should track separate request histories per user', async () => {
      const user1Token = jwt.sign(
        { id: 'user1', email: 'user1@test.com' },
        process.env.JWT_SECRET || 'test-secret'
      );

      // User 1 records requests
      await request(app)
        .post('/api/rate-limiting/record')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          exchange: 'binance',
          endpoint: '/api/v3/ticker/price',
          method: 'GET',
          success: true
        });

      // Original user records requests
      await request(app)
        .post('/api/rate-limiting/record')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'binance',
          endpoint: '/api/v3/account',
          method: 'GET',
          success: true
        });

      // Check separate histories
      const user1History = await request(app)
        .get('/api/rate-limiting/history/binance')
        .set('Authorization', `Bearer ${user1Token}`);

      const originalUserHistory = await request(app)
        .get('/api/rate-limiting/history/binance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(user1History.body.data.history).toHaveLength(1);
      expect(originalUserHistory.body.data.history).toHaveLength(1);

      expect(user1History.body.data.history[0].endpoint).toBe('/api/v3/ticker/price');
      expect(originalUserHistory.body.data.history[0].endpoint).toBe('/api/v3/account');
    });
  });

  describe('Cache Management Integration', () => {
    it('should handle cache clearing and restoration', async () => {
      const exchange = 'binance';

      // Make some requests to populate cache
      await request(app)
        .post('/api/rate-limiting/record')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange,
          endpoint: '/api/v3/ticker/price',
          method: 'GET'
        });

      // Check status before clearing
      const statusBefore = await request(app)
        .get(`/api/rate-limiting/status/${exchange}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(statusBefore.status).toBe(200);

      // Clear cache
      const clearResponse = await request(app)
        .delete(`/api/rate-limiting/cache/${exchange}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(clearResponse.status).toBe(200);
      expect(clearResponse.body.data.message).toBe('Rate limit cache cleared successfully');

      // Check status after clearing
      const statusAfter = await request(app)
        .get(`/api/rate-limiting/status/${exchange}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(statusAfter.status).toBe(200);
      // Cache should be reset
    });

    it('should handle global cache clearing', async () => {
      // Make requests to multiple exchanges
      const exchanges = ['binance', 'coinbase'];
      
      for (const exchange of exchanges) {
        await request(app)
          .post('/api/rate-limiting/record')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ exchange, endpoint: 'default', method: 'GET' });
      }

      // Clear all cache
      const clearResponse = await request(app)
        .delete('/api/rate-limiting/cache/all')
        .set('Authorization', `Bearer ${authToken}`);

      expect(clearResponse.status).toBe(200);
      expect(clearResponse.body.success).toBe(true);
    });
  });

  describe('Statistics and Analytics Integration', () => {
    it('should accurately track statistics', async () => {
      // Make multiple requests with different outcomes
      await request(app)
        .post('/api/rate-limiting/record')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'binance',
          endpoint: '/api/v3/ticker/price',
          method: 'GET',
          success: true
        });

      await request(app)
        .post('/api/rate-limiting/record')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'binance',
          endpoint: '/api/v3/order',
          method: 'POST',
          success: false
        });

      // Get statistics
      const statsResponse = await request(app)
        .get('/api/rate-limiting/statistics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(statsResponse.status).toBe(200);
      expect(statsResponse.body.success).toBe(true);
      expect(statsResponse.body.data.statistics.totalRequests).toBeGreaterThan(0);
      expect(typeof statsResponse.body.data.statistics.successRate).toBe('number');
    });
  });

  describe('Configuration Management Integration', () => {
    it('should persist and retrieve configuration updates', async () => {
      const exchange = 'binance';
      const testConfig = {
        endpoint: '/api/v3/test-integration',
        method: 'POST',
        maxRequests: 50,
        windowMs: 30000,
        weight: 2,
        burstAllowed: true,
        burstLimit: 75
      };

      // Update configuration
      const updateResponse = await request(app)
        .put(`/api/rate-limiting/config/${exchange}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(testConfig);

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.success).toBe(true);

      // Retrieve configuration to verify
      const configResponse = await request(app)
        .get(`/api/rate-limiting/config/${exchange}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(configResponse.status).toBe(200);
      expect(configResponse.body.success).toBe(true);
      
      // Check if the configuration was applied
      const endpointKey = `${testConfig.method}:${testConfig.endpoint}`;
      expect(configResponse.body.data.endpointLimits).toHaveProperty(endpointKey);
    });
  });

  describe('Wait Functionality Integration', () => {
    it('should handle rate limit waiting correctly', async () => {
      const exchange = 'binance';
      const endpoint = '/api/v3/order';

      // Set a very restrictive limit for testing
      await request(app)
        .put(`/api/rate-limiting/config/${exchange}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          endpoint,
          method: 'POST',
          maxRequests: 1,
          windowMs: 5000,
          weight: 1
        });

      // Make first request (should be allowed)
      const firstCheck = await request(app)
        .post('/api/rate-limiting/check')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange,
          endpoint,
          method: 'POST',
          weight: 1
        });

      expect(firstCheck.body.data.allowed).toBe(true);

      // Record the first request
      await request(app)
        .post('/api/rate-limiting/record')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange,
          endpoint,
          method: 'POST',
          weight: 1,
          success: true
        });

      // Wait for next available slot
      const waitResponse = await request(app)
        .post('/api/rate-limiting/wait')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange,
          endpoint,
          method: 'POST',
          weight: 1
        });

      expect(waitResponse.status).toBe(200);
      expect(waitResponse.body.success).toBe(true);
      expect(waitResponse.body.data).toHaveProperty('waitTime');
      expect(typeof waitResponse.body.data.waitTime).toBe('number');
    });
  });

  describe('Error Resilience Integration', () => {
    it('should handle service failures gracefully', async () => {
      // Mock a service method to fail
      const originalMethod = service.checkRateLimit;
      service.checkRateLimit = jest.fn().mockRejectedValue(new Error('Service failure'));

      const response = await request(app)
        .post('/api/rate-limiting/check')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'binance',
          endpoint: '/test'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      // Restore original method
      service.checkRateLimit = originalMethod;
    });

    it('should handle network timeouts gracefully', async () => {
      // Simulate timeout by mocking a long-running operation
      const originalMethod = service.waitForRateLimit;
      service.waitForRateLimit = jest.fn().mockImplementation(() => 
        new Promise((resolve) => setTimeout(resolve, 100))
      );

      const response = await request(app)
        .post('/api/rate-limiting/wait')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'binance',
          endpoint: '/test'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Restore original method
      service.waitForRateLimit = originalMethod;
    });
  });

  describe('Performance Integration', () => {
    it('should handle high-volume requests efficiently', async () => {
      const startTime = Date.now();
      const requestCount = 100;

      // Create many concurrent requests
      const requests = Array(requestCount).fill(null).map((_, index) =>
        request(app)
          .get('/api/rate-limiting/exchanges/supported')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Performance check - should handle 100 requests in reasonable time
      expect(totalTime).toBeLessThan(10000); // 10 seconds max
      
      console.log(`Processed ${requestCount} requests in ${totalTime}ms`);
    });
  });
});