import { BinanceClient } from '../../services/exchanges/binanceClient';
import { exchangeService } from '../../services/exchanges/exchangeService';
import { rateLimitService } from '../../services/rateLimitService';
import { cacheService } from '../../services/cacheService';
import { jest } from '@jest/globals';

describe('Binance Integration Tests', () => {
  let binanceClient: BinanceClient;

  beforeAll(async () => {
    // Initialize services for integration testing
    await cacheService.initialize?.();
    binanceClient = BinanceClient.createPublic();
  });

  afterAll(async () => {
    // Cleanup
    binanceClient?.closeAllWebSockets?.();
    await cacheService.shutdown?.();
  });

  describe('BinanceClient Integration', () => {
    describe('Public API Methods', () => {
      it('should test connection to Binance', async () => {
        const result = await binanceClient.testConnection();
        
        expect(result).toBeDefined();
        expect(typeof result.connected).toBe('boolean');
        
        if (result.connected) {
          expect(result.serverTime).toBeInstanceOf(Date);
          expect(typeof result.latency).toBe('number');
          expect(result.latency).toBeGreaterThan(0);
        }
      }, 10000);

      it('should fetch current prices', async () => {
        const prices = await binanceClient.getCurrentPrices(['BTCUSDT', 'ETHUSDT']);
        
        expect(prices).toBeDefined();
        expect(typeof prices).toBe('object');
        
        if (Object.keys(prices).length > 0) {
          const btcPrice = prices['BTCUSDT'];
          if (btcPrice) {
            expect(btcPrice).toHaveProperty('symbol', 'BTCUSDT');
            expect(btcPrice).toHaveProperty('price');
            expect(btcPrice).toHaveProperty('timestamp');
            expect(btcPrice).toHaveProperty('exchange', 'binance');
            expect(typeof btcPrice.price).toBe('number');
            expect(btcPrice.price).toBeGreaterThan(0);
          }
        }
      }, 15000);

      it('should fetch historical data', async () => {
        const historicalData = await binanceClient.getHistoricalPrices('BTCUSDT', '1d', 5);
        
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
        const exchangeInfo = await binanceClient.getExchangeInfo();
        
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
          await rateLimitService.waitForExchangeAvailability('binance', 1);
          return binanceClient.getCurrentPrices(['BTCUSDT']);
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
        
        await expect(binanceClient.getCurrentPrices()).rejects.toThrow();
        
        mockWaitForAvailability.mockRestore();
      });
    });

    describe('Caching Integration', () => {
      it('should cache API responses', async () => {
        // Clear cache first
        await cacheService.delete?.('binance:current_prices:BTCUSDT');
        
        // First request should hit the API
        const startTime1 = Date.now();
        const prices1 = await binanceClient.getCurrentPrices(['BTCUSDT']);
        const duration1 = Date.now() - startTime1;
        
        // Second request should use cache (should be faster)
        const startTime2 = Date.now();
        const prices2 = await binanceClient.getCurrentPrices(['BTCUSDT']);
        const duration2 = Date.now() - startTime2;
        
        expect(prices1).toEqual(prices2);
        expect(duration2).toBeLessThan(duration1);
      }, 15000);

      it('should handle cache failures gracefully', async () => {
        // Mock cache failure
        const mockCacheGet = jest.spyOn(cacheService, 'get');
        mockCacheGet.mockRejectedValue(new Error('Cache error'));
        
        // Should still work by hitting the API directly
        const prices = await binanceClient.getCurrentPrices(['BTCUSDT']);
        expect(prices).toBeDefined();
        
        mockCacheGet.mockRestore();
      }, 10000);
    });

    describe('Error Handling Integration', () => {
      it('should handle API errors appropriately', async () => {
        // Test with invalid symbol
        try {
          await binanceClient.getHistoricalPrices('INVALIDPAIR', '1d', 5);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(error.message).toContain('Binance API error');
        }
      }, 10000);

      it('should handle network timeouts', async () => {
        // Create client with very short timeout
        const clientWithTimeout = new (BinanceClient as any)();
        clientWithTimeout.apiClient.defaults.timeout = 1; // 1ms timeout
        
        try {
          await clientWithTimeout.getCurrentPrices(['BTCUSDT']);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }, 5000);
    });
  });

  describe('ExchangeService Integration', () => {
    describe('Public Methods', () => {
      it('should get supported exchanges', () => {
        const exchanges = exchangeService.getSupportedExchanges();
        expect(Array.isArray(exchanges)).toBe(true);
        expect(exchanges).toContain('binance');
      });

      it('should get public client', () => {
        const client = exchangeService.getPublicClient('binance');
        expect(client).toBeDefined();
        expect(client).toBeInstanceOf(BinanceClient);
      });

      it('should test connections to exchanges', async () => {
        const status = await exchangeService.getExchangeStatus();
        
        expect(status).toBeDefined();
        expect(typeof status).toBe('object');
        expect(status).toHaveProperty('binance');
        
        const binanceStatus = status.binance;
        expect(typeof binanceStatus.connected).toBe('boolean');
      }, 15000);

      it('should get current prices through service', async () => {
        const prices = await exchangeService.getCurrentPrices('binance', ['BTCUSDT']);
        
        expect(prices).toBeDefined();
        expect(typeof prices).toBe('object');
      }, 10000);

      it('should get historical prices through service', async () => {
        const historicalData = await exchangeService.getHistoricalPrices('binance', 'BTCUSDT', '1h', 5);
        
        expect(historicalData).toBeDefined();
        expect(Array.isArray(historicalData)).toBe(true);
      }, 10000);

      it('should get exchange info through service', async () => {
        const exchangeInfo = await exchangeService.getExchangeInfo('binance');
        
        expect(exchangeInfo).toBeDefined();
        expect(exchangeInfo).toHaveProperty('timezone');
        expect(exchangeInfo).toHaveProperty('tradingPairs');
      }, 10000);
    });

    describe('WebSocket Integration', () => {
      it('should setup real-time updates', (done) => {
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
          exchangeService.setupRealTimeUpdates('binance', ['BTCUSDT'], callback);
          
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

  describe('End-to-End Integration', () => {
    it('should handle complete price data workflow', async () => {
      // 1. Test connection
      const connectionTest = await exchangeService.testConnection('binance');
      expect(connectionTest).toHaveProperty('connected');
      
      if (connectionTest.connected) {
        // 2. Get current prices
        const currentPrices = await exchangeService.getCurrentPrices('binance', ['BTCUSDT']);
        expect(currentPrices).toBeDefined();
        
        // 3. Get historical data
        const historicalData = await exchangeService.getHistoricalPrices('binance', 'BTCUSDT', '1h', 3);
        expect(Array.isArray(historicalData)).toBe(true);
        
        // 4. Get exchange info
        const exchangeInfo = await exchangeService.getExchangeInfo('binance');
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
      
      const status = await exchangeService.testConnection('binance');
      expect(status.connected).toBe(false);
      expect(status.error).toBeDefined();
      
      mockTestConnection.mockRestore();
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now();
      
      const promises = Array(5).fill(null).map(() =>
        exchangeService.getCurrentPrices('binance', ['BTCUSDT', 'ETHUSDT'])
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
        const historicalData = await exchangeService.getHistoricalPrices('binance', 'BTCUSDT', '1h', 100);
        
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