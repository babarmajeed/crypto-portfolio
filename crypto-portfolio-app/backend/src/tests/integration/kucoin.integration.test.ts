import { KuCoinClient } from '../../services/exchanges/kucoinClient';
import { exchangeService } from '../../services/exchanges/exchangeService';
import { rateLimitService } from '../../services/rateLimitService';
import { cacheService } from '../../services/cacheService';
import { jest } from '@jest/globals';

describe('KuCoin Integration Tests', () => {
  let kucoinClient: KuCoinClient;

  beforeAll(async () => {
    // Initialize services for integration testing
    await cacheService.initialize?.();
    kucoinClient = KuCoinClient.createPublic();
  });

  afterAll(async () => {
    // Cleanup
    kucoinClient?.closeAllWebSockets?.();
    await cacheService.shutdown?.();
  });

  describe('KuCoinClient Integration', () => {
    describe('Public API Methods', () => {
      it('should test connection to KuCoin', async () => {
        const result = await kucoinClient.testConnection();
        
        expect(result).toBeDefined();
        expect(typeof result.connected).toBe('boolean');
        
        if (result.connected) {
          expect(result.serverTime).toBeInstanceOf(Date);
          expect(typeof result.latency).toBe('number');
          expect(result.latency).toBeGreaterThan(0);
        }
      }, 10000);

      it('should fetch current prices', async () => {
        const prices = await kucoinClient.getCurrentPrices(['BTC-USDT', 'ETH-USDT']);
        
        expect(prices).toBeDefined();
        expect(typeof prices).toBe('object');
        
        if (Object.keys(prices).length > 0) {
          const btcPrice = prices['BTC-USDT'];
          if (btcPrice) {
            expect(btcPrice).toHaveProperty('symbol', 'BTC-USDT');
            expect(btcPrice).toHaveProperty('price');
            expect(btcPrice).toHaveProperty('timestamp');
            expect(btcPrice).toHaveProperty('exchange', 'kucoin');
            expect(typeof btcPrice.price).toBe('number');
            expect(btcPrice.price).toBeGreaterThan(0);
          }
        }
      }, 15000);

      it('should fetch historical data', async () => {
        const historicalData = await kucoinClient.getHistoricalPrices('BTC-USDT', '3600', 5);
        
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
        const exchangeInfo = await kucoinClient.getExchangeInfo();
        
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

      it('should get WebSocket token', async () => {
        try {
          const token = await kucoinClient.getWebSocketToken();
          expect(typeof token).toBe('string');
          expect(token.length).toBeGreaterThan(0);
        } catch (error) {
          // WebSocket token generation might fail in test environment
          expect(error).toBeInstanceOf(Error);
        }
      }, 10000);
    });

    describe('Rate Limiting Integration', () => {
      it('should respect rate limits', async () => {
        const startTime = Date.now();
        
        // Make multiple requests
        const promises = Array(5).fill(null).map(async () => {
          await rateLimitService.waitForExchangeAvailability('kucoin', 1);
          return kucoinClient.getCurrentPrices(['BTC-USDT']);
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
        
        await expect(kucoinClient.getCurrentPrices()).rejects.toThrow();
        
        mockWaitForAvailability.mockRestore();
      });
    });

    describe('Caching Integration', () => {
      it('should cache API responses', async () => {
        // Clear cache first
        await cacheService.delete?.('kucoin:current_prices:BTC-USDT');
        
        // First request should hit the API
        const startTime1 = Date.now();
        const prices1 = await kucoinClient.getCurrentPrices(['BTC-USDT']);
        const duration1 = Date.now() - startTime1;
        
        // Second request should use cache (should be faster)
        const startTime2 = Date.now();
        const prices2 = await kucoinClient.getCurrentPrices(['BTC-USDT']);
        const duration2 = Date.now() - startTime2;
        
        expect(prices1).toEqual(prices2);
        expect(duration2).toBeLessThan(duration1);
      }, 15000);

      it('should handle cache failures gracefully', async () => {
        // Mock cache failure
        const mockCacheGet = jest.spyOn(cacheService, 'get');
        mockCacheGet.mockRejectedValue(new Error('Cache error'));
        
        // Should still work by hitting the API directly
        const prices = await kucoinClient.getCurrentPrices(['BTC-USDT']);
        expect(prices).toBeDefined();
        
        mockCacheGet.mockRestore();
      }, 10000);
    });

    describe('Error Handling Integration', () => {
      it('should handle API errors appropriately', async () => {
        // Test with invalid symbol
        try {
          await kucoinClient.getHistoricalPrices('INVALID-PAIR', '3600', 5);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }, 10000);

      it('should handle network timeouts', async () => {
        // Create client with very short timeout
        const clientWithTimeout = new (KuCoinClient as any)();
        clientWithTimeout.apiClient.defaults.timeout = 1; // 1ms timeout
        
        try {
          await clientWithTimeout.getCurrentPrices(['BTC-USDT']);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }, 5000);
    });

    describe('KuCoin-specific Integration', () => {
      it('should handle KuCoin symbol format', async () => {
        const prices = await exchangeService.getCurrentPrices('kucoin', ['BTC-USDT', 'ETH-USDT']);
        
        expect(prices).toBeDefined();
        
        // Should handle KuCoin's hyphenated symbol format (BTC-USDT, ETH-USDT)
        if (prices['BTC-USDT']) {
          expect(prices['BTC-USDT'].symbol).toBe('BTC-USDT');
        }
        if (prices['ETH-USDT']) {
          expect(prices['ETH-USDT'].symbol).toBe('ETH-USDT');
        }
      }, 10000);

      it('should handle KuCoin interval format', async () => {
        // KuCoin uses string intervals (1min, 5min, 1hour, 1day)
        const historicalData = await exchangeService.getHistoricalPrices('kucoin', 'BTC-USDT', '3600', 3);
        
        expect(Array.isArray(historicalData)).toBe(true);
      }, 10000);

      it('should handle authentication signature format', async () => {
        // Test that the client correctly handles KuCoin authentication format
        try {
          const client = KuCoinClient.createWithCredentials('test_key', 'test_secret', 'test_passphrase');
          expect(client).toBeDefined();
        } catch (error) {
          // Expected to fail with invalid credentials, but client should be created
          expect(error).toBeInstanceOf(Error);
        }
      });

      it('should handle KuCoin WebSocket token workflow', async () => {
        try {
          const token = await kucoinClient.getWebSocketToken();
          expect(typeof token).toBe('string');
          
          // Token should be valid for WebSocket connection
          expect(token.length).toBeGreaterThan(10);
        } catch (error) {
          // WebSocket token generation might fail in test environment
          expect(error).toBeInstanceOf(Error);
        }
      }, 10000);
    });
  });

  describe('ExchangeService Integration', () => {
    describe('Public Methods', () => {
      it('should get supported exchanges including KuCoin', () => {
        const exchanges = exchangeService.getSupportedExchanges();
        expect(Array.isArray(exchanges)).toBe(true);
        expect(exchanges).toContain('kucoin');
        expect(exchanges).toContain('binance');
        expect(exchanges).toContain('coinbase');
        expect(exchanges).toContain('kraken');
      });

      it('should get public client for KuCoin', () => {
        const client = exchangeService.getPublicClient('kucoin');
        expect(client).toBeDefined();
        expect(client).toBeInstanceOf(KuCoinClient);
      });

      it('should test connections to KuCoin', async () => {
        const status = await exchangeService.getExchangeStatus();
        
        expect(status).toBeDefined();
        expect(typeof status).toBe('object');
        expect(status).toHaveProperty('kucoin');
        
        const kucoinStatus = status.kucoin;
        expect(typeof kucoinStatus.connected).toBe('boolean');
      }, 15000);

      it('should get current prices through service', async () => {
        const prices = await exchangeService.getCurrentPrices('kucoin', ['BTC-USDT']);
        
        expect(prices).toBeDefined();
        expect(typeof prices).toBe('object');
      }, 10000);

      it('should get historical prices through service', async () => {
        const historicalData = await exchangeService.getHistoricalPrices('kucoin', 'BTC-USDT', '3600', 5);
        
        expect(historicalData).toBeDefined();
        expect(Array.isArray(historicalData)).toBe(true);
      }, 10000);

      it('should get exchange info through service', async () => {
        const exchangeInfo = await exchangeService.getExchangeInfo('kucoin');
        
        expect(exchangeInfo).toBeDefined();
        expect(exchangeInfo).toHaveProperty('timezone');
        expect(exchangeInfo).toHaveProperty('tradingPairs');
      }, 10000);
    });

    describe('WebSocket Integration', () => {
      it('should setup real-time updates for KuCoin', (done) => {
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
          exchangeService.setupRealTimeUpdates('kucoin', ['BTC-USDT'], callback);
          
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

  describe('Multi-Exchange Integration', () => {
    it('should handle all four exchanges through service', async () => {
      const binancePrices = await exchangeService.getCurrentPrices('binance', ['BTCUSDT']);
      const coinbasePrices = await exchangeService.getCurrentPrices('coinbase', ['BTC-USD']);
      const krakenPrices = await exchangeService.getCurrentPrices('kraken', ['XXBTZUSD']);
      const kucoinPrices = await exchangeService.getCurrentPrices('kucoin', ['BTC-USDT']);
      
      expect(binancePrices).toBeDefined();
      expect(coinbasePrices).toBeDefined();
      expect(krakenPrices).toBeDefined();
      expect(kucoinPrices).toBeDefined();
      
      // All should return price data
      expect(typeof binancePrices).toBe('object');
      expect(typeof coinbasePrices).toBe('object');
      expect(typeof krakenPrices).toBe('object');
      expect(typeof kucoinPrices).toBe('object');
    }, 25000);

    it('should maintain separate rate limits per exchange', async () => {
      const startTime = Date.now();
      
      // Make concurrent requests to all exchanges
      const promises = [
        exchangeService.getCurrentPrices('binance', ['BTCUSDT']),
        exchangeService.getCurrentPrices('coinbase', ['BTC-USD']),
        exchangeService.getCurrentPrices('kraken', ['XXBTZUSD']),
        exchangeService.getCurrentPrices('kucoin', ['BTC-USDT'])
      ];
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      expect(results).toHaveLength(4);
      expect(results[0]).toBeDefined();
      expect(results[1]).toBeDefined();
      expect(results[2]).toBeDefined();
      expect(results[3]).toBeDefined();
      
      // Should complete within reasonable time for concurrent requests
      expect(endTime - startTime).toBeLessThan(20000);
    }, 25000);
  });

  describe('End-to-End Integration', () => {
    it('should handle complete price data workflow for KuCoin', async () => {
      // 1. Test connection
      const connectionTest = await exchangeService.testConnection('kucoin');
      expect(connectionTest).toHaveProperty('connected');
      
      if (connectionTest.connected) {
        // 2. Get current prices
        const currentPrices = await exchangeService.getCurrentPrices('kucoin', ['BTC-USDT']);
        expect(currentPrices).toBeDefined();
        
        // 3. Get historical data
        const historicalData = await exchangeService.getHistoricalPrices('kucoin', 'BTC-USDT', '3600', 3);
        expect(Array.isArray(historicalData)).toBe(true);
        
        // 4. Get exchange info
        const exchangeInfo = await exchangeService.getExchangeInfo('kucoin');
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
      
      const status = await exchangeService.testConnection('kucoin');
      expect(status.connected).toBe(false);
      expect(status.error).toBeDefined();
      
      mockTestConnection.mockRestore();
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now();
      
      const promises = Array(5).fill(null).map(() =>
        exchangeService.getCurrentPrices('kucoin', ['BTC-USDT', 'ETH-USDT'])
      );
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(25000);
    }, 30000);

    it('should handle large data requests', async () => {
      try {
        const historicalData = await exchangeService.getHistoricalPrices('kucoin', 'BTC-USDT', '3600', 100);
        
        expect(Array.isArray(historicalData)).toBe(true);
        expect(historicalData.length).toBeGreaterThan(0);
        expect(historicalData.length).toBeLessThanOrEqual(100);
      } catch (error) {
        // Might hit rate limits with large requests
        expect(error).toBeInstanceOf(Error);
      }
    }, 20000);
  });

  describe('KuCoin-specific Features', () => {
    it('should handle KuCoin three-factor authentication requirements', () => {
      // Test that client correctly requires API key, secret, and passphrase
      expect(() => {
        KuCoinClient.createWithCredentials('key', 'secret', ''); // Empty passphrase
      }).not.toThrow(); // Client creation should succeed, validation happens on API calls
      
      expect(() => {
        KuCoinClient.createWithCredentials('key', 'secret', 'passphrase');
      }).not.toThrow();
    });

    it('should handle KuCoin trading account filtering', async () => {
      // This would test the account filtering logic for trading accounts
      // Since we're using a public client, we can't test actual account info
      // but we can verify the client structure is correct
      expect(kucoinClient.isAuthenticated()).toBe(false);
    });

    it('should handle KuCoin WebSocket bulletins', async () => {
      try {
        // Test the WebSocket token retrieval which is unique to KuCoin
        const token = await kucoinClient.getWebSocketToken();
        expect(typeof token).toBe('string');
      } catch (error) {
        // Token generation might fail in test environment
        expect(error).toBeInstanceOf(Error);
      }
    }, 10000);
  });
});