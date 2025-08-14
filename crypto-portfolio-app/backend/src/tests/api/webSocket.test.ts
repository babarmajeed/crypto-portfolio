import request from 'supertest';
import { app } from '../../app';
import { webSocketManager } from '../../services/exchanges/webSocketManager';
import { cacheService } from '../../services/cacheService';
import { auditService } from '../../services/auditService';
import { generateTestJWT } from '../helpers/testHelpers';
import { jest } from '@jest/globals';

describe('WebSocket API Tests', () => {
  let authToken: string;
  let adminToken: string;
  let userId: string;

  beforeAll(async () => {
    const testUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'user'
    };
    const adminUser = {
      id: 'admin-user-id',
      email: 'admin@example.com',
      role: 'admin'
    };
    
    authToken = generateTestJWT(testUser);
    adminToken = generateTestJWT(adminUser);
    userId = testUser.id;
  });

  beforeEach(async () => {
    // Disconnect all connections before each test
    await webSocketManager.disconnectAll();
    
    // Clear cache
    if (cacheService.flush) {
      await cacheService.flush();
    }
  });

  afterAll(async () => {
    // Cleanup
    await webSocketManager.disconnectAll();
  });

  describe('POST /api/v1/exchanges/websocket/connect', () => {
    it('should connect to Binance WebSocket successfully', async () => {
      const response = await request(app)
        .post('/api/v1/exchanges/websocket/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'binance',
          symbols: ['BTCUSDT', 'ETHUSDT']
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('connected', true);
      expect(response.body.data).toHaveProperty('exchange', 'binance');
      expect(response.body.data).toHaveProperty('symbols');
      expect(response.body.data.symbols).toEqual(['BTCUSDT', 'ETHUSDT']);
      expect(response.body.data).toHaveProperty('timestamp');
    });

    it('should connect to Coinbase WebSocket successfully', async () => {
      const response = await request(app)
        .post('/api/v1/exchanges/websocket/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'coinbase'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.exchange).toBe('coinbase');
    });

    it('should connect to Kraken WebSocket successfully', async () => {
      const response = await request(app)
        .post('/api/v1/exchanges/websocket/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'kraken',
          symbols: ['XXBTZUSD']
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.exchange).toBe('kraken');
    });

    it('should connect to KuCoin WebSocket successfully', async () => {
      const response = await request(app)
        .post('/api/v1/exchanges/websocket/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'kucoin',
          symbols: ['BTC-USDT']
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.exchange).toBe('kucoin');
    });

    it('should reject invalid exchange', async () => {
      const response = await request(app)
        .post('/api/v1/exchanges/websocket/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'invalid-exchange'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Exchange must be one of');
    });

    it('should reject missing exchange parameter', async () => {
      const response = await request(app)
        .post('/api/v1/exchanges/websocket/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/exchanges/websocket/connect')
        .send({ exchange: 'binance' })
        .expect(401);
    });

    it('should handle duplicate connections gracefully', async () => {
      // First connection
      await request(app)
        .post('/api/v1/exchanges/websocket/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ exchange: 'binance' })
        .expect(200);

      // Second connection to same exchange
      const response = await request(app)
        .post('/api/v1/exchanges/websocket/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ exchange: 'binance' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/exchanges/websocket/disconnect', () => {
    beforeEach(async () => {
      // Ensure we have a connection to disconnect
      await webSocketManager.connect('binance');
    });

    it('should disconnect from WebSocket successfully', async () => {
      const response = await request(app)
        .post('/api/v1/exchanges/websocket/disconnect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ exchange: 'binance' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('disconnected', true);
      expect(response.body.data).toHaveProperty('exchange', 'binance');
    });

    it('should return 404 for non-existent connection', async () => {
      // First disconnect
      await webSocketManager.disconnect('binance');
      
      const response = await request(app)
        .post('/api/v1/exchanges/websocket/disconnect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ exchange: 'binance' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Connection not found');
    });

    it('should reject invalid exchange', async () => {
      await request(app)
        .post('/api/v1/exchanges/websocket/disconnect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ exchange: 'invalid' })
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/exchanges/websocket/disconnect')
        .send({ exchange: 'binance' })
        .expect(401);
    });
  });

  describe('POST /api/v1/exchanges/websocket/subscribe', () => {
    beforeEach(async () => {
      // Ensure connection exists
      await webSocketManager.connect('binance');
    });

    it('should create subscription successfully', async () => {
      const response = await request(app)
        .post('/api/v1/exchanges/websocket/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'binance',
          symbols: ['BTCUSDT', 'ETHUSDT'],
          types: ['ticker', 'trade']
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('subscriptionId');
      expect(response.body.data).toHaveProperty('exchange', 'binance');
      expect(response.body.data).toHaveProperty('symbols');
      expect(response.body.data.symbols).toEqual(['BTCUSDT', 'ETHUSDT']);
      expect(response.body.data).toHaveProperty('types');
      expect(response.body.data.types).toEqual(['ticker', 'trade']);
    });

    it('should use default types when not specified', async () => {
      const response = await request(app)
        .post('/api/v1/exchanges/websocket/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'binance',
          symbols: ['BTCUSDT']
        })
        .expect(201);

      expect(response.body.data.types).toEqual(['ticker']);
    });

    it('should reject empty symbols array', async () => {
      await request(app)
        .post('/api/v1/exchanges/websocket/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'binance',
          symbols: []
        })
        .expect(400);
    });

    it('should reject invalid stream types', async () => {
      await request(app)
        .post('/api/v1/exchanges/websocket/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'binance',
          symbols: ['BTCUSDT'],
          types: ['invalid-type']
        })
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/exchanges/websocket/subscribe')
        .send({
          exchange: 'binance',
          symbols: ['BTCUSDT']
        })
        .expect(401);
    });
  });

  describe('DELETE /api/v1/exchanges/websocket/subscribe/:subscriptionId', () => {
    let subscriptionId: string;

    beforeEach(async () => {
      await webSocketManager.connect('binance');
      subscriptionId = await webSocketManager.subscribe({
        exchange: 'binance',
        symbols: ['BTCUSDT'],
        types: ['ticker'],
        userId
      });
    });

    it('should unsubscribe successfully', async () => {
      const response = await request(app)
        .delete(`/api/v1/exchanges/websocket/subscribe/${subscriptionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('unsubscribed', true);
      expect(response.body.data).toHaveProperty('subscriptionId', subscriptionId);
    });

    it('should return 404 for non-existent subscription', async () => {
      const fakeId = 'fake-subscription-id-123';
      const response = await request(app)
        .delete(`/api/v1/exchanges/websocket/subscribe/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Subscription not found');
    });

    it('should reject invalid subscription ID format', async () => {
      await request(app)
        .delete('/api/v1/exchanges/websocket/subscribe/abc')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .delete(`/api/v1/exchanges/websocket/subscribe/${subscriptionId}`)
        .expect(401);
    });
  });

  describe('GET /api/v1/exchanges/websocket/status', () => {
    beforeEach(async () => {
      await webSocketManager.connect('binance');
      await webSocketManager.subscribe({
        exchange: 'binance',
        symbols: ['BTCUSDT'],
        types: ['ticker'],
        userId
      });
    });

    it('should return WebSocket status successfully', async () => {
      const response = await request(app)
        .get('/api/v1/exchanges/websocket/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('connections');
      expect(response.body.data).toHaveProperty('activeSubscriptions');
      expect(response.body.data).toHaveProperty('subscriptions');
      expect(response.body.data).toHaveProperty('timestamp');
      
      expect(typeof response.body.data.connections).toBe('object');
      expect(typeof response.body.data.activeSubscriptions).toBe('number');
      expect(Array.isArray(response.body.data.subscriptions)).toBe(true);
    });

    it('should show connection status for connected exchanges', async () => {
      const response = await request(app)
        .get('/api/v1/exchanges/websocket/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.connections).toHaveProperty('binance');
      expect(response.body.data.connections.binance).toHaveProperty('isConnected');
      expect(response.body.data.connections.binance).toHaveProperty('lastPing');
      expect(response.body.data.connections.binance).toHaveProperty('reconnectAttempts');
      expect(response.body.data.connections.binance).toHaveProperty('subscriptionCount');
    });

    it('should filter subscriptions by user', async () => {
      const response = await request(app)
        .get('/api/v1/exchanges/websocket/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.activeSubscriptions).toBeGreaterThanOrEqual(1);
      expect(response.body.data.subscriptions.length).toBeGreaterThanOrEqual(1);
      
      // Check that returned subscriptions belong to the user
      response.body.data.subscriptions.forEach((sub: any) => {
        expect(sub).toHaveProperty('id');
        expect(sub).toHaveProperty('exchange');
        expect(sub).toHaveProperty('symbols');
        expect(sub).toHaveProperty('types');
        expect(sub).toHaveProperty('createdAt');
      });
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/exchanges/websocket/status')
        .expect(401);
    });
  });

  describe('GET /api/v1/exchanges/websocket/data/:exchange/:symbol', () => {
    beforeEach(async () => {
      // Mock cached data
      const mockData = {
        symbol: 'BTCUSDT',
        price: 50000,
        volume: 1000,
        timestamp: new Date(),
        exchange: 'binance',
        type: 'ticker'
      };
      
      jest.spyOn(webSocketManager, 'getCachedData').mockResolvedValue(mockData);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return cached stream data successfully', async () => {
      const response = await request(app)
        .get('/api/v1/exchanges/websocket/data/binance/BTCUSDT')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('symbol', 'BTCUSDT');
      expect(response.body.data).toHaveProperty('price', 50000);
      expect(response.body.data).toHaveProperty('exchange', 'binance');
      expect(response.body.data).toHaveProperty('type', 'ticker');
    });

    it('should accept type query parameter', async () => {
      const response = await request(app)
        .get('/api/v1/exchanges/websocket/data/binance/BTCUSDT?type=trade')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(webSocketManager.getCachedData).toHaveBeenCalledWith('binance', 'BTCUSDT', 'trade');
    });

    it('should return 404 when data not found', async () => {
      jest.spyOn(webSocketManager, 'getCachedData').mockResolvedValue(null);
      
      const response = await request(app)
        .get('/api/v1/exchanges/websocket/data/binance/NONEXISTENT')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Data not found');
    });

    it('should reject invalid exchange', async () => {
      await request(app)
        .get('/api/v1/exchanges/websocket/data/invalid/BTCUSDT')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should reject invalid type parameter', async () => {
      await request(app)
        .get('/api/v1/exchanges/websocket/data/binance/BTCUSDT?type=invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/exchanges/websocket/data/binance/BTCUSDT')
        .expect(401);
    });
  });

  describe('POST /api/v1/exchanges/websocket/disconnect-all', () => {
    beforeEach(async () => {
      await webSocketManager.connect('binance');
      await webSocketManager.connect('coinbase');
    });

    it('should disconnect all WebSockets for admin', async () => {
      const response = await request(app)
        .post('/api/v1/exchanges/websocket/disconnect-all')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('timestamp');
    });

    it('should reject non-admin users', async () => {
      const response = await request(app)
        .post('/api/v1/exchanges/websocket/disconnect-all')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Forbidden');
      expect(response.body.message).toContain('Admin role required');
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/exchanges/websocket/disconnect-all')
        .expect(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on connect endpoint', async () => {
      const promises = Array(15).fill(null).map(() =>
        request(app)
          .post('/api/v1/exchanges/websocket/connect')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ exchange: 'binance' })
      );

      const results = await Promise.allSettled(promises);
      const responses = results.map((result: any) => result.value);
      
      // Some requests should be rate limited (429)
      const rateLimitedResponses = responses.filter((res: any) => res?.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle WebSocket manager errors gracefully', async () => {
      jest.spyOn(webSocketManager, 'connect').mockRejectedValue(new Error('WebSocket connection failed'));

      const response = await request(app)
        .post('/api/v1/exchanges/websocket/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ exchange: 'binance' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Internal server error');
    });

    it('should handle subscription errors gracefully', async () => {
      jest.spyOn(webSocketManager, 'subscribe').mockRejectedValue(new Error('Subscription failed'));

      const response = await request(app)
        .post('/api/v1/exchanges/websocket/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'binance',
          symbols: ['BTCUSDT']
        })
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Audit Logging', () => {
    it('should log WebSocket connect actions', async () => {
      jest.spyOn(auditService, 'log').mockResolvedValue();

      await request(app)
        .post('/api/v1/exchanges/websocket/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ exchange: 'binance' })
        .expect(200);

      expect(auditService.log).toHaveBeenCalledWith({
        userId,
        action: 'websocket_connect',
        resource: 'websocket',
        details: { exchange: 'binance', symbols: [] }
      });
    });

    it('should log WebSocket subscription actions', async () => {
      jest.spyOn(auditService, 'log').mockResolvedValue();
      await webSocketManager.connect('binance');

      await request(app)
        .post('/api/v1/exchanges/websocket/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'binance',
          symbols: ['BTCUSDT'],
          types: ['ticker']
        })
        .expect(201);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          action: 'websocket_subscribe',
          resource: 'websocket_subscription'
        })
      );
    });
  });

  describe('Integration with WebSocket Manager', () => {
    it('should properly integrate with WebSocket manager service', async () => {
      // Test that API endpoints properly call WebSocket manager methods
      const connectSpy = jest.spyOn(webSocketManager, 'connect').mockResolvedValue(true);
      
      await request(app)
        .post('/api/v1/exchanges/websocket/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ exchange: 'binance', symbols: ['BTCUSDT'] })
        .expect(200);

      expect(connectSpy).toHaveBeenCalledWith('binance', ['BTCUSDT']);
      
      connectSpy.mockRestore();
    });

    it('should handle WebSocket manager state correctly', async () => {
      // Connect to exchange
      await webSocketManager.connect('binance');
      
      const status = await request(app)
        .get('/api/v1/exchanges/websocket/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(status.body.data.connections.binance.isConnected).toBe(true);

      // Disconnect
      await request(app)
        .post('/api/v1/exchanges/websocket/disconnect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ exchange: 'binance' })
        .expect(200);

      const statusAfterDisconnect = await request(app)
        .get('/api/v1/exchanges/websocket/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(statusAfterDisconnect.body.data.connections.binance).toBeUndefined();
    });
  });
});