import { portfolioSyncService } from '../../services/exchanges/portfolioSyncService';
import { exchangeService } from '../../services/exchanges/exchangeService';
import { cacheService } from '../../services/cacheService';
import { rateLimitService } from '../../services/rateLimitService';
import { loggingService } from '../../services/loggingService';
import { jest } from '@jest/globals';

describe('Portfolio Sync Service Integration Tests', () => {
  beforeAll(async () => {
    // Initialize services
    await cacheService.initialize?.();
  });

  afterAll(async () => {
    await cacheService.shutdown?.();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should initialize with correct supported exchanges', () => {
      expect(portfolioSyncService).toBeDefined();
      expect(typeof portfolioSyncService.syncPortfolio).toBe('function');
      expect(typeof portfolioSyncService.syncBalances).toBe('function');
      expect(typeof portfolioSyncService.getSyncStatus).toBe('function');
    });

    it('should be an EventEmitter instance', () => {
      expect(portfolioSyncService.on).toBeDefined();
      expect(portfolioSyncService.emit).toBeDefined();
      expect(portfolioSyncService.removeListener).toBeDefined();
    });

    it('should have correct supported exchanges', () => {
      const supportedExchanges = portfolioSyncService.getSupportedExchanges();
      expect(supportedExchanges).toContain('binance');
      expect(supportedExchanges).toContain('coinbase');
      expect(supportedExchanges).toContain('kraken');
      expect(supportedExchanges).toContain('kucoin');
    });
  });

  describe('Balance Sync Integration', () => {
    const syncRequest = {
      userId: 'test-user-id',
      exchange: 'binance',
      syncType: 'balances' as const,
      forceRefresh: false
    };

    it('should sync balances with proper rate limiting', async () => {
      // Mock dependencies
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue({
        accountInfo: jest.fn().mockResolvedValue({
          balances: [
            { asset: 'BTC', free: '1.50000000', locked: '0.10000000' },
            { asset: 'ETH', free: '10.00000000', locked: '2.00000000' },
            { asset: 'USDT', free: '0.00000000', locked: '0.00000000' } // Should be filtered out
          ]
        })
      });

      const result = await portfolioSyncService.syncBalances('test-user-id', 'binance');

      expect(result.balances).toHaveLength(2); // USDT filtered out due to zero balance
      expect(result.balances[0]).toEqual({
        asset: 'BTC',
        free: 1.5,
        locked: 0.1,
        total: 1.6
      });
      expect(result.balances[1]).toEqual({
        asset: 'ETH',
        free: 10.0,
        locked: 2.0,
        total: 12.0
      });

      expect(rateLimitService.waitForExchangeAvailability).toHaveBeenCalledWith('binance', 1);
    });

    it('should handle Coinbase balance format correctly', async () => {
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue({
        getAccounts: jest.fn().mockResolvedValue([
          {
            balance: { currency: 'BTC', amount: '1.50000000' }
          },
          {
            balance: { currency: 'USD', amount: '1000.00' }
          },
          {
            balance: { currency: 'ETH', amount: '0.00000000' } // Should be filtered out
          }
        ])
      });

      const result = await portfolioSyncService.syncBalances('test-user-id', 'coinbase');

      expect(result.balances).toHaveLength(2);
      expect(result.balances[0]).toEqual({
        asset: 'BTC',
        free: 1.5,
        locked: 0, // Coinbase doesn't separate locked balances in basic account info
        total: 1.5
      });
      expect(result.balances[1]).toEqual({
        asset: 'USD',
        free: 1000.0,
        locked: 0,
        total: 1000.0
      });
    });

    it('should handle Kraken balance format correctly', async () => {
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue({
        getBalance: jest.fn().mockResolvedValue({
          result: {
            XXBT: '1.5000000000', // Kraken prefixes with X/Z
            ZUSD: '1000.0000000000',
            XETH: '0.0000000000' // Should be filtered out
          }
        })
      });

      const result = await portfolioSyncService.syncBalances('test-user-id', 'kraken');

      expect(result.balances).toHaveLength(2);
      expect(result.balances[0]).toEqual({
        asset: 'XBT', // X prefix removed
        free: 1.5,
        locked: 0,
        total: 1.5
      });
      expect(result.balances[1]).toEqual({
        asset: 'USD', // Z prefix removed
        free: 1000.0,
        locked: 0,
        total: 1000.0
      });
    });

    it('should handle KuCoin balance aggregation correctly', async () => {
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue({
        getAccounts: jest.fn().mockResolvedValue({
          data: [
            {
              currency: 'BTC',
              type: 'trade',
              available: '1.0',
              holds: '0.1'
            },
            {
              currency: 'BTC',
              type: 'main',
              available: '0.5',
              holds: '0.0'
            },
            {
              currency: 'ETH',
              type: 'trade',
              available: '10.0',
              holds: '2.0'
            },
            {
              currency: 'USDT',
              type: 'trade',
              available: '0.0',
              holds: '0.0' // Should be filtered out
            }
          ]
        })
      });

      const result = await portfolioSyncService.syncBalances('test-user-id', 'kucoin');

      expect(result.balances).toHaveLength(2);
      
      // Find BTC balance (aggregated from trade and main accounts)
      const btcBalance = result.balances.find(b => b.asset === 'BTC');
      expect(btcBalance).toEqual({
        asset: 'BTC',
        free: 1.5, // 1.0 + 0.5
        locked: 0.1, // 0.1 + 0.0
        total: 1.6
      });

      const ethBalance = result.balances.find(b => b.asset === 'ETH');
      expect(ethBalance).toEqual({
        asset: 'ETH',
        free: 10.0,
        locked: 2.0,
        total: 12.0
      });
    });
  });

  describe('Transaction Sync Integration', () => {
    it('should sync Binance transactions correctly', async () => {
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue({
        getAllOrders: jest.fn().mockResolvedValue([
          {
            orderId: 12345,
            symbol: 'BTCUSDT',
            side: 'BUY',
            status: 'FILLED',
            executedQty: '0.001',
            price: '50000.00',
            commission: '0.00001',
            commissionAsset: 'BTC',
            time: 1640995200000
          },
          {
            orderId: 12346,
            symbol: 'ETHUSDT',
            side: 'SELL',
            status: 'FILLED',
            executedQty: '0.1',
            price: '4000.00',
            commission: '0.4',
            commissionAsset: 'USDT',
            time: 1640995800000
          },
          {
            orderId: 12347,
            symbol: 'ADAUSDT',
            side: 'BUY',
            status: 'NEW', // Should be filtered out (not filled)
            executedQty: '0',
            price: '1.50',
            time: 1640996400000
          }
        ])
      });

      // Mock database operations
      jest.spyOn(portfolioSyncService as any, 'getLastSyncedTransactionId').mockResolvedValue(undefined);
      jest.spyOn(portfolioSyncService as any, 'storeTransactions').mockResolvedValue(undefined);
      jest.spyOn(portfolioSyncService as any, 'calculateBalancesFromTransactions').mockResolvedValue([]);

      const result = await portfolioSyncService.syncTransactions('test-user-id', 'binance');

      expect(result.syncType).toBe('transactions');
      expect(result.lastTransactionId).toBe('12346'); // Last filled order ID
    });

    it('should sync Coinbase fills correctly', async () => {
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue({
        getFills: jest.fn().mockResolvedValue([
          {
            trade_id: 'fill-1',
            product_id: 'BTC-USD',
            side: 'buy',
            size: '0.001',
            price: '50000.00',
            fee: '0.25',
            created_at: '2022-01-01T12:00:00.000Z'
          },
          {
            trade_id: 'fill-2',
            product_id: 'ETH-USD',
            side: 'sell',
            size: '0.1',
            price: '4000.00',
            fee: '0.20',
            created_at: '2022-01-01T12:10:00.000Z'
          }
        ])
      });

      jest.spyOn(portfolioSyncService as any, 'getLastSyncedTransactionId').mockResolvedValue(undefined);
      jest.spyOn(portfolioSyncService as any, 'storeTransactions').mockResolvedValue(undefined);
      jest.spyOn(portfolioSyncService as any, 'calculateBalancesFromTransactions').mockResolvedValue([]);

      const result = await portfolioSyncService.syncTransactions('test-user-id', 'coinbase');

      expect(result.syncType).toBe('transactions');
      expect(result.lastTransactionId).toBe('fill-2');
    });

    it('should handle incremental sync with last transaction ID', async () => {
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue({
        getAllOrders: jest.fn().mockResolvedValue([
          {
            orderId: 12345,
            symbol: 'BTCUSDT',
            side: 'BUY',
            status: 'FILLED',
            executedQty: '0.001',
            price: '50000.00',
            time: 1640995200000
          },
          {
            orderId: 12347, // Higher than last synced (12346)
            symbol: 'ETHUSDT',
            side: 'SELL',
            status: 'FILLED',
            executedQty: '0.1',
            price: '4000.00',
            time: 1640996400000
          }
        ])
      });

      jest.spyOn(portfolioSyncService as any, 'getLastSyncedTransactionId').mockResolvedValue('12346');
      jest.spyOn(portfolioSyncService as any, 'storeTransactions').mockResolvedValue(undefined);
      jest.spyOn(portfolioSyncService as any, 'calculateBalancesFromTransactions').mockResolvedValue([]);

      const result = await portfolioSyncService.syncTransactions('test-user-id', 'binance');

      expect(result.lastTransactionId).toBe('12347');
      
      // Verify only new transactions after last synced ID are processed
      const storeTransactionsCall = (portfolioSyncService as any).storeTransactions.mock.calls[0];
      const storedTransactions = storeTransactionsCall[2];
      expect(storedTransactions).toHaveLength(1); // Only the new transaction
      expect(storedTransactions[0].transactionId).toBe('12347');
    });
  });

  describe('Full Sync Integration', () => {
    it('should perform full sync with all components', async () => {
      // Mock all dependencies
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      
      const mockClient = {
        // For balance sync
        accountInfo: jest.fn().mockResolvedValue({
          balances: [
            { asset: 'BTC', free: '1.50000000', locked: '0.10000000' }
          ]
        }),
        // For transaction sync
        getAllOrders: jest.fn().mockResolvedValue([
          {
            orderId: 12345,
            symbol: 'BTCUSDT',
            side: 'BUY',
            status: 'FILLED',
            executedQty: '0.001',
            price: '50000.00',
            time: 1640995200000
          }
        ]),
        // For order sync
        getOpenOrders: jest.fn().mockResolvedValue([]),
        createOrder: jest.fn()
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);
      jest.spyOn(portfolioSyncService as any, 'getLastSyncedTransactionId').mockResolvedValue(undefined);
      jest.spyOn(portfolioSyncService as any, 'storeTransactions').mockResolvedValue(undefined);
      jest.spyOn(portfolioSyncService as any, 'storeOrders').mockResolvedValue(undefined);
      jest.spyOn(portfolioSyncService as any, 'calculateBalancesFromTransactions').mockResolvedValue([]);

      const syncRequest = {
        userId: 'test-user-id',
        exchange: 'binance',
        syncType: 'full' as const,
        forceRefresh: true
      };

      const result = await portfolioSyncService.syncPortfolio(syncRequest);

      expect(result.syncType).toBe('full');
      expect(result.balances).toHaveLength(1);
      expect(result.balances[0].asset).toBe('BTC');
      
      // Verify all sync methods were called
      expect(mockClient.accountInfo).toHaveBeenCalled(); // Balance sync
      expect(mockClient.getAllOrders).toHaveBeenCalled(); // Transaction sync
      expect(mockClient.getOpenOrders).toHaveBeenCalled(); // Order sync
    });

    it('should emit events during sync process', (done) => {
      let eventsReceived: string[] = [];

      const onSyncStarted = (data: any) => {
        eventsReceived.push('sync-started');
        expect(data).toHaveProperty('userId', 'test-user-id');
        expect(data).toHaveProperty('exchange', 'binance');
      };

      const onSyncProgress = (data: any) => {
        eventsReceived.push('sync-progress');
        expect(data).toHaveProperty('progress');
        expect(data.progress).toBeGreaterThan(0);
      };

      const onSyncCompleted = (data: any) => {
        eventsReceived.push('sync-completed');
        expect(data).toHaveProperty('syncType', 'balances');
        
        // Clean up listeners
        portfolioSyncService.off('sync-started', onSyncStarted);
        portfolioSyncService.off('sync-progress', onSyncProgress);
        portfolioSyncService.off('sync-completed', onSyncCompleted);
        
        expect(eventsReceived).toContain('sync-started');
        expect(eventsReceived).toContain('sync-completed');
        done();
      };

      portfolioSyncService.on('sync-started', onSyncStarted);
      portfolioSyncService.on('sync-progress', onSyncProgress);
      portfolioSyncService.on('sync-completed', onSyncCompleted);

      // Mock dependencies
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue({
        accountInfo: jest.fn().mockResolvedValue({
          balances: [{ asset: 'BTC', free: '1.0', locked: '0.0' }]
        })
      });

      portfolioSyncService.syncBalances('test-user-id', 'binance');

      setTimeout(() => {
        if (!eventsReceived.includes('sync-completed')) {
          portfolioSyncService.off('sync-started', onSyncStarted);
          portfolioSyncService.off('sync-progress', onSyncProgress);
          portfolioSyncService.off('sync-completed', onSyncCompleted);
          done();
        }
      }, 5000);
    }, 8000);
  });

  describe('Sync Status Management', () => {
    it('should track sync status correctly', async () => {
      const userId = 'test-user-id';
      const exchange = 'binance';

      // Initially no status
      expect(portfolioSyncService.getSyncStatus(userId, exchange)).toBeNull();

      // Mock long-running sync
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );
      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue({
        accountInfo: jest.fn().mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve({ balances: [] }), 100))
        )
      });

      // Start sync
      const syncPromise = portfolioSyncService.syncBalances(userId, exchange);

      // Check status during sync
      setTimeout(() => {
        const status = portfolioSyncService.getSyncStatus(userId, exchange);
        expect(status).toBeTruthy();
        expect(status!.status).toBe('syncing');
        expect(status!.userId).toBe(userId);
        expect(status!.exchange).toBe(exchange);
      }, 50);

      await syncPromise;

      // Status should be completed after sync
      const finalStatus = portfolioSyncService.getSyncStatus(userId, exchange);
      expect(finalStatus!.status).toBe('completed');
      expect(finalStatus!.progress).toBe(100);
      expect(finalStatus!.endTime).toBeTruthy();
    });

    it('should prevent concurrent syncs for same exchange', async () => {
      const syncRequest = {
        userId: 'test-user-id',
        exchange: 'binance',
        syncType: 'balances' as const
      };

      // Mock slow sync
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue({
        accountInfo: jest.fn().mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve({ balances: [] }), 200))
        )
      });

      // Start first sync
      const firstSync = portfolioSyncService.syncPortfolio(syncRequest);

      // Attempt second sync - should fail
      await expect(portfolioSyncService.syncPortfolio(syncRequest))
        .rejects.toThrow('Portfolio sync already in progress for binance');

      await firstSync;
    });

    it('should support sync cancellation', async () => {
      const userId = 'test-user-id';
      const exchange = 'binance';

      // Mock slow sync
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue({
        accountInfo: jest.fn().mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve({ balances: [] }), 1000))
        )
      });

      // Start sync
      const syncPromise = portfolioSyncService.syncBalances(userId, exchange);

      // Cancel sync after a short delay
      setTimeout(() => {
        const cancelled = portfolioSyncService.cancelSync(userId, exchange);
        expect(cancelled).toBe(true);
      }, 50);

      // Wait for sync to complete or be cancelled
      await syncPromise;

      const status = portfolioSyncService.getSyncStatus(userId, exchange);
      expect(status!.status).toBe('failed');
      expect(status!.error).toBe('Cancelled by user');
    });
  });

  describe('Caching Integration', () => {
    it('should use cached data when available and not force refresh', async () => {
      const userId = 'test-user-id';
      const exchange = 'binance';
      
      const cachedData = {
        userId,
        exchange,
        syncType: 'balances',
        syncedAt: new Date(),
        balances: [{ asset: 'BTC', free: 1.0, locked: 0.0, total: 1.0 }],
        totalValue: 50000
      };

      jest.spyOn(cacheService, 'get').mockResolvedValue(JSON.stringify(cachedData));

      const result = await portfolioSyncService.syncPortfolio({
        userId,
        exchange,
        syncType: 'balances',
        forceRefresh: false
      });

      expect(result).toEqual(cachedData);
      
      // Verify exchange API was not called
      expect(exchangeService.getAuthenticatedClient).not.toHaveBeenCalled();
    });

    it('should bypass cache when force refresh is true', async () => {
      const userId = 'test-user-id';
      const exchange = 'binance';

      jest.spyOn(cacheService, 'get').mockResolvedValue('cached-data');
      jest.spyOn(cacheService, 'set').mockResolvedValue(undefined);
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue({
        accountInfo: jest.fn().mockResolvedValue({
          balances: [{ asset: 'BTC', free: '1.0', locked: '0.0' }]
        })
      });

      const result = await portfolioSyncService.syncPortfolio({
        userId,
        exchange,
        syncType: 'balances',
        forceRefresh: true
      });

      expect(result.balances).toHaveLength(1);
      expect(exchangeService.getAuthenticatedClient).toHaveBeenCalled();
      expect(cacheService.set).toHaveBeenCalled();
    });

    it('should cache sync results', async () => {
      const userId = 'test-user-id';
      const exchange = 'binance';

      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      const cacheSetSpy = jest.spyOn(cacheService, 'set').mockResolvedValue(undefined);
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue({
        accountInfo: jest.fn().mockResolvedValue({
          balances: [{ asset: 'BTC', free: '1.0', locked: '0.0' }]
        })
      });

      await portfolioSyncService.syncBalances(userId, exchange);

      expect(cacheSetSpy).toHaveBeenCalledWith(
        `portfolio:${userId}:${exchange}`,
        expect.any(String),
        300 // 5 minutes TTL
      );
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle exchange API errors gracefully', async () => {
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue({
        accountInfo: jest.fn().mockRejectedValue(new Error('API Error: Invalid signature'))
      });

      await expect(portfolioSyncService.syncBalances('test-user-id', 'binance'))
        .rejects.toThrow('API Error: Invalid signature');

      // Verify sync status reflects the error
      const status = portfolioSyncService.getSyncStatus('test-user-id', 'binance');
      expect(status!.status).toBe('failed');
      expect(status!.error).toBe('API Error: Invalid signature');
    });

    it('should handle network timeouts', async () => {
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue({
        accountInfo: jest.fn().mockImplementation(
          () => new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Network timeout')), 100)
          )
        )
      });

      await expect(portfolioSyncService.syncBalances('test-user-id', 'binance'))
        .rejects.toThrow('Network timeout');
    });

    it('should handle unsupported exchange error', async () => {
      await expect(portfolioSyncService.syncBalances('test-user-id', 'unsupported-exchange'))
        .rejects.toThrow('Unsupported exchange: unsupported-exchange');
    });
  });

  describe('Performance and Resource Management', () => {
    it('should respect rate limits', async () => {
      const rateLimitSpy = jest.spyOn(rateLimitService, 'waitForExchangeAvailability')
        .mockResolvedValue(undefined);
      
      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue({
        accountInfo: jest.fn().mockResolvedValue({ balances: [] })
      });

      await portfolioSyncService.syncBalances('test-user-id', 'binance');

      expect(rateLimitSpy).toHaveBeenCalledWith('binance', 1);
    });

    it('should clean up completed sync statuses', async () => {
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue({
        accountInfo: jest.fn().mockResolvedValue({ balances: [] })
      });

      const userId = 'test-user-id';
      const exchange = 'binance';

      await portfolioSyncService.syncBalances(userId, exchange);

      // Status should be available immediately after sync
      expect(portfolioSyncService.getSyncStatus(userId, exchange)).toBeTruthy();

      // Simulate the cleanup timeout (normally 5 minutes)
      jest.advanceTimersByTime(300000);

      // Status should be cleaned up
      expect(portfolioSyncService.getSyncStatus(userId, exchange)).toBeNull();
    });

    it('should handle multiple concurrent syncs for different exchanges', async () => {
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      jest.spyOn(exchangeService, 'getAuthenticatedClient')
        .mockImplementation((userId, exchange) => Promise.resolve({
          accountInfo: jest.fn().mockResolvedValue({ balances: [] }),
          getAccounts: jest.fn().mockResolvedValue([]),
          getBalance: jest.fn().mockResolvedValue({ result: {} })
        }));

      const userId = 'test-user-id';
      
      const syncPromises = [
        portfolioSyncService.syncBalances(userId, 'binance'),
        portfolioSyncService.syncBalances(userId, 'coinbase'),
        portfolioSyncService.syncBalances(userId, 'kraken')
      ];

      const results = await Promise.allSettled(syncPromises);
      
      // All syncs should complete successfully
      expect(results.every(result => result.status === 'fulfilled')).toBe(true);
      
      // Each should have called the exchange service
      expect(exchangeService.getAuthenticatedClient).toHaveBeenCalledTimes(3);
    });
  });
});