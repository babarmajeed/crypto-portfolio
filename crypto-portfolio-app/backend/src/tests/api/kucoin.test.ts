import request from 'supertest';
import { app } from '../../app';
import { jest } from '@jest/globals';
import { KuCoinClient } from '../../services/exchanges/kucoinClient';
import { exchangeService } from '../../services/exchanges/exchangeService';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';

// Mock external dependencies
jest.mock('../../services/exchanges/kucoinClient');
jest.mock('../../services/loggingService');
jest.mock('../../services/rateLimitService');

const MockKuCoinClient = KuCoinClient as jest.MockedClass<typeof KuCoinClient>;

describe('KuCoin API Routes', () => {
  let authToken: string;
  let mockUser: any;

  beforeAll(async () => {
    // Create a test user
    mockUser = await prisma.user.create({
      data: {
        email: 'kucoin-test@example.com',
        passwordHash: 'hashed_password'
      }
    });

    // Generate auth token
    authToken = jwt.sign(
      { userId: mockUser.id, email: mockUser.email },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.userExchangeCredential.deleteMany({
      where: { userId: mockUser.id }
    });
    await prisma.user.delete({
      where: { id: mockUser.id }
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/exchanges/kucoin/test', () => {
    it('should test KuCoin connection successfully', async () => {
      const mockConnectionTest = {
        connected: true,
        serverTime: new Date(),
        latency: 200
      };

      const mockClient = {
        testConnection: jest.fn().mockResolvedValue(mockConnectionTest)
      };

      MockKuCoinClient.createPublic = jest.fn().mockReturnValue(mockClient);

      const response = await request(app)
        .get('/api/v1/exchanges/kucoin/test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.connected).toBe(true);
      expect(response.body.data.latency).toBe(200);
      expect(response.body.message).toBe('KuCoin connection test completed');
    });

    it('should handle connection test failure', async () => {
      const mockClient = {
        testConnection: jest.fn().mockRejectedValue(new Error('Connection failed'))
      };

      MockKuCoinClient.createPublic = jest.fn().mockReturnValue(mockClient);

      const response = await request(app)
        .get('/api/v1/exchanges/kucoin/test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to test KuCoin connection');
    });
  });

  describe('GET /api/v1/exchanges/kucoin/prices', () => {
    it('should fetch current prices successfully', async () => {
      const mockPrices = {
        'BTC-USDT': {
          symbol: 'BTC-USDT',
          price: 65000,
          timestamp: new Date(),
          exchange: 'kucoin'
        },
        'ETH-USDT': {
          symbol: 'ETH-USDT',
          price: 3500,
          timestamp: new Date(),
          exchange: 'kucoin'
        }
      };

      const mockClient = {
        getCurrentPrices: jest.fn().mockResolvedValue(mockPrices)
      };

      MockKuCoinClient.createPublic = jest.fn().mockReturnValue(mockClient);

      const response = await request(app)
        .get('/api/v1/exchanges/kucoin/prices?symbols=BTC-USDT,ETH-USDT')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPrices);
      expect(response.body.message).toBe('Current prices fetched successfully');
      expect(mockClient.getCurrentPrices).toHaveBeenCalledWith(['BTC-USDT', 'ETH-USDT']);
    });

    it('should fetch all prices when no symbols provided', async () => {
      const mockPrices = {
        'BTC-USDT': {
          symbol: 'BTC-USDT',
          price: 65000,
          timestamp: new Date(),
          exchange: 'kucoin'
        }
      };

      const mockClient = {
        getCurrentPrices: jest.fn().mockResolvedValue(mockPrices)
      };

      MockKuCoinClient.createPublic = jest.fn().mockReturnValue(mockClient);

      const response = await request(app)
        .get('/api/v1/exchanges/kucoin/prices')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockClient.getCurrentPrices).toHaveBeenCalledWith(undefined);
    });
  });

  describe('GET /api/v1/exchanges/kucoin/historical', () => {
    it('should fetch historical prices successfully', async () => {
      const mockHistoricalData = [
        {
          timestamp: new Date('2024-01-01'),
          open: 64000,
          high: 66000,
          low: 63000,
          close: 65000,
          volume: 100.5
        },
        {
          timestamp: new Date('2024-01-02'),
          open: 65000,
          high: 67000,
          low: 64000,
          close: 66000,
          volume: 120.3
        }
      ];

      const mockClient = {
        getHistoricalPrices: jest.fn().mockResolvedValue(mockHistoricalData)
      };

      MockKuCoinClient.createPublic = jest.fn().mockReturnValue(mockClient);

      const response = await request(app)
        .get('/api/v1/exchanges/kucoin/historical?symbol=BTC-USDT&interval=3600&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockHistoricalData);
      expect(response.body.metadata.symbol).toBe('BTC-USDT');
      expect(response.body.metadata.count).toBe(2);
      expect(mockClient.getHistoricalPrices).toHaveBeenCalledWith('BTC-USDT', '3600', 10);
    });

    it('should return 400 when symbol is missing', async () => {
      const response = await request(app)
        .get('/api/v1/exchanges/kucoin/historical')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Symbol parameter is required');
    });

    it('should use default values for interval and limit', async () => {
      const mockClient = {
        getHistoricalPrices: jest.fn().mockResolvedValue([])
      };

      MockKuCoinClient.createPublic = jest.fn().mockReturnValue(mockClient);

      await request(app)
        .get('/api/v1/exchanges/kucoin/historical?symbol=BTC-USDT')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(mockClient.getHistoricalPrices).toHaveBeenCalledWith('BTC-USDT', '3600', 100);
    });
  });

  describe('GET /api/v1/exchanges/kucoin/info', () => {
    it('should fetch exchange info successfully', async () => {
      const mockExchangeInfo = {
        timezone: 'UTC',
        serverTime: new Date(),
        tradingPairs: [
          {
            symbol: 'BTC-USDT',
            baseAsset: 'BTC',
            quoteAsset: 'USDT',
            status: 'TRADING',
            minOrderSize: 0.0001,
            tickSize: 0.1
          }
        ],
        totalPairs: 1
      };

      const mockClient = {
        getExchangeInfo: jest.fn().mockResolvedValue(mockExchangeInfo)
      };

      MockKuCoinClient.createPublic = jest.fn().mockReturnValue(mockClient);

      const response = await request(app)
        .get('/api/v1/exchanges/kucoin/info')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockExchangeInfo);
      expect(response.body.message).toBe('Exchange info fetched successfully');
    });
  });

  describe('POST /api/v1/exchanges/kucoin/credentials', () => {
    it('should save credentials successfully', async () => {
      const mockCredentials = {
        id: 'test-id',
        userId: mockUser.id,
        exchange: 'kucoin',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        passphrase: 'test-passphrase',
        sandbox: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(exchangeService, 'validateCredentials').mockResolvedValue(true);
      jest.spyOn(exchangeService, 'saveCredentials').mockResolvedValue(mockCredentials);

      const response = await request(app)
        .post('/api/v1/exchanges/kucoin/credentials')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          apiKey: 'test-key',
          apiSecret: 'test-secret',
          passphrase: 'test-passphrase'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('KuCoin credentials saved successfully');
      expect(exchangeService.validateCredentials).toHaveBeenCalledWith(
        mockUser.id,
        'kucoin',
        'test-key',
        'test-secret',
        'test-passphrase'
      );
    });

    it('should return 400 for invalid credentials', async () => {
      jest.spyOn(exchangeService, 'validateCredentials').mockResolvedValue(false);

      const response = await request(app)
        .post('/api/v1/exchanges/kucoin/credentials')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          apiKey: 'invalid-key',
          apiSecret: 'invalid-secret',
          passphrase: 'invalid-passphrase'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid KuCoin credentials');
    });

    it('should return 400 for missing fields', async () => {
      const response = await request(app)
        .post('/api/v1/exchanges/kucoin/credentials')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          apiKey: 'test-key',
          apiSecret: 'test-secret'
          // Missing passphrase
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('GET /api/v1/exchanges/kucoin/credentials', () => {
    it('should return credential status successfully', async () => {
      jest.spyOn(exchangeService, 'hasValidCredentials').mockResolvedValue(true);

      const response = await request(app)
        .get('/api/v1/exchanges/kucoin/credentials')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hasCredentials).toBe(true);
      expect(response.body.data.exchange).toBe('kucoin');
      expect(response.body.data.status).toBe('active');
    });

    it('should return inactive status when no credentials', async () => {
      jest.spyOn(exchangeService, 'hasValidCredentials').mockResolvedValue(false);

      const response = await request(app)
        .get('/api/v1/exchanges/kucoin/credentials')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hasCredentials).toBe(false);
      expect(response.body.data.status).toBe('inactive');
    });
  });

  describe('DELETE /api/v1/exchanges/kucoin/credentials', () => {
    it('should delete credentials successfully', async () => {
      jest.spyOn(exchangeService, 'deleteCredentials').mockResolvedValue();

      const response = await request(app)
        .delete('/api/v1/exchanges/kucoin/credentials')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('KuCoin credentials deleted successfully');
      expect(exchangeService.deleteCredentials).toHaveBeenCalledWith(mockUser.id, 'kucoin');
    });
  });

  describe('GET /api/v1/exchanges/kucoin/account', () => {
    it('should fetch account info with valid credentials', async () => {
      const mockAccountInfo = {
        balances: [
          {
            currency: 'BTC',
            balance: 1.5,
            available: 1.5,
            holds: 0
          },
          {
            currency: 'USDT',
            balance: 10000,
            available: 9500,
            holds: 500
          }
        ],
        accountType: 'spot',
        canTrade: true,
        canWithdraw: true,
        canDeposit: true,
        updateTime: new Date()
      };

      const mockClient = {
        getAccountInfo: jest.fn().mockResolvedValue(mockAccountInfo)
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);

      const response = await request(app)
        .get('/api/v1/exchanges/kucoin/account')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAccountInfo);
      expect(response.body.message).toBe('Account info fetched successfully');
    });

    it('should return 400 when no credentials found', async () => {
      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/exchanges/kucoin/account')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('KuCoin credentials not found or invalid');
    });
  });

  describe('GET /api/v1/exchanges/kucoin/trades', () => {
    it('should fetch trade history successfully', async () => {
      const mockTrades = [
        {
          id: 'trade-1',
          symbol: 'BTC-USDT',
          side: 'buy' as const,
          quantity: 0.1,
          price: 65000,
          commission: 10,
          commissionAsset: 'USDT',
          time: new Date(),
          isMaker: false
        },
        {
          id: 'trade-2',
          symbol: 'BTC-USDT',
          side: 'sell' as const,
          quantity: 0.05,
          price: 66000,
          commission: 5,
          commissionAsset: 'USDT',
          time: new Date(),
          isMaker: true
        }
      ];

      const mockClient = {
        getTradeHistory: jest.fn().mockResolvedValue(mockTrades)
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);

      const response = await request(app)
        .get('/api/v1/exchanges/kucoin/trades?symbol=BTC-USDT&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockTrades);
      expect(response.body.metadata.count).toBe(2);
      expect(response.body.metadata.symbol).toBe('BTC-USDT');
      expect(mockClient.getTradeHistory).toHaveBeenCalledWith('BTC-USDT', 10);
    });

    it('should use default limit when not provided', async () => {
      const mockClient = {
        getTradeHistory: jest.fn().mockResolvedValue([])
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);

      await request(app)
        .get('/api/v1/exchanges/kucoin/trades')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(mockClient.getTradeHistory).toHaveBeenCalledWith(undefined, 50);
    });
  });

  describe('POST /api/v1/exchanges/kucoin/websocket', () => {
    it('should setup WebSocket connection successfully', async () => {
      jest.spyOn(exchangeService, 'setupRealTimeUpdates').mockImplementation(() => {});

      const response = await request(app)
        .post('/api/v1/exchanges/kucoin/websocket')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          symbols: ['BTC-USDT', 'ETH-USDT']
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('WebSocket connection established for KuCoin');
      expect(response.body.data.symbols).toEqual(['BTC-USDT', 'ETH-USDT']);
      expect(response.body.data.status).toBe('connected');
    });

    it('should return 400 for invalid symbols array', async () => {
      const response = await request(app)
        .post('/api/v1/exchanges/kucoin/websocket')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          symbols: 'not-an-array'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for empty symbols array', async () => {
      const response = await request(app)
        .post('/api/v1/exchanges/kucoin/websocket')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          symbols: []
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('GET /api/v1/exchanges/kucoin/websocket/token', () => {
    it('should get WebSocket token successfully with authenticated client', async () => {
      const mockClient = {
        getWebSocketToken: jest.fn().mockResolvedValue('test-token-123')
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);

      const response = await request(app)
        .get('/api/v1/exchanges/kucoin/websocket/token')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBe('test-token-123');
      expect(response.body.message).toBe('WebSocket token retrieved successfully');
    });

    it('should get WebSocket token successfully with public client fallback', async () => {
      const mockPublicClient = {
        getWebSocketToken: jest.fn().mockResolvedValue('public-token-456')
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockRejectedValue(new Error('No credentials'));
      MockKuCoinClient.createPublic = jest.fn().mockReturnValue(mockPublicClient);

      const response = await request(app)
        .get('/api/v1/exchanges/kucoin/websocket/token')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBe('public-token-456');
      expect(response.body.message).toBe('WebSocket token retrieved successfully');
    });
  });

  describe('Authentication', () => {
    it('should return 401 for requests without auth token', async () => {
      const response = await request(app)
        .get('/api/v1/exchanges/kucoin/test')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 for requests with invalid auth token', async () => {
      const response = await request(app)
        .get('/api/v1/exchanges/kucoin/test')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});