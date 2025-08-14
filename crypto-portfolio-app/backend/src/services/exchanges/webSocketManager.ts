import { EventEmitter } from 'events';
import { exchangeService } from './exchangeService';
import { loggingService } from '../loggingService';
import { cacheService } from '../cacheService';
import { rateLimitService } from '../rateLimitService';
import WebSocket from 'ws';

interface StreamData {
  symbol: string;
  price: number;
  volume?: number;
  change24h?: number;
  timestamp: Date;
  exchange: string;
  type: 'price' | 'trade' | 'orderbook' | 'ticker';
}

interface SubscriptionConfig {
  exchange: string;
  symbols: string[];
  types: ('price' | 'trade' | 'orderbook' | 'ticker')[];
  userId?: string;
}

interface WebSocketConnection {
  exchange: string;
  ws: WebSocket;
  url: string;
  isConnected: boolean;
  lastPing: Date;
  reconnectAttempts: number;
  subscriptions: Set<string>;
}

interface StreamSubscription {
  id: string;
  userId?: string;
  exchange: string;
  symbols: string[];
  types: string[];
  callback?: (data: StreamData) => void;
  isActive: boolean;
  createdAt: Date;
}

export class WebSocketManager extends EventEmitter {
  private connections: Map<string, WebSocketConnection> = new Map();
  private subscriptions: Map<string, StreamSubscription> = new Map();
  private reconnectIntervals: Map<string, NodeJS.Timeout> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  private supportedExchanges: string[];
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 5000;
  private heartbeatInterval: number = 30000;

  constructor() {
    super();
    this.supportedExchanges = exchangeService.getSupportedExchanges();
    this.setupGracefulShutdown();
  }

  private setupGracefulShutdown(): void {
    process.on('SIGINT', () => this.disconnectAll());
    process.on('SIGTERM', () => this.disconnectAll());
    process.on('exit', () => this.disconnectAll());
  }

