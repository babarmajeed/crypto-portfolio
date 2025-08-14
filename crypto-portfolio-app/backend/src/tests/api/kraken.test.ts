import request from 'supertest';
import { app } from '../../app';
import { jest } from '@jest/globals';
import { KrakenClient } from '../../services/exchanges/krakenClient';
import { exchangeService } from '../../services/exchanges/exchangeService';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';

// Mock external dependencies
jest.mock('../../services/exchanges/krakenClient');
jest.mock('../../services/loggingService');
jest.mock('../../services/rateLimitService');

const MockKrakenClient = KrakenClient as jest.MockedClass<typeof KrakenClient>;

describe('Kraken API Routes', () => {
  let authToken: string;
  let mockUser: any;

  beforeAll(async () => {
    // Create a test user
    mockUser = await prisma.user.create({
      data: {
        email: 'kraken-test@example.com',
        username: 'krakenuser',
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

  describe('GET /api/v1/exchanges/kraken/test', () => {
    it('should test Kraken connection successfully', async () => {
      const mockConnectionTest = {
        connected: true,
        serverTime: new Date(),
        latency: 150
      };

      const mockClient = {
        testConnection: jest.fn().mockResolvedValue(mockConnectionTest)
      };

      MockKrakenClient.createPublic = jest.fn().mockReturnValue(mockClient);

      const response = await request(app)
        .get('/api/v1/exchanges/kraken/test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.connected).toBe(true);
      expect(response.body.data.latency).toBe(150);
      expect(response.body.message).toBe('Kraken connection test completed');
    });

    it('should handle connection test failure', async () => {
      const mockClient = {
        testConnection: jest.fn().mockRejectedValue(new Error('Connection failed'))
      };

      MockKrakenClient.createPublic = jest.fn().mockReturnValue(mockClient);

      const response = await request(app)
        .get('/api/v1/exchanges/kraken/test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to test Kraken connection');
    });
  });

  describe('GET /api/v1/exchanges/kraken/prices', () => {
    it('should fetch current prices successfully', async () => {
      const mockPrices = {
        'XXBTZUSD': {
          symbol: 'XXBTZUSD',
          price: 65000,
          timestamp: new Date(),
          exchange: 'kraken'
        },
        'XETHZUSD': {
          symbol: 'XETHZUSD',
          price: 3500,
          timestamp: new Date(),
          exchange: 'kraken'
        }
      };

      const mockClient = {
        getCurrentPrices: jest.fn().mockResolvedValue(mockPrices)
      };

      MockKrakenClient.createPublic = jest.fn().mockReturnValue(mockClient);

      const response = await request(app)
        .get('/api/v1/exchanges/kraken/prices?symbols=XXBTZUSD,XETHZUSD')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPrices);
      expect(response.body.message).toBe('Current prices fetched successfully');
      expect(mockClient.getCurrentPrices).toHaveBeenCalledWith(['XXBTZUSD', 'XETHZUSD']);
    });

    it('should fetch all prices when no symbols provided', async () => {
      const mockPrices = {
        'XXBTZUSD': {
          symbol: 'XXBTZUSD',
          price: 65000,
          timestamp: new Date(),
          exchange: 'kraken'
        }
      };

      const mockClient = {
        getCurrentPrices: jest.fn().mockResolvedValue(mockPrices)
      };

      MockKrakenClient.createPublic = jest.fn().mockReturnValue(mockClient);

      const response = await request(app)
        .get('/api/v1/exchanges/kraken/prices')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockClient.getCurrentPrices).toHaveBeenCalledWith(undefined);
    });
  });

  describe('GET /api/v1/exchanges/kraken/historical', () => {
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

      MockKrakenClient.createPublic = jest.fn().mockReturnValue(mockClient);

      const response = await request(app)
        .get('/api/v1/exchanges/kraken/historical?symbol=XXBTZUSD&interval=3600&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockHistoricalData);
      expect(response.body.metadata.symbol).toBe('XXBTZUSD');
      expect(response.body.metadata.count).toBe(2);
      expect(mockClient.getHistoricalPrices).toHaveBeenCalledWith('XXBTZUSD', '3600', 10);
    });

    it('should return 400 when symbol is missing', async () => {
      const response = await request(app)
        .get('/api/v1/exchanges/kraken/historical')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Symbol parameter is required');
    });

    it('should use default values for interval and limit', async () => {
      const mockClient = {
        getHistoricalPrices: jest.fn().mockResolvedValue([])
      };

      MockKrakenClient.createPublic = jest.fn().mockReturnValue(mockClient);

      await request(app)
        .get('/api/v1/exchanges/kraken/historical?symbol=XXBTZUSD')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(mockClient.getHistoricalPrices).toHaveBeenCalledWith('XXBTZUSD', '3600', 100);
    });
  });

  describe('GET /api/v1/exchanges/kraken/info', () => {
    it('should fetch exchange info successfully', async () => {
      const mockExchangeInfo = {
        timezone: 'UTC',
        serverTime: new Date(),
        tradingPairs: [
          {
            symbol: 'XXBTZUSD',
            baseAsset: 'XBT',
            quoteAsset: 'ZUSD',
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

      MockKrakenClient.createPublic = jest.fn().mockReturnValue(mockClient);

      const response = await request(app)
        .get('/api/v1/exchanges/kraken/info')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockExchangeInfo);
      expect(response.body.message).toBe('Exchange info fetched successfully');
    });
  });

  describe('POST /api/v1/exchanges/kraken/credentials', () => {
    it('should save credentials successfully', async () => {
      const mockCredentials = {
        id: 'test-id',
        userId: mockUser.id,
        exchange: 'kraken',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        sandbox: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(exchangeService, 'validateCredentials').mockResolvedValue(true);
      jest.spyOn(exchangeService, 'saveCredentials').mockResolvedValue(mockCredentials);

      const response = await request(app)
        .post('/api/v1/exchanges/kraken/credentials')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          apiKey: 'test-key',
          apiSecret: 'test-secret'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Kraken credentials saved successfully');
      expect(exchangeService.validateCredentials).toHaveBeenCalledWith(
        mockUser.id,
        'kraken',
        'test-key',
        'test-secret'
      );
    });

    it('should return 400 for invalid credentials', async () => {
      jest.spyOn(exchangeService, 'validateCredentials').mockResolvedValue(false);

      const response = await request(app)
        .post('/api/v1/exchanges/kraken/credentials')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          apiKey: 'invalid-key',
          apiSecret: 'invalid-secret'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid Kraken credentials');
    });

    it('should return 400 for missing fields', async () => {
      const response = await request(app)
        .post('/api/v1/exchanges/kraken/credentials')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          apiKey: 'test-key'
          // Missing apiSecret
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('GET /api/v1/exchanges/kraken/credentials', () => {
    it('should return credential status successfully', async () => {
      jest.spyOn(exchangeService, 'hasValidCredentials').mockResolvedValue(true);

      const response = await request(app)
        .get('/api/v1/exchanges/kraken/credentials')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hasCredentials).toBe(true);
      expect(response.body.data.exchange).toBe('kraken');
      expect(response.body.data.status).toBe('active');
    });

    it('should return inactive status when no credentials', async () => {
      jest.spyOn(exchangeService, 'hasValidCredentials').mockResolvedValue(false);

      const response = await request(app)
        .get('/api/v1/exchanges/kraken/credentials')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hasCredentials).toBe(false);
      expect(response.body.data.status).toBe('inactive');
    });
  });

  describe('DELETE /api/v1/exchanges/kraken/credentials', () => {
    it('should delete credentials successfully', async () => {
      jest.spyOn(exchangeService, 'deleteCredentials').mockResolvedValue();

      const response = await request(app)
        .delete('/api/v1/exchanges/kraken/credentials')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Kraken credentials deleted successfully');
      expect(exchangeService.deleteCredentials).toHaveBeenCalledWith(mockUser.id, 'kraken');
    });
  });

  describe('GET /api/v1/exchanges/kraken/account', () => {
    it('should fetch account info with valid credentials', async () => {
      const mockAccountInfo = {
        balances: [
          {
            asset: 'XXBT',
            balance: 1.5,
            available: 1.5,
            reserved: 0
          },
          {
            asset: 'ZUSD',
            balance: 10000,
            available: 9500,
            reserved: 500
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
        .get('/api/v1/exchanges/kraken/account')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAccountInfo);
      expect(response.body.message).toBe('Account info fetched successfully');
    });

    it('should return 400 when no credentials found', async () => {
      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/exchanges/kraken/account')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Kraken credentials not found or invalid');
    });
  });

  describe('GET /api/v1/exchanges/kraken/trades', () => {
    it('should fetch trade history successfully', async () => {
      const mockTrades = [
        {
          id: 'trade-1',
          symbol: 'XXBTZUSD',
          side: 'buy' as const,
          quantity: 0.1,
          price: 65000,
          commission: 10,
          commissionAsset: 'ZUSD',
          time: new Date(),
          isMaker: false
        },
        {
          id: 'trade-2',
          symbol: 'XXBTZUSD',
          side: 'sell' as const,
          quantity: 0.05,
          price: 66000,
          commission: 5,
          commissionAsset: 'ZUSD',
          time: new Date(),
          isMaker: true
        }
      ];

      const mockClient = {
        getTradeHistory: jest.fn().mockResolvedValue(mockTrades)
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);

      const response = await request(app)
        .get('/api/v1/exchanges/kraken/trades?symbol=XXBTZUSD&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockTrades);
      expect(response.body.metadata.count).toBe(2);
      expect(response.body.metadata.symbol).toBe('XXBTZUSD');
      expect(mockClient.getTradeHistory).toHaveBeenCalledWith('XXBTZUSD', 10);
    });

    it('should use default limit when not provided', async () => {
      const mockClient = {
        getTradeHistory: jest.fn().mockResolvedValue([])
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);

      await request(app)
        .get('/api/v1/exchanges/kraken/trades')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(mockClient.getTradeHistory).toHaveBeenCalledWith(undefined, 50);
    });
  });

  describe('POST /api/v1/exchanges/kraken/websocket', () => {
    it('should setup WebSocket connection successfully', async () => {
      jest.spyOn(exchangeService, 'setupRealTimeUpdates').mockImplementation(() => {});

      const response = await request(app)
        .post('/api/v1/exchanges/kraken/websocket')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          symbols: ['XXBTZUSD', 'XETHZUSD']
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('WebSocket connection established for Kraken');
      expect(response.body.data.symbols).toEqual(['XXBTZUSD', 'XETHZUSD']);
      expect(response.body.data.status).toBe('connected');
    });

    it('should return 400 for invalid symbols array', async () => {
      const response = await request(app)
        .post('/api/v1/exchanges/kraken/websocket')
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
        .post('/api/v1/exchanges/kraken/websocket')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          symbols: []
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('Authentication', () => {
    it('should return 401 for requests without auth token', async () => {
      const response = await request(app)
        .get('/api/v1/exchanges/kraken/test')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 for requests with invalid auth token', async () => {
      const response = await request(app)
        .get('/api/v1/exchanges/kraken/test')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});