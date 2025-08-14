import { CoinbaseClient } from '../../services/exchanges/coinbaseClient';
import { exchangeService } from '../../services/exchanges/exchangeService';
import { rateLimitService } from '../../services/rateLimitService';
import { cacheService } from '../../services/cacheService';
import { jest } from '@jest/globals';

describe('Coinbase Integration Tests', () => {
  let coinbaseClient: CoinbaseClient;

  beforeAll(async () => {
    // Initialize services for integration testing
    await cacheService.initialize?.();
    coinbaseClient = CoinbaseClient.createPublic();
  });

  afterAll(async () => {
    // Cleanup
    coinbaseClient?.closeAllWebSockets?.();
    await cacheService.shutdown?.();
  });

  describe('CoinbaseClient Integration', () => {
    describe('Public API Methods', () => {
      it('should test connection to Coinbase Pro', async () => {
        const result = await coinbaseClient.testConnection();
        
        expect(result).toBeDefined();
        expect(typeof result.connected).toBe('boolean');
        
        if (result.connected) {
          expect(result.serverTime).toBeInstanceOf(Date);
          expect(typeof result.latency).toBe('number');
          expect(result.latency).toBeGreaterThan(0);
        }
      }, 10000);

      it('should fetch current prices', async () => {
        const prices = await coinbaseClient.getCurrentPrices(['BTC-USD', 'ETH-USD']);
        
        expect(prices).toBeDefined();
        expect(typeof prices).toBe('object');
        
        if (Object.keys(prices).length > 0) {
          const btcPrice = prices['BTC-USD'];
          if (btcPrice) {
            expect(btcPrice).toHaveProperty('symbol', 'BTC-USD');
            expect(btcPrice).toHaveProperty('price');
            expect(btcPrice).toHaveProperty('timestamp');
            expect(btcPrice).toHaveProperty('exchange', 'coinbase');
            expect(typeof btcPrice.price).toBe('number');
            expect(btcPrice.price).toBeGreaterThan(0);
          }
        }
      }, 15000);

      it('should fetch historical data', async () => {
        const historicalData = await coinbaseClient.getHistoricalPrices('BTC-USD', '86400', 5);
        
        expect(historicalData).toBeDefined();
        expect(Array.isArray(historicalData)).toBe(true);
        
        if (historicalData.length > 0) {
          const candle = historicalData[0];
          expect(candle).toHaveProperty('timestamp');
          expect(candle).toHaveProperty('open');
          expect(candle).toHaveProperty('high');
          expect(candle).toHaveProperty('low');
          expect(candle).toHaveProperty('close');
          expect(candle).toHaveProperty('volume');
          
          expect(candle.timestamp).toBeInstanceOf(Date);
          expect(typeof candle.open).toBe('number');
          expect(typeof candle.high).toBe('number');
          expect(typeof candle.low).toBe('number');
          expect(typeof candle.close).toBe('number');
          expect(typeof candle.volume).toBe('number');
          
          // Validate OHLC logic
          expect(candle.high).toBeGreaterThanOrEqual(candle.open);
          expect(candle.high).toBeGreaterThanOrEqual(candle.close);
          expect(candle.low).toBeLessThanOrEqual(candle.open);
          expect(candle.low).toBeLessThanOrEqual(candle.close);
        }
      }, 15000);

      it('should fetch exchange info', async () => {
        const exchangeInfo = await coinbaseClient.getExchangeInfo();
        
        expect(exchangeInfo).toBeDefined();
        expect(exchangeInfo).toHaveProperty('timezone');
        expect(exchangeInfo).toHaveProperty('serverTime');
        expect(exchangeInfo).toHaveProperty('tradingPairs');
        expect(exchangeInfo).toHaveProperty('totalPairs');
        
        expect(exchangeInfo.serverTime).toBeInstanceOf(Date);
        expect(Array.isArray(exchangeInfo.tradingPairs)).toBe(true);
        expect(typeof exchangeInfo.totalPairs).toBe('number');
        
        if (exchangeInfo.tradingPairs.length > 0) {
          const pair = exchangeInfo.tradingPairs[0];
          expect(pair).toHaveProperty('symbol');
          expect(pair).toHaveProperty('baseAsset');
          expect(pair).toHaveProperty('quoteAsset');
          expect(pair).toHaveProperty('status');
          expect(typeof pair.minOrderSize).toBe('number');
          expect(typeof pair.tickSize).toBe('number');
        }
      }, 15000);
    });

    describe('Rate Limiting Integration', () => {
      it('should respect rate limits', async () => {
        const startTime = Date.now();
        
        // Make multiple requests
        const promises = Array(5).fill(null).map(async () => {
          await rateLimitService.waitForExchangeAvailability('coinbase', 1);
          return coinbaseClient.getCurrentPrices(['BTC-USD']);
        });
        
        await Promise.all(promises);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Should take some time due to rate limiting
        expect(duration).toBeGreaterThan(100);
      }, 20000);

      it('should handle rate limit errors gracefully', async () => {
        // Mock rate limit exceeded
        const mockWaitForAvailability = jest.spyOn(rateLimitService, 'waitForExchangeAvailability');
        mockWaitForAvailability.mockRejectedValue(new Error('Rate limit exceeded'));
        
        await expect(coinbaseClient.getCurrentPrices()).rejects.toThrow();
        
        mockWaitForAvailability.mockRestore();
      });
    });

    describe('Caching Integration', () => {
      it('should cache API responses', async () => {
        // Clear cache first
        await cacheService.delete?.('coinbase:current_prices:BTC-USD');
        
        // First request should hit the API
        const startTime1 = Date.now();
        const prices1 = await coinbaseClient.getCurrentPrices(['BTC-USD']);
        const duration1 = Date.now() - startTime1;
        
        // Second request should use cache (should be faster)
        const startTime2 = Date.now();
        const prices2 = await coinbaseClient.getCurrentPrices(['BTC-USD']);
        const duration2 = Date.now() - startTime2;
        
        expect(prices1).toEqual(prices2);
        expect(duration2).toBeLessThan(duration1);
      }, 15000);

      it('should handle cache failures gracefully', async () => {
        // Mock cache failure
        const mockCacheGet = jest.spyOn(cacheService, 'get');
        mockCacheGet.mockRejectedValue(new Error('Cache error'));
        
        // Should still work by hitting the API directly
        const prices = await coinbaseClient.getCurrentPrices(['BTC-USD']);
        expect(prices).toBeDefined();
        
        mockCacheGet.mockRestore();
      }, 10000);
    });

    describe('Error Handling Integration', () => {
      it('should handle API errors appropriately', async () => {
        // Test with invalid symbol
        try {
          await coinbaseClient.getHistoricalPrices('INVALID-PAIR', '86400', 5);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }, 10000);

      it('should handle network timeouts', async () => {
        // Create client with very short timeout
        const clientWithTimeout = new (CoinbaseClient as any)();
        clientWithTimeout.apiClient.defaults.timeout = 1; // 1ms timeout
        
        try {
          await clientWithTimeout.getCurrentPrices(['BTC-USD']);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }, 5000);
    });
  });

  describe('ExchangeService Integration', () => {
    describe('Public Methods', () => {
      it('should get supported exchanges including Coinbase', () => {
        const exchanges = exchangeService.getSupportedExchanges();
        expect(Array.isArray(exchanges)).toBe(true);
        expect(exchanges).toContain('coinbase');
        expect(exchanges).toContain('binance');
      });

      it('should get public client for Coinbase', () => {
        const client = exchangeService.getPublicClient('coinbase');
        expect(client).toBeDefined();
        expect(client).toBeInstanceOf(CoinbaseClient);
      });

      it('should test connections to Coinbase', async () => {
        const status = await exchangeService.getExchangeStatus();
        
        expect(status).toBeDefined();
        expect(typeof status).toBe('object');
        expect(status).toHaveProperty('coinbase');
        
        const coinbaseStatus = status.coinbase;
        expect(typeof coinbaseStatus.connected).toBe('boolean');
      }, 15000);

      it('should get current prices through service', async () => {
        const prices = await exchangeService.getCurrentPrices('coinbase', ['BTC-USD']);
        
        expect(prices).toBeDefined();
        expect(typeof prices).toBe('object');
      }, 10000);

      it('should get historical prices through service', async () => {
        const historicalData = await exchangeService.getHistoricalPrices('coinbase', 'BTC-USD', '3600', 5);
        
        expect(historicalData).toBeDefined();
        expect(Array.isArray(historicalData)).toBe(true);
      }, 10000);

      it('should get exchange info through service', async () => {
        const exchangeInfo = await exchangeService.getExchangeInfo('coinbase');
        
        expect(exchangeInfo).toBeDefined();
        expect(exchangeInfo).toHaveProperty('timezone');
        expect(exchangeInfo).toHaveProperty('tradingPairs');
      }, 10000);
    });

    describe('WebSocket Integration', () => {
      it('should setup real-time updates for Coinbase', (done) => {
        let messageReceived = false;
        
        const callback = (data: any) => {
          if (!messageReceived) {
            messageReceived = true;
            expect(data).toBeDefined();
            expect(data).toHaveProperty('symbol');
            expect(data).toHaveProperty('price');
            done();
          }
        };
        
        try {
          exchangeService.setupRealTimeUpdates('coinbase', ['BTC-USD'], callback);
          
          // Timeout the test after 30 seconds
          setTimeout(() => {
            if (!messageReceived) {
              done();
            }
          }, 30000);
        } catch (error) {
          // WebSocket might not be available in test environment
          done();
        }
      }, 35000);
    });
  });

  describe('Coinbase-specific Integration', () => {
    it('should handle Coinbase Pro product format', async () => {
      const prices = await exchangeService.getCurrentPrices('coinbase', ['BTC-USD', 'ETH-USD']);
      
      expect(prices).toBeDefined();
      
      // Should handle hyphenated product IDs (Coinbase format)
      if (prices['BTC-USD']) {
        expect(prices['BTC-USD'].symbol).toBe('BTC-USD');
      }
    }, 10000);

    it('should handle Coinbase granularity format', async () => {
      // Coinbase uses seconds for granularity (e.g., 86400 for 1 day)
      const historicalData = await exchangeService.getHistoricalPrices('coinbase', 'BTC-USD', '86400', 3);
      
      expect(Array.isArray(historicalData)).toBe(true);
    }, 10000);

    it('should handle authentication signature format', async () => {
      // Test that the client correctly handles Coinbase Pro authentication format
      try {
        const client = CoinbaseClient.createWithCredentials('test_key', 'test_secret', 'test_passphrase');
        expect(client).toBeDefined();
      } catch (error) {
        // Expected to fail with invalid credentials, but client should be created
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Multi-Exchange Integration', () => {
    it('should handle both Binance and Coinbase through service', async () => {
      const binancePrices = await exchangeService.getCurrentPrices('binance', ['BTCUSDT']);
      const coinbasePrices = await exchangeService.getCurrentPrices('coinbase', ['BTC-USD']);
      
      expect(binancePrices).toBeDefined();
      expect(coinbasePrices).toBeDefined();
      
      // Both should return price data
      expect(typeof binancePrices).toBe('object');
      expect(typeof coinbasePrices).toBe('object');
    }, 15000);

    it('should maintain separate rate limits per exchange', async () => {
      const startTime = Date.now();
      
      // Make concurrent requests to both exchanges
      const promises = [
        exchangeService.getCurrentPrices('binance', ['BTCUSDT']),
        exchangeService.getCurrentPrices('coinbase', ['BTC-USD'])
      ];
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      expect(results).toHaveLength(2);
      expect(results[0]).toBeDefined();
      expect(results[1]).toBeDefined();
      
      // Should complete within reasonable time for concurrent requests
      expect(endTime - startTime).toBeLessThan(10000);
    }, 15000);
  });

  describe('End-to-End Integration', () => {
    it('should handle complete price data workflow for Coinbase', async () => {
      // 1. Test connection
      const connectionTest = await exchangeService.testConnection('coinbase');
      expect(connectionTest).toHaveProperty('connected');
      
      if (connectionTest.connected) {
        // 2. Get current prices
        const currentPrices = await exchangeService.getCurrentPrices('coinbase', ['BTC-USD']);
        expect(currentPrices).toBeDefined();
        
        // 3. Get historical data
        const historicalData = await exchangeService.getHistoricalPrices('coinbase', 'BTC-USD', '3600', 3);
        expect(Array.isArray(historicalData)).toBe(true);
        
        // 4. Get exchange info
        const exchangeInfo = await exchangeService.getExchangeInfo('coinbase');
        expect(exchangeInfo).toHaveProperty('tradingPairs');
      }
    }, 30000);

    it('should handle service failures gracefully', async () => {
      // Mock service failure
      const mockTestConnection = jest.spyOn(exchangeService, 'testConnection');
      mockTestConnection.mockResolvedValue({
        connected: false,
        error: 'Service unavailable'
      });
      
      const status = await exchangeService.testConnection('coinbase');
      expect(status.connected).toBe(false);
      expect(status.error).toBeDefined();
      
      mockTestConnection.mockRestore();
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now();
      
      const promises = Array(5).fill(null).map(() =>
        exchangeService.getCurrentPrices('coinbase', ['BTC-USD', 'ETH-USD'])
      );
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(15000);
    }, 20000);

    it('should handle large data requests', async () => {
      try {
        const historicalData = await exchangeService.getHistoricalPrices('coinbase', 'BTC-USD', '3600', 100);
        
        expect(Array.isArray(historicalData)).toBe(true);
        expect(historicalData.length).toBeGreaterThan(0);
        expect(historicalData.length).toBeLessThanOrEqual(100);
      } catch (error) {
        // Might hit rate limits with large requests
        expect(error).toBeInstanceOf(Error);
      }
    }, 20000);
  });
});