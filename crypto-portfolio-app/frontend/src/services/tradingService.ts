import axios, { AxiosInstance } from 'axios';

interface TradeOrder {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  orderType: 'market' | 'limit' | 'stop' | 'stop_limit';
  quantity: number;
  price?: number; // For limit orders
  stopPrice?: number; // For stop orders
  total: number;
  fee: number;
  feeRate: number;
  status: 'pending' | 'filled' | 'partial' | 'cancelled' | 'failed';
  exchange: string;
  createdAt: Date;
  updatedAt: Date;
  filledQuantity?: number;
  averagePrice?: number;
  notes?: string;
}

interface OrderBook {
  symbol: string;
  bids: [number, number][]; // [price, quantity]
  asks: [number, number][]; // [price, quantity]
  lastUpdated: Date;
}

interface TradingFees {
  maker: number;
  taker: number;
  minFee: number;
  currency: string;
}

interface ExchangeInfo {
  name: string;
  status: 'online' | 'maintenance' | 'offline';
  tradingEnabled: boolean;
  supportedSymbols: string[];
  fees: TradingFees;
}

class TradingService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add auth token to requests if available
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  /**
   * Create a new trade order
   */
  async createOrder(order: Omit<TradeOrder, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<TradeOrder> {
    try {
      const response = await this.api.post('/trading/orders', order);
      return {
        ...response.data,
        createdAt: new Date(response.data.createdAt),
        updatedAt: new Date(response.data.updatedAt)
      };
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  /**
   * Get user's trading orders
   */
  async getOrders(status?: string, limit?: number): Promise<TradeOrder[]> {
    try {
      const response = await this.api.get('/trading/orders', {
        params: { status, limit }
      });
      return response.data.orders.map((order: any) => ({
        ...order,
        createdAt: new Date(order.createdAt),
        updatedAt: new Date(order.updatedAt)
      }));
    } catch (error) {
      console.error('Error fetching orders:', error);
      return [];
    }
  }

  /**
   * Get specific order by ID
   */
  async getOrder(orderId: string): Promise<TradeOrder | null> {
    try {
      const response = await this.api.get(`/trading/orders/${orderId}`);
      return {
        ...response.data,
        createdAt: new Date(response.data.createdAt),
        updatedAt: new Date(response.data.updatedAt)
      };
    } catch (error) {
      console.error('Error fetching order:', error);
      return null;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<void> {
    try {
      await this.api.delete(`/trading/orders/${orderId}`);
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw error;
    }
  }

  /**
   * Get order book for a symbol
   */
  async getOrderBook(symbol: string, depth: number = 20): Promise<OrderBook> {
    try {
      const response = await this.api.get(`/trading/orderbook/${symbol}`, {
        params: { depth }
      });
      return {
        ...response.data,
        lastUpdated: new Date(response.data.lastUpdated)
      };
    } catch (error) {
      console.error('Error fetching order book:', error);
      throw error;
    }
  }

  /**
   * Get trading fees for an exchange
   */
  async getTradingFees(exchange: string): Promise<TradingFees> {
    try {
      const response = await this.api.get(`/trading/fees/${exchange}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching trading fees:', error);
      return this.getDefaultTradingFees();
    }
  }

  /**
   * Get exchange information
   */
  async getExchangeInfo(exchange: string): Promise<ExchangeInfo> {
    try {
      const response = await this.api.get(`/trading/exchanges/${exchange}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching exchange info:', error);
      throw error;
    }
  }

  /**
   * Get available exchanges
   */
  async getAvailableExchanges(): Promise<ExchangeInfo[]> {
    try {
      const response = await this.api.get('/trading/exchanges');
      return response.data.exchanges;
    } catch (error) {
      console.error('Error fetching exchanges:', error);
      return [];
    }
  }

  /**
   * Estimate trading fees for an order
   */
  async estimateFees(
    symbol: string,
    type: 'buy' | 'sell',
    quantity: number,
    price: number,
    exchange: string = 'default'
  ): Promise<{ fee: number; feeRate: number; total: number }> {
    try {
      const response = await this.api.post('/trading/estimate-fees', {
        symbol,
        type,
        quantity,
        price,
        exchange
      });
      return response.data;
    } catch (error) {
      console.error('Error estimating fees:', error);
      // Fallback calculation
      const total = quantity * price;
      const feeRate = type === 'buy' ? 0.001 : 0.001; // 0.1%
      const fee = total * feeRate;
      return { fee, feeRate, total: total + (type === 'buy' ? fee : -fee) };
    }
  }

  /**
   * Validate order parameters
   */
  validateOrder(order: Partial<TradeOrder>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!order.symbol) {
      errors.push('Symbol is required');
    }

    if (!order.type || !['buy', 'sell'].includes(order.type)) {
      errors.push('Valid order type is required (buy/sell)');
    }

    if (!order.orderType || !['market', 'limit', 'stop', 'stop_limit'].includes(order.orderType)) {
      errors.push('Valid order type is required');
    }

    if (!order.quantity || order.quantity <= 0) {
      errors.push('Quantity must be greater than 0');
    }

    if (order.orderType === 'limit' && (!order.price || order.price <= 0)) {
      errors.push('Price is required for limit orders');
    }

    if (['stop', 'stop_limit'].includes(order.orderType as string) && (!order.stopPrice || order.stopPrice <= 0)) {
      errors.push('Stop price is required for stop orders');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate order totals
   */
  calculateOrderTotal(
    type: 'buy' | 'sell',
    quantity: number,
    price: number,
    feeRate: number = 0.001
  ): { subtotal: number; fee: number; total: number } {
    const subtotal = quantity * price;
    const fee = subtotal * feeRate;
    
    let total: number;
    if (type === 'buy') {
      total = subtotal + fee;
    } else {
      total = subtotal - fee;
    }

    return { subtotal, fee, total };
  }

  private getDefaultTradingFees(): TradingFees {
    return {
      maker: 0.001, // 0.1%
      taker: 0.001, // 0.1%
      minFee: 0.01,
      currency: 'USD'
    };
  }
}

export const tradingService = new TradingService();
export type { TradeOrder, OrderBook, TradingFees, ExchangeInfo };