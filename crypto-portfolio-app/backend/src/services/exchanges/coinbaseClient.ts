import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import { rateLimitService } from '../rateLimitService';
import { loggingService } from '../loggingService';
import { cacheService } from '../cacheService';
import { EventEmitter } from 'events';

interface CoinbaseCredentials {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
}

interface CoinbasePriceData {
  symbol: string;
  price: number;
  timestamp: Date;
  exchange: string;
}

interface CoinbaseBalance {
  currency: string;
  balance: number;
  available: number;
  hold: number;
}

interface CoinbaseAccountInfo {
  balances: CoinbaseBalance[];
  accountType: string;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  updateTime: Date;
}

interface CoinbaseTrade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  commission: number;
  commissionAsset: string;
  time: Date;
  isMaker: boolean;
}

interface CoinbaseHistoricalData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CoinbaseExchangeInfo {
  timezone: string;
  serverTime: Date;
  rateLimits: any[];
  tradingPairs: CoinbaseTradingPair[];
  totalPairs: number;
}

interface CoinbaseTradingPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  minOrderSize: number;
  tickSize: number;
}

interface CoinbaseWebSocketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  timestamp: Date;
}

export class CoinbaseClient extends EventEmitter {
  private apiClient: AxiosInstance;
  private baseURL = 'https://api.exchange.coinbase.com';
  private wsURL = 'wss://ws-feed.exchange.coinbase.com';
  private websocketConnections: Map<string, WebSocket> = new Map();

