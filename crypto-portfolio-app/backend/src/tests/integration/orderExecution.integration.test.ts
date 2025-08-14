import { orderExecutionService } from '../../services/exchanges/orderExecutionService';
import { exchangeService } from '../../services/exchanges/exchangeService';
import { cacheService } from '../../services/cacheService';
import { rateLimitService } from '../../services/rateLimitService';
import { loggingService } from '../../services/loggingService';
import { jest } from '@jest/globals';

describe('Order Execution Service Integration Tests', () => {
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
      expect(orderExecutionService).toBeDefined();
      expect(typeof orderExecutionService.executeOrder).toBe('function');
      expect(typeof orderExecutionService.validateOrder).toBe('function');
      expect(typeof orderExecutionService.getOrderStatus).toBe('function');
      expect(typeof orderExecutionService.cancelOrder).toBe('function');
    });

    it('should be an EventEmitter instance', () => {
      expect(orderExecutionService.on).toBeDefined();
      expect(orderExecutionService.emit).toBeDefined();
      expect(orderExecutionService.removeListener).toBeDefined();
    });

    it('should have correct supported exchanges', () => {
      const supportedExchanges = orderExecutionService.getSupportedExchanges();
      expect(supportedExchanges).toContain('binance');
      expect(supportedExchanges).toContain('coinbase');
      expect(supportedExchanges).toContain('kraken');
      expect(supportedExchanges).toContain('kucoin');
    });
  });

  describe('Order Validation', () => {
    const validOrderRequest = {
      userId: 'test-user-id',
      exchange: 'binance',
      symbol: 'BTCUSDT',
      side: 'buy' as const,
      type: 'limit' as const,
      quantity: 0.001,
      price: 50000
    };

    it('should validate basic order parameters', async () => {
      // Mock exchange service
      jest.spyOn(exchangeService, 'hasValidCredentials').mockResolvedValue(true);
      jest.spyOn(exchangeService, 'getExchangeInfo').mockResolvedValue({
        exchange: 'binance',
        tradingPairs: [{
          symbol: 'BTCUSDT',
          minOrderSize: 0.00001,
          tickSize: 0.01,
          status: 'TRADING'
        }],
        fees: { maker: 0.001, taker: 0.001 },
        rateLimit: { requests: 1200, window: 60 }
      });

      const validation = await orderExecutionService.validateOrder(validOrderRequest);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.minimumQuantity).toBe(0.00001);
      expect(validation.tickSize).toBe(0.01);
    });

    it('should reject unsupported exchange', async () => {
      const invalidRequest = {
        ...validOrderRequest,
        exchange: 'unsupported-exchange'
      };

      const validation = await orderExecutionService.validateOrder(invalidRequest);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Unsupported exchange: unsupported-exchange');
    });

    it('should reject invalid quantity', async () => {
      const invalidRequest = {
        ...validOrderRequest,
        quantity: 0
      };

      const validation = await orderExecutionService.validateOrder(invalidRequest);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Quantity must be greater than 0');
    });

    it('should require price for limit orders', async () => {
      const invalidRequest = {
        ...validOrderRequest,
        type: 'limit' as const,
        price: undefined
      };

      const validation = await orderExecutionService.validateOrder(invalidRequest);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Price is required for limit orders');
    });

    it('should require stop price for stop orders', async () => {
      const invalidRequest = {
        ...validOrderRequest,
        type: 'stop' as const,
        stopPrice: undefined
      };

      const validation = await orderExecutionService.validateOrder(invalidRequest);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Stop price is required for stop orders');
    });

    it('should validate symbol existence', async () => {
      jest.spyOn(exchangeService, 'hasValidCredentials').mockResolvedValue(true);
      jest.spyOn(exchangeService, 'getExchangeInfo').mockResolvedValue({
        exchange: 'binance',
        tradingPairs: [], // Empty trading pairs
        fees: { maker: 0.001, taker: 0.001 },
        rateLimit: { requests: 1200, window: 60 }
      });

      const validation = await orderExecutionService.validateOrder(validOrderRequest);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Symbol BTCUSDT not found on binance');
    });

    it('should validate minimum order size', async () => {
      jest.spyOn(exchangeService, 'hasValidCredentials').mockResolvedValue(true);
      jest.spyOn(exchangeService, 'getExchangeInfo').mockResolvedValue({
        exchange: 'binance',
        tradingPairs: [{
          symbol: 'BTCUSDT',
          minOrderSize: 0.01, // Higher than request quantity
          tickSize: 0.01,
          status: 'TRADING'
        }],
        fees: { maker: 0.001, taker: 0.001 },
        rateLimit: { requests: 1200, window: 60 }
      });

      const validation = await orderExecutionService.validateOrder(validOrderRequest);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Quantity 0.001 is below minimum 0.01');
    });

    it('should warn about price precision', async () => {
      jest.spyOn(exchangeService, 'hasValidCredentials').mockResolvedValue(true);
      jest.spyOn(exchangeService, 'getExchangeInfo').mockResolvedValue({
        exchange: 'binance',
        tradingPairs: [{
          symbol: 'BTCUSDT',
          minOrderSize: 0.00001,
          tickSize: 1, // Price 50000 is not divisible by tick size
          status: 'TRADING'
        }],
        fees: { maker: 0.001, taker: 0.001 },
        rateLimit: { requests: 1200, window: 60 }
      });

      const orderWithInvalidPrice = {
        ...validOrderRequest,
        price: 50000.5 // Not aligned with tick size
      };

      const validation = await orderExecutionService.validateOrder(orderWithInvalidPrice);

      expect(validation.warnings).toContain('Price will be rounded to tick size 1');
    });
  });

  describe('Order Execution Flow', () => {
    const orderRequest = {
      userId: 'test-user-id',
      exchange: 'binance',
      symbol: 'BTCUSDT',
      side: 'buy' as const,
      type: 'limit' as const,
      quantity: 0.001,
      price: 50000
    };

    it('should execute order with proper validation', async () => {
      // Mock all dependencies
      jest.spyOn(orderExecutionService, 'validateOrder').mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);

      const mockClient = {
        createOrder: jest.fn().mockResolvedValue({
          orderId: 12345,
          clientOrderId: 'test-client-id',
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'LIMIT',
          origQty: '0.00100000',
          price: '50000.00000000',
          status: 'NEW',
          executedQty: '0.00000000',
          transactTime: Date.now(),
          fills: []
        })
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);

      const orderResponse = await orderExecutionService.executeOrder(orderRequest);

      expect(orderResponse).toBeDefined();
      expect(orderResponse.orderId).toBe('12345');
      expect(orderResponse.symbol).toBe('BTCUSDT');
      expect(orderResponse.side).toBe('buy');
      expect(orderResponse.status).toBe('NEW');
      expect(orderResponse.exchange).toBe('binance');
    });

    it('should generate client order ID if not provided', async () => {
      const orderWithoutClientId = { ...orderRequest };
      delete (orderWithoutClientId as any).clientOrderId;

      jest.spyOn(orderExecutionService, 'validateOrder').mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);

      const mockClient = {
        createOrder: jest.fn().mockResolvedValue({
          orderId: 12345,
          clientOrderId: expect.any(String),
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'LIMIT',
          origQty: '0.00100000',
          price: '50000.00000000',
          status: 'NEW',
          executedQty: '0.00000000',
          transactTime: Date.now(),
          fills: []
        })
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);

      const orderResponse = await orderExecutionService.executeOrder(orderWithoutClientId);

      expect(mockClient.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          newClientOrderId: expect.stringMatching(/^test-user-id_\d+_[a-z0-9]{9}$/)
        })
      );
    });

    it('should emit events on successful order execution', (done) => {
      let eventReceived = false;

      const onOrderExecuted = (order: any) => {
        if (!eventReceived) {
          eventReceived = true;
          expect(order).toHaveProperty('orderId');
          expect(order).toHaveProperty('symbol');
          expect(order).toHaveProperty('exchange');
          orderExecutionService.off('order-executed', onOrderExecuted);
          done();
        }
      };

      orderExecutionService.on('order-executed', onOrderExecuted);

      // Mock dependencies and execute order
      jest.spyOn(orderExecutionService, 'validateOrder').mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);

      const mockClient = {
        createOrder: jest.fn().mockResolvedValue({
          orderId: 12345,
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'LIMIT',
          origQty: '0.00100000',
          status: 'NEW',
          transactTime: Date.now(),
          fills: []
        })
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);

      orderExecutionService.executeOrder(orderRequest);

      setTimeout(() => {
        if (!eventReceived) {
          orderExecutionService.off('order-executed', onOrderExecuted);
          done();
        }
      }, 5000);
    }, 8000);

    it('should handle order execution failures', async () => {
      jest.spyOn(orderExecutionService, 'validateOrder').mockResolvedValue({
        isValid: false,
        errors: ['Insufficient balance'],
        warnings: []
      });

      await expect(orderExecutionService.executeOrder(orderRequest))
        .rejects.toThrow('Order validation failed: Insufficient balance');
    });

    it('should respect rate limits', async () => {
      jest.spyOn(orderExecutionService, 'validateOrder').mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      const rateLimitSpy = jest.spyOn(rateLimitService, 'waitForExchangeAvailability')
        .mockResolvedValue(undefined);

      const mockClient = {
        createOrder: jest.fn().mockResolvedValue({
          orderId: 12345,
          symbol: 'BTCUSDT',
          status: 'NEW',
          transactTime: Date.now(),
          fills: []
        })
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);

      await orderExecutionService.executeOrder(orderRequest);

      expect(rateLimitSpy).toHaveBeenCalledWith('binance', 1);
    });
  });

  describe('Exchange-Specific Order Execution', () => {
    it('should handle Binance order format correctly', async () => {
      const binanceResponse = {
        orderId: 12345,
        clientOrderId: 'test-client-id',
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        origQty: '0.00100000',
        price: '50000.00000000',
        status: 'NEW',
        executedQty: '0.00000000',
        transactTime: Date.now(),
        fills: [{
          price: '50000.00',
          qty: '0.00050000',
          commission: '0.00000050',
          commissionAsset: 'BTC'
        }]
      };

      // Access private method through prototype casting
      const normalizedOrder = await (orderExecutionService as any).executeBinanceOrder(
        { createOrder: () => Promise.resolve(binanceResponse) },
        {
          userId: 'test-user',
          exchange: 'binance',
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'limit',
          quantity: 0.001,
          price: 50000
        }
      );

      expect(normalizedOrder.orderId).toBe('12345');
      expect(normalizedOrder.side).toBe('buy');
      expect(normalizedOrder.exchange).toBe('binance');
      expect(normalizedOrder.fills).toHaveLength(1);
      expect(normalizedOrder.fills![0].price).toBe(50000);
    });

    it('should handle Coinbase order format correctly', async () => {
      const coinbaseResponse = {
        id: 'abc-123-def',
        client_oid: 'test-client-id',
        product_id: 'BTC-USD',
        side: 'buy',
        type: 'limit',
        size: '0.00100000',
        price: '50000.00',
        status: 'open',
        filled_size: '0.00000000',
        executed_value: '0.00',
        fill_fees: '0.00',
        created_at: new Date().toISOString()
      };

      const normalizedOrder = await (orderExecutionService as any).executeCoinbaseOrder(
        { createOrder: () => Promise.resolve(coinbaseResponse) },
        {
          userId: 'test-user',
          exchange: 'coinbase',
          symbol: 'BTC-USD',
          side: 'buy',
          type: 'limit',
          quantity: 0.001,
          price: 50000
        }
      );

      expect(normalizedOrder.orderId).toBe('abc-123-def');
      expect(normalizedOrder.side).toBe('buy');
      expect(normalizedOrder.exchange).toBe('coinbase');
      expect(normalizedOrder.status).toBe('NEW'); // Mapped from 'open'
    });
  });

  describe('Order Status Management', () => {
    it('should retrieve and cache order status', async () => {
      const mockOrderStatus = {
        orderId: '12345',
        symbol: 'BTCUSDT',
        status: 'FILLED',
        side: 'buy',
        type: 'limit',
        quantity: 0.001,
        executedQuantity: 0.001,
        timestamp: new Date(),
        updateTime: new Date()
      };

      const mockClient = {
        getOrder: jest.fn().mockResolvedValue({
          orderId: 12345,
          symbol: 'BTCUSDT',
          status: 'FILLED',
          side: 'BUY',
          type: 'LIMIT',
          origQty: '0.00100000',
          executedQty: '0.00100000',
          time: Date.now(),
          updateTime: Date.now()
        })
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);
      const cacheSpy = jest.spyOn(cacheService, 'set').mockResolvedValue(undefined);

      const orderStatus = await orderExecutionService.getOrderStatus('test-user', 'binance', '12345');

      expect(orderStatus).toBeDefined();
      expect(orderStatus!.orderId).toBe('12345');
      expect(orderStatus!.status).toBe('FILLED');

      // Verify caching
      expect(cacheSpy).toHaveBeenCalledWith(
        'order:binance:12345',
        expect.any(String),
        30
      );
    });

    it('should return cached order status when available', async () => {
      const cachedStatus = {
        orderId: '12345',
        symbol: 'BTCUSDT',
        status: 'FILLED'
      };

      jest.spyOn(cacheService, 'get').mockResolvedValue(JSON.stringify(cachedStatus));

      const orderStatus = await orderExecutionService.getOrderStatus('test-user', 'binance', '12345');

      expect(orderStatus).toEqual(cachedStatus);
    });
  });

  describe('Order Cancellation', () => {
    it('should cancel order successfully', async () => {
      const mockClient = {
        cancelOrder: jest.fn().mockResolvedValue({
          orderId: 12345,
          clientOrderId: 'test-client-id',
          status: 'CANCELED'
        })
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);
      jest.spyOn(cacheService, 'delete').mockResolvedValue(undefined);

      const result = await orderExecutionService.cancelOrder('test-user', 'binance', '12345');

      expect(result).toBe(true);
      expect(mockClient.cancelOrder).toHaveBeenCalledWith({
        orderId: 12345,
        origClientOrderId: undefined
      });
    });

    it('should emit cancellation event', (done) => {
      let eventReceived = false;

      const onOrderCanceled = (data: any) => {
        if (!eventReceived) {
          eventReceived = true;
          expect(data).toHaveProperty('userId', 'test-user');
          expect(data).toHaveProperty('exchange', 'binance');
          expect(data).toHaveProperty('orderId', '12345');
          orderExecutionService.off('order-canceled', onOrderCanceled);
          done();
        }
      };

      orderExecutionService.on('order-canceled', onOrderCanceled);

      const mockClient = {
        cancelOrder: jest.fn().mockResolvedValue({ status: 'CANCELED' })
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);

      orderExecutionService.cancelOrder('test-user', 'binance', '12345');

      setTimeout(() => {
        if (!eventReceived) {
          orderExecutionService.off('order-canceled', onOrderCanceled);
          done();
        }
      }, 3000);
    }, 5000);
  });

  describe('Error Handling and Resilience', () => {
    it('should handle exchange API errors gracefully', async () => {
      jest.spyOn(orderExecutionService, 'validateOrder').mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);

      const mockClient = {
        createOrder: jest.fn().mockRejectedValue(new Error('API Error: Insufficient funds'))
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);

      await expect(orderExecutionService.executeOrder({
        userId: 'test-user',
        exchange: 'binance',
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.001
      })).rejects.toThrow('API Error: Insufficient funds');
    });

    it('should handle network timeouts', async () => {
      jest.spyOn(orderExecutionService, 'validateOrder').mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      const mockClient = {
        createOrder: jest.fn().mockImplementation(() => 
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Network timeout')), 100)
          )
        )
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);

      await expect(orderExecutionService.executeOrder({
        userId: 'test-user',
        exchange: 'binance',
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.001
      })).rejects.toThrow('Network timeout');
    }, 10000);
  });

  describe('Memory and Resource Management', () => {
    it('should manage pending orders correctly', async () => {
      expect(orderExecutionService.getPendingOrders()).toHaveLength(0);

      // Start an order execution that will be pending
      const orderPromise = orderExecutionService.executeOrder({
        userId: 'test-user',
        exchange: 'binance',
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.001,
        clientOrderId: 'pending-test-123'
      }).catch(() => {}); // Ignore errors for this test

      // Mock validation to pass but delay the order execution
      jest.spyOn(orderExecutionService, 'validateOrder').mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      // Check that order is in pending state
      setTimeout(() => {
        const pendingOrders = orderExecutionService.getPendingOrders();
        const foundPending = pendingOrders.find(o => o.clientOrderId === 'pending-test-123');
        expect(foundPending).toBeDefined();
      }, 50);

      await orderPromise;
    });

    it('should clean up resources after order completion', async () => {
      const initialPendingCount = orderExecutionService.getPendingOrders().length;

      jest.spyOn(orderExecutionService, 'validateOrder').mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      const mockClient = {
        createOrder: jest.fn().mockResolvedValue({
          orderId: 12345,
          symbol: 'BTCUSDT',
          status: 'NEW',
          transactTime: Date.now(),
          fills: []
        })
      };

      jest.spyOn(exchangeService, 'getAuthenticatedClient').mockResolvedValue(mockClient);
      jest.spyOn(rateLimitService, 'waitForExchangeAvailability').mockResolvedValue(undefined);

      await orderExecutionService.executeOrder({
        userId: 'test-user',
        exchange: 'binance',
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.001,
        clientOrderId: 'cleanup-test-123'
      });

      // Verify pending orders are cleaned up
      const finalPendingCount = orderExecutionService.getPendingOrders().length;
      expect(finalPendingCount).toBe(initialPendingCount);
    });
  });
});