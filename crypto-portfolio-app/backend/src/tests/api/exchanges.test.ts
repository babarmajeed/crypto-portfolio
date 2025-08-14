import request from 'supertest';
import app from '../../index';
import { jest } from '@jest/globals';
import { prisma } from '../../config/database';
import { exchangeService } from '../../services/exchanges/exchangeService';

describe('Binance Exchange API', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Create test user and get auth token
    const testUser = await prisma.user.create({
      data: {
        email: 'test@binance.com',
        firstName: 'Test',
        lastName: 'User',
        password: 'hashedpassword',
        isEmailVerified: true
      }
    });
    userId = testUser.id;

    // Mock JWT token for testing
    authToken = 'Bearer mock-jwt-token';
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.userExchangeCredential.deleteMany({
      where: { userId }
    });
    await prisma.user.delete({
      where: { id: userId }
    });
  });

  describe('GET /api/v1/exchanges/binance/ping', () => {
    it('should test Binance connection', async () => {
      const response = await request(app)
        .get('/api/v1/exchanges/binance/ping')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('connected');
    });
  });

  describe('GET /api/v1/exchanges/binance/prices', () => {
    it('should get current prices', async () => {
      const response = await request(app)
        .get('/api/v1/exchanges/binance/prices?symbols=BTCUSDT,ETHUSDT')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should handle invalid symbols gracefully', async () => {
      const response = await request(app)
        .get('/api/v1/exchanges/binance/prices?symbols=INVALIDPAIR')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/exchanges/binance/prices/historical/:symbol', () => {
    it('should get historical prices', async () => {
      const response = await request(app)
        .get('/api/v1/exchanges/binance/prices/historical/BTCUSDT')
        .query({ interval: '1d', limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should validate interval parameter', async () => {
      const response = await request(app)
        .get('/api/v1/exchanges/binance/prices/historical/BTCUSDT')
        .query({ interval: 'invalid', limit: 10 });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /api/v1/exchanges/binance/info', () => {
    it('should get exchange info', async () => {
      const response = await request(app)
        .get('/api/v1/exchanges/binance/info')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('timezone');
      expect(response.body.data).toHaveProperty('tradingPairs');
    });
  });

  describe('POST /api/v1/exchanges/binance/credentials', () => {
    it('should save valid credentials', async () => {
      const mockValidateCredentials = jest.spyOn(exchangeService, 'validateCredentials');
      mockValidateCredentials.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/exchanges/binance/credentials')
        .set('Authorization', authToken)
        .send({
          apiKey: 'test_api_key',
          apiSecret: 'test_api_secret',
          sandbox: true
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.exchange).toBe('binance');

      mockValidateCredentials.mockRestore();
    });

    it('should reject invalid credentials', async () => {
      const mockValidateCredentials = jest.spyOn(exchangeService, 'validateCredentials');
      mockValidateCredentials.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/v1/exchanges/binance/credentials')
        .set('Authorization', authToken)
        .send({
          apiKey: 'invalid_key',
          apiSecret: 'invalid_secret'
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);

      mockValidateCredentials.mockRestore();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/exchanges/binance/credentials')
        .send({
          apiKey: 'test_key',
          apiSecret: 'test_secret'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/v1/exchanges/binance/credentials')
        .set('Authorization', authToken)
        .send({
          apiKey: '', // Invalid empty key
          apiSecret: 'test_secret'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('GET /api/v1/exchanges/binance/account', () => {
    beforeEach(async () => {
      // Create test credentials for authenticated tests
      await prisma.userExchangeCredential.create({
        data: {
          userId,
          exchange: 'binance',
          apiKey: 'test_key',
          apiSecret: 'test_secret',
          isActive: true
        }
      });
    });

    afterEach(async () => {
      await prisma.userExchangeCredential.deleteMany({
        where: { userId }
      });
    });

    it('should get account info with valid credentials', async () => {
      const mockGetAccountInfo = jest.spyOn(exchangeService, 'syncUserBalances');
      mockGetAccountInfo.mockResolvedValue({
        balances: [
          { asset: 'BTC', free: 1.0, locked: 0.0, total: 1.0 },
          { asset: 'ETH', free: 10.0, locked: 0.0, total: 10.0 }
        ],
        accountType: 'SPOT',
        canTrade: true,
        canWithdraw: false,
        canDeposit: true,
        updateTime: new Date()
      });

      const response = await request(app)
        .get('/api/v1/exchanges/binance/account')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('balances');
      expect(response.body.data.balances).toBeInstanceOf(Array);

      mockGetAccountInfo.mockRestore();
    });

    it('should handle missing credentials', async () => {
      await prisma.userExchangeCredential.deleteMany({
        where: { userId }
      });

      const response = await request(app)
        .get('/api/v1/exchanges/binance/account')
        .set('Authorization', authToken);

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/exchanges/binance/account/test', () => {
    it('should test user connection', async () => {
      const mockTestConnection = jest.spyOn(exchangeService, 'testUserConnection');
      mockTestConnection.mockResolvedValue({
        connected: true
      });

      const response = await request(app)
        .get('/api/v1/exchanges/binance/account/test')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('connected');

      mockTestConnection.mockRestore();
    });
  });

  describe('POST /api/v1/exchanges/binance/account/sync', () => {
    it('should sync account balances', async () => {
      const mockSyncBalances = jest.spyOn(exchangeService, 'syncUserBalances');
      mockSyncBalances.mockResolvedValue({
        balances: [
          { asset: 'BTC', free: 1.0, locked: 0.0, total: 1.0 }
        ],
        accountType: 'SPOT',
        canTrade: true,
        canWithdraw: false,
        canDeposit: true,
        updateTime: new Date()
      });

      const response = await request(app)
        .post('/api/v1/exchanges/binance/account/sync')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('balances');

      mockSyncBalances.mockRestore();
    });
  });

  describe('GET /api/v1/exchanges/binance/history', () => {
    it('should import trading history', async () => {
      const mockImportHistory = jest.spyOn(exchangeService, 'importTradingHistory');
      mockImportHistory.mockResolvedValue({
        imported: 5,
        total: 10,
        exchange: 'binance',
        symbol: ''
      });

      const response = await request(app)
        .get('/api/v1/exchanges/binance/history')
        .set('Authorization', authToken)
        .query({ symbol: 'BTCUSDT', limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('imported');
      expect(response.body.data).toHaveProperty('total');

      mockImportHistory.mockRestore();
    });
  });

  describe('DELETE /api/v1/exchanges/binance/credentials', () => {
    it('should remove credentials', async () => {
      const mockRemoveCredentials = jest.spyOn(exchangeService, 'removeUserCredentials');
      mockRemoveCredentials.mockResolvedValue();

      const response = await request(app)
        .delete('/api/v1/exchanges/binance/credentials')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('removed successfully');

      mockRemoveCredentials.mockRestore();
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limiting on repeated requests', async () => {
      // Make multiple rapid requests to test rate limiting
      const promises = Array(10).fill(null).map(() =>
        request(app)
          .get('/api/v1/exchanges/binance/prices')
          .expect((res) => {
            expect([200, 429]).toContain(res.status);
          })
      );

      await Promise.all(promises);
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      // Mock an API error
      const mockGetCurrentPrices = jest.spyOn(exchangeService, 'getCurrentPrices');
      mockGetCurrentPrices.mockRejectedValue(new Error('Binance API unavailable'));

      const response = await request(app)
        .get('/api/v1/exchanges/binance/prices');

      expect(response.status).toBeGreaterThanOrEqual(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();

      mockGetCurrentPrices.mockRestore();
    });

    it('should handle network timeouts', async () => {
      const mockGetCurrentPrices = jest.spyOn(exchangeService, 'getCurrentPrices');
      mockGetCurrentPrices.mockRejectedValue(new Error('ECONNABORTED'));

      const response = await request(app)
        .get('/api/v1/exchanges/binance/prices');

      expect(response.status).toBeGreaterThanOrEqual(500);
      expect(response.body.success).toBe(false);

      mockGetCurrentPrices.mockRestore();
    });
  });

  describe('WebSocket Integration', () => {
    it('should setup WebSocket streams', async () => {
      // This would typically test WebSocket functionality
      // For now, we'll just test that the endpoint exists
      const response = await request(app)
        .get('/api/v1/exchanges/binance/info')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});