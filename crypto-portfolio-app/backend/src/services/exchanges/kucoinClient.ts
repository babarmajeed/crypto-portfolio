import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import { rateLimitService } from '../rateLimitService';
import { loggingService } from '../loggingService';
import { cacheService } from '../cacheService';
import { EventEmitter } from 'events';

interface KuCoinCredentials {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
}

interface KuCoinPriceData {
  symbol: string;
  price: number;
  timestamp: Date;
  exchange: string;
}

interface KuCoinBalance {
  currency: string;
  balance: number;
  available: number;
  holds: number;
}

interface KuCoinAccountInfo {
  balances: KuCoinBalance[];
  accountType: string;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  updateTime: Date;
}

interface KuCoinTrade {
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

interface KuCoinHistoricalData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface KuCoinExchangeInfo {
  timezone: string;
  serverTime: Date;
  tradingPairs: KuCoinTradingPair[];
  totalPairs: number;
}

interface KuCoinTradingPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  minOrderSize: number;
  tickSize: number;
}

export class KuCoinClient extends EventEmitter {
  private apiClient: AxiosInstance;
  private baseURL = 'https://api.kucoin.com';
  private wsURL = 'wss://ws-api.kucoin.com';
  private websocketConnections: Map<string, WebSocket> = new Map();
  private credentials?: KuCoinCredentials;

