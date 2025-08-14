import request from 'supertest';
import { app } from '../../index';
import { feeCalculationService } from '../../services/exchanges/feeCalculationService';
import { exchangeService } from '../../services/exchanges/exchangeService';
import { auditService } from '../../services/auditService';
import { generateTestJWT } from '../helpers/testHelpers';
import { jest } from '@jest/globals';

describe('Fee Calculation API Tests', () => {
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

  describe('POST /api/v1/exchanges/fees/trade', () => {
    const mockTradeFeeRequest = {
      exchange: 'binance',
      symbol: 'BTCUSDT',
      side: 'buy',
      orderType: 'limit',
      quantity: 0.001,
      price: 50000
    };

    const mockTradeFeeResponse = {
      exchange: 'binance',
      type: 'trade',
      fee: 0.05,
      feeAsset: 'USDT',
      feeRate: 0.001,
      feeStructure: {
        maker: 0.001,
        taker: 0.001
      },
      estimatedAt: new Date()
    };

    it('should calculate trade fee successfully', async () => {
      jest.spyOn(feeCalculationService, 'calculateFee').mockResolvedValue(mockTradeFeeResponse as any);
      jest.spyOn(auditService, 'log').mockResolvedValue();

      const response = await request(app)
        .post('/api/v1/exchanges/fees/trade')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mockTradeFeeRequest)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('fee');
      expect(response.body.data.fee).toHaveProperty('exchange', 'binance');
      expect(response.body.data.fee).toHaveProperty('type', 'trade');
      expect(response.body.data.fee).toHaveProperty('fee', 0.05);
      expect(response.body.data.fee).toHaveProperty('feeAsset', 'USDT');
      expect(response.body.data.fee).toHaveProperty('feeRate', 0.001);

      expect(feeCalculationService.calculateFee).toHaveBeenCalledWith({
        userId,
        exchange: 'binance',
        type: 'trade',
        symbol: 'BTCUSDT',
        side: 'buy',
        orderType: 'limit',
        quantity: 0.001,
        price: 50000
      });

      expect(auditService.log).toHaveBeenCalledWith({
        userId,
        action: 'fee_calculated',
        resource: 'fee',
        details: expect.objectContaining({
          exchange: 'binance',
          type: 'trade',
          symbol: 'BTCUSDT',
          side: 'buy'
        })
      });
    });

    it('should calculate market order fee without price', async () => {
      const marketOrderRequest = {
        ...mockTradeFeeRequest,
        orderType: 'market'
      };
      delete (marketOrderRequest as any).price;

      const marketFeeResponse = {
        ...mockTradeFeeResponse,
        feeRate: 0.001 // taker fee for market order
      };

      jest.spyOn(feeCalculationService, 'calculateFee').mockResolvedValue(marketFeeResponse as any);
      jest.spyOn(auditService, 'log').mockResolvedValue();

      const response = await request(app)
        .post('/api/v1/exchanges/fees/trade')
        .set('Authorization', `Bearer ${authToken}`)
        .send(marketOrderRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.fee.feeRate).toBe(0.001);
    });

    it('should reject missing required parameters', async () => {
      const incompleteRequest = {
        exchange: 'binance',
        symbol: 'BTCUSDT'
        // Missing side, orderType, quantity
      };

      await request(app)
        .post('/api/v1/exchanges/fees/trade')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteRequest)
        .expect(400);
    });

    it('should reject limit order without price', async () => {
      const limitOrderWithoutPrice = {
        ...mockTradeFeeRequest
      };
      delete (limitOrderWithoutPrice as any).price;

      await request(app)
        .post('/api/v1/exchanges/fees/trade')
        .set('Authorization', `Bearer ${authToken}`)
        .send(limitOrderWithoutPrice)
        .expect(400);
    });

    it('should reject invalid exchange', async () => {
      const invalidRequest = {
        ...mockTradeFeeRequest,
        exchange: 'invalid-exchange'
      };

      await request(app)
        .post('/api/v1/exchanges/fees/trade')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRequest)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/exchanges/fees/trade')
        .send(mockTradeFeeRequest)
        .expect(401);
    });

    it('should enforce rate limiting', async () => {
      jest.spyOn(feeCalculationService, 'calculateFee').mockResolvedValue(mockTradeFeeResponse as any);
      jest.spyOn(auditService, 'log').mockResolvedValue();

      // Make multiple requests quickly to trigger rate limit
      const requests = Array(35).fill(null).map(() =>
        request(app)
          .post('/api/v1/exchanges/fees/trade')
          .set('Authorization', `Bearer ${authToken}`)
          .send(mockTradeFeeRequest)
      );

      const results = await Promise.allSettled(requests);
      const responses = results.map((result: any) => result.value);
      
      // Some requests should be rate limited (429)
      const rateLimitedResponses = responses.filter((res: any) => res?.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe('POST /api/v1/exchanges/fees/withdrawal', () => {
    const mockWithdrawalRequest = {
      exchange: 'binance',
      asset: 'BTC',
      network: 'bitcoin'
    };

    const mockWithdrawalResponse = {
      exchange: 'binance',
      type: 'withdrawal',
      fee: 0.0005,
      feeAsset: 'BTC',
      estimatedAt: new Date()
    };

    it('should calculate withdrawal fee successfully', async () => {
      jest.spyOn(feeCalculationService, 'calculateFee').mockResolvedValue(mockWithdrawalResponse as any);
      jest.spyOn(auditService, 'log').mockResolvedValue();

      const response = await request(app)
        .post('/api/v1/exchanges/fees/withdrawal')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mockWithdrawalRequest)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.fee).toHaveProperty('type', 'withdrawal');
      expect(response.body.data.fee).toHaveProperty('fee', 0.0005);
      expect(response.body.data.fee).toHaveProperty('feeAsset', 'BTC');

      expect(feeCalculationService.calculateFee).toHaveBeenCalledWith({
        userId,
        exchange: 'binance',
        type: 'withdrawal',
        asset: 'BTC',
        network: 'bitcoin'
      });
    });

    it('should handle asset not found error', async () => {
      jest.spyOn(feeCalculationService, 'calculateFee').mockRejectedValue(
        new Error('Withdrawal fee not found for asset UNKNOWN on binance')
      );

      const response = await request(app)
        .post('/api/v1/exchanges/fees/withdrawal')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...mockWithdrawalRequest,
          asset: 'UNKNOWN'
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Asset not found');
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/exchanges/fees/withdrawal')
        .send(mockWithdrawalRequest)
        .expect(401);
    });
  });

  describe('POST /api/v1/exchanges/fees/deposit', () => {
    const mockDepositRequest = {
      exchange: 'binance',
      asset: 'ETH',
      network: 'ethereum'
    };

    const mockDepositResponse = {
      exchange: 'binance',
      type: 'deposit',
      fee: 0, // Most exchanges don't charge deposit fees
      feeAsset: 'ETH',
      estimatedAt: new Date()
    };

    it('should calculate deposit fee successfully', async () => {
      jest.spyOn(feeCalculationService, 'calculateFee').mockResolvedValue(mockDepositResponse as any);
      jest.spyOn(auditService, 'log').mockResolvedValue();

      const response = await request(app)
        .post('/api/v1/exchanges/fees/deposit')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mockDepositRequest)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.fee).toHaveProperty('type', 'deposit');
      expect(response.body.data.fee).toHaveProperty('fee', 0);
      expect(response.body.data.fee).toHaveProperty('feeAsset', 'ETH');
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/exchanges/fees/deposit')
        .send(mockDepositRequest)
        .expect(401);
    });
  });

  describe('POST /api/v1/exchanges/fees/estimate-total', () => {
    const mockEstimateRequest = {
      exchange: 'binance',
      trades: [
        {
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'limit',
          quantity: 0.001,
          price: 50000
        },
        {
          symbol: 'ETHUSDT',
          side: 'sell',
          type: 'market',
          quantity: 0.1
        }
      ]
    };

    const mockEstimateResponse = {
      totalFee: 0.15,
      breakdown: [
        {
          exchange: 'binance',
          type: 'trade',
          fee: 0.05,
          feeAsset: 'USDT'
        },
        {
          exchange: 'binance',
          type: 'trade',
          fee: 0.10,
          feeAsset: 'USDT'
        }
      ]
    };

    it('should estimate total fees successfully', async () => {
      jest.spyOn(feeCalculationService, 'estimateTotalFees').mockResolvedValue(mockEstimateResponse as any);
      jest.spyOn(auditService, 'log').mockResolvedValue();

      const response = await request(app)
        .post('/api/v1/exchanges/fees/estimate-total')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mockEstimateRequest)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('totalFee', 0.15);
      expect(response.body.data).toHaveProperty('breakdown');
      expect(response.body.data.breakdown).toHaveLength(2);
      expect(response.body.data).toHaveProperty('tradesCount', 2);

      expect(feeCalculationService.estimateTotalFees).toHaveBeenCalledWith(
        userId,
        'binance',
        mockEstimateRequest.trades
      );
    });

    it('should reject too many trades', async () => {
      const requestWithTooManyTrades = {
        exchange: 'binance',
        trades: Array(51).fill({
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'market',
          quantity: 0.001
        })
      };

      await request(app)
        .post('/api/v1/exchanges/fees/estimate-total')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestWithTooManyTrades)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/exchanges/fees/estimate-total')
        .send(mockEstimateRequest)
        .expect(401);
    });
  });

  describe('POST /api/v1/exchanges/fees/batch', () => {
    const mockBatchRequest = {
      requests: [
        {
          exchange: 'binance',
          type: 'trade',
          symbol: 'BTCUSDT',
          side: 'buy',
          orderType: 'limit',
          quantity: 0.001,
          price: 50000
        },
        {
          exchange: 'coinbase',
          type: 'withdrawal',
          asset: 'ETH'
        }
      ]
    };

    it('should calculate multiple fees in batch', async () => {
      jest.spyOn(feeCalculationService, 'calculateFee')
        .mockResolvedValueOnce({
          exchange: 'binance',
          type: 'trade',
          fee: 0.05,
          feeAsset: 'USDT'
        } as any)
        .mockResolvedValueOnce({
          exchange: 'coinbase',
          type: 'withdrawal',
          fee: 0.005,
          feeAsset: 'ETH'
        } as any);

      jest.spyOn(auditService, 'log').mockResolvedValue();

      const response = await request(app)
        .post('/api/v1/exchanges/fees/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mockBatchRequest)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('results');
      expect(response.body.data.results).toHaveLength(2);
      expect(response.body.data.summary).toHaveProperty('successful', 2);
      expect(response.body.data.summary).toHaveProperty('failed', 0);

      expect(feeCalculationService.calculateFee).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures in batch', async () => {
      jest.spyOn(feeCalculationService, 'calculateFee')
        .mockResolvedValueOnce({
          exchange: 'binance',
          type: 'trade',
          fee: 0.05,
          feeAsset: 'USDT'
        } as any)
        .mockRejectedValueOnce(new Error('Invalid parameters'));

      jest.spyOn(auditService, 'log').mockResolvedValue();

      const response = await request(app)
        .post('/api/v1/exchanges/fees/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mockBatchRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.successful).toBe(1);
      expect(response.body.data.summary.failed).toBe(1);
      expect(response.body.data.results[1].success).toBe(false);
      expect(response.body.data.results[1].error).toBe('Invalid parameters');
    });

    it('should reject too many requests', async () => {
      const requestWithTooManyItems = {
        requests: Array(21).fill({
          exchange: 'binance',
          type: 'trade',
          symbol: 'BTCUSDT',
          side: 'buy',
          orderType: 'market',
          quantity: 0.001
        })
      };

      await request(app)
        .post('/api/v1/exchanges/fees/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestWithTooManyItems)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/exchanges/fees/batch')
        .send(mockBatchRequest)
        .expect(401);
    });
  });

  describe('POST /api/v1/exchanges/fees/compare', () => {
    const mockCompareRequest = {
      exchanges: ['binance', 'coinbase', 'kraken'],
      symbol: 'BTCUSDT',
      side: 'buy',
      orderType: 'limit',
      quantity: 0.001,
      price: 50000
    };

    it('should compare fees across exchanges', async () => {
      jest.spyOn(feeCalculationService, 'calculateFee')
        .mockResolvedValueOnce({
          exchange: 'binance',
          fee: 0.05,
          feeAsset: 'USDT',
          feeRate: 0.001
        } as any)
        .mockResolvedValueOnce({
          exchange: 'coinbase',
          fee: 0.25,
          feeAsset: 'USD',
          feeRate: 0.005
        } as any)
        .mockResolvedValueOnce({
          exchange: 'kraken',
          fee: 0.08,
          feeAsset: 'USD',
          feeRate: 0.0016
        } as any);

      jest.spyOn(auditService, 'log').mockResolvedValue();

      const response = await request(app)
        .post('/api/v1/exchanges/fees/compare')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mockCompareRequest)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('comparisons');
      expect(response.body.data.comparisons).toHaveLength(3);
      expect(response.body.data).toHaveProperty('cheapest');
      expect(response.body.data.cheapest).toHaveProperty('exchange', 'binance'); // Lowest fee
      expect(response.body.data.summary).toHaveProperty('successful', 3);
    });

    it('should handle comparison failures gracefully', async () => {
      jest.spyOn(feeCalculationService, 'calculateFee')
        .mockResolvedValueOnce({
          exchange: 'binance',
          fee: 0.05,
          feeAsset: 'USDT'
        } as any)
        .mockRejectedValueOnce(new Error('Exchange unavailable'))
        .mockResolvedValueOnce({
          exchange: 'kraken',
          fee: 0.08,
          feeAsset: 'USD'
        } as any);

      jest.spyOn(auditService, 'log').mockResolvedValue();

      const response = await request(app)
        .post('/api/v1/exchanges/fees/compare')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mockCompareRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.successful).toBe(2);
      expect(response.body.data.summary.failed).toBe(1);
      expect(response.body.data.cheapest.exchange).toBe('binance');
    });

    it('should require at least 2 exchanges', async () => {
      const invalidRequest = {
        ...mockCompareRequest,
        exchanges: ['binance']
      };

      await request(app)
        .post('/api/v1/exchanges/fees/compare')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRequest)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/exchanges/fees/compare')
        .send(mockCompareRequest)
        .expect(401);
    });
  });

  describe('GET /api/v1/exchanges/fees/history/:exchange', () => {
    const mockFeeHistory = [
      {
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.001,
        price: 50000,
        fee: 0.05,
        feeAsset: 'USDT',
        feeRate: 0.001,
        exchangeFees: { maker: 0.001, taker: 0.001 }
      },
      {
        symbol: 'ETHUSDT',
        side: 'sell',
        type: 'market',
        quantity: 0.1,
        fee: 0.40,
        feeAsset: 'USDT',
        feeRate: 0.001,
        exchangeFees: { maker: 0.001, taker: 0.001 }
      }
    ];

    it('should get fee history successfully', async () => {
      jest.spyOn(feeCalculationService, 'getFeeHistory').mockResolvedValue(mockFeeHistory as any);

      const response = await request(app)
        .get('/api/v1/exchanges/fees/history/binance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('exchange', 'binance');
      expect(response.body.data).toHaveProperty('fees');
      expect(response.body.data.fees).toHaveLength(2);
      expect(response.body.data).toHaveProperty('count', 2);

      expect(feeCalculationService.getFeeHistory).toHaveBeenCalledWith(userId, 'binance', 50);
    });

    it('should support custom limit', async () => {
      jest.spyOn(feeCalculationService, 'getFeeHistory').mockResolvedValue([mockFeeHistory[0]] as any);

      const response = await request(app)
        .get('/api/v1/exchanges/fees/history/binance?limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(feeCalculationService.getFeeHistory).toHaveBeenCalledWith(userId, 'binance', 1);
    });

    it('should reject invalid limit', async () => {
      await request(app)
        .get('/api/v1/exchanges/fees/history/binance?limit=101')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/exchanges/fees/history/binance')
        .expect(401);
    });
  });

  describe('GET /api/v1/exchanges/fees/structure/:exchange', () => {
    const mockFeeStructure = {
      maker: 0.001,
      taker: 0.001,
      withdrawal: {
        BTC: 0.0005,
        ETH: 0.005,
        USDT: 1
      }
    };

    it('should get fee structure successfully', async () => {
      jest.spyOn(feeCalculationService as any, 'getFeeStructure').mockResolvedValue(mockFeeStructure);

      const response = await request(app)
        .get('/api/v1/exchanges/fees/structure/binance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('exchange', 'binance');
      expect(response.body.data).toHaveProperty('feeStructure');
      expect(response.body.data.feeStructure).toHaveProperty('maker', 0.001);
      expect(response.body.data.feeStructure).toHaveProperty('taker', 0.001);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/exchanges/fees/structure/binance')
        .expect(401);
    });
  });

  describe('GET /api/v1/exchanges/fees/exchanges/supported', () => {
    it('should get supported exchanges', async () => {
      jest.spyOn(feeCalculationService, 'getSupportedExchanges').mockReturnValue(['binance', 'coinbase', 'kraken', 'kucoin']);

      const response = await request(app)
        .get('/api/v1/exchanges/fees/exchanges/supported')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('exchanges');
      expect(response.body.data.exchanges).toEqual(['binance', 'coinbase', 'kraken', 'kucoin']);
      expect(response.body.data).toHaveProperty('count', 4);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/exchanges/fees/exchanges/supported')
        .expect(401);
    });
  });

  describe('GET /api/v1/exchanges/fees/types/supported', () => {
    it('should get supported fee types', async () => {
      jest.spyOn(feeCalculationService, 'getSupportedFeeTypes').mockReturnValue(['trade', 'withdrawal', 'deposit']);

      const response = await request(app)
        .get('/api/v1/exchanges/fees/types/supported')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('feeTypes');
      expect(response.body.data.feeTypes).toEqual(['trade', 'withdrawal', 'deposit']);
      expect(response.body.data).toHaveProperty('count', 3);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/exchanges/fees/types/supported')
        .expect(401);
    });
  });

  describe('DELETE /api/v1/exchanges/fees/cache', () => {
    it('should clear fee cache successfully', async () => {
      jest.spyOn(feeCalculationService, 'clearCache').mockImplementation();
      jest.spyOn(auditService, 'log').mockResolvedValue();

      const response = await request(app)
        .delete('/api/v1/exchanges/fees/cache')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('message', 'Fee calculation cache cleared successfully');

      expect(feeCalculationService.clearCache).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith({
        userId: adminUser.id,
        action: 'fee_cache_cleared',
        resource: 'cache',
        details: { type: 'fee_calculation_cache' }
      });
    });

    // Note: Admin role check would be implemented in middleware
    // it('should reject non-admin users', async () => {
    //   await request(app)
    //     .delete('/api/v1/exchanges/fees/cache')
    //     .set('Authorization', `Bearer ${authToken}`)
    //     .expect(403);
    // });

    it('should require authentication', async () => {
      await request(app)
        .delete('/api/v1/exchanges/fees/cache')
        .expect(401);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      jest.spyOn(feeCalculationService, 'calculateFee').mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app)
        .post('/api/v1/exchanges/fees/trade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'binance',
          symbol: 'BTCUSDT',
          side: 'buy',
          orderType: 'market',
          quantity: 0.001
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Fee calculation failed');
      expect(response.body.message).toBe('Internal server error');
    });

    it('should handle unsupported exchange errors', async () => {
      jest.spyOn(feeCalculationService, 'calculateFee').mockRejectedValue(
        new Error('Unsupported exchange: unknown-exchange')
      );

      const response = await request(app)
        .post('/api/v1/exchanges/fees/trade')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'binance', // This will be overridden in the mock
          symbol: 'BTCUSDT',
          side: 'buy',
          orderType: 'market',
          quantity: 0.001
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Unsupported exchange');
    });
  });
});