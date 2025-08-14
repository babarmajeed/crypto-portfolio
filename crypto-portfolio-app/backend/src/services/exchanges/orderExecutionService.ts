import { EventEmitter } from 'events';
import { exchangeService } from './exchangeService';
import { loggingService } from '../loggingService';
import { cacheService } from '../cacheService';
import { rateLimitService } from '../rateLimitService';
import { prisma } from '../../config/database';

interface OrderRequest {
  userId: string;
  exchange: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  clientOrderId?: string;
}

interface OrderResponse {
  orderId: string;
  clientOrderId?: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: string;
  quantity: number;
  price?: number;
  status: 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'REJECTED' | 'EXPIRED';
  executedQuantity: number;
  executedPrice?: number;
  commission?: number;
  commissionAsset?: string;
  timestamp: Date;
  exchange: string;
  fills?: OrderFill[];
}

interface OrderFill {
  price: number;
  quantity: number;
  commission: number;
  commissionAsset: string;
  timestamp: Date;
}

interface OrderStatus {
  orderId: string;
  symbol: string;
  status: string;
  side: 'buy' | 'sell';
  type: string;
  quantity: number;
  price?: number;
  executedQuantity: number;
  executedPrice?: number;
  timestamp: Date;
  updateTime: Date;
}

interface OrderValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  estimatedCost?: number;
  availableBalance?: number;
  minimumQuantity?: number;
  tickSize?: number;
}

export class OrderExecutionService extends EventEmitter {
  private supportedExchanges: string[];
  private orderCache: Map<string, OrderResponse> = new Map();
  private pendingOrders: Map<string, OrderRequest> = new Map();

  constructor() {
    super();
    this.supportedExchanges = exchangeService.getSupportedExchanges();
  }

