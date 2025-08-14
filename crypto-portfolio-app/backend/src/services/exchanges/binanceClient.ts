import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import { rateLimitService } from '../rateLimitService';
import { loggingService } from '../loggingService';
import { cacheService } from '../cacheService';
import { EventEmitter } from 'events';

interface BinanceCredentials {
  apiKey: string;
  apiSecret: string;
}

interface BinancePriceData {
  symbol: string;
  price: number;
  timestamp: Date;
  exchange: string;
}

interface BinanceBalance {
  asset: string;
  free: number;
  locked: number;
  total: number;
}

interface BinanceAccountInfo {
  balances: BinanceBalance[];
  accountType: string;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  updateTime: Date;
}

interface BinanceTrade {
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

interface BinanceHistoricalData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface BinanceExchangeInfo {
  timezone: string;
  serverTime: Date;
  rateLimits: any[];
  tradingPairs: BinanceTradingPair[];
  totalPairs: number;
}

interface BinanceTradingPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  minOrderSize: number;
  tickSize: number;
}

interface BinanceWebSocketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  timestamp: Date;
}

export class BinanceClient extends EventEmitter {
  private apiClient: AxiosInstance;
  private baseURL = 'https://api.binance.com';
  private wsURL = 'wss://stream.binance.com:9443/ws/';
  private websocketConnections: Map<string, WebSocket> = new Map();