  constructor(credentials?: KuCoinCredentials) {
    super();
    this.credentials = credentials;
    
    this.apiClient = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CryptoPortfolio/1.0.0'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for rate limiting and authentication
    this.apiClient.interceptors.request.use(async (config) => {
      try {
        await rateLimitService.waitForExchangeAvailability('kucoin', 1);
        
        if (this.credentials && this.isPrivateEndpoint(config.url || '')) {
          const timestamp = Date.now().toString();
          const method = config.method?.toUpperCase() || 'GET';
          const requestPath = config.url || '';
          const body = config.data ? JSON.stringify(config.data) : '';
          
          const stringToSign = timestamp + method + requestPath + body;
          const signature = this.generateSignature(stringToSign, this.credentials.apiSecret);
          const passphrase = this.generatePassphrase(this.credentials.passphrase, this.credentials.apiSecret);
          
          config.headers = {
            ...config.headers,
            'KC-API-KEY': this.credentials.apiKey,
            'KC-API-SIGN': signature,
            'KC-API-TIMESTAMP': timestamp,
            'KC-API-PASSPHRASE': passphrase,
            'KC-API-KEY-VERSION': '2'
          };
        }
        
        return config;
      } catch (error) {
        loggingService.error('KuCoin request interceptor error', error);
        throw error;
      }
    });

    // Response interceptor for error handling and caching
    this.apiClient.interceptors.response.use(
      (response) => {
        if (response.data.code !== '200000') {
          throw new Error(`KuCoin API Error: ${response.data.msg || 'Unknown error'}`);
        }
        return response;
      },
      (error) => {
        loggingService.error('KuCoin API error', {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        throw error;
      }
    );
  }

  private isPrivateEndpoint(url: string): boolean {
    return url.includes('/api/v1/accounts') || 
           url.includes('/api/v1/orders') || 
           url.includes('/api/v1/fills') ||
           url.includes('/api/v1/deposits') ||
           url.includes('/api/v1/withdrawals');
  }

  private generateSignature(message: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(message).digest('base64');
  }

  private generatePassphrase(passphrase: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(passphrase).digest('base64');
  }

  static createPublic(): KuCoinClient {
    return new KuCoinClient();
  }

  static createWithCredentials(apiKey: string, apiSecret: string, passphrase: string): KuCoinClient {
    return new KuCoinClient({ apiKey, apiSecret, passphrase });
  }

  async testConnection(): Promise<{ connected: boolean; serverTime?: Date; latency?: number; error?: string }> {
    try {
      const startTime = Date.now();
      const response = await this.apiClient.get('/api/v1/timestamp');
      const endTime = Date.now();
      
      return {
        connected: true,
        serverTime: new Date(parseInt(response.data.data)),
        latency: endTime - startTime
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getCurrentPrices(symbols?: string[]): Promise<Record<string, KuCoinPriceData>> {
    try {
      const cacheKey = `kucoin:current_prices:${symbols?.join(',') || 'all'}`;
      const cached = await cacheService.get?.(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      let response;
      if (symbols && symbols.length > 0) {
        // Get specific symbols
        const promises = symbols.map(symbol => 
          this.apiClient.get(`/api/v1/market/orderbook/level1?symbol=${symbol}`)
        );
        const responses = await Promise.all(promises);
        
        const prices: Record<string, KuCoinPriceData> = {};
        responses.forEach((res, index) => {
          const symbol = symbols[index];
          const data = res.data.data;
          if (data && data.price) {
            prices[symbol] = {
              symbol: symbol,
              price: parseFloat(data.price),
              timestamp: new Date(parseInt(data.time)),
              exchange: 'kucoin'
            };
          }
        });
        
        await cacheService.set?.(cacheKey, JSON.stringify(prices), 60);
        return prices;
      } else {
        // Get all tickers
        response = await this.apiClient.get('/api/v1/market/allTickers');
        const tickers = response.data.data.ticker;
        
        const prices: Record<string, KuCoinPriceData> = {};
        tickers.forEach((ticker: any) => {
          prices[ticker.symbol] = {
            symbol: ticker.symbol,
            price: parseFloat(ticker.last),
            timestamp: new Date(parseInt(ticker.time)),
            exchange: 'kucoin'
          };
        });

        await cacheService.set?.(cacheKey, JSON.stringify(prices), 60);
        return prices;
      }
    } catch (error) {
      loggingService.error('Error fetching KuCoin prices', error);
      throw error;
    }
  }

  async getHistoricalPrices(symbol: string, interval: string, limit: number): Promise<KuCoinHistoricalData[]> {
    try {
      const cacheKey = `kucoin:historical:${symbol}:${interval}:${limit}`;
      const cached = await cacheService.get?.(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      // KuCoin interval mapping
      const kucoinInterval = this.mapIntervalToKuCoin(interval);
      const endAt = Math.floor(Date.now() / 1000);
      const startAt = endAt - (limit * this.getIntervalSeconds(kucoinInterval));
      
      const response = await this.apiClient.get('/api/v1/market/candles', {
        params: {
          symbol: symbol,
          type: kucoinInterval,
          startAt: startAt,
          endAt: endAt
        }
      });

      const candles = response.data.data;
      const historicalData: KuCoinHistoricalData[] = candles
        .slice(0, limit)
        .map((candle: string[]) => ({
          timestamp: new Date(parseInt(candle[0]) * 1000),
          open: parseFloat(candle[1]),
          close: parseFloat(candle[2]),
          high: parseFloat(candle[3]),
          low: parseFloat(candle[4]),
          volume: parseFloat(candle[5])
        }))
        .reverse(); // KuCoin returns in descending order, we want ascending

      await cacheService.set?.(cacheKey, JSON.stringify(historicalData), 300);
      return historicalData;
    } catch (error) {
      loggingService.error('Error fetching KuCoin historical data', error);
      throw error;
    }
  }

  private mapIntervalToKuCoin(interval: string): string {
    const mapping: Record<string, string> = {
      '60': '1min',     // 1 minute
      '300': '5min',    // 5 minutes
      '900': '15min',   // 15 minutes
      '1800': '30min',  // 30 minutes
      '3600': '1hour',  // 1 hour
      '14400': '4hour', // 4 hours
      '86400': '1day'   // 1 day
    };
    
    return mapping[interval] || '1hour';
  }

  private getIntervalSeconds(interval: string): number {
    const mapping: Record<string, number> = {
      '1min': 60,
      '5min': 300,
      '15min': 900,
      '30min': 1800,
      '1hour': 3600,
      '4hour': 14400,
      '1day': 86400
    };
    
    return mapping[interval] || 3600;
  }

  async getExchangeInfo(): Promise<KuCoinExchangeInfo> {
    try {
      const cacheKey = 'kucoin:exchange_info';
      const cached = await cacheService.get?.(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const response = await this.apiClient.get('/api/v1/symbols');
      const symbols = response.data.data;

      const tradingPairs: KuCoinTradingPair[] = symbols.map((symbol: any) => ({
        symbol: symbol.symbol,
        baseAsset: symbol.baseCurrency,
        quoteAsset: symbol.quoteCurrency,
        status: symbol.enableTrading ? 'TRADING' : 'BREAK',
        minOrderSize: parseFloat(symbol.baseMinSize || '0'),
        tickSize: parseFloat(symbol.priceIncrement || '0')
      }));

      const exchangeInfo: KuCoinExchangeInfo = {
        timezone: 'UTC',
        serverTime: new Date(),
        tradingPairs,
        totalPairs: tradingPairs.length
      };

      await cacheService.set?.(cacheKey, JSON.stringify(exchangeInfo), 3600);
      return exchangeInfo;
    } catch (error) {
      loggingService.error('Error fetching KuCoin exchange info', error);
      throw error;
    }
  }

  async getAccountInfo(): Promise<KuCoinAccountInfo> {
    if (!this.credentials) {
      throw new Error('KuCoin credentials required for account info');
    }

    try {
      const response = await this.apiClient.get('/api/v1/accounts');
      const accounts = response.data.data;

      const balances: KuCoinBalance[] = accounts
        .filter((account: any) => account.type === 'trade') // Only trading accounts
        .map((account: any) => ({
          currency: account.currency,
          balance: parseFloat(account.balance),
          available: parseFloat(account.available),
          holds: parseFloat(account.holds)
        }));

      return {
        balances,
        accountType: 'spot',
        canTrade: true,
        canWithdraw: true,
        canDeposit: true,
        updateTime: new Date()
      };
    } catch (error) {
      loggingService.error('Error fetching KuCoin account info', error);
      throw error;
    }
  }

  async getTradeHistory(symbol?: string, limit = 50): Promise<KuCoinTrade[]> {
    if (!this.credentials) {
      throw new Error('KuCoin credentials required for trade history');
    }

    try {
      const params: any = { pageSize: limit };
      if (symbol) {
        params.symbol = symbol;
      }

      const response = await this.apiClient.get('/api/v1/fills', { params });
      const fills = response.data.data.items;

      const trades: KuCoinTrade[] = fills.map((fill: any) => ({
        id: fill.tradeId,
        symbol: fill.symbol,
        side: fill.side as 'buy' | 'sell',
        quantity: parseFloat(fill.size),
        price: parseFloat(fill.price),
        commission: parseFloat(fill.fee),
        commissionAsset: fill.feeCurrency,
        time: new Date(parseInt(fill.createdAt)),
        isMaker: fill.liquidity === 'maker'
      }));

      return trades;
    } catch (error) {
      loggingService.error('Error fetching KuCoin trade history', error);
      throw error;
    }
  }

  async getWebSocketToken(): Promise<string> {
    try {
      const endpoint = this.credentials ? '/api/v1/bullet-private' : '/api/v1/bullet-public';
      const response = await this.apiClient.post(endpoint);
      return response.data.data.token;
    } catch (error) {
      loggingService.error('Error getting KuCoin WebSocket token', error);
      throw error;
    }
  }

  async setupWebSocket(symbols: string[], callback: (data: any) => void): Promise<void> {
    try {
      const token = await this.getWebSocketToken();
      const connectId = Math.random().toString(36).substr(2, 9);
      const wsUrl = `${this.wsURL}/endpoint?token=${token}&connectId=${connectId}`;
      
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        loggingService.info('KuCoin WebSocket connected');
        
        // Subscribe to ticker updates
        const subscribeMessage = {
          id: connectId,
          type: 'subscribe',
          topic: `/market/ticker:${symbols.join(',')}`
        };
        
        ws.send(JSON.stringify(subscribeMessage));
      });

      ws.on('message', (data: string) => {
        try {
          const message = JSON.parse(data);
          
          if (message.type === 'message' && message.topic?.includes('/market/ticker:')) {
            const tickerData = message.data;
            
            const priceData = {
              symbol: tickerData.symbol,
              price: parseFloat(tickerData.price),
              timestamp: new Date(parseInt(tickerData.time)),
              exchange: 'kucoin'
            };
            
            callback(priceData);
          }
        } catch (error) {
          loggingService.error('Error parsing KuCoin WebSocket message', error);
        }
      });

      ws.on('error', (error) => {
        loggingService.error('KuCoin WebSocket error', error);
        this.emit('websocket-error', error);
      });

      ws.on('close', () => {
        loggingService.info('KuCoin WebSocket disconnected');
        this.emit('websocket-close');
      });

      this.websocketConnections.set('ticker', ws);
    } catch (error) {
      loggingService.error('Error setting up KuCoin WebSocket', error);
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