  async validateOrder(orderRequest: OrderRequest): Promise<OrderValidation> {
    const validation: OrderValidation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // Basic validation
      if (!this.supportedExchanges.includes(orderRequest.exchange)) {
        validation.errors.push(`Unsupported exchange: ${orderRequest.exchange}`);
      }

      if (orderRequest.quantity <= 0) {
        validation.errors.push('Quantity must be greater than 0');
      }

      if (orderRequest.type === 'limit' && !orderRequest.price) {
        validation.errors.push('Price is required for limit orders');
      }

      if (orderRequest.type === 'stop' && !orderRequest.stopPrice) {
        validation.errors.push('Stop price is required for stop orders');
      }

      // Check user has valid credentials for exchange
      const hasCredentials = await exchangeService.hasValidCredentials(
        orderRequest.userId, 
        orderRequest.exchange
      );
      
      if (!hasCredentials) {
        validation.errors.push(`No valid credentials found for ${orderRequest.exchange}`);
      }

      if (validation.errors.length === 0 && hasCredentials) {
        // Get exchange info for symbol validation
        const exchangeInfo = await exchangeService.getExchangeInfo(orderRequest.exchange);
        const symbolInfo = exchangeInfo.tradingPairs.find(p => p.symbol === orderRequest.symbol);
        
        if (!symbolInfo) {
          validation.errors.push(`Symbol ${orderRequest.symbol} not found on ${orderRequest.exchange}`);
        } else {
          // Check minimum quantity
          if (orderRequest.quantity < symbolInfo.minOrderSize) {
            validation.errors.push(
              `Quantity ${orderRequest.quantity} is below minimum ${symbolInfo.minOrderSize}`
            );
          }
          
          validation.minimumQuantity = symbolInfo.minOrderSize;
          validation.tickSize = symbolInfo.tickSize;

          // Validate price precision for limit orders
          if (orderRequest.price && symbolInfo.tickSize) {
            const priceRemainder = orderRequest.price % symbolInfo.tickSize;
            if (priceRemainder !== 0) {
              validation.warnings.push(
                `Price will be rounded to tick size ${symbolInfo.tickSize}`
              );
            }
          }
        }

        // Check account balance for buy orders
        if (orderRequest.side === 'buy' && symbolInfo) {
          try {
            const client = await exchangeService.getAuthenticatedClient(
              orderRequest.userId, 
              orderRequest.exchange
            );
            const accountInfo = await client.getAccountInfo();
            
            const quoteAsset = this.getQuoteAsset(orderRequest.symbol);
            const balance = accountInfo.balances.find(
              (b: any) => (b.asset || b.currency) === quoteAsset
            );
            
            if (balance) {
              const availableBalance = balance.available || balance.free || balance.balance || 0;
              validation.availableBalance = availableBalance;
              
              const estimatedCost = orderRequest.type === 'market' 
                ? orderRequest.quantity * (await this.getEstimatedPrice(orderRequest))
                : orderRequest.quantity * (orderRequest.price || 0);
              
              validation.estimatedCost = estimatedCost;
              
              if (availableBalance < estimatedCost) {
                validation.errors.push(
                  `Insufficient balance. Available: ${availableBalance}, Required: ${estimatedCost}`
                );
              }
            }
          } catch (error) {
            validation.warnings.push('Unable to verify account balance');
          }
        }
      }

      validation.isValid = validation.errors.length === 0;
      return validation;
    } catch (error) {
      loggingService.error('Error validating order', { orderRequest, error });
      validation.errors.push('Order validation failed');
      validation.isValid = false;
      return validation;
    }
  }

  async executeOrder(orderRequest: OrderRequest): Promise<OrderResponse> {
    try {
      // Validate order first
      const validation = await this.validateOrder(orderRequest);
      if (!validation.isValid) {
        throw new Error(`Order validation failed: ${validation.errors.join(', ')}`);
      }

      // Check rate limits
      await rateLimitService.waitForExchangeAvailability(orderRequest.exchange, 1);

      // Generate client order ID if not provided
      if (!orderRequest.clientOrderId) {
        orderRequest.clientOrderId = this.generateClientOrderId(orderRequest.userId);
      }

      // Store pending order
      this.pendingOrders.set(orderRequest.clientOrderId, orderRequest);

      // Get authenticated client
      const client = await exchangeService.getAuthenticatedClient(
        orderRequest.userId,
        orderRequest.exchange
      );

      // Execute order based on exchange
      let orderResponse: OrderResponse;
      switch (orderRequest.exchange) {
        case 'binance':
          orderResponse = await this.executeBinanceOrder(client, orderRequest);
          break;
        case 'coinbase':
          orderResponse = await this.executeCoinbaseOrder(client, orderRequest);
          break;
        case 'kraken':
          orderResponse = await this.executeKrakenOrder(client, orderRequest);
          break;
        case 'kucoin':
          orderResponse = await this.executeKuCoinOrder(client, orderRequest);
          break;
        default:
          throw new Error(`Unsupported exchange: ${orderRequest.exchange}`);
      }

      // Cache the order
      this.orderCache.set(orderResponse.orderId, orderResponse);
      await this.cacheOrder(orderResponse);

      // Remove from pending orders
      this.pendingOrders.delete(orderRequest.clientOrderId!);

      // Store in database
      await this.storeOrderInDatabase(orderRequest.userId, orderResponse);

      // Emit order event
      this.emit('order-executed', orderResponse);
      this.emit(`${orderRequest.exchange}:order-executed`, orderResponse);

      loggingService.info('Order executed successfully', {
        userId: orderRequest.userId,
        orderId: orderResponse.orderId,
        exchange: orderRequest.exchange,
        symbol: orderRequest.symbol,
        side: orderRequest.side,
        status: orderResponse.status
      });

      return orderResponse;
    } catch (error) {
      // Remove from pending orders on error
      if (orderRequest.clientOrderId) {
        this.pendingOrders.delete(orderRequest.clientOrderId);
      }

      loggingService.error('Order execution failed', { orderRequest, error });
      this.emit('order-error', { orderRequest, error });
      throw error;
    }
  }

  private async executeBinanceOrder(client: any, orderRequest: OrderRequest): Promise<OrderResponse> {
    const params: any = {
      symbol: orderRequest.symbol,
      side: orderRequest.side.toUpperCase(),
      type: orderRequest.type.toUpperCase(),
      quantity: orderRequest.quantity
    };

    if (orderRequest.type === 'limit') {
      params.price = orderRequest.price;
      params.timeInForce = orderRequest.timeInForce || 'GTC';
    }

    if (orderRequest.type === 'stop' || orderRequest.type === 'stop_limit') {
      params.stopPrice = orderRequest.stopPrice;
    }

    if (orderRequest.clientOrderId) {
      params.newClientOrderId = orderRequest.clientOrderId;
    }

    const response = await client.createOrder(params);

    return {
      orderId: response.orderId.toString(),
      clientOrderId: response.clientOrderId,
      symbol: response.symbol,
      side: response.side.toLowerCase() as 'buy' | 'sell',
      type: response.type,
      quantity: parseFloat(response.origQty),
      price: response.price ? parseFloat(response.price) : undefined,
      status: response.status as any,
      executedQuantity: parseFloat(response.executedQty || '0'),
      executedPrice: response.fills && response.fills.length > 0 
        ? this.calculateAveragePrice(response.fills) 
        : undefined,
      commission: response.fills 
        ? response.fills.reduce((sum: number, fill: any) => sum + parseFloat(fill.commission), 0) 
        : undefined,
      commissionAsset: response.fills?.[0]?.commissionAsset,
      timestamp: new Date(response.transactTime || Date.now()),
      exchange: 'binance',
      fills: response.fills ? response.fills.map((fill: any) => ({
        price: parseFloat(fill.price),
        quantity: parseFloat(fill.qty),
        commission: parseFloat(fill.commission),
        commissionAsset: fill.commissionAsset,
        timestamp: new Date(response.transactTime || Date.now())
      })) : undefined
    };
  }

  private async executeCoinbaseOrder(client: any, orderRequest: OrderRequest): Promise<OrderResponse> {
    const params: any = {
      product_id: orderRequest.symbol,
      side: orderRequest.side,
      size: orderRequest.quantity.toString()
    };

    if (orderRequest.type === 'limit') {
      params.type = 'limit';
      params.price = orderRequest.price!.toString();
      params.time_in_force = orderRequest.timeInForce || 'GTC';
    } else if (orderRequest.type === 'market') {
      params.type = 'market';
    }

    if (orderRequest.clientOrderId) {
      params.client_oid = orderRequest.clientOrderId;
    }

    const response = await client.createOrder(params);

    return {
      orderId: response.id,
      clientOrderId: response.client_oid,
      symbol: response.product_id,
      side: response.side as 'buy' | 'sell',
      type: response.type,
      quantity: parseFloat(response.size),
      price: response.price ? parseFloat(response.price) : undefined,
      status: this.mapCoinbaseStatus(response.status),
      executedQuantity: parseFloat(response.filled_size || '0'),
      executedPrice: response.executed_value && response.filled_size 
        ? parseFloat(response.executed_value) / parseFloat(response.filled_size)
        : undefined,
      commission: parseFloat(response.fill_fees || '0'),
      timestamp: new Date(response.created_at || Date.now()),
      exchange: 'coinbase'
    };
  }

  private async executeKrakenOrder(client: any, orderRequest: OrderRequest): Promise<OrderResponse> {
    const params: any = {
      pair: orderRequest.symbol,
      type: orderRequest.side,
      ordertype: orderRequest.type === 'market' ? 'market' : 'limit',
      volume: orderRequest.quantity.toString()
    };

    if (orderRequest.type === 'limit') {
      params.price = orderRequest.price!.toString();
    }

    if (orderRequest.clientOrderId) {
      params.userref = orderRequest.clientOrderId;
    }

    const response = await client.createOrder(params);
    const orderId = response.txid[0];

    return {
      orderId,
      clientOrderId: orderRequest.clientOrderId,
      symbol: orderRequest.symbol,
      side: orderRequest.side,
      type: orderRequest.type,
      quantity: orderRequest.quantity,
      price: orderRequest.price,
      status: 'NEW',
      executedQuantity: 0,
      timestamp: new Date(),
      exchange: 'kraken'
    };
  }

  private async executeKuCoinOrder(client: any, orderRequest: OrderRequest): Promise<OrderResponse> {
    const params: any = {
      symbol: orderRequest.symbol,
      side: orderRequest.side,
      type: orderRequest.type,
      size: orderRequest.quantity.toString()
    };

    if (orderRequest.type === 'limit') {
      params.price = orderRequest.price!.toString();
    }

    if (orderRequest.clientOrderId) {
      params.clientOid = orderRequest.clientOrderId;
    }

    const response = await client.createOrder(params);

    return {
      orderId: response.orderId,
      clientOrderId: response.clientOid || orderRequest.clientOrderId,
      symbol: orderRequest.symbol,
      side: orderRequest.side,
      type: orderRequest.type,
      quantity: orderRequest.quantity,
      price: orderRequest.price,
      status: 'NEW',
      executedQuantity: 0,
      timestamp: new Date(),
      exchange: 'kucoin'
    };
  }

  async getOrderStatus(userId: string, exchange: string, orderId: string): Promise<OrderStatus | null> {
    try {
      // Check cache first
      const cached = await cacheService.get?.(`order:${exchange}:${orderId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      const client = await exchangeService.getAuthenticatedClient(userId, exchange);
      let orderInfo: any;

      switch (exchange) {
        case 'binance':
          orderInfo = await client.getOrder({ orderId: parseInt(orderId) });
          break;
        case 'coinbase':
          orderInfo = await client.getOrder(orderId);
          break;
        case 'kraken':
          orderInfo = await client.getOrderInfo({ txid: orderId });
          break;
        case 'kucoin':
          orderInfo = await client.getOrder(orderId);
          break;
        default:
          throw new Error(`Unsupported exchange: ${exchange}`);
      }

      const status = this.normalizeOrderStatus(orderInfo, exchange);
      
      // Cache for 30 seconds
      await cacheService.set?.(`order:${exchange}:${orderId}`, JSON.stringify(status), 30);
      
      return status;
    } catch (error) {
      loggingService.error('Error getting order status', { userId, exchange, orderId, error });
      return null;
    }
  }

  async cancelOrder(userId: string, exchange: string, orderId: string, clientOrderId?: string): Promise<boolean> {
    try {
      await rateLimitService.waitForExchangeAvailability(exchange, 1);
      
      const client = await exchangeService.getAuthenticatedClient(userId, exchange);
      let result: any;

      switch (exchange) {
        case 'binance':
          result = await client.cancelOrder({ 
            orderId: parseInt(orderId),
            origClientOrderId: clientOrderId 
          });
          break;
        case 'coinbase':
          result = await client.cancelOrder(orderId);
          break;
        case 'kraken':
          result = await client.cancelOrder({ txid: orderId });
          break;
        case 'kucoin':
          result = await client.cancelOrder(orderId);
          break;
        default:
          throw new Error(`Unsupported exchange: ${exchange}`);
      }

      // Clear cache
      await cacheService.delete?.(`order:${exchange}:${orderId}`);
      
      this.emit('order-canceled', { userId, exchange, orderId });
      
      loggingService.info('Order canceled successfully', { userId, exchange, orderId });
      return true;
    } catch (error) {
      loggingService.error('Error canceling order', { userId, exchange, orderId, error });
      return false;
    }
  }

  async getUserOrders(userId: string, exchange: string, symbol?: string, limit: number = 50): Promise<OrderResponse[]> {
    try {
      // Get from database first
      const dbOrders = await prisma.order.findMany({
        where: {
          userId,
          exchange,
          ...(symbol && { symbol })
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      // Map database orders to OrderResponse format
      const orders = dbOrders.map(order => ({
        orderId: order.orderId,
        clientOrderId: order.clientOrderId,
        symbol: order.symbol,
        side: order.side as 'buy' | 'sell',
        type: order.type,
        quantity: order.quantity.toNumber(),
        price: order.price?.toNumber(),
        status: order.status as any,
        executedQuantity: order.executedQuantity.toNumber(),
        executedPrice: order.executedPrice?.toNumber(),
        commission: order.commission?.toNumber(),
        commissionAsset: order.commissionAsset,
        timestamp: order.createdAt,
        exchange: order.exchange
      }));

      return orders;
    } catch (error) {
      loggingService.error('Error getting user orders', { userId, exchange, symbol, error });
      return [];
    }
  }

  private generateClientOrderId(userId: string): string {
    return `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getEstimatedPrice(orderRequest: OrderRequest): Promise<number> {
    try {
      const prices = await exchangeService.getCurrentPrices(orderRequest.exchange, [orderRequest.symbol]);
      return prices[orderRequest.symbol]?.price || 0;
    } catch (error) {
      return 0;
    }
  }

  private getQuoteAsset(symbol: string): string {
    // Simple logic - in production this would be more sophisticated
    if (symbol.includes('USDT')) return 'USDT';
    if (symbol.includes('USD')) return 'USD';
    if (symbol.includes('BTC')) return 'BTC';
    if (symbol.includes('ETH')) return 'ETH';
    return 'USD';
  }

  private calculateAveragePrice(fills: any[]): number {
    if (!fills || fills.length === 0) return 0;
    
    const totalValue = fills.reduce((sum, fill) => 
      sum + (parseFloat(fill.price) * parseFloat(fill.qty)), 0
    );
    const totalQuantity = fills.reduce((sum, fill) => 
      sum + parseFloat(fill.qty), 0
    );
    
    return totalQuantity > 0 ? totalValue / totalQuantity : 0;
  }

  private mapCoinbaseStatus(status: string): OrderResponse['status'] {
    const statusMap: Record<string, OrderResponse['status']> = {
      'open': 'NEW',
      'pending': 'NEW',
      'active': 'NEW',
      'done': 'FILLED',
      'cancelled': 'CANCELED',
      'rejected': 'REJECTED'
    };
    
    return statusMap[status] || 'NEW';
  }

  private normalizeOrderStatus(orderInfo: any, exchange: string): OrderStatus {
    // Normalize order status across exchanges
    const baseStatus = {
      orderId: '',
      symbol: '',
      status: '',
      side: 'buy' as 'buy' | 'sell',
      type: '',
      quantity: 0,
      executedQuantity: 0,
      timestamp: new Date(),
      updateTime: new Date()
    };

    switch (exchange) {
      case 'binance':
        return {
          ...baseStatus,
          orderId: orderInfo.orderId.toString(),
          symbol: orderInfo.symbol,
          status: orderInfo.status,
          side: orderInfo.side.toLowerCase(),
          type: orderInfo.type,
          quantity: parseFloat(orderInfo.origQty),
          price: orderInfo.price ? parseFloat(orderInfo.price) : undefined,
          executedQuantity: parseFloat(orderInfo.executedQty),
          executedPrice: orderInfo.avgPrice ? parseFloat(orderInfo.avgPrice) : undefined,
          timestamp: new Date(orderInfo.time),
          updateTime: new Date(orderInfo.updateTime)
        };
      
      case 'coinbase':
        return {
          ...baseStatus,
          orderId: orderInfo.id,
          symbol: orderInfo.product_id,
          status: this.mapCoinbaseStatus(orderInfo.status),
          side: orderInfo.side,
          type: orderInfo.type,
          quantity: parseFloat(orderInfo.size),
          price: orderInfo.price ? parseFloat(orderInfo.price) : undefined,
          executedQuantity: parseFloat(orderInfo.filled_size || '0'),
          timestamp: new Date(orderInfo.created_at),
          updateTime: new Date(orderInfo.created_at)
        };
      
      default:
        return baseStatus;
    }
  }

  private async cacheOrder(order: OrderResponse): Promise<void> {
    try {
      const cacheKey = `order:${order.exchange}:${order.orderId}`;
      await cacheService.set?.(cacheKey, JSON.stringify(order), 300);
    } catch (error) {
      loggingService.error('Error caching order', error);
    }
  }

  private async storeOrderInDatabase(userId: string, order: OrderResponse): Promise<void> {
    try {
      await prisma.order.create({
        data: {
          userId,
          orderId: order.orderId,
          clientOrderId: order.clientOrderId,
          exchange: order.exchange,
          symbol: order.symbol,
          side: order.side,
          type: order.type,
          quantity: order.quantity,
          price: order.price,
          status: order.status,
          executedQuantity: order.executedQuantity,
          executedPrice: order.executedPrice,
          commission: order.commission,
          commissionAsset: order.commissionAsset,
          fills: order.fills ? JSON.stringify(order.fills) : null,
          createdAt: order.timestamp
        }
      });
    } catch (error) {
      loggingService.error('Error storing order in database', { userId, order, error });
    }
  }

  getPendingOrders(): OrderRequest[] {
    return Array.from(this.pendingOrders.values());
  }

  getSupportedExchanges(): string[] {
    return [...this.supportedExchanges];
  }
}

// Create singleton instance
export const orderExecutionService = new OrderExecutionService();
export default orderExecutionService;