  constructor(private credentials?: CoinbaseCredentials) {
    super();
    
    this.apiClient = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CryptoPortfolio/1.0.0'
      }
    });

    // Add request interceptor for authentication
    this.apiClient.interceptors.request.use((config) => {
      if (this.credentials && this.requiresAuth(config.url || '')) {
        const timestamp = Date.now() / 1000;
        const method = config.method?.toUpperCase() || 'GET';
        const requestPath = config.url || '';
        const body = config.data ? JSON.stringify(config.data) : '';
        
        const message = timestamp + method + requestPath + body;
        const signature = crypto
          .createHmac('sha256', Buffer.from(this.credentials.apiSecret, 'base64'))
          .update(message)
          .digest('base64');

        config.headers = {
          ...config.headers,
          'CB-ACCESS-KEY': this.credentials.apiKey,
          'CB-ACCESS-SIGN': signature,
          'CB-ACCESS-TIMESTAMP': timestamp.toString(),
          'CB-ACCESS-PASSPHRASE': this.credentials.passphrase
        };
      }
      return config;
    });

    // Add response interceptor for error handling
    this.apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        loggingService.error('Coinbase API error', {
          error: error.message,
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url
        });
        throw error;
      }
    );
  }

  private requiresAuth(url: string): boolean {
    const authEndpoints = ['/accounts', '/orders', '/fills', '/transfers'];
    return authEndpoints.some(endpoint => url.includes(endpoint));
  }

  async getCurrentPrices(symbols: string[] = []): Promise<Record<string, CoinbasePriceData>> {
    try {
      await rateLimitService.waitForExchangeAvailability('coinbase', 1);

      const cacheKey = `coinbase:current_prices:${symbols.join(',')}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        return cached;
      }

      let response;
      if (symbols.length === 0) {
        response = await this.apiClient.get('/products/ticker');
      } else {
        const prices: Record<string, CoinbasePriceData> = {};
        
        for (const symbol of symbols) {
          try {
            const productResponse = await this.apiClient.get(`/products/${symbol}/ticker`);
            prices[symbol] = {
              symbol,
              price: parseFloat(productResponse.data.price),
              timestamp: new Date(),
              exchange: 'coinbase'
            };
          } catch (error) {
            loggingService.warn('Failed to fetch price for symbol', { symbol, error });
          }
        }
        
        // Cache for 30 seconds
        await cacheService.set(cacheKey, prices, 30);
        return prices;
      }

      const formattedPrices: Record<string, CoinbasePriceData> = {};
      
      if (Array.isArray(response.data)) {
        for (const ticker of response.data) {
          formattedPrices[ticker.product_id] = {
            symbol: ticker.product_id,
            price: parseFloat(ticker.price),
            timestamp: new Date(),
            exchange: 'coinbase'
          };
        }
      } else {
        formattedPrices[response.data.product_id] = {
          symbol: response.data.product_id,
          price: parseFloat(response.data.price),
          timestamp: new Date(),
          exchange: 'coinbase'
        };
      }

      // Cache for 30 seconds
      await cacheService.set(cacheKey, formattedPrices, 30);

      loggingService.info('Coinbase prices fetched successfully', {
        symbolCount: Object.keys(formattedPrices).length,
        exchange: 'coinbase'
      });

      return formattedPrices;
    } catch (error) {
      loggingService.error('Failed to fetch Coinbase prices', {
        error: error instanceof Error ? error.message : 'Unknown error',
        symbols
      });
      throw new Error(`Coinbase API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getHistoricalPrices(
    symbol: string, 
    interval: string = '86400', // 1 day in seconds
    limit: number = 100
  ): Promise<CoinbaseHistoricalData[]> {
    try {
      await rateLimitService.waitForExchangeAvailability('coinbase', 1);

      const cacheKey = `coinbase:historical:${symbol}:${interval}:${limit}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        return cached;
      }

      // Calculate start and end times
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - (limit * parseInt(interval) * 1000));

      const response = await this.apiClient.get(`/products/${symbol}/candles`, {
        params: {
          start: startTime.toISOString(),
          end: endTime.toISOString(),
          granularity: interval
        }
      });

      const historicalData: CoinbaseHistoricalData[] = response.data.map((candle: number[]) => ({
        timestamp: new Date(candle[0] * 1000),
        low: candle[1],
        high: candle[2], 
        open: candle[3],
        close: candle[4],
        volume: candle[5]
      }));

      // Cache for 5 minutes
      await cacheService.set(cacheKey, historicalData, 300);

      return historicalData;
    } catch (error) {
      loggingService.error('Failed to fetch Coinbase historical data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        symbol,
        interval,
        limit
      });
      throw error;
    }
  }

  async getAccountInfo(): Promise<CoinbaseAccountInfo> {
    try {
      if (!this.credentials) {
        throw new Error('Coinbase credentials not configured');
      }

      await rateLimitService.waitForExchangeAvailability('coinbase', 10);

      const response = await this.apiClient.get('/accounts');
      const accounts = response.data;

      const balances: CoinbaseBalance[] = accounts
        .filter((account: any) => parseFloat(account.balance) > 0 || parseFloat(account.hold) > 0)
        .map((account: any) => ({
          currency: account.currency,
          balance: parseFloat(account.balance),
          available: parseFloat(account.available),
          hold: parseFloat(account.hold)
        }));

      loggingService.info('Coinbase account info retrieved', {
        balanceCount: balances.length
      });

      return {
        balances,
        accountType: 'EXCHANGE',
        canTrade: true,
        canWithdraw: true,
        canDeposit: true,
        updateTime: new Date()
      };
    } catch (error) {
      loggingService.error('Failed to fetch Coinbase account info', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getTradingHistory(symbol: string = '', limit: number = 100): Promise<CoinbaseTrade[]> {
    try {
      if (!this.credentials) {
        throw new Error('Coinbase credentials not configured');
      }

      await rateLimitService.waitForExchangeAvailability('coinbase', 10);

      const params: any = { limit };
      if (symbol) {
        params.product_id = symbol;
      }

      const response = await this.apiClient.get('/fills', { params });
      const fills = response.data;

      const formattedTrades: CoinbaseTrade[] = fills.map((fill: any) => ({
        id: fill.trade_id.toString(),
        symbol: fill.product_id,
        side: fill.side,
        quantity: parseFloat(fill.size),
        price: parseFloat(fill.price),
        commission: parseFloat(fill.fee),
        commissionAsset: fill.fee_currency || 'USD',
        time: new Date(fill.created_at),
        isMaker: fill.liquidity === 'M'
      }));

      return formattedTrades;
    } catch (error) {
      loggingService.error('Failed to fetch Coinbase trading history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        symbol
      });
      throw error;
    }
  }

  async getExchangeInfo(): Promise<CoinbaseExchangeInfo> {
    try {
      const cacheKey = 'coinbase:exchange_info';
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        return cached;
      }

      await rateLimitService.waitForExchangeAvailability('coinbase', 1);

      const response = await this.apiClient.get('/products');
      const products = response.data;
      
      const tradingPairs: CoinbaseTradingPair[] = products
        .filter((product: any) => product.status === 'online')
        .map((product: any) => ({
          symbol: product.id,
          baseAsset: product.base_currency,
          quoteAsset: product.quote_currency,
          status: product.status,
          minOrderSize: parseFloat(product.base_min_size),
          tickSize: parseFloat(product.quote_increment)
        }));

      const exchangeInfo: CoinbaseExchangeInfo = {
        timezone: 'UTC',
        serverTime: new Date(),
        rateLimits: [], // Coinbase doesn't expose rate limits in API
        tradingPairs,
        totalPairs: tradingPairs.length
      };

      // Cache for 1 hour
      await cacheService.set(cacheKey, exchangeInfo, 3600);

      return exchangeInfo;
    } catch (error) {
      loggingService.error('Failed to fetch Coinbase exchange info', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  setupWebSocket(symbols: string[], callback: (data: CoinbaseWebSocketData) => void): void {
    try {
      const ws = new WebSocket(this.wsURL);

      ws.on('open', () => {
        const subscribeMessage = {
          type: 'subscribe',
          product_ids: symbols,
          channels: ['ticker']
        };

        ws.send(JSON.stringify(subscribeMessage));

        loggingService.info('Coinbase WebSocket connection established', {
          symbolCount: symbols.length,
          symbols
        });
      });

      ws.on('message', (data: string) => {
        try {
          const parsedData = JSON.parse(data);
          
          if (parsedData.type === 'ticker') {
            const formattedData: CoinbaseWebSocketData = {
              symbol: parsedData.product_id,
              price: parseFloat(parsedData.price),
              change: parseFloat(parsedData.open_24h) - parseFloat(parsedData.price),
              changePercent: ((parseFloat(parsedData.price) - parseFloat(parsedData.open_24h)) / parseFloat(parsedData.open_24h)) * 100,
              volume: parseFloat(parsedData.volume_24h),
              high: parseFloat(parsedData.high_24h),
              low: parseFloat(parsedData.low_24h),
              timestamp: new Date(parsedData.time)
            };

            callback(formattedData);
          }
        } catch (error) {
          loggingService.error('WebSocket data processing error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            data: data.toString()
          });
        }
      });

      ws.on('error', (error) => {
        loggingService.error('Coinbase WebSocket error', {
          error: error.message
        });
        this.emit('error', error);
      });

      ws.on('close', () => {
        loggingService.warn('Coinbase WebSocket connection closed');
        this.emit('disconnected');
        
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          this.setupWebSocket(symbols, callback);
        }, 5000);
      });

      this.websocketConnections.set(symbols.join(','), ws);
    } catch (error) {
      loggingService.error('Failed to setup Coinbase WebSocket', {
        error: error instanceof Error ? error.message : 'Unknown error',
        symbols
      });
      throw error;
    }
  }

  closeWebSocket(symbols: string[]): void {
    const key = symbols.join(',');
    const ws = this.websocketConnections.get(key);
    
    if (ws) {
      ws.close();
      this.websocketConnections.delete(key);
      loggingService.info('Coinbase WebSocket connection closed', { symbols });
    }
  }

  closeAllWebSockets(): void {
    for (const [key, ws] of this.websocketConnections) {
      ws.close();
      loggingService.info('Coinbase WebSocket connection closed', { key });
    }
    this.websocketConnections.clear();
  }

  async testConnection(): Promise<{ connected: boolean; serverTime?: Date; latency?: number; error?: string }> {
    try {
      await rateLimitService.waitForExchangeAvailability('coinbase', 1);
      
      const startTime = Date.now();
      const timeResponse = await this.apiClient.get('/time');
      const endTime = Date.now();
      
      const latency = endTime - startTime;
      const serverTime = new Date(timeResponse.data.iso);

      return {
        connected: true,
        serverTime,
        latency
      };
    } catch (error) {
      loggingService.error('Coinbase connection test failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Static method to create client with credentials
  static createWithCredentials(apiKey: string, apiSecret: string, passphrase: string): CoinbaseClient {
    return new CoinbaseClient({ apiKey, apiSecret, passphrase });
  }

  // Static method to create public client (no credentials needed)
  static createPublic(): CoinbaseClient {
    return new CoinbaseClient();
  }
}

export default CoinbaseClient;