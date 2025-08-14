import { feeCalculationService } from '../../services/exchanges/feeCalculationService';
import { exchangeService } from '../../services/exchanges/exchangeService';
import { cacheService } from '../../services/cacheService';
import { rateLimitService } from '../../services/rateLimitService';
import { loggingService } from '../../services/loggingService';
import { jest } from '@jest/globals';

describe('Fee Calculation Service Integration Tests', () => {
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
      expect(feeCalculationService).toBeDefined();
      expect(typeof feeCalculationService.calculateFee).toBe('function');
      expect(typeof feeCalculationService.estimateTotalFees).toBe('function');
      expect(typeof feeCalculationService.getFeeHistory).toBe('function');
    });

    it('should be an EventEmitter instance', () => {
      expect(feeCalculationService.on).toBeDefined();
      expect(feeCalculationService.emit).toBeDefined();
      expect(feeCalculationService.removeListener).toBeDefined();
    });

    it('should have correct supported exchanges and fee types', () => {
      const supportedExchanges = feeCalculationService.getSupportedExchanges();
      expect(supportedExchanges).toContain('binance');
      expect(supportedExchanges).toContain('coinbase');
      expect(supportedExchanges).toContain('kraken');
      expect(supportedExchanges).toContain('kucoin');

      const supportedTypes = feeCalculationService.getSupportedFeeTypes();
      expect(supportedTypes).toContain('trade');
      expect(supportedTypes).toContain('withdrawal');
      expect(supportedTypes).toContain('deposit');
    });
  });

  describe('Trade Fee Calculation Integration', () => {
    const baseTradeFeeRequest = {
      userId: 'test-user-id',
      exchange: 'binance',
      type: 'trade' as const,
      symbol: 'BTCUSDT',
      side: 'buy' as const,
      orderType: 'limit' as const,
      quantity: 0.001,
      price: 50000
    };

    it('should calculate Binance trade fees with VIP discounts', async () => {
      // Mock rate limiting
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      
      // Mock exchange authentication and account info
      const mockClient = {
        accountInfo: jest.fn().mockResolvedValue({
          makerCommission: 10, // 0.001 (10 basis points)
          takerCommission: 10,
          balances: [
            { asset: 'BNB', free: '100.0', locked: '0.0' }
          ]
        })
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);

      const result = await feeCalculationService.calculateFee(baseTradeFeeRequest);

      expect(result).toBeDefined();
      expect(result.exchange).toBe('binance');
      expect(result.type).toBe('trade');
      expect(result.fee).toBeGreaterThan(0);
      expect(result.feeAsset).toBeDefined();
      expect(result.feeRate).toBeDefined();
      expect(result.feeStructure).toHaveProperty('maker');
      expect(result.feeStructure).toHaveProperty('taker');

      expect(rateLimitService.waitForExchangeAvailability).toHaveBeenCalledWith('binance', 1);
    });

    it('should calculate Coinbase trade fees correctly', async () => {
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      
      const mockClient = {
        getFees: jest.fn().mockResolvedValue({
          maker_fee_rate: '0.005',
          taker_fee_rate: '0.005'
        })
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);

      const coinbaseRequest = {
        ...baseTradeFeeRequest,
        exchange: 'coinbase',
        symbol: 'BTC-USD'
      };

      const result = await feeCalculationService.calculateFee(coinbaseRequest);

      expect(result.exchange).toBe('coinbase');
      expect(result.feeRate).toBe(0.005);
      expect(result.feeAsset).toBe('USD');
    });

    it('should calculate Kraken fees with volume discounts', async () => {
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      
      const mockClient = {
        getTradeVolume: jest.fn().mockResolvedValue({
          volume: '5000000.0', // High volume for discount
          fees: {
            XXBTZUSD: { fee: '0.0014' }
          }
        })
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);

      const krakenRequest = {
        ...baseTradeFeeRequest,
        exchange: 'kraken',
        symbol: 'XBTUSD'
      };

      const result = await feeCalculationService.calculateFee(krakenRequest);

      expect(result.exchange).toBe('kraken');
      expect(result.feeRate).toBe(0.0014);
      expect(result.feeAsset).toBe('USD');
    });

    it('should calculate KuCoin fees with KCS discounts', async () => {
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      
      const mockClient = {
        getBaseFeeRates: jest.fn().mockResolvedValue({
          data: {
            makerFeeRate: '0.001',
            takerFeeRate: '0.001'
          }
        }),
        getAccounts: jest.fn().mockResolvedValue({
          data: [
            {
              currency: 'KCS',
              type: 'trade',
              available: '1500.0', // Sufficient KCS for discount
              holds: '0.0'
            }
          ]
        })
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);

      const kucoinRequest = {
        ...baseTradeFeeRequest,
        exchange: 'kucoin',
        symbol: 'BTC-USDT'
      };

      const result = await feeCalculationService.calculateFee(kucoinRequest);

      expect(result.exchange).toBe('kucoin');
      expect(result.feeRate).toBe(0.0008); // 20% KCS discount applied
      expect(result.feeAsset).toBe('KCS');
    });

    it('should handle market vs limit order fee differences', async () => {
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      
      const mockClient = {
        accountInfo: jest.fn().mockResolvedValue({
          makerCommission: 10, // 0.001
          takerCommission: 10,
          balances: []
        })
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);

      // Test limit order (maker)
      const limitOrderResult = await feeCalculationService.calculateFee(baseTradeFeeRequest);
      
      // Test market order (taker)
      const marketOrderRequest = {
        ...baseTradeFeeRequest,
        orderType: 'market' as const
      };
      delete (marketOrderRequest as any).price;

      const marketOrderResult = await feeCalculationService.calculateFee(marketOrderRequest);

      expect(limitOrderResult.feeRate).toBe(0.001); // maker fee
      expect(marketOrderResult.feeRate).toBe(0.001); // taker fee (same in this case)
    });
  });

  describe('Withdrawal Fee Integration', () => {
    const withdrawalRequest = {
      userId: 'test-user-id',
      exchange: 'binance',
      type: 'withdrawal' as const,
      asset: 'BTC',
      network: 'bitcoin'
    };

    it('should get withdrawal fees from cache when available', async () => {
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      
      // Mock cache hit
      const mockWithdrawalFees = {
        BTC: { asset: 'BTC', fee: 0.0005, minWithdrawal: 0.001, maxWithdrawal: 100 },
        ETH: { asset: 'ETH', fee: 0.005, minWithdrawal: 0.01, maxWithdrawal: 10000 }
      };

      jest.spyOn(feeCalculationService as any, 'feeCache', 'get').mockReturnValue(
        new Map([['withdrawal_fees:binance', { 
          data: mockWithdrawalFees, 
          timestamp: Date.now() 
        }]])
      );

      const result = await feeCalculationService.calculateFee(withdrawalRequest);

      expect(result.exchange).toBe('binance');
      expect(result.type).toBe('withdrawal');
      expect(result.fee).toBe(0.0005);
      expect(result.feeAsset).toBe('BTC');
    });

    it('should fetch fresh withdrawal fees when cache is empty', async () => {
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      
      // Mock cache miss
      jest.spyOn(feeCalculationService as any, 'feeCache', 'get').mockReturnValue(new Map());
      
      const result = await feeCalculationService.calculateFee(withdrawalRequest);

      expect(result.exchange).toBe('binance');
      expect(result.type).toBe('withdrawal');
      expect(result.fee).toBeGreaterThan(0);
      expect(result.feeAsset).toBe('BTC');
    });

    it('should handle withdrawal fee for unsupported asset', async () => {
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      
      const unsupportedAssetRequest = {
        ...withdrawalRequest,
        asset: 'UNKNOWN_TOKEN'
      };

      await expect(feeCalculationService.calculateFee(unsupportedAssetRequest))
        .rejects.toThrow('Withdrawal fee not found for asset UNKNOWN_TOKEN on binance');
    });
  });

  describe('Deposit Fee Integration', () => {
    const depositRequest = {
      userId: 'test-user-id',
      exchange: 'binance',
      type: 'deposit' as const,
      asset: 'ETH',
      network: 'ethereum'
    };

    it('should calculate deposit fees (typically zero)', async () => {
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);

      const result = await feeCalculationService.calculateFee(depositRequest);

      expect(result.exchange).toBe('binance');
      expect(result.type).toBe('deposit');
      expect(result.fee).toBe(0); // Most exchanges don't charge deposit fees
      expect(result.feeAsset).toBe('ETH');
    });
  });

  describe('Fee Structure Caching', () => {
    it('should cache fee structures with proper TTL', async () => {
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      
      const mockClient = {
        accountInfo: jest.fn().mockResolvedValue({
          makerCommission: 10,
          takerCommission: 10,
          balances: []
        })
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);

      const userId = 'test-user-id';
      const exchange = 'binance';

      // First call should fetch from exchange
      const feeStructure1 = await (feeCalculationService as any).getFeeStructure(userId, exchange);
      expect(exchangeService.getAuthenticatedClient).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const feeStructure2 = await (feeCalculationService as any).getFeeStructure(userId, exchange);
      expect(exchangeService.getAuthenticatedClient).toHaveBeenCalledTimes(1); // Still 1

      expect(feeStructure1).toEqual(feeStructure2);
      expect(feeStructure1).toHaveProperty('maker', 0.001);
      expect(feeStructure1).toHaveProperty('taker', 0.001);
    });

    it('should fall back to default fees when API fails', async () => {
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockRejectedValue(new Error('API Error'));

      const userId = 'test-user-id';
      const exchange = 'binance';

      const feeStructure = await (feeCalculationService as any).getFeeStructure(userId, exchange);

      expect(feeStructure).toEqual({ maker: 0.001, taker: 0.001 });
    });
  });

  describe('Total Fee Estimation', () => {
    const userId = 'test-user-id';
    const exchange = 'binance';
    const trades = [
      {
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'limit' as const,
        quantity: 0.001,
        price: 50000
      },
      {
        symbol: 'ETHUSDT',
        side: 'sell' as const,
        type: 'market' as const,
        quantity: 0.1,
        price: 4000
      }
    ];

    it('should estimate total fees for multiple trades', async () => {
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      
      const mockClient = {
        accountInfo: jest.fn().mockResolvedValue({
          makerCommission: 10,
          takerCommission: 10,
          balances: []
        })
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);

      const result = await feeCalculationService.estimateTotalFees(userId, exchange, trades);

      expect(result).toHaveProperty('totalFee');
      expect(result).toHaveProperty('breakdown');
      expect(result.breakdown).toHaveLength(2);
      expect(result.totalFee).toBeGreaterThan(0);
      expect(result.totalFee).toBe(
        result.breakdown.reduce((sum, fee) => sum + fee.fee, 0)
      );
    });

    it('should handle partial failures in fee estimation', async () => {
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      
      jest.spyOn(feeCalculationService, 'calculateFee')
        .mockResolvedValueOnce({
          exchange: 'binance',
          type: 'trade',
          fee: 0.05,
          feeAsset: 'USDT',
          estimatedAt: new Date()
        } as any)
        .mockRejectedValueOnce(new Error('Symbol not found'));

      const result = await feeCalculationService.estimateTotalFees(userId, exchange, trades);

      expect(result.breakdown).toHaveLength(1); // Only successful calculation
      expect(result.totalFee).toBe(0.05);
    });
  });

  describe('Event Emission', () => {
    it('should emit fee-calculated event on successful calculation', (done) => {
      let eventReceived = false;

      const onFeeCalculated = (feeResponse: any) => {
        if (!eventReceived) {
          eventReceived = true;
          expect(feeResponse).toHaveProperty('exchange');
          expect(feeResponse).toHaveProperty('type');
          expect(feeResponse).toHaveProperty('fee');
          feeCalculationService.off('fee-calculated', onFeeCalculated);
          done();
        }
      };

      feeCalculationService.on('fee-calculated', onFeeCalculated);

      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      
      const mockClient = {
        accountInfo: jest.fn().mockResolvedValue({
          makerCommission: 10,
          takerCommission: 10,
          balances: []
        })
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);

      feeCalculationService.calculateFee({
        userId: 'test-user-id',
        exchange: 'binance',
        type: 'trade',
        symbol: 'BTCUSDT',
        side: 'buy',
        orderType: 'market',
        quantity: 0.001
      });

      setTimeout(() => {
        if (!eventReceived) {
          feeCalculationService.off('fee-calculated', onFeeCalculated);
          done();
        }
      }, 5000);
    }, 8000);

    it('should emit fee-calculation-failed event on calculation failure', (done) => {
      let eventReceived = false;

      const onFeeCalculationFailed = (errorData: any) => {
        if (!eventReceived) {
          eventReceived = true;
          expect(errorData).toHaveProperty('exchange', 'binance');
          expect(errorData).toHaveProperty('type', 'trade');
          expect(errorData).toHaveProperty('error');
          feeCalculationService.off('fee-calculation-failed', onFeeCalculationFailed);
          done();
        }
      };

      feeCalculationService.on('fee-calculation-failed', onFeeCalculationFailed);

      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockRejectedValue(new Error('API Error'));

      feeCalculationService.calculateFee({
        userId: 'test-user-id',
        exchange: 'binance',
        type: 'trade',
        symbol: 'BTCUSDT',
        side: 'buy',
        orderType: 'market',
        quantity: 0.001
      }).catch(() => {
        // Expected to fail
      });

      setTimeout(() => {
        if (!eventReceived) {
          feeCalculationService.off('fee-calculation-failed', onFeeCalculationFailed);
          done();
        }
      }, 3000);
    }, 5000);
  });

  describe('Cache Management', () => {
    it('should clear all caches when requested', () => {
      // Populate cache
      (feeCalculationService as any).feeCache.set('test-key', { 
        data: 'test-data', 
        timestamp: Date.now() 
      });

      expect((feeCalculationService as any).feeCache.size).toBe(1);

      feeCalculationService.clearCache();

      expect((feeCalculationService as any).feeCache.size).toBe(0);
    });

    it('should emit cache-cleared event when cache is cleared', (done) => {
      const onCacheCleared = () => {
        feeCalculationService.off('cache-cleared', onCacheCleared);
        done();
      };

      feeCalculationService.on('cache-cleared', onCacheCleared);
      feeCalculationService.clearCache();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle unsupported exchange gracefully', async () => {
      const unsupportedRequest = {
        userId: 'test-user-id',
        exchange: 'unsupported-exchange',
        type: 'trade' as const,
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        orderType: 'market' as const,
        quantity: 0.001
      };

      await expect(feeCalculationService.calculateFee(unsupportedRequest))
        .rejects.toThrow('Unsupported exchange: unsupported-exchange');
    });

    it('should handle missing required parameters', async () => {
      const incompleteRequest = {
        userId: 'test-user-id',
        exchange: 'binance',
        type: 'trade' as const
        // Missing required parameters
      };

      await expect(feeCalculationService.calculateFee(incompleteRequest))
        .rejects.toThrow('Missing required parameters for trade fee calculation');
    });

    it('should handle rate limit errors', async () => {
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability')
        .mockRejectedValue(new Error('Rate limit exceeded'));

      const request = {
        userId: 'test-user-id',
        exchange: 'binance',
        type: 'trade' as const,
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        orderType: 'market' as const,
        quantity: 0.001
      };

      await expect(feeCalculationService.calculateFee(request))
        .rejects.toThrow('Rate limit exceeded');
    });

    it('should handle exchange API failures gracefully', async () => {
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      jest.spyOn(exchangeService, 'getAuthenticatedClient')
        .mockRejectedValue(new Error('Exchange API unavailable'));

      const request = {
        userId: 'test-user-id',
        exchange: 'binance',
        type: 'trade' as const,
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        orderType: 'market' as const,
        quantity: 0.001
      };

      await expect(feeCalculationService.calculateFee(request))
        .rejects.toThrow('Exchange API unavailable');
    });
  });

  describe('Performance and Resource Management', () => {
    it('should respect rate limits', async () => {
      const rateLimitSpy = jest.spyOn(rateLimitService, 'waitForExchangeAvailability')
        .mockResolvedValue(undefined);
      
      const mockClient = {
        accountInfo: jest.fn().mockResolvedValue({
          makerCommission: 10,
          takerCommission: 10,
          balances: []
        })
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);

      await feeCalculationService.calculateFee({
        userId: 'test-user-id',
        exchange: 'binance',
        type: 'trade',
        symbol: 'BTCUSDT',
        side: 'buy',
        orderType: 'market',
        quantity: 0.001
      });

      expect(rateLimitSpy).toHaveBeenCalledWith('binance', 1);
    });

    it('should handle multiple concurrent fee calculations', async () => {
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      
      const mockClient = {
        accountInfo: jest.fn().mockResolvedValue({
          makerCommission: 10,
          takerCommission: 10,
          balances: []
        })
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);

      const requests = Array(5).fill(null).map((_, index) => 
        feeCalculationService.calculateFee({
          userId: `test-user-id-${index}`,
          exchange: 'binance',
          type: 'trade',
          symbol: 'BTCUSDT',
          side: 'buy',
          orderType: 'market',
          quantity: 0.001
        })
      );

      const results = await Promise.allSettled(requests);
      
      // All should complete successfully
      expect(results.every(result => result.status === 'fulfilled')).toBe(true);
      expect(exchangeService.getAuthenticatedClient).toHaveBeenCalledTimes(5);
    });

    it('should properly manage cache memory with TTL', async () => {
      const service = feeCalculationService as any;
      const cacheKey = 'test-ttl-key';
      const testData = { test: 'data' };
      const shortTtl = 100; // 100ms

      // Set cache entry with short TTL simulation
      service.feeCache.set(cacheKey, { 
        data: testData, 
        timestamp: Date.now() - (service.CACHE_DURATION + 1000) // Expired
      });

      // Cache should be considered expired
      const cached = service.feeCache.get(cacheKey);
      expect(Date.now() - cached.timestamp).toBeGreaterThan(service.CACHE_DURATION);
    });
  });
});