import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import { rateLimitService } from '../rateLimitService';
import { loggingService } from '../loggingService';
import { cacheService } from '../cacheService';
import { EventEmitter } from 'events';

interface KrakenCredentials {
  apiKey: string;
  apiSecret: string;
}

interface KrakenPriceData {
  symbol: string;
  price: number;
  timestamp: Date;
  exchange: string;
}

interface KrakenBalance {
  asset: string;
  balance: number;
  available: number;
  reserved: number;
}

interface KrakenAccountInfo {
  balances: KrakenBalance[];
  accountType: string;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  updateTime: Date;
}

interface KrakenTrade {
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

interface KrakenHistoricalData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface KrakenExchangeInfo {
  timezone: string;
  serverTime: Date;
  tradingPairs: KrakenTradingPair[];
  totalPairs: number;
}

interface KrakenTradingPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  minOrderSize: number;
  tickSize: number;
}

export class KrakenClient extends EventEmitter {
  private apiClient: AxiosInstance;
  private baseURL = 'https://api.kraken.com';
  private wsURL = 'wss://ws.kraken.com';
  private websocketConnections: Map<string, WebSocket> = new Map();
  private credentials?: KrakenCredentials;

  constructor(credentials?: KrakenCredentials) {
    super();
    this.credentials = credentials;
    
    this.apiClient = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'CryptoPortfolio/1.0.0'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for rate limiting and authentication
    this.apiClient.interceptors.request.use(async (config) => {
      try {
        await rateLimitService.waitForExchangeAvailability('kraken', 1);
        
        if (this.credentials && config.url?.startsWith('/0/private/')) {
          const nonce = Date.now() * 1000;
          const postData = `nonce=${nonce}&${config.data || ''}`;
          
          const signature = this.generateSignature(config.url, postData, nonce);
          
          config.headers = {
            ...config.headers,
            'API-Key': this.credentials.apiKey,
            'API-Sign': signature
          };
          
          config.data = postData;
        }
        
        return config;
      } catch (error) {
        loggingService.error('Kraken request interceptor error', error);
        throw error;
      }
    });

    // Response interceptor for error handling and caching
    this.apiClient.interceptors.response.use(
      (response) => {
        if (response.data.error && response.data.error.length > 0) {
          throw new Error(`Kraken API Error: ${response.data.error.join(', ')}`);
        }
        return response;
      },
      (error) => {
        loggingService.error('Kraken API error', {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        throw error;
      }
    );
  }

  private generateSignature(path: string, postData: string, nonce: number): string {
    if (!this.credentials) {
      throw new Error('Kraken credentials not provided');
    }

    const sha256 = crypto.createHash('sha256');
    const hash = sha256.update(nonce + postData).digest();
    
    const hmac = crypto.createHmac('sha512', Buffer.from(this.credentials.apiSecret, 'base64'));
    const signature = hmac.update(path + hash).digest('base64');
    
    return signature;
  }

  static createPublic(): KrakenClient {
    return new KrakenClient();
  }

  static createWithCredentials(apiKey: string, apiSecret: string): KrakenClient {
    return new KrakenClient({ apiKey, apiSecret });
  }

  async testConnection(): Promise<{ connected: boolean; serverTime?: Date; latency?: number; error?: string }> {
    try {
      const startTime = Date.now();
      const response = await this.apiClient.get('/0/public/Time');
      const endTime = Date.now();
      
      return {
        connected: true,
        serverTime: new Date(response.data.result.unixtime * 1000),
        latency: endTime - startTime
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getCurrentPrices(symbols?: string[]): Promise<Record<string, KrakenPriceData>> {
    try {
      const cacheKey = `kraken:current_prices:${symbols?.join(',') || 'all'}`;
      const cached = await cacheService.get?.(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const response = await this.apiClient.get('/0/public/Ticker', {
        params: symbols ? { pair: symbols.join(',') } : {}
      });

      const prices: Record<string, KrakenPriceData> = {};
      const result = response.data.result;

      for (const [symbol, data] of Object.entries(result)) {
        const priceArray = data as any;
        prices[symbol] = {
          symbol: symbol,
          price: parseFloat(priceArray.c[0]), // Last trade price
          timestamp: new Date(),
          exchange: 'kraken'
        };
      }

      await cacheService.set?.(cacheKey, JSON.stringify(prices), 60); // Cache for 60 seconds
      return prices;
    } catch (error) {
      loggingService.error('Error fetching Kraken prices', error);
      throw error;
    }
  }

  async getHistoricalPrices(symbol: string, interval: string, limit: number): Promise<KrakenHistoricalData[]> {
    try {
      const cacheKey = `kraken:historical:${symbol}:${interval}:${limit}`;
      const cached = await cacheService.get?.(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      // Kraken interval mapping
      const krakenInterval = this.mapIntervalToKraken(interval);
      
      const response = await this.apiClient.get('/0/public/OHLC', {
        params: {
          pair: symbol,
          interval: krakenInterval
        }
      });

      const result = response.data.result;
      const symbolData = result[Object.keys(result)[0]]; // Get data for the symbol
      
      const historicalData: KrakenHistoricalData[] = symbolData
        .slice(-limit) // Get last 'limit' entries
        .map((candle: any[]) => ({
          timestamp: new Date(candle[0] * 1000),
          open: parseFloat(candle[1]),
          high: parseFloat(candle[2]),
          low: parseFloat(candle[3]),
          close: parseFloat(candle[4]),
          volume: parseFloat(candle[6])
        }));

      await cacheService.set?.(cacheKey, JSON.stringify(historicalData), 300); // Cache for 5 minutes
      return historicalData;
    } catch (error) {
      loggingService.error('Error fetching Kraken historical data', error);
      throw error;
    }
  }

  private mapIntervalToKraken(interval: string): number {
    const mapping: Record<string, number> = {
      '60': 1,      // 1 minute
      '300': 5,     // 5 minutes
      '900': 15,    // 15 minutes
      '1800': 30,   // 30 minutes
      '3600': 60,   // 1 hour
      '14400': 240, // 4 hours
      '86400': 1440 // 1 day
    };
    
    return mapping[interval] || 60; // Default to 1 hour
  }

  async getExchangeInfo(): Promise<KrakenExchangeInfo> {
    try {
      const cacheKey = 'kraken:exchange_info';
      const cached = await cacheService.get?.(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const response = await this.apiClient.get('/0/public/AssetPairs');
      const result = response.data.result;

      const tradingPairs: KrakenTradingPair[] = [];
      
      for (const [pairName, pairData] of Object.entries(result)) {
        const pair = pairData as any;
        
        tradingPairs.push({
          symbol: pairName,
          baseAsset: pair.base,
          quoteAsset: pair.quote,
          status: pair.status === 'online' ? 'TRADING' : 'BREAK',
          minOrderSize: parseFloat(pair.ordermin || '0'),
          tickSize: Math.pow(10, -pair.pair_decimals)
        });
      }

      const exchangeInfo: KrakenExchangeInfo = {
        timezone: 'UTC',
        serverTime: new Date(),
        tradingPairs,
        totalPairs: tradingPairs.length
      };

      await cacheService.set?.(cacheKey, JSON.stringify(exchangeInfo), 3600); // Cache for 1 hour
      return exchangeInfo;
    } catch (error) {
      loggingService.error('Error fetching Kraken exchange info', error);
      throw error;
    }
  }

  async getAccountInfo(): Promise<KrakenAccountInfo> {
    if (!this.credentials) {
      throw new Error('Kraken credentials required for account info');
    }

    try {
      const response = await this.apiClient.post('/0/private/Balance');
      const result = response.data.result;

      const balances: KrakenBalance[] = [];
      
      for (const [asset, balance] of Object.entries(result)) {
        balances.push({
          asset: asset,
          balance: parseFloat(balance as string),
          available: parseFloat(balance as string), // Kraken doesn't separate available/reserved in balance call
          reserved: 0
        });
      }

      return {
        balances,
        accountType: 'spot',
        canTrade: true,
        canWithdraw: true,
        canDeposit: true,
        updateTime: new Date()
      };
    } catch (error) {
      loggingService.error('Error fetching Kraken account info', error);
      throw error;
    }
  }

  async getTradeHistory(symbol?: string, limit = 50): Promise<KrakenTrade[]> {
    if (!this.credentials) {
      throw new Error('Kraken credentials required for trade history');
    }

    try {
      const params: any = { trades: true };
      if (symbol) {
        params.pair = symbol;
      }

      const response = await this.apiClient.post('/0/private/TradesHistory', 
        new URLSearchParams(params).toString()
      );
      
      const result = response.data.result;
      const trades: KrakenTrade[] = [];

      for (const [tradeId, tradeData] of Object.entries(result.trades)) {
        const trade = tradeData as any;
        
        trades.push({
          id: tradeId,
          symbol: trade.pair,
          side: trade.type as 'buy' | 'sell',
          quantity: parseFloat(trade.vol),
          price: parseFloat(trade.price),
          commission: parseFloat(trade.fee),
          commissionAsset: trade.pair.split('/')[1], // Assuming quote asset for fees
          time: new Date(trade.time * 1000),
          isMaker: trade.maker === true
        });
      }

      return trades.slice(0, limit);
    } catch (error) {
      loggingService.error('Error fetching Kraken trade history', error);
      throw error;
    }
  }

  setupWebSocket(symbols: string[], callback: (data: any) => void): void {
    try {
      const ws = new WebSocket(this.wsURL);
      
      ws.on('open', () => {
        loggingService.info('Kraken WebSocket connected');
        
        // Subscribe to ticker updates
        const subscribeMessage = {
          event: 'subscribe',
          pair: symbols,
          subscription: { name: 'ticker' }
        };
        
        ws.send(JSON.stringify(subscribeMessage));
      });

      ws.on('message', (data: string) => {
        try {
          const message = JSON.parse(data);
          
          if (Array.isArray(message) && message[2] === 'ticker') {
            const tickerData = message[1];
            const symbol = message[3];
            
            const priceData = {
              symbol: symbol,
              price: parseFloat(tickerData.c[0]), // Last trade price
              timestamp: new Date(),
              exchange: 'kraken'
            };
            
            callback(priceData);
          }
        } catch (error) {
          loggingService.error('Error parsing Kraken WebSocket message', error);
        }
      });

      ws.on('error', (error) => {
        loggingService.error('Kraken WebSocket error', error);
        this.emit('websocket-error', error);
      });

      ws.on('close', () => {
        loggingService.info('Kraken WebSocket disconnected');
        this.emit('websocket-close');
      });

      this.websocketConnections.set('ticker', ws);
    } catch (error) {
      loggingService.error('Error setting up Kraken WebSocket', error);
      throw error;
    }
  }

  closeWebSocket(connectionId: string): void {
    const ws = this.websocketConnections.get(connectionId);
    if (ws) {
      ws.close();
      this.websocketConnections.delete(connectionId);
    }
  }

  closeAllWebSockets(): void {
    for (const [connectionId] of this.websocketConnections) {
      this.closeWebSocket(connectionId);
    }
  }

  isAuthenticated(): boolean {
    return !!this.credentials;
  }
}