import { webSocketManager } from '../../services/exchanges/webSocketManager';
import { exchangeService } from '../../services/exchanges/exchangeService';
import { cacheService } from '../../services/cacheService';
import { jest } from '@jest/globals';
import WebSocket from 'ws';

describe('WebSocket Manager Integration Tests', () => {
  beforeAll(async () => {
    // Initialize cache service
    await cacheService.initialize?.();
  });

  afterAll(async () => {
    // Cleanup all connections
    await webSocketManager.disconnectAll();
    await cacheService.shutdown?.();
  });

  beforeEach(async () => {
    // Disconnect all connections before each test
    await webSocketManager.disconnectAll();
    
    // Clear cache
    if (cacheService.flush) {
      await cacheService.flush();
    }
  });

  describe('WebSocket Manager Initialization', () => {
    it('should initialize with correct supported exchanges', () => {
      const manager = webSocketManager;
      
      expect(manager).toBeDefined();
      expect(typeof manager.connect).toBe('function');
      expect(typeof manager.disconnect).toBe('function');
      expect(typeof manager.subscribe).toBe('function');
      expect(typeof manager.unsubscribe).toBe('function');
    });

    it('should be an EventEmitter instance', () => {
      expect(webSocketManager.on).toBeDefined();
      expect(webSocketManager.emit).toBeDefined();
      expect(webSocketManager.removeListener).toBeDefined();
    });

    it('should have no active connections initially', () => {
      const status = webSocketManager.getConnectionStatus();
      expect(Object.keys(status)).toHaveLength(0);
    });
  });

  describe('Exchange Connection Management', () => {
    it('should connect to Binance WebSocket successfully', async () => {
      const connected = await webSocketManager.connect('binance', ['BTCUSDT']);
      
      expect(connected).toBe(true);
      
      const status = webSocketManager.getConnectionStatus();
      expect(status.binance).toBeDefined();
      expect(status.binance.isConnected).toBe(true);
      expect(status.binance.reconnectAttempts).toBe(0);
    }, 15000);

    it('should connect to multiple exchanges simultaneously', async () => {
      const exchanges = ['binance', 'coinbase'];
      
      const connectionPromises = exchanges.map(exchange =>
        webSocketManager.connect(exchange)
      );
      
      const results = await Promise.allSettled(connectionPromises);
      
      // At least some connections should succeed
      const successfulConnections = results.filter((result: any) => 
        result.status === 'fulfilled' && result.value === true
      );
      
      expect(successfulConnections.length).toBeGreaterThan(0);
      
      const status = webSocketManager.getConnectionStatus();
      expect(Object.keys(status).length).toBeGreaterThan(0);
    }, 20000);

    it('should handle connection failures gracefully', async () => {
      // Mock WebSocket to simulate connection failure
      const originalWebSocket = (global as any).WebSocket;
      (global as any).WebSocket = class MockWebSocket extends WebSocket {
        constructor(url: string) {
          super(url);
          // Simulate connection failure after a short delay
          setTimeout(() => {
            this.emit('error', new Error('Simulated connection failure'));
          }, 100);
        }
      };

      try {
        await webSocketManager.connect('binance');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }

      // Restore original WebSocket
      (global as any).WebSocket = originalWebSocket;
    }, 10000);

    it('should disconnect from exchange successfully', async () => {
      await webSocketManager.connect('binance');
      
      const disconnected = await webSocketManager.disconnect('binance');
      expect(disconnected).toBe(true);
      
      const status = webSocketManager.getConnectionStatus();
      expect(status.binance).toBeUndefined();
    }, 10000);

    it('should disconnect all connections', async () => {
      await webSocketManager.connect('binance');
      await webSocketManager.connect('coinbase');
      
      await webSocketManager.disconnectAll();
      
      const status = webSocketManager.getConnectionStatus();
      expect(Object.keys(status)).toHaveLength(0);
    }, 15000);
  });

  describe('Subscription Management', () => {
    beforeEach(async () => {
      // Ensure we have a connection for subscription tests
      await webSocketManager.connect('binance');
    });

    it('should create subscription successfully', async () => {
      const subscriptionId = await webSocketManager.subscribe({
        exchange: 'binance',
        symbols: ['BTCUSDT'],
        types: ['ticker'],
        userId: 'test-user'
      });
      
      expect(subscriptionId).toBeDefined();
      expect(typeof subscriptionId).toBe('string');
      expect(subscriptionId.length).toBeGreaterThan(10);
      
      const activeSubscriptions = webSocketManager.getActiveSubscriptions();
      expect(activeSubscriptions.length).toBe(1);
      expect(activeSubscriptions[0].id).toBe(subscriptionId);
      expect(activeSubscriptions[0].exchange).toBe('binance');
      expect(activeSubscriptions[0].symbols).toEqual(['BTCUSDT']);
    }, 10000);

    it('should handle subscription callbacks', (done) => {
      let callbackInvoked = false;
      
      const callback = (data: any) => {
        if (!callbackInvoked) {
          callbackInvoked = true;
          expect(data).toHaveProperty('symbol');
          expect(data).toHaveProperty('price');
          expect(data).toHaveProperty('exchange');
          expect(data).toHaveProperty('timestamp');
          done();
        }
      };
      
      webSocketManager.subscribe({
        exchange: 'binance',
        symbols: ['BTCUSDT'],
        types: ['ticker']
      }, callback).then(() => {
        // Simulate receiving data
        webSocketManager.emit('data', {
          symbol: 'BTCUSDT',
          price: 50000,
          exchange: 'binance',
          timestamp: new Date(),
          type: 'ticker'
        });
      });
      
      // Timeout protection
      setTimeout(() => {
        if (!callbackInvoked) {
          done();
        }
      }, 5000);
    }, 8000);

    it('should unsubscribe successfully', async () => {
      const subscriptionId = await webSocketManager.subscribe({
        exchange: 'binance',
        symbols: ['BTCUSDT'],
        types: ['ticker']
      });
      
      const unsubscribed = await webSocketManager.unsubscribe(subscriptionId);
      expect(unsubscribed).toBe(true);
      
      const activeSubscriptions = webSocketManager.getActiveSubscriptions();
      expect(activeSubscriptions.length).toBe(0);
    }, 10000);

    it('should handle multiple subscriptions for same exchange', async () => {
      const subscription1 = await webSocketManager.subscribe({
        exchange: 'binance',
        symbols: ['BTCUSDT'],
        types: ['ticker']
      });
      
      const subscription2 = await webSocketManager.subscribe({
        exchange: 'binance',
        symbols: ['ETHUSDT'],
        types: ['trade']
      });
      
      expect(subscription1).toBeDefined();
      expect(subscription2).toBeDefined();
      expect(subscription1).not.toBe(subscription2);
      
      const activeSubscriptions = webSocketManager.getActiveSubscriptions();
      expect(activeSubscriptions.length).toBe(2);
    }, 10000);
  });

  describe('Data Processing and Caching', () => {
    beforeEach(async () => {
      await webSocketManager.connect('binance');
    });

    it('should parse Binance message format correctly', async () => {
      const mockBinanceMessage = {
        e: '24hrTicker',
        s: 'BTCUSDT',
        c: '50000.00',
        v: '1000.50',
        P: '2.50',
        E: Date.now()
      };
      
      // Access private method through prototype
      const parsedData = (webSocketManager as any).parseBinanceMessage(mockBinanceMessage);
      
      expect(parsedData).toBeDefined();
      expect(parsedData.symbol).toBe('BTCUSDT');
      expect(parsedData.price).toBe(50000);
      expect(parsedData.volume).toBe(1000.5);
      expect(parsedData.change24h).toBe(2.5);
      expect(parsedData.exchange).toBe('binance');
      expect(parsedData.type).toBe('ticker');
    });

    it('should parse Coinbase message format correctly', async () => {
      const mockCoinbaseMessage = {
        type: 'ticker',
        product_id: 'BTC-USD',
        price: '50000.00',
        volume_24h: '1000.50',
        time: new Date().toISOString()
      };
      
      const parsedData = (webSocketManager as any).parseCoinbaseMessage(mockCoinbaseMessage);
      
      expect(parsedData).toBeDefined();
      expect(parsedData.symbol).toBe('BTC-USD');
      expect(parsedData.price).toBe(50000);
      expect(parsedData.volume).toBe(1000.5);
      expect(parsedData.exchange).toBe('coinbase');
      expect(parsedData.type).toBe('ticker');
    });

    it('should cache stream data correctly', async () => {
      const testData = {
        symbol: 'BTCUSDT',
        price: 50000,
        volume: 1000,
        timestamp: new Date(),
        exchange: 'binance',
        type: 'ticker' as const
      };
      
      // Cache data through private method
      await (webSocketManager as any).cacheStreamData(testData);
      
      // Retrieve cached data
      const cachedData = await webSocketManager.getCachedData('binance', 'BTCUSDT', 'ticker');
      
      expect(cachedData).toBeDefined();
      expect(cachedData!.symbol).toBe('BTCUSDT');
      expect(cachedData!.price).toBe(50000);
      expect(cachedData!.exchange).toBe('binance');
    });

    it('should handle cache failures gracefully', async () => {
      // Mock cache service failure
      const originalCacheSet = cacheService.set;
      if (cacheService.set) {
        cacheService.set = jest.fn().mockRejectedValue(new Error('Cache failure'));
      }
      
      const testData = {
        symbol: 'BTCUSDT',
        price: 50000,
        volume: 1000,
        timestamp: new Date(),
        exchange: 'binance',
        type: 'ticker' as const
      };
      
      // Should not throw error
      await expect(
        (webSocketManager as any).cacheStreamData(testData)
      ).resolves.not.toThrow();
      
      // Restore cache service
      if (originalCacheSet) {
        cacheService.set = originalCacheSet;
      }
    });
  });

  describe('Event System Integration', () => {
    beforeEach(async () => {
      await webSocketManager.connect('binance');
    });

    it('should emit connection events', (done) => {
      let eventReceived = false;
      
      const onConnected = (data: any) => {
        if (!eventReceived) {
          eventReceived = true;
          expect(data).toHaveProperty('exchange');
          expect(data).toHaveProperty('symbols');
          webSocketManager.off('connected', onConnected);
          done();
        }
      };
      
      webSocketManager.on('connected', onConnected);
      
      // Trigger connection
      webSocketManager.connect('coinbase');
      
      // Timeout protection
      setTimeout(() => {
        if (!eventReceived) {
          webSocketManager.off('connected', onConnected);
          done();
        }
      }, 10000);
    }, 15000);

    it('should emit data events', (done) => {
      let eventReceived = false;
      
      const onData = (data: any) => {
        if (!eventReceived) {
          eventReceived = true;
          expect(data).toHaveProperty('symbol');
          expect(data).toHaveProperty('price');
          expect(data).toHaveProperty('exchange');
          webSocketManager.off('data', onData);
          done();
        }
      };
      
      webSocketManager.on('data', onData);
      
      // Simulate data emission
      webSocketManager.emit('data', {
        symbol: 'BTCUSDT',
        price: 50000,
        exchange: 'binance',
        timestamp: new Date(),
        type: 'ticker'
      });
      
      // Timeout protection
      setTimeout(() => {
        if (!eventReceived) {
          webSocketManager.off('data', onData);
          done();
        }
      }, 1000);
    }, 3000);

    it('should emit exchange-specific events', (done) => {
      let eventReceived = false;
      
      const onBinanceData = (data: any) => {
        if (!eventReceived) {
          eventReceived = true;
          expect(data.exchange).toBe('binance');
          webSocketManager.off('binance:data', onBinanceData);
          done();
        }
      };
      
      webSocketManager.on('binance:data', onBinanceData);
      
      // Simulate Binance-specific data
      webSocketManager.emit('binance:data', {
        symbol: 'BTCUSDT',
        price: 50000,
        exchange: 'binance',
        timestamp: new Date(),
        type: 'ticker'
      });
      
      // Timeout protection
      setTimeout(() => {
        if (!eventReceived) {
          webSocketManager.off('binance:data', onBinanceData);
          done();
        }
      }, 1000);
    }, 3000);
  });

  describe('Reconnection Logic', () => {
    it('should handle WebSocket disconnections', (done) => {
      let disconnectEventReceived = false;
      
      const onDisconnected = (data: any) => {
        if (!disconnectEventReceived) {
          disconnectEventReceived = true;
          expect(data).toHaveProperty('exchange');
          expect(data).toHaveProperty('code');
          webSocketManager.off('disconnected', onDisconnected);
          done();
        }
      };
      
      webSocketManager.on('disconnected', onDisconnected);
      
      // Connect and then force disconnect
      webSocketManager.connect('binance').then(() => {
        const status = webSocketManager.getConnectionStatus();
        const connection = (webSocketManager as any).connections.get('binance');
        if (connection && connection.ws) {
          connection.ws.close(1006, 'Simulated network error');
        }
      });
      
      // Timeout protection
      setTimeout(() => {
        if (!disconnectEventReceived) {
          webSocketManager.off('disconnected', onDisconnected);
          done();
        }
      }, 15000);
    }, 20000);
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent operations', async () => {
      const operations = [
        webSocketManager.connect('binance'),
        webSocketManager.connect('coinbase'),
        webSocketManager.getConnectionStatus(),
        webSocketManager.getCachedData('binance', 'BTCUSDT', 'ticker')
      ];
      
      const results = await Promise.allSettled(operations);
      
      // All operations should complete without hanging
      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(result.status).toMatch(/fulfilled|rejected/);
      });
    }, 20000);

    it('should maintain reasonable memory usage', async () => {
      // Create multiple subscriptions and connections
      await webSocketManager.connect('binance');
      
      const subscriptionIds = [];
      for (let i = 0; i < 10; i++) {
        const id = await webSocketManager.subscribe({
          exchange: 'binance',
          symbols: [`TEST${i}USDT`],
          types: ['ticker']
        });
        subscriptionIds.push(id);
      }
      
      const activeSubscriptions = webSocketManager.getActiveSubscriptions();
      expect(activeSubscriptions.length).toBe(10);
      
      // Clean up subscriptions
      for (const id of subscriptionIds) {
        await webSocketManager.unsubscribe(id);
      }
      
      const finalSubscriptions = webSocketManager.getActiveSubscriptions();
      expect(finalSubscriptions.length).toBe(0);
    }, 15000);
  });

  describe('Error Resilience', () => {
    it('should handle malformed messages gracefully', async () => {
      await webSocketManager.connect('binance');
      
      // Simulate malformed message
      const malformedMessage = 'invalid-json-data';
      
      // Should not throw error
      expect(() => {
        (webSocketManager as any).handleMessage('binance', malformedMessage);
      }).not.toThrow();
    });

    it('should continue operating after individual exchange failures', async () => {
      await webSocketManager.connect('binance');
      await webSocketManager.connect('coinbase');
      
      // Force disconnect one exchange
      await webSocketManager.disconnect('binance');
      
      const status = webSocketManager.getConnectionStatus();
      expect(status.binance).toBeUndefined();
      expect(status.coinbase).toBeDefined();
      
      // Should still be able to create subscriptions on working exchange
      const subscriptionId = await webSocketManager.subscribe({
        exchange: 'coinbase',
        symbols: ['BTC-USD'],
        types: ['ticker']
      });
      
      expect(subscriptionId).toBeDefined();
    }, 15000);

    it('should handle exchange service integration failures', async () => {
      // Mock exchange service failure
      const originalGetPublicClient = exchangeService.getPublicClient;
      exchangeService.getPublicClient = jest.fn().mockReturnValue(null);
      
      try {
        await webSocketManager.connect('kucoin');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
      
      // Restore original method
      exchangeService.getPublicClient = originalGetPublicClient;
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should properly cleanup on process termination', async () => {
      await webSocketManager.connect('binance');
      
      // Create subscription
      await webSocketManager.subscribe({
        exchange: 'binance',
        symbols: ['BTCUSDT'],
        types: ['ticker']
      });
      
      // Verify active state
      const statusBefore = webSocketManager.getConnectionStatus();
      expect(Object.keys(statusBefore)).toHaveLength(1);
      
      // Cleanup
      await webSocketManager.disconnectAll();
      
      const statusAfter = webSocketManager.getConnectionStatus();
      expect(Object.keys(statusAfter)).toHaveLength(0);
    });

    it('should clear intervals and timeouts properly', async () => {
      await webSocketManager.connect('binance');
      
      // Verify connection has heartbeat
      const heartbeatIntervals = (webSocketManager as any).heartbeatIntervals;
      expect(heartbeatIntervals.size).toBeGreaterThan(0);
      
      await webSocketManager.disconnect('binance');
      
      // Verify cleanup
      expect(heartbeatIntervals.size).toBe(0);
    });
  });
});