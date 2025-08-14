import request from 'supertest';
import { app } from '../../app';
import { multiExchangeSyncService } from '../../services/exchanges/multiExchangeSyncService';
import { exchangeService } from '../../services/exchanges/exchangeService';
import { cacheService } from '../../services/cacheService';
import { auditService } from '../../services/auditService';
import { generateTestJWT } from '../helpers/testHelpers';
import { jest } from '@jest/globals';

describe('Multi-Exchange Sync API Tests', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    const testUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'user'
    };
    authToken = generateTestJWT(testUser);
    userId = testUser.id;
  });

  beforeEach(async () => {
    // Reset service state
    await multiExchangeSyncService.stopSynchronization();
    
    // Clear any cached data
    if (cacheService.flush) {
      await cacheService.flush();
    }
  });

  afterAll(async () => {
    // Cleanup
    await multiExchangeSyncService.stopSynchronization();
  });

  describe('POST /api/v1/exchanges/sync/start', () => {
    it('should start synchronization with default interval', async () => {
      const response = await request(app)
        .post('/api/v1/exchanges/sync/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('status', 'started');
      expect(response.body.data).toHaveProperty('interval', 30000);
      expect(response.body.data).toHaveProperty('exchanges');
      expect(Array.isArray(response.body.data.exchanges)).toBe(true);
      expect(response.body.data.exchanges).toContain('binance');
      expect(response.body.data.exchanges).toContain('coinbase');
      expect(response.body.data.exchanges).toContain('kraken');
      expect(response.body.data.exchanges).toContain('kucoin');
    });

    it('should start synchronization with custom interval', async () => {
      const customInterval = 60000;
      
      const response = await request(app)
        .post('/api/v1/exchanges/sync/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ interval: customInterval })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.interval).toBe(customInterval);
    });

    it('should reject invalid interval values', async () => {
      // Too small interval
      await request(app)
        .post('/api/v1/exchanges/sync/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ interval: 1000 })
        .expect(400);

      // Too large interval
      await request(app)
        .post('/api/v1/exchanges/sync/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ interval: 400000 })
        .expect(400);
    });

    it('should reject request if already running', async () => {
      // Start synchronization first
      await multiExchangeSyncService.startSynchronization();

      const response = await request(app)
        .post('/api/v1/exchanges/sync/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Synchronization already running');
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/exchanges/sync/start')
        .send({})
        .expect(401);
    });
  });

  describe('POST /api/v1/exchanges/sync/stop', () => {
    it('should stop running synchronization', async () => {
      // Start synchronization first
      await multiExchangeSyncService.startSynchronization();
      expect(multiExchangeSyncService.isRunning()).toBe(true);

      const response = await request(app)
        .post('/api/v1/exchanges/sync/stop')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('status', 'stopped');
      expect(multiExchangeSyncService.isRunning()).toBe(false);
    });

    it('should reject request if not running', async () => {
      const response = await request(app)
        .post('/api/v1/exchanges/sync/stop')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Synchronization not running');
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/exchanges/sync/stop')
        .expect(401);
    });
  });

  describe('GET /api/v1/exchanges/sync/status', () => {
    it('should return synchronization status when stopped', async () => {
      const response = await request(app)
        .get('/api/v1/exchanges/sync/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('isRunning', false);
      expect(response.body.data).toHaveProperty('supportedExchanges');
      expect(response.body.data).toHaveProperty('exchangeStatuses');
      expect(Array.isArray(response.body.data.supportedExchanges)).toBe(true);
      expect(Array.isArray(response.body.data.exchangeStatuses)).toBe(true);
    });

    it('should return synchronization status when running', async () => {
      await multiExchangeSyncService.startSynchronization();

      const response = await request(app)
        .get('/api/v1/exchanges/sync/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.isRunning).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/exchanges/sync/status')
        .expect(401);
    });
  });

  describe('POST /api/v1/exchanges/sync/full', () => {
    it('should perform full synchronization', async () => {
      const response = await request(app)
        .post('/api/v1/exchanges/sync/full')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('status', 'completed');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(new Date(response.body.data.timestamp)).toBeInstanceOf(Date);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/exchanges/sync/full')
        .expect(401);
    });
  });

  describe('GET /api/v1/exchanges/sync/market/:symbol', () => {
    it('should get unified market data for valid symbol', async () => {
      // Mock market data
      const mockMarketData = {
        symbol: 'BTC/USDT',
        baseSymbol: 'BTC',
        prices: {
          binance: { symbol: 'BTCUSDT', price: 50000, timestamp: new Date(), exchange: 'binance' },
          coinbase: { symbol: 'BTC-USD', price: 50100, timestamp: new Date(), exchange: 'coinbase' }
        },
        bestBid: { exchange: 'binance', price: 50000 },
        bestAsk: { exchange: 'coinbase', price: 50100 },
        spread: 100,
        lastUpdated: new Date()
      };

      jest.spyOn(multiExchangeSyncService, 'getUnifiedMarketData').mockResolvedValue(mockMarketData);

      const response = await request(app)
        .get('/api/v1/exchanges/sync/market/BTC%2FUSDT')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('symbol', 'BTC/USDT');
      expect(response.body.data).toHaveProperty('baseSymbol', 'BTC');
      expect(response.body.data).toHaveProperty('prices');
      expect(response.body.data).toHaveProperty('bestBid');
      expect(response.body.data).toHaveProperty('bestAsk');
    });

    it('should return 404 for symbol with no data', async () => {
      jest.spyOn(multiExchangeSyncService, 'getUnifiedMarketData').mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/exchanges/sync/market/INVALID%2FPAIR')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Market data not found');
    });

    it('should validate symbol format', async () => {
      await request(app)
        .get('/api/v1/exchanges/sync/market/invalid-symbol')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/exchanges/sync/market/BTC%2FUSDT')
        .expect(401);
    });
  });

  describe('GET /api/v1/exchanges/sync/arbitrage', () => {
    it('should get arbitrage opportunities with default parameters', async () => {
      const mockOpportunities = [
        {
          symbol: 'BTC/USDT',
          baseSymbol: 'BTC',
          buyExchange: 'binance',
          sellExchange: 'coinbase',
          buyPrice: 50000,
          sellPrice: 50500,
          spread: 500,
          spreadPercentage: 1.0,
          timestamp: new Date(),
          confidence: 85
        }
      ];

      jest.spyOn(multiExchangeSyncService, 'detectArbitrageOpportunities').mockResolvedValue(mockOpportunities);

      const response = await request(app)
        .get('/api/v1/exchanges/sync/arbitrage')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('opportunities');
      expect(response.body.data).toHaveProperty('count', 1);
      expect(response.body.data).toHaveProperty('minSpreadPercentage', 0.5);
      expect(Array.isArray(response.body.data.opportunities)).toBe(true);
    });

    it('should accept custom minSpread parameter', async () => {
      jest.spyOn(multiExchangeSyncService, 'detectArbitrageOpportunities').mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/exchanges/sync/arbitrage?minSpread=1.5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.minSpreadPercentage).toBe(1.5);
      expect(multiExchangeSyncService.detectArbitrageOpportunities).toHaveBeenCalledWith(1.5);
    });

    it('should validate minSpread parameter', async () => {
      await request(app)
        .get('/api/v1/exchanges/sync/arbitrage?minSpread=-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      await request(app)
        .get('/api/v1/exchanges/sync/arbitrage?minSpread=15')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/exchanges/sync/arbitrage')
        .expect(401);
    });
  });

  describe('GET /api/v1/exchanges/sync/arbitrage/cached', () => {
    it('should get cached arbitrage opportunities', async () => {
      const mockCachedOpportunities = [
        {
          symbol: 'ETH/USDT',
          baseSymbol: 'ETH',
          buyExchange: 'kraken',
          sellExchange: 'kucoin',
          buyPrice: 3000,
          sellPrice: 3030,
          spread: 30,
          spreadPercentage: 1.0,
          timestamp: new Date(),
          confidence: 90
        }
      ];

      jest.spyOn(multiExchangeSyncService, 'getArbitrageOpportunities').mockResolvedValue(mockCachedOpportunities);

      const response = await request(app)
        .get('/api/v1/exchanges/sync/arbitrage/cached')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('opportunities');
      expect(response.body.data).toHaveProperty('count', 1);
      expect(response.body.data).toHaveProperty('cached', true);
    });

    it('should return empty array if no cached opportunities', async () => {
      jest.spyOn(multiExchangeSyncService, 'getArbitrageOpportunities').mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/exchanges/sync/arbitrage/cached')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.count).toBe(0);
      expect(response.body.data.opportunities).toEqual([]);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/exchanges/sync/arbitrage/cached')
        .expect(401);
    });
  });

  describe('GET /api/v1/exchanges/sync/portfolio', () => {
    it('should get aggregated portfolio', async () => {
      const mockPortfolio = [
        {
          userId,
          asset: 'BTC',
          totalBalance: 1.5,
          exchanges: {
            binance: { available: 0.8, locked: 0.2, total: 1.0 },
            coinbase: { available: 0.5, locked: 0, total: 0.5 }
          },
          lastUpdated: new Date()
        },
        {
          userId,
          asset: 'ETH',
          totalBalance: 10.0,
          exchanges: {
            kraken: { available: 5.0, locked: 0, total: 5.0 },
            kucoin: { available: 5.0, locked: 0, total: 5.0 }
          },
          lastUpdated: new Date()
        }
      ];

      jest.spyOn(multiExchangeSyncService, 'aggregateUserPortfolio').mockResolvedValue(mockPortfolio);

      const response = await request(app)
        .get('/api/v1/exchanges/sync/portfolio')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('portfolio');
      expect(response.body.data).toHaveProperty('totalAssets', 2);
      expect(response.body.data).toHaveProperty('lastUpdated');
      expect(Array.isArray(response.body.data.portfolio)).toBe(true);
      expect(response.body.data.portfolio).toHaveLength(2);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/exchanges/sync/portfolio')
        .expect(401);
    });
  });

  describe('POST /api/v1/exchanges/sync/reconcile', () => {
    it('should reconcile balances successfully', async () => {
      const mockReconciliation = {
        discrepancies: [
          {
            asset: 'BTC',
            expectedTotal: 1.0,
            actualTotal: 0.999,
            difference: 0.001,
            exchanges: ['binance', 'coinbase']
          }
        ],
        lastReconciliation: new Date()
      };

      jest.spyOn(multiExchangeSyncService, 'reconcileBalances').mockResolvedValue(mockReconciliation);
      jest.spyOn(auditService, 'log').mockResolvedValue();

      const response = await request(app)
        .post('/api/v1/exchanges/sync/reconcile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('discrepancies');
      expect(response.body.data).toHaveProperty('lastReconciliation');
      expect(Array.isArray(response.body.data.discrepancies)).toBe(true);
      expect(response.body.data.discrepancies).toHaveLength(1);
      expect(response.body.message).toContain('1 discrepancies');

      // Verify audit log was called
      expect(auditService.log).toHaveBeenCalledWith({
        userId,
        action: 'reconcile_balances',
        resource: 'user_portfolio',
        details: {
          discrepanciesFound: 1,
          reconciliationTime: expect.any(Date)
        }
      });
    });

    it('should handle reconciliation with no discrepancies', async () => {
      const mockReconciliation = {
        discrepancies: [],
        lastReconciliation: new Date()
      };

      jest.spyOn(multiExchangeSyncService, 'reconcileBalances').mockResolvedValue(mockReconciliation);
      jest.spyOn(auditService, 'log').mockResolvedValue();

      const response = await request(app)
        .post('/api/v1/exchanges/sync/reconcile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.discrepancies).toHaveLength(0);
      expect(response.body.message).toContain('0 discrepancies');
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/exchanges/sync/reconcile')
        .expect(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on sync start endpoint', async () => {
      // This test would need to make multiple rapid requests
      // Implementation depends on your rate limiting setup
      const promises = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/v1/exchanges/sync/start')
          .set('Authorization', `Bearer ${authToken}`)
          .send({})
      );

      const results = await Promise.allSettled(promises);
      const responses = results.map((result: any) => result.value);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter((res: any) => res?.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      jest.spyOn(multiExchangeSyncService, 'performFullSync').mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .post('/api/v1/exchanges/sync/full')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Internal server error');
    });

    it('should handle missing parameters', async () => {
      const response = await request(app)
        .get('/api/v1/exchanges/sync/market/')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404); // Route not found
    });
  });

  describe('Integration with Other Services', () => {
    it('should verify exchange service integration', async () => {
      const exchanges = exchangeService.getSupportedExchanges();
      expect(exchanges).toContain('binance');
      expect(exchanges).toContain('coinbase');
      expect(exchanges).toContain('kraken');
      expect(exchanges).toContain('kucoin');

      const syncExchanges = multiExchangeSyncService.getSupportedExchanges();
      expect(syncExchanges).toEqual(exchanges);
    });

    it('should handle cache service failures', async () => {
      // Mock cache service failure
      const originalGet = cacheService.get;
      cacheService.get = jest.fn().mockRejectedValue(new Error('Cache error'));

      const response = await request(app)
        .get('/api/v1/exchanges/sync/arbitrage/cached')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.opportunities).toEqual([]);

      // Restore cache service
      cacheService.get = originalGet;
    });
  });
});