  constructor(private credentials?: BinanceCredentials) {
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
      if (this.credentials && config.url?.includes('/api/v3/account') || config.url?.includes('/api/v3/myTrades')) {
        const timestamp = Date.now();
        const queryString = new URLSearchParams({
          timestamp: timestamp.toString(),
          ...config.params
        }).toString();

        const signature = crypto
          .createHmac('sha256', this.credentials.apiSecret)
          .update(queryString)
          .digest('hex');

        config.headers = {
          ...config.headers,
          'X-MBX-APIKEY': this.credentials.apiKey
        };

        config.params = {
          ...config.params,
          timestamp,
          signature
        };
      }
      return config;
    });

    // Add response interceptor for error handling
    this.apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        loggingService.error('Binance API error', {
          error: error.message,
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url
        });
        throw error;
      }
    );
  }

  async getCurrentPrices(symbols: string[] = []): Promise<Record<string, BinancePriceData>> {
    try {
      await rateLimitService.waitForExchangeAvailability('binance', 1);

      const cacheKey = `binance:current_prices:${symbols.join(',')}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        return cached;
      }

      let response;
      if (symbols.length === 0) {
        response = await this.apiClient.get('/api/v3/ticker/price');
      } else {
        const symbolsParam = symbols.map(s => `"${s}"`).join(',');
        response = await this.apiClient.get('/api/v3/ticker/price', {
          params: { symbols: `[${symbolsParam}]` }
        });
      }

      const prices = Array.isArray(response.data) ? response.data : [response.data];
      const formattedPrices: Record<string, BinancePriceData> = {};

      for (const priceData of prices) {
        formattedPrices[priceData.symbol] = {
          symbol: priceData.symbol,
          price: parseFloat(priceData.price),
          timestamp: new Date(),
          exchange: 'binance'
        };
      }

      // Cache for 30 seconds
      await cacheService.set(cacheKey, formattedPrices, 30);

      loggingService.info('Binance prices fetched successfully', {
        symbolCount: Object.keys(formattedPrices).length,
        exchange: 'binance'
      });

      return formattedPrices;
    } catch (error) {
      loggingService.error('Failed to fetch Binance prices', {
        error: error instanceof Error ? error.message : 'Unknown error',
        symbols
      });
      throw new Error(`Binance API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getHistoricalPrices(
    symbol: string, 
    interval: string = '1d', 
    limit: number = 100
  ): Promise<BinanceHistoricalData[]> {
    try {
      await rateLimitService.waitForExchangeAvailability('binance', 1);

      const cacheKey = `binance:historical:${symbol}:${interval}:${limit}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        return cached;
      }

      const response = await this.apiClient.get('/api/v3/klines', {
        params: {
          symbol,
          interval,
          limit,
          endTime: Date.now()
        }
      });

      const historicalData: BinanceHistoricalData[] = response.data.map((candle: any[]) => ({
        timestamp: new Date(candle[0]),
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5])
      }));

      // Cache for 5 minutes
      await cacheService.set(cacheKey, historicalData, 300);

      return historicalData;
    } catch (error) {
      loggingService.error('Failed to fetch Binance historical data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        symbol,
        interval,
        limit
      });
      throw error;
    }
  }

  async getAccountInfo(): Promise<BinanceAccountInfo> {
    try {
      if (!this.credentials) {
        throw new Error('Binance credentials not configured');
      }

      await rateLimitService.waitForExchangeAvailability('binance', 10);

      const response = await this.apiClient.get('/api/v3/account');
      const accountData = response.data;

      const balances: BinanceBalance[] = accountData.balances
        .filter((balance: any) => parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0)
        .map((balance: any) => ({
          asset: balance.asset,
          free: parseFloat(balance.free),
          locked: parseFloat(balance.locked),
          total: parseFloat(balance.free) + parseFloat(balance.locked)
        }));

      loggingService.info('Binance account info retrieved', {
        balanceCount: balances.length
      });

      return {
        balances,
        accountType: accountData.accountType,
        canTrade: accountData.canTrade,
        canWithdraw: accountData.canWithdraw,
        canDeposit: accountData.canDeposit,
        updateTime: new Date(accountData.updateTime)
      };
    } catch (error) {
      loggingService.error('Failed to fetch Binance account info', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getTradingHistory(symbol: string = '', limit: number = 100): Promise<BinanceTrade[]> {
    try {
      if (!this.credentials) {
        throw new Error('Binance credentials not configured');
      }

      await rateLimitService.waitForExchangeAvailability('binance', 10);

      let trades: any[] = [];
      
      if (symbol) {
        const response = await this.apiClient.get('/api/v3/myTrades', {
          params: { symbol, limit }
        });
        trades = response.data;
      } else {
        // Get account info to find symbols with balances
        const accountInfo = await this.getAccountInfo();
        const symbols = accountInfo.balances
          .map(b => `${b.asset}USDT`)
          .slice(0, 10); // Limit to top 10 to avoid rate limits

        for (const sym of symbols) {
          try {
            const response = await this.apiClient.get('/api/v3/myTrades', {
              params: { symbol: sym, limit: 50 }
            });
            trades = trades.concat(response.data);
          } catch (error) {
            // Symbol might not exist, continue
            continue;
          }
        }
      }

      const formattedTrades: BinanceTrade[] = trades.map((trade: any) => ({
        id: trade.id.toString(),
        symbol: trade.symbol,
        side: trade.isBuyer ? 'buy' : 'sell',
        quantity: parseFloat(trade.qty),
        price: parseFloat(trade.price),
        commission: parseFloat(trade.commission),
        commissionAsset: trade.commissionAsset,
        time: new Date(trade.time),
        isMaker: trade.isMaker
      }));

      return formattedTrades;
    } catch (error) {
      loggingService.error('Failed to fetch Binance trading history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        symbol
      });
      throw error;
    }
  }

  async getExchangeInfo(): Promise<BinanceExchangeInfo> {
    try {
      const cacheKey = 'binance:exchange_info';
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        return cached;
      }

      await rateLimitService.waitForExchangeAvailability('binance', 1);

      const response = await this.apiClient.get('/api/v3/exchangeInfo');
      const info = response.data;
      
      const tradingPairs: BinanceTradingPair[] = info.symbols
        .filter((symbol: any) => symbol.status === 'TRADING')
        .map((symbol: any) => ({
          symbol: symbol.symbol,
          baseAsset: symbol.baseAsset,
          quoteAsset: symbol.quoteAsset,
          status: symbol.status,
          minOrderSize: this.extractMinOrderSize(symbol.filters),
          tickSize: this.extractTickSize(symbol.filters)
        }));

      const exchangeInfo: BinanceExchangeInfo = {
        timezone: info.timezone,
        serverTime: new Date(info.serverTime),
        rateLimits: info.rateLimits,
        tradingPairs,
        totalPairs: tradingPairs.length
      };

      // Cache for 1 hour
      await cacheService.set(cacheKey, exchangeInfo, 3600);

      return exchangeInfo;
    } catch (error) {
      loggingService.error('Failed to fetch Binance exchange info', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  setupWebSocket(symbols: string[], callback: (data: BinanceWebSocketData) => void): void {
    try {
      const streams = symbols.map(symbol => `${symbol.toLowerCase()}@ticker`);
      const streamString = streams.join('/');
      const wsUrl = `${this.wsURL}${streamString}`;

      const ws = new WebSocket(wsUrl);

      ws.on('open', () => {
        loggingService.info('Binance WebSocket connection established', {
          streamCount: streams.length,
          symbols
        });
      });

      ws.on('message', (data: string) => {
        try {
          const parsedData = JSON.parse(data);
          const tickerData = parsedData.data || parsedData;

          const formattedData: BinanceWebSocketData = {
            symbol: tickerData.s,
            price: parseFloat(tickerData.c),
            change: parseFloat(tickerData.p),
            changePercent: parseFloat(tickerData.P),
            volume: parseFloat(tickerData.v),
            high: parseFloat(tickerData.h),
            low: parseFloat(tickerData.l),
            timestamp: new Date(tickerData.E)
          };

          callback(formattedData);
        } catch (error) {
          loggingService.error('WebSocket data processing error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            data: data.toString()
          });
        }
      });

      ws.on('error', (error) => {
        loggingService.error('Binance WebSocket error', {
          error: error.message
        });
        this.emit('error', error);
      });

      ws.on('close', () => {
        loggingService.warn('Binance WebSocket connection closed');
        this.emit('disconnected');
        
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          this.setupWebSocket(symbols, callback);
        }, 5000);
      });

      this.websocketConnections.set(streamString, ws);
    } catch (error) {
      loggingService.error('Failed to setup Binance WebSocket', {
        error: error instanceof Error ? error.message : 'Unknown error',
        symbols
      });
      throw error;
    }
  }

  closeWebSocket(symbols: string[]): void {
    const streams = symbols.map(symbol => `${symbol.toLowerCase()}@ticker`);
    const streamString = streams.join('/');
    
    const ws = this.websocketConnections.get(streamString);
    if (ws) {
      ws.close();
      this.websocketConnections.delete(streamString);
      loggingService.info('Binance WebSocket connection closed', { symbols });
    }
  }

  closeAllWebSockets(): void {
    for (const [streamString, ws] of this.websocketConnections) {
      ws.close();
      loggingService.info('Binance WebSocket connection closed', { stream: streamString });
    }
    this.websocketConnections.clear();
  }

  private extractMinOrderSize(filters: any[]): number {
    const lotSizeFilter = filters.find(f => f.filterType === 'LOT_SIZE');
    return lotSizeFilter ? parseFloat(lotSizeFilter.minQty) : 0;
  }

  private extractTickSize(filters: any[]): number {
    const priceFilter = filters.find(f => f.filterType === 'PRICE_FILTER');
    return priceFilter ? parseFloat(priceFilter.tickSize) : 0;
  }

  async testConnection(): Promise<{ connected: boolean; serverTime?: Date; latency?: number; error?: string }> {
    try {
      await rateLimitService.waitForExchangeAvailability('binance', 1);
      
      const startTime = Date.now();
      const timeResponse = await this.apiClient.get('/api/v3/time');
      const endTime = Date.now();
      
      const latency = endTime - startTime;
      const serverTime = new Date(timeResponse.data.serverTime);

      return {
        connected: true,
        serverTime,
        latency
      };
    } catch (error) {
      loggingService.error('Binance connection test failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Static method to create client with credentials
  static createWithCredentials(apiKey: string, apiSecret: string): BinanceClient {
    return new BinanceClient({ apiKey, apiSecret });
  }

  // Static method to create public client (no credentials needed)
  static createPublic(): BinanceClient {
    return new BinanceClient();
  }
}

export default BinanceClient;