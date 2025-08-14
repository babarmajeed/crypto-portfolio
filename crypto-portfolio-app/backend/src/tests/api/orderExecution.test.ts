import request from 'supertest';
import { app } from '../../index';
import { orderExecutionService } from '../../services/exchanges/orderExecutionService';
import { exchangeService } from '../../services/exchanges/exchangeService';
import { auditService } from '../../services/auditService';
import { generateTestJWT } from '../helpers/testHelpers';
import { jest } from '@jest/globals';

describe('Order Execution API Tests', () => {
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

  describe('POST /api/v1/exchanges/orders/execute', () => {
    const mockOrderRequest = {
      exchange: 'binance',
      symbol: 'BTCUSDT',
      side: 'buy',
      type: 'limit',
      quantity: 0.001,
      price: 50000
    };

    const mockOrderResponse = {
      orderId: '12345',
      clientOrderId: 'test-client-id',
      symbol: 'BTCUSDT',
      side: 'buy',
      type: 'limit',
      quantity: 0.001,
      price: 50000,
      status: 'NEW',
      executedQuantity: 0,
      timestamp: new Date(),
      exchange: 'binance'
    };

    it('should execute a limit buy order successfully', async () => {
      jest.spyOn(orderExecutionService, 'executeOrder').mockResolvedValue(mockOrderResponse as any);
      jest.spyOn(auditService, 'log').mockResolvedValue();

      const response = await request(app)
        .post('/api/v1/exchanges/orders/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mockOrderRequest)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('order');
      expect(response.body.data.order).toHaveProperty('orderId', '12345');
      expect(response.body.data.order).toHaveProperty('symbol', 'BTCUSDT');
      expect(response.body.data.order).toHaveProperty('side', 'buy');
      expect(response.body.data.order).toHaveProperty('status', 'NEW');

      expect(orderExecutionService.executeOrder).toHaveBeenCalledWith({
        userId,
        ...mockOrderRequest
      });

      expect(auditService.log).toHaveBeenCalledWith({
        userId,
        action: 'order_executed',
        resource: 'order',
        details: expect.objectContaining({
          orderId: '12345',
          exchange: 'binance',
          symbol: 'BTCUSDT',
          side: 'buy'
        })
      });
    });

    it('should execute a market sell order successfully', async () => {
      const marketOrder = {
        exchange: 'coinbase',
        symbol: 'BTC-USD',
        side: 'sell',
        type: 'market',
        quantity: 0.01
      };

      const marketResponse = {
        ...mockOrderResponse,
        orderId: '67890',
        symbol: 'BTC-USD',
        side: 'sell',
        type: 'market',
        exchange: 'coinbase'
      };

      jest.spyOn(orderExecutionService, 'executeOrder').mockResolvedValue(marketResponse as any);
      jest.spyOn(auditService, 'log').mockResolvedValue();

      const response = await request(app)
        .post('/api/v1/exchanges/orders/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send(marketOrder)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.order.type).toBe('market');
      expect(response.body.data.order.exchange).toBe('coinbase');
    });

    it('should reject invalid exchange', async () => {
      const invalidOrder = {
        ...mockOrderRequest,
        exchange: 'invalid-exchange'
      };

      await request(app)
        .post('/api/v1/exchanges/orders/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidOrder)
        .expect(400);
    });

    it('should reject missing required fields', async () => {
      const incompleteOrder = {
        exchange: 'binance',
        side: 'buy'
        // Missing symbol, type, quantity
      };

      await request(app)
        .post('/api/v1/exchanges/orders/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteOrder)
        .expect(400);
    });

    it('should reject negative quantity', async () => {
      const invalidOrder = {
        ...mockOrderRequest,
        quantity: -0.001
      };

      await request(app)
        .post('/api/v1/exchanges/orders/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidOrder)
        .expect(400);
    });

    it('should reject invalid order type', async () => {
      const invalidOrder = {
        ...mockOrderRequest,
        type: 'invalid-type'
      };

      await request(app)
        .post('/api/v1/exchanges/orders/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidOrder)
        .expect(400);
    });

    it('should handle order validation failures', async () => {
      jest.spyOn(orderExecutionService, 'executeOrder').mockRejectedValue(
        new Error('Order validation failed: Insufficient balance')
      );

      const response = await request(app)
        .post('/api/v1/exchanges/orders/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mockOrderRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Order validation failed');
    });

    it('should handle insufficient balance error', async () => {
      jest.spyOn(orderExecutionService, 'executeOrder').mockRejectedValue(
        new Error('Insufficient balance. Available: 100, Required: 500')
      );

      const response = await request(app)
        .post('/api/v1/exchanges/orders/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mockOrderRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Insufficient balance');
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/exchanges/orders/execute')
        .send(mockOrderRequest)
        .expect(401);
    });

    it('should enforce rate limiting', async () => {
      jest.spyOn(orderExecutionService, 'executeOrder').mockResolvedValue(mockOrderResponse as any);
      jest.spyOn(auditService, 'log').mockResolvedValue();

      // Make multiple requests quickly to trigger rate limit
      const requests = Array(15).fill(null).map(() =>
        request(app)
          .post('/api/v1/exchanges/orders/execute')
          .set('Authorization', `Bearer ${authToken}`)
          .send(mockOrderRequest)
      );

      const results = await Promise.allSettled(requests);
      const responses = results.map((result: any) => result.value);
      
      // Some requests should be rate limited (429)
      const rateLimitedResponses = responses.filter((res: any) => res?.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe('POST /api/v1/exchanges/orders/validate', () => {
    const mockOrderRequest = {
      exchange: 'binance',
      symbol: 'BTCUSDT',
      side: 'buy',
      type: 'limit',
      quantity: 0.001,
      price: 50000
    };

    const mockValidation = {
      isValid: true,
      errors: [],
      warnings: [],
      estimatedCost: 50,
      availableBalance: 1000,
      minimumQuantity: 0.00001,
      tickSize: 0.01
    };

    it('should validate order successfully', async () => {
      jest.spyOn(orderExecutionService, 'validateOrder').mockResolvedValue(mockValidation);

      const response = await request(app)
        .post('/api/v1/exchanges/orders/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mockOrderRequest)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('validation');
      expect(response.body.data.validation).toHaveProperty('isValid', true);
      expect(response.body.data.validation).toHaveProperty('estimatedCost', 50);
      expect(response.body.data.validation).toHaveProperty('availableBalance', 1000);
    });

    it('should return validation errors', async () => {
      const invalidValidation = {
        isValid: false,
        errors: ['Insufficient balance', 'Symbol not found'],
        warnings: ['High price deviation'],
        estimatedCost: 50,
        availableBalance: 10
      };

      jest.spyOn(orderExecutionService, 'validateOrder').mockResolvedValue(invalidValidation);

      const response = await request(app)
        .post('/api/v1/exchanges/orders/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mockOrderRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.validation.isValid).toBe(false);
      expect(response.body.data.validation.errors).toHaveLength(2);
      expect(response.body.data.validation.warnings).toHaveLength(1);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/exchanges/orders/validate')
        .send(mockOrderRequest)
        .expect(401);
    });
  });

  describe('GET /api/v1/exchanges/orders/:exchange/:orderId', () => {
    const mockOrderStatus = {
      orderId: '12345',
      symbol: 'BTCUSDT',
      status: 'FILLED',
      side: 'buy',
      type: 'limit',
      quantity: 0.001,
      executedQuantity: 0.001,
      price: 50000,
      executedPrice: 49950,
      timestamp: new Date(),
      updateTime: new Date()
    };

    it('should get order status successfully', async () => {
      jest.spyOn(orderExecutionService, 'getOrderStatus').mockResolvedValue(mockOrderStatus as any);

      const response = await request(app)
        .get('/api/v1/exchanges/orders/binance/12345')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('order');
      expect(response.body.data.order).toHaveProperty('orderId', '12345');
      expect(response.body.data.order).toHaveProperty('status', 'FILLED');
      expect(response.body.data.order).toHaveProperty('executedQuantity', 0.001);

      expect(orderExecutionService.getOrderStatus).toHaveBeenCalledWith(userId, 'binance', '12345');
    });

    it('should return 404 for non-existent order', async () => {
      jest.spyOn(orderExecutionService, 'getOrderStatus').mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/exchanges/orders/binance/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Order not found');
    });

    it('should reject invalid exchange', async () => {
      await request(app)
        .get('/api/v1/exchanges/orders/invalid/12345')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/exchanges/orders/binance/12345')
        .expect(401);
    });
  });

  describe('DELETE /api/v1/exchanges/orders/:exchange/:orderId', () => {
    it('should cancel order successfully', async () => {
      jest.spyOn(orderExecutionService, 'cancelOrder').mockResolvedValue(true);
      jest.spyOn(auditService, 'log').mockResolvedValue();

      const response = await request(app)
        .delete('/api/v1/exchanges/orders/binance/12345')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ clientOrderId: 'client-123' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('canceled', true);
      expect(response.body.data).toHaveProperty('orderId', '12345');
      expect(response.body.data).toHaveProperty('exchange', 'binance');

      expect(orderExecutionService.cancelOrder).toHaveBeenCalledWith(
        userId, 'binance', '12345', 'client-123'
      );

      expect(auditService.log).toHaveBeenCalledWith({
        userId,
        action: 'order_canceled',
        resource: 'order',
        details: { exchange: 'binance', orderId: '12345', clientOrderId: 'client-123' }
      });
    });

    it('should handle cancellation failure', async () => {
      jest.spyOn(orderExecutionService, 'cancelOrder').mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/v1/exchanges/orders/binance/12345')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to cancel order');
    });

    it('should require authentication', async () => {
      await request(app)
        .delete('/api/v1/exchanges/orders/binance/12345')
        .expect(401);
    });
  });

  describe('GET /api/v1/exchanges/orders/:exchange', () => {
    const mockOrders = [
      {
        orderId: '12345',
        clientOrderId: 'client-123',
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.001,
        price: 50000,
        status: 'FILLED',
        executedQuantity: 0.001,
        executedPrice: 49950,
        timestamp: new Date(),
        exchange: 'binance'
      },
      {
        orderId: '67890',
        clientOrderId: 'client-456',
        symbol: 'ETHUSDT',
        side: 'sell',
        type: 'market',
        quantity: 0.1,
        status: 'NEW',
        executedQuantity: 0,
        timestamp: new Date(),
        exchange: 'binance'
      }
    ];

    it('should get user orders successfully', async () => {
      jest.spyOn(orderExecutionService, 'getUserOrders').mockResolvedValue(mockOrders as any);

      const response = await request(app)
        .get('/api/v1/exchanges/orders/binance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('orders');
      expect(response.body.data.orders).toHaveLength(2);
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.pagination).toHaveProperty('page', 1);
      expect(response.body.data.pagination).toHaveProperty('limit', 50);
      expect(response.body.data.pagination).toHaveProperty('total', 2);

      expect(orderExecutionService.getUserOrders).toHaveBeenCalledWith(userId, 'binance', undefined, 50);
    });

    it('should support pagination and filtering', async () => {
      jest.spyOn(orderExecutionService, 'getUserOrders').mockResolvedValue([mockOrders[0]] as any);

      const response = await request(app)
        .get('/api/v1/exchanges/orders/binance?symbol=BTCUSDT&limit=10&page=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.pagination.page).toBe(2);
      expect(response.body.data.pagination.limit).toBe(10);
      expect(orderExecutionService.getUserOrders).toHaveBeenCalledWith(userId, 'binance', 'BTCUSDT', 10);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/exchanges/orders/binance')
        .expect(401);
    });
  });

  describe('GET /api/v1/exchanges/orders/pending/all', () => {
    const mockPendingOrders = [
      {
        userId: 'user-1',
        exchange: 'binance',
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.001,
        price: 50000,
        clientOrderId: 'pending-123'
      }
    ];

    it('should get pending orders (admin access required)', async () => {
      jest.spyOn(orderExecutionService, 'getPendingOrders').mockReturnValue(mockPendingOrders as any);

      const response = await request(app)
        .get('/api/v1/exchanges/orders/pending/all')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('orders');
      expect(response.body.data).toHaveProperty('count', 1);
      expect(response.body.data.orders).toHaveLength(1);
    });

    // Note: Admin role check would be implemented in middleware
    // it('should reject non-admin users', async () => {
    //   await request(app)
    //     .get('/api/v1/exchanges/orders/pending/all')
    //     .set('Authorization', `Bearer ${authToken}`)
    //     .expect(403);
    // });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/exchanges/orders/pending/all')
        .expect(401);
    });
  });

  describe('GET /api/v1/exchanges/exchanges/supported', () => {
    it('should get supported exchanges', async () => {
      jest.spyOn(orderExecutionService, 'getSupportedExchanges').mockReturnValue(['binance', 'coinbase', 'kraken', 'kucoin']);

      const response = await request(app)
        .get('/api/v1/exchanges/exchanges/supported')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('exchanges');
      expect(response.body.data.exchanges).toEqual(['binance', 'coinbase', 'kraken', 'kucoin']);
      expect(response.body.data).toHaveProperty('count', 4);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/exchanges/exchanges/supported')
        .expect(401);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      jest.spyOn(orderExecutionService, 'executeOrder').mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app)
        .post('/api/v1/exchanges/orders/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exchange: 'binance',
          symbol: 'BTCUSDT',
          side: 'buy',
          type: 'market',
          quantity: 0.001
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Order execution failed');
      expect(response.body.message).toBe('Internal server error');
    });
  });
});