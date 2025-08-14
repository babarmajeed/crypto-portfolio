import request from 'supertest';
import { app } from '../../index';
import { portfolioSyncService } from '../../services/exchanges/portfolioSyncService';
import { exchangeService } from '../../services/exchanges/exchangeService';
import { auditService } from '../../services/auditService';
import { generateTestJWT } from '../helpers/testHelpers';
import { jest } from '@jest/globals';

describe('Portfolio Sync API Tests', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/exchanges/portfolio/sync', () => {
    const mockSyncRequest = {
      exchange: 'binance',
      syncType: 'full',
      forceRefresh: false
    };

    const mockSyncResponse = {
      userId: 'test-user-id',
      exchange: 'binance',
      syncType: 'full',
      syncedAt: new Date(),
      balances: [
        {
          asset: 'BTC',
          free: 1.5,
          locked: 0.1,
          total: 1.6
        },
        {
          asset: 'ETH',
          free: 10.0,
          locked: 2.0,
          total: 12.0
        }
      ],
      totalValue: 85000.50
    };

    it('should sync portfolio successfully', async () => {
      jest.spyOn(portfolioSyncService, 'syncPortfolio').mockResolvedValue(mockSyncResponse as any);
      jest.spyOn(auditService, 'log').mockResolvedValue();

      const response = await request(app)
        .post('/api/v1/exchanges/portfolio/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mockSyncRequest)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('sync');
      expect(response.body.data.sync).toHaveProperty('exchange', 'binance');
      expect(response.body.data.sync).toHaveProperty('syncType', 'full');
      expect(response.body.data.sync.balances).toHaveLength(2);
      expect(response.body.data.sync).toHaveProperty('totalValue', 85000.50);

      expect(portfolioSyncService.syncPortfolio).toHaveBeenCalledWith({
        userId,
        exchange: 'binance',
        syncType: 'full',
        forceRefresh: false
      });

      expect(auditService.log).toHaveBeenCalledWith({
        userId,
        action: 'portfolio_sync',
        resource: 'portfolio',
        details: expect.objectContaining({
          exchange: 'binance',
          syncType: 'full',
          balancesCount: 2,
          totalValue: 85000.50
        })
      });
    });

    it('should reject invalid exchange', async () => {
      const invalidRequest = {
        ...mockSyncRequest,
        exchange: 'invalid-exchange'
      };

      await request(app)
        .post('/api/v1/exchanges/portfolio/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRequest)
        .expect(400);
    });

    it('should reject missing exchange', async () => {
      const incompleteRequest = {
        syncType: 'full',
        forceRefresh: false
      };

      await request(app)
        .post('/api/v1/exchanges/portfolio/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteRequest)
        .expect(400);
    });

    it('should handle sync already in progress error', async () => {
      jest.spyOn(portfolioSyncService, 'syncPortfolio').mockRejectedValue(
        new Error('Portfolio sync already in progress for binance')
      );

      const response = await request(app)
        .post('/api/v1/exchanges/portfolio/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mockSyncRequest)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Sync already in progress');
    });

    it('should handle invalid credentials error', async () => {
      jest.spyOn(portfolioSyncService, 'syncPortfolio').mockRejectedValue(
        new Error('Invalid credentials for exchange binance')
      );

      const response = await request(app)
        .post('/api/v1/exchanges/portfolio/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mockSyncRequest)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid exchange credentials');
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/exchanges/portfolio/sync')
        .send(mockSyncRequest)
        .expect(401);
    });

    it('should enforce rate limiting', async () => {
      jest.spyOn(portfolioSyncService, 'syncPortfolio').mockResolvedValue(mockSyncResponse as any);
      jest.spyOn(auditService, 'log').mockResolvedValue();

      // Make multiple requests quickly to trigger rate limit
      const requests = Array(7).fill(null).map(() =>
        request(app)
          .post('/api/v1/exchanges/portfolio/sync')
          .set('Authorization', `Bearer ${authToken}`)
          .send(mockSyncRequest)
      );

      const results = await Promise.allSettled(requests);
      const responses = results.map((result: any) => result.value);
      
      // Some requests should be rate limited (429)
      const rateLimitedResponses = responses.filter((res: any) => res?.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe('POST /api/v1/exchanges/portfolio/sync/:exchange/balances', () => {
    const mockBalancesResponse = {
      userId: 'test-user-id',
      exchange: 'binance',
      syncType: 'balances',
      syncedAt: new Date(),
      balances: [
        { asset: 'BTC', free: 1.5, locked: 0.1, total: 1.6 },
        { asset: 'ETH', free: 10.0, locked: 2.0, total: 12.0 }
      ],
      totalValue: 85000.50
    };

    it('should sync balances successfully', async () => {
      jest.spyOn(portfolioSyncService, 'syncPortfolio').mockResolvedValue(mockBalancesResponse as any);

      const response = await request(app)
        .post('/api/v1/exchanges/portfolio/sync/binance/balances')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('exchange', 'binance');
      expect(response.body.data).toHaveProperty('balances');
      expect(response.body.data.balances).toHaveLength(2);
      expect(response.body.data).toHaveProperty('totalValue', 85000.50);

      expect(portfolioSyncService.syncPortfolio).toHaveBeenCalledWith({
        userId,
        exchange: 'binance',
        syncType: 'balances',
        forceRefresh: false
      });
    });

    it('should support force refresh', async () => {
      jest.spyOn(portfolioSyncService, 'syncPortfolio').mockResolvedValue(mockBalancesResponse as any);

      const response = await request(app)
        .post('/api/v1/exchanges/portfolio/sync/binance/balances?force=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(portfolioSyncService.syncPortfolio).toHaveBeenCalledWith({
        userId,
        exchange: 'binance',
        syncType: 'balances',
        forceRefresh: true
      });
    });

    it('should reject invalid exchange', async () => {
      await request(app)
        .post('/api/v1/exchanges/portfolio/sync/invalid/balances')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/exchanges/portfolio/sync/binance/balances')
        .expect(401);
    });
  });

  describe('POST /api/v1/exchanges/portfolio/sync/:exchange/transactions', () => {
    const mockTransactionsResponse = {
      userId: 'test-user-id',
      exchange: 'binance',
      syncType: 'transactions',
      syncedAt: new Date(),
      balances: [
        { asset: 'BTC', free: 1.5, locked: 0.1, total: 1.6 }
      ],
      totalValue: 50000,
      lastTransactionId: '12345'
    };

    it('should sync transactions successfully', async () => {
      jest.spyOn(portfolioSyncService, 'syncPortfolio').mockResolvedValue(mockTransactionsResponse as any);

      const response = await request(app)
        .post('/api/v1/exchanges/portfolio/sync/binance/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('exchange', 'binance');
      expect(response.body.data).toHaveProperty('lastTransactionId', '12345');

      expect(portfolioSyncService.syncPortfolio).toHaveBeenCalledWith({
        userId,
        exchange: 'binance',
        syncType: 'transactions',
        forceRefresh: false
      });
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/exchanges/portfolio/sync/binance/transactions')
        .expect(401);
    });
  });

  describe('POST /api/v1/exchanges/portfolio/sync/:exchange/orders', () => {
    const mockOrdersResponse = {
      userId: 'test-user-id',
      exchange: 'binance',
      syncType: 'orders',
      syncedAt: new Date(),
      balances: [
        { asset: 'BTC', free: 1.5, locked: 0.1, total: 1.6 }
      ],
      totalValue: 50000
    };

    it('should sync orders successfully', async () => {
      jest.spyOn(portfolioSyncService, 'syncPortfolio').mockResolvedValue(mockOrdersResponse as any);

      const response = await request(app)
        .post('/api/v1/exchanges/portfolio/sync/binance/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('exchange', 'binance');

      expect(portfolioSyncService.syncPortfolio).toHaveBeenCalledWith({
        userId,
        exchange: 'binance',
        syncType: 'orders',
        forceRefresh: false
      });
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/exchanges/portfolio/sync/binance/orders')
        .expect(401);
    });
  });

  describe('POST /api/v1/exchanges/portfolio/sync/:exchange/force-full', () => {
    const mockFullSyncResponse = {
      userId: 'test-user-id',
      exchange: 'binance',
      syncType: 'full',
      syncedAt: new Date(),
      balances: [
        { asset: 'BTC', free: 1.5, locked: 0.1, total: 1.6 },
        { asset: 'ETH', free: 10.0, locked: 2.0, total: 12.0 }
      ],
      totalValue: 85000.50
    };

    it('should force full sync successfully', async () => {
      jest.spyOn(portfolioSyncService, 'syncPortfolio').mockResolvedValue(mockFullSyncResponse as any);
      jest.spyOn(auditService, 'log').mockResolvedValue();

      const response = await request(app)
        .post('/api/v1/exchanges/portfolio/sync/binance/force-full')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('sync');
      expect(response.body.data.sync).toHaveProperty('syncType', 'full');

      expect(portfolioSyncService.syncPortfolio).toHaveBeenCalledWith({
        userId,
        exchange: 'binance',
        syncType: 'full',
        forceRefresh: true
      });

      expect(auditService.log).toHaveBeenCalledWith({
        userId,
        action: 'portfolio_force_sync',
        resource: 'portfolio',
        details: expect.objectContaining({
          exchange: 'binance',
          balancesCount: 2,
          totalValue: 85000.50
        })
      });
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/exchanges/portfolio/sync/binance/force-full')
        .expect(401);
    });
  });

  describe('POST /api/v1/exchanges/portfolio/sync-all', () => {
    it('should sync all exchanges successfully', async () => {
      const mockResults = [
        { exchange: 'binance', success: true, data: { balances: [], totalValue: 50000 } },
        { exchange: 'coinbase', success: true, data: { balances: [], totalValue: 30000 } },
        { exchange: 'kraken', success: false, error: 'Invalid credentials' },
        { exchange: 'kucoin', success: true, data: { balances: [], totalValue: 20000 } }
      ];

      jest.spyOn(portfolioSyncService, 'getSupportedExchanges').mockReturnValue(['binance', 'coinbase', 'kraken', 'kucoin']);
      jest.spyOn(portfolioSyncService, 'syncPortfolio')
        .mockImplementation(async (request) => {
          if (request.exchange === 'kraken') {
            throw new Error('Invalid credentials');
          }
          return { totalValue: 50000, balances: [] } as any;
        });
      jest.spyOn(auditService, 'log').mockResolvedValue();

      const response = await request(app)
        .post('/api/v1/exchanges/portfolio/sync-all')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ syncType: 'balances', forceRefresh: false })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('results');
      expect(response.body.data.results).toHaveLength(4);
      expect(response.body.data.summary).toHaveProperty('successful', 3);
      expect(response.body.data.summary).toHaveProperty('failed', 1);

      expect(auditService.log).toHaveBeenCalledWith({
        userId,
        action: 'portfolio_sync_all',
        resource: 'portfolio',
        details: expect.objectContaining({
          syncType: 'balances',
          successCount: 3,
          failureCount: 1
        })
      });
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/exchanges/portfolio/sync-all')
        .expect(401);
    });
  });

  describe('GET /api/v1/exchanges/portfolio/sync/:exchange/status', () => {
    const mockSyncStatus = {
      userId: 'test-user-id',
      exchange: 'binance',
      status: 'syncing',
      progress: 50,
      startTime: new Date(),
      endTime: undefined,
      error: undefined
    };

    it('should get sync status successfully', async () => {
      jest.spyOn(portfolioSyncService, 'getSyncStatus').mockReturnValue(mockSyncStatus as any);

      const response = await request(app)
        .get('/api/v1/exchanges/portfolio/sync/binance/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data.status).toHaveProperty('status', 'syncing');
      expect(response.body.data.status).toHaveProperty('progress', 50);

      expect(portfolioSyncService.getSyncStatus).toHaveBeenCalledWith(userId, 'binance');
    });

    it('should return 404 for non-existent sync status', async () => {
      jest.spyOn(portfolioSyncService, 'getSyncStatus').mockReturnValue(null);

      const response = await request(app)
        .get('/api/v1/exchanges/portfolio/sync/binance/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No sync status found');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/exchanges/portfolio/sync/binance/status')
        .expect(401);
    });
  });

  describe('GET /api/v1/exchanges/portfolio/sync/status/all', () => {
    const mockStatuses = [
      { userId: 'test-user-id', exchange: 'binance', status: 'completed', progress: 100 },
      { userId: 'test-user-id', exchange: 'coinbase', status: 'syncing', progress: 75 }
    ];

    it('should get all sync statuses successfully', async () => {
      jest.spyOn(portfolioSyncService, 'getAllSyncStatuses').mockReturnValue(mockStatuses as any);

      const response = await request(app)
        .get('/api/v1/exchanges/portfolio/sync/status/all')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('statuses');
      expect(response.body.data.statuses).toHaveLength(2);
      expect(response.body.data).toHaveProperty('count', 2);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/exchanges/portfolio/sync/status/all')
        .expect(401);
    });
  });

  describe('DELETE /api/v1/exchanges/portfolio/sync/:exchange', () => {
    it('should cancel sync successfully', async () => {
      jest.spyOn(portfolioSyncService, 'cancelSync').mockResolvedValue(true);
      jest.spyOn(auditService, 'log').mockResolvedValue();

      const response = await request(app)
        .delete('/api/v1/exchanges/portfolio/sync/binance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('cancelled', true);
      expect(response.body.data).toHaveProperty('exchange', 'binance');

      expect(portfolioSyncService.cancelSync).toHaveBeenCalledWith(userId, 'binance');
      expect(auditService.log).toHaveBeenCalledWith({
        userId,
        action: 'portfolio_sync_cancelled',
        resource: 'portfolio',
        details: { exchange: 'binance' }
      });
    });

    it('should handle no active sync to cancel', async () => {
      jest.spyOn(portfolioSyncService, 'cancelSync').mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/v1/exchanges/portfolio/sync/binance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No active sync to cancel');
    });

    it('should require authentication', async () => {
      await request(app)
        .delete('/api/v1/exchanges/portfolio/sync/binance')
        .expect(401);
    });
  });

  describe('GET /api/v1/exchanges/portfolio/exchanges/supported', () => {
    it('should get supported exchanges', async () => {
      jest.spyOn(portfolioSyncService, 'getSupportedExchanges').mockReturnValue(['binance', 'coinbase', 'kraken', 'kucoin']);

      const response = await request(app)
        .get('/api/v1/exchanges/portfolio/exchanges/supported')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('exchanges');
      expect(response.body.data.exchanges).toEqual(['binance', 'coinbase', 'kraken', 'kucoin']);
      expect(response.body.data).toHaveProperty('count', 4);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/exchanges/portfolio/exchanges/supported')
        .expect(401);
    });
  });

  describe('GET /api/v1/exchanges/portfolio/summary', () => {
    it('should get portfolio summary successfully', async () => {
      const response = await request(app)
        .get('/api/v1/exchanges/portfolio/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('userId', userId);
      expect(response.body.data).toHaveProperty('totalValue');
      expect(response.body.data).toHaveProperty('exchanges');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/exchanges/portfolio/summary')
        .expect(401);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      jest.spyOn(portfolioSyncService, 'syncPortfolio').mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app)
        .post('/api/v1/exchanges/portfolio/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'binance',
          syncType: 'balances',
          forceRefresh: false
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Portfolio sync failed');
      expect(response.body.message).toBe('Internal server error');
    });
  });
});