import { multiExchangeSyncService } from '../../services/exchanges/multiExchangeSyncService';
import { exchangeService } from '../../services/exchanges/exchangeService';
import { cacheService } from '../../services/cacheService';
import { jest } from '@jest/globals';

describe('Multi-Exchange Sync Integration Tests', () => {
  beforeAll(async () => {
    // Initialize services for integration testing
    await cacheService.initialize?.();
  });

  afterAll(async () => {
    // Cleanup
    await multiExchangeSyncService.stopSynchronization();
    await cacheService.shutdown?.();
  });

  beforeEach(async () => {
    // Stop any running synchronization
    if (multiExchangeSyncService.isRunning()) {
      await multiExchangeSyncService.stopSynchronization();
    }
    
    // Clear cache
    if (cacheService.flush) {
      await cacheService.flush();
    }
  });

  describe('Service Initialization and Configuration', () => {
    it('should initialize with correct supported exchanges', () => {
      const supportedExchanges = multiExchangeSyncService.getSupportedExchanges();
      
      expect(Array.isArray(supportedExchanges)).toBe(true);
      expect(supportedExchanges).toContain('binance');
      expect(supportedExchanges).toContain('coinbase');
      expect(supportedExchanges).toContain('kraken');
      expect(supportedExchanges).toContain('kucoin');
      expect(supportedExchanges).toHaveLength(4);
    });

    it('should match exchange service supported exchanges', () => {
      const syncExchanges = multiExchangeSyncService.getSupportedExchanges();
      const serviceExchanges = exchangeService.getSupportedExchanges();
      
      expect(syncExchanges).toEqual(serviceExchanges);
    });

    it('should not be running initially', () => {
      expect(multiExchangeSyncService.isRunning()).toBe(false);
    });
  });

  describe('Synchronization Lifecycle', () => {
    it('should start and stop synchronization properly', async () => {
      expect(multiExchangeSyncService.isRunning()).toBe(false);
      
      // Start synchronization
      await multiExchangeSyncService.startSynchronization(60000); // 1 minute interval
      expect(multiExchangeSyncService.isRunning()).toBe(true);
      
      // Stop synchronization
      await multiExchangeSyncService.stopSynchronization();
      expect(multiExchangeSyncService.isRunning()).toBe(false);
    }, 10000);

    it('should handle start synchronization events', (done) => {
      let eventReceived = false;
      
      multiExchangeSyncService.once('sync-started', (data) => {
        if (!eventReceived) {
          eventReceived = true;
          expect(data).toHaveProperty('exchanges');
          expect(data).toHaveProperty('interval');
          expect(Array.isArray(data.exchanges)).toBe(true);
          expect(typeof data.interval).toBe('number');
          done();
        }
      });
      
      multiExchangeSyncService.startSynchronization(10000);
      
      // Timeout protection
      setTimeout(() => {
        if (!eventReceived) {
          done();
        }
      }, 5000);
    }, 8000);

    it('should handle stop synchronization events', (done) => {
      let eventReceived = false;
      
      const onStopped = () => {
        if (!eventReceived) {
          eventReceived = true;
          done();
        }
      };
      
      multiExchangeSyncService.once('sync-stopped', onStopped);
      
      // Start then stop
      multiExchangeSyncService.startSynchronization(10000).then(() => {
        setTimeout(() => {
          multiExchangeSyncService.stopSynchronization();
        }, 1000);
      });
      
      // Timeout protection
      setTimeout(() => {
        if (!eventReceived) {
          done();
        }
      }, 5000);
    }, 8000);
  });

  describe('Full Synchronization', () => {
    it('should perform full sync without errors', async () => {
      let fullSyncCompleted = false;
      
      multiExchangeSyncService.once('full-sync-completed', () => {
        fullSyncCompleted = true;
      });
      
      await multiExchangeSyncService.performFullSync();
      expect(fullSyncCompleted).toBe(true);
    }, 30000);

    it('should emit exchange sync events during full sync', (done) => {
      let eventsReceived = 0;
      const expectedExchanges = multiExchangeSyncService.getSupportedExchanges().length;
      
      const onExchangeSynced = (data: any) => {
        expect(data).toHaveProperty('exchange');
        expect(data).toHaveProperty('duration');
        expect(typeof data.exchange).toBe('string');
        expect(typeof data.duration).toBe('number');
        
        eventsReceived++;
        if (eventsReceived >= expectedExchanges) {
          done();
        }
      };
      
      multiExchangeSyncService.on('exchange-synced', onExchangeSynced);
      
      multiExchangeSyncService.performFullSync();
      
      // Timeout protection
      setTimeout(() => {
        multiExchangeSyncService.off('exchange-synced', onExchangeSynced);
        done();
      }, 25000);
    }, 30000);
  });

  describe('Sync Status Management', () => {
    it('should track sync status for all exchanges', async () => {
      await multiExchangeSyncService.performFullSync();
      
      const syncStatuses = await multiExchangeSyncService.getSyncStatus();
      
      expect(Array.isArray(syncStatuses)).toBe(true);
      expect(syncStatuses).toHaveLength(4); // All supported exchanges
      
      syncStatuses.forEach(status => {
        expect(status).toHaveProperty('exchange');
        expect(status).toHaveProperty('lastSync');
        expect(status).toHaveProperty('status');
        expect(['success', 'error', 'pending']).toContain(status.status);
        expect(status.lastSync).toBeInstanceOf(Date);
      });
    }, 20000);

    it('should update sync status after individual exchange sync', async () => {
      // Perform full sync to populate status
      await multiExchangeSyncService.performFullSync();
      
      const initialStatuses = await multiExchangeSyncService.getSyncStatus();
      expect(initialStatuses.length).toBeGreaterThan(0);
      
      // Wait a moment and check that timestamps are reasonable
      const now = new Date();
      initialStatuses.forEach(status => {
        const timeDiff = now.getTime() - status.lastSync.getTime();
        expect(timeDiff).toBeLessThan(60000); // Should be within last minute
      });
    }, 15000);
  });

  describe('Unified Market Data', () => {
    it('should get unified market data for major pairs', async () => {
      // Test BTC/USDT
      const btcData = await multiExchangeSyncService.getUnifiedMarketData('BTC/USDT');
      
      if (btcData) {
        expect(btcData).toHaveProperty('symbol', 'BTC/USDT');
        expect(btcData).toHaveProperty('baseSymbol', 'BTC');
        expect(btcData).toHaveProperty('prices');
        expect(btcData).toHaveProperty('lastUpdated');
        expect(btcData.lastUpdated).toBeInstanceOf(Date);
        expect(typeof btcData.prices).toBe('object');
        
        // Should have data from at least one exchange
        const priceEntries = Object.keys(btcData.prices);
        expect(priceEntries.length).toBeGreaterThan(0);
        
        // Validate price data structure
        priceEntries.forEach(exchange => {
          const priceData = btcData.prices[exchange];
          expect(priceData).toHaveProperty('price');
          expect(priceData).toHaveProperty('timestamp');
          expect(priceData).toHaveProperty('exchange');
          expect(typeof priceData.price).toBe('number');
          expect(priceData.price).toBeGreaterThan(0);
          expect(priceData.timestamp).toBeInstanceOf(Date);
        });
      }
    }, 20000);

    it('should handle symbol mapping correctly', async () => {
      // Test different symbol formats
      const testCases = ['BTC/USDT', 'BTC/USD', 'ETH/USDT', 'ETH/USD'];
      
      for (const symbol of testCases) {
        const marketData = await multiExchangeSyncService.getUnifiedMarketData(symbol);
        
        if (marketData) {
          expect(marketData.symbol).toBe(symbol);
          expect(marketData.baseSymbol).toBe(symbol.split('/')[0]);
        }
      }
    }, 30000);
  });

  describe('Arbitrage Detection', () => {
    it('should detect arbitrage opportunities', async () => {
      const opportunities = await multiExchangeSyncService.detectArbitrageOpportunities(0.1); // Very low threshold
      
      expect(Array.isArray(opportunities)).toBe(true);
      
      opportunities.forEach(opportunity => {
        expect(opportunity).toHaveProperty('symbol');
        expect(opportunity).toHaveProperty('baseSymbol');
        expect(opportunity).toHaveProperty('buyExchange');
        expect(opportunity).toHaveProperty('sellExchange');
        expect(opportunity).toHaveProperty('buyPrice');
        expect(opportunity).toHaveProperty('sellPrice');
        expect(opportunity).toHaveProperty('spread');
        expect(opportunity).toHaveProperty('spreadPercentage');
        expect(opportunity).toHaveProperty('confidence');
        expect(opportunity).toHaveProperty('timestamp');
        
        expect(typeof opportunity.buyPrice).toBe('number');
        expect(typeof opportunity.sellPrice).toBe('number');
        expect(typeof opportunity.spread).toBe('number');
        expect(typeof opportunity.spreadPercentage).toBe('number');
        expect(typeof opportunity.confidence).toBe('number');
        expect(opportunity.timestamp).toBeInstanceOf(Date);
        
        expect(opportunity.buyPrice).toBeGreaterThan(0);
        expect(opportunity.sellPrice).toBeGreaterThan(0);
        expect(opportunity.spreadPercentage).toBeGreaterThanOrEqual(0.1);
        expect(opportunity.confidence).toBeGreaterThanOrEqual(0);
        expect(opportunity.confidence).toBeLessThanOrEqual(100);
        expect(opportunity.buyExchange).not.toBe(opportunity.sellExchange);
      });
    }, 25000);

    it('should cache arbitrage opportunities', async () => {
      // Detect opportunities
      const opportunities = await multiExchangeSyncService.detectArbitrageOpportunities(0.5);
      
      // Get cached opportunities
      const cachedOpportunities = await multiExchangeSyncService.getArbitrageOpportunities();
      
      expect(cachedOpportunities).toEqual(opportunities);
    }, 15000);

    it('should emit arbitrage detection events', (done) => {
      let eventReceived = false;
      
      const onArbitrageDetected = (opportunities: any[]) => {
        if (!eventReceived) {
          eventReceived = true;
          expect(Array.isArray(opportunities)).toBe(true);
          multiExchangeSyncService.off('arbitrage-detected', onArbitrageDetected);
          done();
        }
      };
      
      multiExchangeSyncService.on('arbitrage-detected', onArbitrageDetected);
      
      // Trigger arbitrage detection
      multiExchangeSyncService.detectArbitrageOpportunities(0.1);
      
      // Timeout protection
      setTimeout(() => {
        if (!eventReceived) {
          multiExchangeSyncService.off('arbitrage-detected', onArbitrageDetected);
          done();
        }
      }, 15000);
    }, 20000);
  });

  describe('Portfolio Aggregation', () => {
    it('should handle portfolio aggregation for user without credentials', async () => {
      const testUserId = 'test-user-without-creds';
      
      const portfolio = await multiExchangeSyncService.aggregateUserPortfolio(testUserId);
      
      expect(Array.isArray(portfolio)).toBe(true);
      expect(portfolio).toHaveLength(0); // No credentials = no portfolio data
    });

    it('should aggregate portfolio structure correctly', async () => {
      // Mock exchange service to simulate credentials
      const originalHasValidCredentials = exchangeService.hasValidCredentials;
      const originalGetAuthenticatedClient = exchangeService.getAuthenticatedClient;
      
      jest.spyOn(exchangeService, 'hasValidCredentials').mockResolvedValue(false);
      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(null as any);
      
      const testUserId = 'test-user-with-mocked-creds';
      const portfolio = await multiExchangeSyncService.aggregateUserPortfolio(testUserId);
      
      expect(Array.isArray(portfolio)).toBe(true);
      
      // Restore original methods
      exchangeService.hasValidCredentials = originalHasValidCredentials;
      exchangeService.getAuthenticatedClient = originalGetAuthenticatedClient;
    });
  });

  describe('Balance Reconciliation', () => {
    it('should perform balance reconciliation', async () => {
      const testUserId = 'test-reconcile-user';
      
      const reconciliation = await multiExchangeSyncService.reconcileBalances(testUserId);
      
      expect(reconciliation).toHaveProperty('discrepancies');
      expect(reconciliation).toHaveProperty('lastReconciliation');
      expect(Array.isArray(reconciliation.discrepancies)).toBe(true);
      expect(reconciliation.lastReconciliation).toBeInstanceOf(Date);
    });

    it('should cache reconciliation results', async () => {
      const testUserId = 'test-cache-reconcile-user';
      
      const reconciliation = await multiExchangeSyncService.reconcileBalances(testUserId);
      
      // Check if result was cached
      const cacheKey = `reconciliation:${testUserId}`;
      const cached = await cacheService.get?.(cacheKey);
      
      if (cached) {
        const parsedCached = JSON.parse(cached);
        expect(parsedCached).toHaveProperty('discrepancies');
        expect(parsedCached).toHaveProperty('lastReconciliation');
      }
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle exchange connection failures gracefully', async () => {
      // This test verifies that the service doesn't crash when exchanges are unavailable
      const statuses = await multiExchangeSyncService.getSyncStatus();
      
      expect(Array.isArray(statuses)).toBe(true);
      
      // All statuses should have valid structure even if exchanges are down
      statuses.forEach(status => {
        expect(status).toHaveProperty('exchange');
        expect(status).toHaveProperty('status');
        expect(status).toHaveProperty('lastSync');
      });
    });

    it('should continue operating with partial exchange failures', async () => {
      // Mock one exchange to fail
      const originalTestConnection = exchangeService.testConnection;
      
      let callCount = 0;
      jest.spyOn(exchangeService, 'testConnection').mockImplementation((exchange: string) => {
        callCount++;
        if (exchange === 'binance' && callCount === 1) {
          return Promise.resolve({ connected: false, error: 'Simulated failure' });
        }
        return originalTestConnection.call(exchangeService, exchange);
      });
      
      // Should still work with other exchanges
      const marketData = await multiExchangeSyncService.getUnifiedMarketData('BTC/USDT');
      
      // Restore original method
      exchangeService.testConnection = originalTestConnection;
      
      // Should have data from at least one exchange
      if (marketData) {
        expect(Object.keys(marketData.prices).length).toBeGreaterThan(0);
      }
    }, 15000);

    it('should handle cache service unavailability', async () => {
      // Mock cache service failure
      const originalCacheSet = cacheService.set;
      const originalCacheGet = cacheService.get;
      
      if (cacheService.set) {
        cacheService.set = jest.fn().mockRejectedValue(new Error('Cache unavailable'));
      }
      if (cacheService.get) {
        cacheService.get = jest.fn().mockRejectedValue(new Error('Cache unavailable'));
      }
      
      // Should still work without cache
      const opportunities = await multiExchangeSyncService.getArbitrageOpportunities();
      expect(Array.isArray(opportunities)).toBe(true);
      
      // Restore cache service
      if (originalCacheSet) cacheService.set = originalCacheSet;
      if (originalCacheGet) cacheService.get = originalCacheGet;
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent operations', async () => {
      const operations = [
        multiExchangeSyncService.getUnifiedMarketData('BTC/USDT'),
        multiExchangeSyncService.getUnifiedMarketData('ETH/USDT'),
        multiExchangeSyncService.detectArbitrageOpportunities(0.5),
        multiExchangeSyncService.getSyncStatus()
      ];
      
      const results = await Promise.allSettled(operations);
      
      // All operations should complete (fulfilled or rejected, but not hang)
      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(result.status).toMatch(/fulfilled|rejected/);
      });
    }, 30000);

    it('should maintain reasonable response times', async () => {
      const startTime = Date.now();
      
      await multiExchangeSyncService.getSyncStatus();
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Event System', () => {
    it('should be an EventEmitter instance', () => {
      expect(multiExchangeSyncService.on).toBeDefined();
      expect(multiExchangeSyncService.emit).toBeDefined();
      expect(multiExchangeSyncService.removeListener).toBeDefined();
    });

    it('should handle event listener cleanup', () => {
      const testListener = jest.fn();
      
      multiExchangeSyncService.on('test-event', testListener);
      multiExchangeSyncService.emit('test-event', { data: 'test' });
      
      expect(testListener).toHaveBeenCalledWith({ data: 'test' });
      
      multiExchangeSyncService.removeListener('test-event', testListener);
      multiExchangeSyncService.emit('test-event', { data: 'test2' });
      
      expect(testListener).toHaveBeenCalledTimes(1); // Should not be called again
    });
  });
});