  async connect(exchange: string, symbols: string[] = []): Promise<boolean> {
    try {
      if (!this.supportedExchanges.includes(exchange)) {
        throw new Error(`Unsupported exchange: ${exchange}`);
      }

      // Check if already connected
      const existing = this.connections.get(exchange);
      if (existing?.isConnected) {
        loggingService.warn('WebSocket already connected', { exchange });
        return true;
      }

      // Get WebSocket URL for exchange
      const wsUrl = await this.getWebSocketUrl(exchange);
      if (!wsUrl) {
        throw new Error(`Failed to get WebSocket URL for ${exchange}`);
      }

      // Create WebSocket connection
      const ws = new WebSocket(wsUrl);
      const connection: WebSocketConnection = {
        exchange,
        ws,
        url: wsUrl,
        isConnected: false,
        lastPing: new Date(),
        reconnectAttempts: 0,
        subscriptions: new Set()
      };

      // Setup WebSocket event handlers
      this.setupWebSocketHandlers(connection);

      // Store connection
      this.connections.set(exchange, connection);

      // Wait for connection to open
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`WebSocket connection timeout for ${exchange}`));
        }, 10000);

        ws.once('open', () => {
          clearTimeout(timeout);
          resolve(true);
        });

        ws.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      // Subscribe to initial symbols
      if (symbols.length > 0) {
        await this.subscribeToSymbols(exchange, symbols);
      }

      // Start heartbeat
      this.startHeartbeat(exchange);

      loggingService.info('WebSocket connected successfully', { exchange, url: wsUrl });
      this.emit('connected', { exchange, symbols });

      return true;
    } catch (error) {
      loggingService.error('Failed to connect WebSocket', { exchange, error });
      throw error;
    }
  }

  private setupWebSocketHandlers(connection: WebSocketConnection): void {
    const { exchange, ws } = connection;

    ws.on('open', () => {
      connection.isConnected = true;
      connection.reconnectAttempts = 0;
      loggingService.info('WebSocket opened', { exchange });
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        this.handleMessage(exchange, data);
      } catch (error) {
        loggingService.error('Error handling WebSocket message', { exchange, error });
      }
    });

    ws.on('close', (code: number, reason: string) => {
      connection.isConnected = false;
      loggingService.warn('WebSocket closed', { exchange, code, reason });
      this.emit('disconnected', { exchange, code, reason });
      
      // Attempt reconnection if not intentional
      if (code !== 1000 && connection.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect(exchange);
      }
    });

    ws.on('error', (error: Error) => {
      loggingService.error('WebSocket error', { exchange, error: error.message });
      this.emit('error', { exchange, error });
    });

    ws.on('pong', () => {
      connection.lastPing = new Date();
    });
  }

  private async handleMessage(exchange: string, data: WebSocket.Data): Promise<void> {
    try {
      const message = JSON.parse(data.toString());
      
      // Parse exchange-specific message format
      const streamData = await this.parseExchangeMessage(exchange, message);
      
      if (streamData) {
        // Cache the data
        await this.cacheStreamData(streamData);
        
        // Emit to subscribers
        this.emit('data', streamData);
        this.emit(`${exchange}:data`, streamData);
        this.emit(`${exchange}:${streamData.type}`, streamData);
        
        // Update subscription callbacks
        for (const subscription of this.subscriptions.values()) {
          if (subscription.exchange === exchange && 
              subscription.symbols.includes(streamData.symbol) &&
              subscription.isActive &&
              subscription.callback) {
            subscription.callback(streamData);
          }
        }
      }
    } catch (error) {
      loggingService.error('Error parsing WebSocket message', { exchange, error });
    }
  }

  private async parseExchangeMessage(exchange: string, message: any): Promise<StreamData | null> {
    try {
      switch (exchange) {
        case 'binance':
          return this.parseBinanceMessage(message);
        case 'coinbase':
          return this.parseCoinbaseMessage(message);
        case 'kraken':
          return this.parseKrakenMessage(message);
        case 'kucoin':
          return this.parseKuCoinMessage(message);
        default:
          return null;
      }
    } catch (error) {
      loggingService.error('Error parsing exchange message', { exchange, error });
      return null;
    }
  }

  private parseBinanceMessage(message: any): StreamData | null {
    if (message.e === '24hrTicker') {
      return {
        symbol: message.s,
        price: parseFloat(message.c),
        volume: parseFloat(message.v),
        change24h: parseFloat(message.P),
        timestamp: new Date(message.E),
        exchange: 'binance',
        type: 'ticker'
      };
    }
    
    if (message.e === 'trade') {
      return {
        symbol: message.s,
        price: parseFloat(message.p),
        volume: parseFloat(message.q),
        timestamp: new Date(message.T),
        exchange: 'binance',
        type: 'trade'
      };
    }

    return null;
  }

  private parseCoinbaseMessage(message: any): StreamData | null {
    if (message.type === 'ticker') {
      return {
        symbol: message.product_id,
        price: parseFloat(message.price),
        volume: parseFloat(message.volume_24h),
        timestamp: new Date(message.time),
        exchange: 'coinbase',
        type: 'ticker'
      };
    }
    
    if (message.type === 'match') {
      return {
        symbol: message.product_id,
        price: parseFloat(message.price),
        volume: parseFloat(message.size),
        timestamp: new Date(message.time),
        exchange: 'coinbase',
        type: 'trade'
      };
    }

    return null;
  }

  private parseKrakenMessage(message: any): StreamData | null {
    if (Array.isArray(message) && message[1] && message[2] === 'ticker') {
      const tickerData = message[1];
      return {
        symbol: message[3], // Symbol from channel name
        price: parseFloat(tickerData.c[0]), // Last price
        volume: parseFloat(tickerData.v[1]), // 24h volume
        change24h: parseFloat(tickerData.p[1]), // 24h change
        timestamp: new Date(),
        exchange: 'kraken',
        type: 'ticker'
      };
    }
    
    if (Array.isArray(message) && message[1] && message[2] === 'trade') {
      const trades = message[1];
      if (trades.length > 0) {
        const lastTrade = trades[trades.length - 1];
        return {
          symbol: message[3],
          price: parseFloat(lastTrade[0]),
          volume: parseFloat(lastTrade[1]),
          timestamp: new Date(parseFloat(lastTrade[2]) * 1000),
          exchange: 'kraken',
          type: 'trade'
        };
      }
    }

    return null;
  }

  private parseKuCoinMessage(message: any): StreamData | null {
    if (message.type === 'message') {
      const data = message.data;
      
      if (message.topic?.includes('/ticker:')) {
        return {
          symbol: message.subject,
          price: parseFloat(data.price),
          volume: parseFloat(data.vol),
          change24h: parseFloat(data.changeRate) * 100,
          timestamp: new Date(parseInt(data.time)),
          exchange: 'kucoin',
          type: 'ticker'
        };
      }
      
      if (message.topic?.includes('/market/match:')) {
        return {
          symbol: message.subject,
          price: parseFloat(data.price),
          volume: parseFloat(data.size),
          timestamp: new Date(parseInt(data.time)),
          exchange: 'kucoin',
          type: 'trade'
        };
      }
    }

    return null;
  }

  private async cacheStreamData(data: StreamData): Promise<void> {
    try {
      const cacheKey = `ws:${data.exchange}:${data.type}:${data.symbol}`;
      await cacheService.set?.(cacheKey, JSON.stringify(data), 300); // 5-minute cache
    } catch (error) {
      loggingService.error('Error caching stream data', error);
    }
  }

  private async getWebSocketUrl(exchange: string): Promise<string | null> {
    try {
      switch (exchange) {
        case 'binance':
          return 'wss://stream.binance.com:9443/ws/!ticker@arr';
        case 'coinbase':
          return 'wss://ws-feed.exchange.coinbase.com';
        case 'kraken':
          return 'wss://ws.kraken.com';
        case 'kucoin':
          // KuCoin requires getting WebSocket token first
          const client = exchangeService.getPublicClient('kucoin');
          if (client && 'getWebSocketToken' in client) {
            const token = await (client as any).getWebSocketToken();
            return `wss://ws-api-spot.kucoin.com/?token=${token}`;
          }
          return null;
        default:
          return null;
      }
    } catch (error) {
      loggingService.error('Error getting WebSocket URL', { exchange, error });
      return null;
    }
  }

  private async subscribeToSymbols(exchange: string, symbols: string[]): Promise<void> {
    const connection = this.connections.get(exchange);
    if (!connection?.isConnected) {
      throw new Error(`WebSocket not connected for ${exchange}`);
    }

    try {
      const subscribeMessage = this.createSubscribeMessage(exchange, symbols);
      if (subscribeMessage) {
        connection.ws.send(JSON.stringify(subscribeMessage));
        symbols.forEach(symbol => connection.subscriptions.add(symbol));
        loggingService.info('Subscribed to symbols', { exchange, symbols });
      }
    } catch (error) {
      loggingService.error('Error subscribing to symbols', { exchange, symbols, error });
      throw error;
    }
  }

  private createSubscribeMessage(exchange: string, symbols: string[]): any {
    switch (exchange) {
      case 'binance':
        return {
          method: 'SUBSCRIBE',
          params: symbols.flatMap(symbol => [
            `${symbol.toLowerCase()}@ticker`,
            `${symbol.toLowerCase()}@trade`
          ]),
          id: Date.now()
        };
      
      case 'coinbase':
        return {
          type: 'subscribe',
          product_ids: symbols,
          channels: ['ticker', 'matches']
        };
      
      case 'kraken':
        return {
          event: 'subscribe',
          pair: symbols,
          subscription: {
            name: 'ticker'
          }
        };
      
      case 'kucoin':
        return {
          id: Date.now(),
          type: 'subscribe',
          topic: `/market/ticker:${symbols.join(',')}`
        };
      
      default:
        return null;
    }
  }

  private scheduleReconnect(exchange: string): void {
    const connection = this.connections.get(exchange);
    if (!connection) return;

    connection.reconnectAttempts++;
    
    const delay = this.reconnectDelay * Math.pow(2, connection.reconnectAttempts - 1);
    
    loggingService.info('Scheduling WebSocket reconnect', { 
      exchange, 
      attempt: connection.reconnectAttempts, 
      delay 
    });

    const reconnectTimer = setTimeout(async () => {
      try {
        await this.reconnect(exchange);
      } catch (error) {
        loggingService.error('Reconnection failed', { exchange, error });
      }
    }, delay);

    this.reconnectIntervals.set(exchange, reconnectTimer);
  }

  private async reconnect(exchange: string): Promise<void> {
    const connection = this.connections.get(exchange);
    if (!connection) return;

    try {
      // Close existing connection
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.close();
      }

      // Get subscribed symbols
      const symbols = Array.from(connection.subscriptions);
      
      // Remove old connection
      this.connections.delete(exchange);
      
      // Create new connection
      await this.connect(exchange, symbols);
      
      loggingService.info('WebSocket reconnected successfully', { exchange });
    } catch (error) {
      loggingService.error('Reconnection failed', { exchange, error });
      
      // Schedule another reconnect if not exceeded max attempts
      if (connection.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect(exchange);
      }
    }
  }

  private startHeartbeat(exchange: string): void {
    const heartbeat = setInterval(() => {
      const connection = this.connections.get(exchange);
      if (connection?.isConnected && connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.ping();
      } else {
        clearInterval(heartbeat);
      }
    }, this.heartbeatInterval);

    this.heartbeatIntervals.set(exchange, heartbeat);
  }

  async subscribe(config: SubscriptionConfig, callback?: (data: StreamData) => void): Promise<string> {
    const subscriptionId = `${config.exchange}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Ensure connection exists
      if (!this.connections.get(config.exchange)?.isConnected) {
        await this.connect(config.exchange);
      }

      // Create subscription
      const subscription: StreamSubscription = {
        id: subscriptionId,
        userId: config.userId,
        exchange: config.exchange,
        symbols: config.symbols,
        types: config.types,
        callback,
        isActive: true,
        createdAt: new Date()
      };

      this.subscriptions.set(subscriptionId, subscription);

      // Subscribe to symbols on exchange
      await this.subscribeToSymbols(config.exchange, config.symbols);

      loggingService.info('Created WebSocket subscription', {
        subscriptionId,
        exchange: config.exchange,
        symbols: config.symbols,
        userId: config.userId
      });

      return subscriptionId;
    } catch (error) {
      loggingService.error('Error creating subscription', { config, error });
      throw error;
    }
  }

  async unsubscribe(subscriptionId: string): Promise<boolean> {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        return false;
      }

      subscription.isActive = false;
      this.subscriptions.delete(subscriptionId);

      loggingService.info('Unsubscribed from WebSocket stream', {
        subscriptionId,
        exchange: subscription.exchange
      });

      return true;
    } catch (error) {
      loggingService.error('Error unsubscribing', { subscriptionId, error });
      return false;
    }
  }

  async disconnect(exchange: string): Promise<boolean> {
    try {
      const connection = this.connections.get(exchange);
      if (!connection) {
        return false;
      }

      // Clear intervals
      const reconnectTimer = this.reconnectIntervals.get(exchange);
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        this.reconnectIntervals.delete(exchange);
      }

      const heartbeatTimer = this.heartbeatIntervals.get(exchange);
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        this.heartbeatIntervals.delete(exchange);
      }

      // Close WebSocket
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.close(1000, 'Disconnected by user');
      }

      // Remove connection
      this.connections.delete(exchange);

      // Deactivate related subscriptions
      for (const subscription of this.subscriptions.values()) {
        if (subscription.exchange === exchange) {
          subscription.isActive = false;
        }
      }

      loggingService.info('WebSocket disconnected', { exchange });
      return true;
    } catch (error) {
      loggingService.error('Error disconnecting WebSocket', { exchange, error });
      return false;
    }
  }

  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.connections.keys()).map(exchange =>
      this.disconnect(exchange)
    );
    
    await Promise.allSettled(disconnectPromises);
    loggingService.info('All WebSocket connections disconnected');
  }

  getConnectionStatus(): Record<string, {
    isConnected: boolean;
    lastPing: Date;
    reconnectAttempts: number;
    subscriptionCount: number;
  }> {
    const status: Record<string, any> = {};
    
    for (const [exchange, connection] of this.connections.entries()) {
      const subscriptionCount = Array.from(this.subscriptions.values())
        .filter(sub => sub.exchange === exchange && sub.isActive).length;
      
      status[exchange] = {
        isConnected: connection.isConnected,
        lastPing: connection.lastPing,
        reconnectAttempts: connection.reconnectAttempts,
        subscriptionCount
      };
    }
    
    return status;
  }

  getActiveSubscriptions(): StreamSubscription[] {
    return Array.from(this.subscriptions.values()).filter(sub => sub.isActive);
  }

  async getCachedData(exchange: string, symbol: string, type: string = 'ticker'): Promise<StreamData | null> {
    try {
      const cacheKey = `ws:${exchange}:${type}:${symbol}`;
      const cached = await cacheService.get?.(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      loggingService.error('Error getting cached stream data', error);
      return null;
    }
  }
}

// Create singleton instance
export const webSocketManager = new WebSocketManager();
export default webSocketManager;