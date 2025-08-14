import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { exchangeService } from '../exchanges/exchangeService.js';
import { rateLimitingService } from '../exchanges/rateLimitingService.js';
import { loggingService } from '../loggingService.js';
import { redis } from '../../config/redis.js';

/**
 * Price Stream Manager
 * Manages real-time price data streams from multiple exchanges
 * with fallback mechanisms and intelligent routing
 */
class PriceStreamManager extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map(); // exchange -> WebSocket connection
    this.subscriptions = new Map(); // symbol -> Set<exchange>
    this.priceCache = new Map(); // symbol -> latest price data
    this.reconnectAttempts = new Map(); // exchange -> attempt count
    this.connectionStatus = new Map(); // exchange -> boolean
    
    // Configuration
    this.exchanges = ['binance', 'coinbase', 'kraken', 'kucoin'];
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
    this.priceUpdateThreshold = 0.001; // 0.1% change threshold
    this.cacheExpirationTime = 60000; // 1 minute cache expiration
    
    // Metrics
    this.metrics = {
      totalPriceUpdates: 0,
      successfulConnections: 0,
      failedConnections: 0,
      reconnectionCount: 0,
      lastUpdateTime: null,
      averageLatency: 0
    };
    
    this.setupCleanupHandlers();
  }

  /**
   * Initialize all exchange connections
   */
  async initialize() {
    try {
      loggingService.info('Initializing PriceStreamManager');
      
      // Initialize connections for all exchanges
      const connectionPromises = this.exchanges.map(exchange => 
        this.initializeExchangeConnection(exchange)
      );
      
      const results = await Promise.allSettled(connectionPromises);
      
      // Log results
      results.forEach((result, index) => {
        const exchange = this.exchanges[index];
        if (result.status === 'fulfilled') {
          loggingService.info(`Successfully connected to ${exchange}`);
          this.metrics.successfulConnections++;
        } else {
          loggingService.error(`Failed to connect to ${exchange}`, {
            error: result.reason?.message
          });
          this.metrics.failedConnections++;
        }
      });
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      loggingService.info('PriceStreamManager initialized', {
        successfulConnections: this.metrics.successfulConnections,
        failedConnections: this.metrics.failedConnections
      });
      
    } catch (error) {
      loggingService.error('Failed to initialize PriceStreamManager', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Initialize connection for a specific exchange
   */
  async initializeExchangeConnection(exchange) {
    try {
      // Check rate limits before connecting
      const rateLimitStatus = await rateLimitingService.checkRateLimit(exchange, 'websocket');
      if (rateLimitStatus.isBlocked) {
        throw new Error(`Rate limit exceeded for ${exchange}`);
      }
      
      const wsUrl = this.getWebSocketUrl(exchange);
      const ws = new WebSocket(wsUrl);
      
      // Setup connection handlers
      this.setupConnectionHandlers(exchange, ws);
      
      // Wait for connection to open
      await this.waitForConnection(ws);
      
      // Store connection
      this.connections.set(exchange, ws);
      this.connectionStatus.set(exchange, true);
      this.reconnectAttempts.set(exchange, 0);
      
      // Send initial subscription if needed
      await this.sendInitialSubscription(exchange, ws);
      
      return ws;
      
    } catch (error) {
      loggingService.error(`Failed to initialize connection for ${exchange}`, {
        error: error.message
      });
      this.connectionStatus.set(exchange, false);
      throw error;
    }
  }

  /**
   * Setup WebSocket connection event handlers
   */
  setupConnectionHandlers(exchange, ws) {
    ws.on('open', () => {
      loggingService.info(`WebSocket connected to ${exchange}`);
      this.connectionStatus.set(exchange, true);
      this.reconnectAttempts.set(exchange, 0);
      this.emit('connectionChange', exchange, true);
    });

    ws.on('message', (data) => {
      try {
        this.handleMessage(exchange, data);
      } catch (error) {
        loggingService.error(`Error handling message from ${exchange}`, {
          error: error.message,
          data: data.toString().substring(0, 200)
        });
      }
    });

    ws.on('close', (code, reason) => {
      loggingService.warn(`WebSocket disconnected from ${exchange}`, {
        code,
        reason: reason?.toString()
      });
      this.connectionStatus.set(exchange, false);
      this.emit('connectionChange', exchange, false);
      this.scheduleReconnection(exchange);
    });

    ws.on('error', (error) => {
      loggingService.error(`WebSocket error for ${exchange}`, {
        error: error.message
      });
      this.connectionStatus.set(exchange, false);
      this.emit('error', exchange, error);
    });

    // Setup ping/pong for connection health
    ws.on('pong', () => {
      // Connection is alive
      ws.isAlive = true;
    });
  }

  /**
   * Handle incoming price messages from exchanges
   */
  handleMessage(exchange, data) {
    try {
      const message = JSON.parse(data.toString());
      const priceData = this.parsePriceData(exchange, message);
      
      if (!priceData) {
        return; // Not a price update message
      }
      
      const { symbol, price, change24h, volume24h, timestamp } = priceData;
      
      // Validate price data
      if (!symbol || !price || isNaN(price)) {
        return;
      }
      
      // Check if this is a significant price change
      const cachedData = this.priceCache.get(symbol);
      if (cachedData && !this.isSignificantPriceChange(cachedData.price, price)) {
        return; // Skip minor price changes to reduce noise
      }
      
      // Update cache
      const cacheData = {
        symbol,
        price: parseFloat(price),
        change24h: parseFloat(change24h || 0),
        volume24h: parseFloat(volume24h || 0),
        timestamp: new Date(timestamp || Date.now()),
        exchange,
        lastUpdated: new Date()
      };
      
      this.priceCache.set(symbol, cacheData);
      
      // Record metrics
      this.metrics.totalPriceUpdates++;
      this.metrics.lastUpdateTime = new Date();
      
      // Emit price update event
      this.emit('priceUpdate', cacheData);
      
      // Cache in Redis if available
      this.cacheInRedis(symbol, cacheData);
      
    } catch (error) {
      loggingService.error('Error parsing price message', {
        exchange,
        error: error.message,
        data: data.toString().substring(0, 200)
      });
    }
  }

  /**
   * Parse price data from exchange-specific message format
   */
  parsePriceData(exchange, message) {
    try {
      switch (exchange) {
        case 'binance':
          return this.parseBinancePriceData(message);
        case 'coinbase':
          return this.parseCoinbasePriceData(message);
        case 'kraken':
          return this.parseKrakenPriceData(message);
        case 'kucoin':
          return this.parseKucoinPriceData(message);
        default:
          return null;
      }
    } catch (error) {
      loggingService.error(`Error parsing ${exchange} price data`, {
        error: error.message,
        message
      });
      return null;
    }
  }

  /**
   * Parse Binance price data
   */
  parseBinancePriceData(message) {
    if (message.e === '24hrTicker') {
      return {
        symbol: this.normalizeSymbol(message.s),
        price: message.c,
        change24h: message.P,
        volume24h: message.v,
        timestamp: message.E
      };
    }
    return null;
  }

  /**
   * Parse Coinbase price data
   */
  parseCoinbasePriceData(message) {
    if (message.type === 'ticker') {
      return {
        symbol: this.normalizeSymbol(message.product_id),
        price: message.price,
        change24h: message.open_24h ? ((message.price - message.open_24h) / message.open_24h * 100) : 0,
        volume24h: message.volume_24h,
        timestamp: new Date(message.time).getTime()
      };
    }
    return null;
  }

  /**
   * Parse Kraken price data
   */
  parseKrakenPriceData(message) {
    if (Array.isArray(message) && message[1] && message[2] === 'ticker') {
      const tickerData = message[1];
      return {
        symbol: this.normalizeSymbol(message[3]),
        price: tickerData.c[0],
        change24h: ((tickerData.c[0] - tickerData.o) / tickerData.o * 100),
        volume24h: tickerData.v[1],
        timestamp: Date.now()
      };
    }
    return null;
  }

  /**
   * Parse KuCoin price data
   */
  parseKucoinPriceData(message) {
    if (message.type === 'message' && message.topic && message.topic.includes('/market/ticker:')) {
      const data = message.data;
      return {
        symbol: this.normalizeSymbol(data.symbol),
        price: data.price,
        change24h: data.changeRate * 100,
        volume24h: data.vol,
        timestamp: data.time
      };
    }
    return null;
  }

  /**
   * Subscribe to price updates for specific symbols
   */
  async subscribeToSymbols(symbols) {
    try {
      loggingService.info('Subscribing to symbols', { symbols });
      
      for (const symbol of symbols) {
        const normalizedSymbol = this.normalizeSymbol(symbol);
        
        // Determine which exchanges support this symbol
        const supportingExchanges = await this.findSupportingExchanges(normalizedSymbol);
        
        if (supportingExchanges.length === 0) {
          loggingService.warn(`No supporting exchanges found for symbol: ${normalizedSymbol}`);
          continue;
        }
        
        // Subscribe on each supporting exchange
        for (const exchange of supportingExchanges) {
          await this.subscribeSymbolOnExchange(exchange, normalizedSymbol);
        }
        
        // Update subscription map
        this.subscriptions.set(normalizedSymbol, new Set(supportingExchanges));
      }
      
    } catch (error) {
      loggingService.error('Error subscribing to symbols', {
        symbols,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Subscribe to a symbol on a specific exchange
   */
  async subscribeSymbolOnExchange(exchange, symbol) {
    try {
      const connection = this.connections.get(exchange);
      if (!connection || connection.readyState !== WebSocket.OPEN) {
        throw new Error(`No active connection for ${exchange}`);
      }
      
      const subscribeMessage = this.createSubscribeMessage(exchange, symbol);
      if (subscribeMessage) {
        connection.send(JSON.stringify(subscribeMessage));
        loggingService.debug(`Subscribed to ${symbol} on ${exchange}`);
      }
      
    } catch (error) {
      loggingService.error(`Failed to subscribe to ${symbol} on ${exchange}`, {
        error: error.message
      });
    }
  }

  /**
   * Create subscription message for specific exchange
   */
  createSubscribeMessage(exchange, symbol) {
    const exchangeSymbol = this.convertToExchangeSymbol(exchange, symbol);
    
    switch (exchange) {
      case 'binance':
        return {
          method: 'SUBSCRIBE',
          params: [`${exchangeSymbol.toLowerCase()}@ticker`],
          id: Date.now()
        };
        
      case 'coinbase':
        return {
          type: 'subscribe',
          product_ids: [exchangeSymbol],
          channels: ['ticker']
        };
        
      case 'kraken':
        return {
          event: 'subscribe',
          pair: [exchangeSymbol],
          subscription: { name: 'ticker' }
        };
        
      case 'kucoin':
        return {
          id: Date.now(),
          type: 'subscribe',
          topic: `/market/ticker:${exchangeSymbol}`,
          privateChannel: false,
          response: true
        };
        
      default:
        return null;
    }
  }

  /**
   * Unsubscribe from price updates for specific symbols
   */
  async unsubscribeFromSymbols(symbols) {
    try {
      loggingService.info('Unsubscribing from symbols', { symbols });
      
      for (const symbol of symbols) {
        const normalizedSymbol = this.normalizeSymbol(symbol);
        const subscribedExchanges = this.subscriptions.get(normalizedSymbol);
        
        if (subscribedExchanges) {
          for (const exchange of subscribedExchanges) {
            await this.unsubscribeSymbolFromExchange(exchange, normalizedSymbol);
          }
          
          // Remove from subscription map
          this.subscriptions.delete(normalizedSymbol);
        }
        
        // Remove from price cache
        this.priceCache.delete(normalizedSymbol);
      }
      
    } catch (error) {
      loggingService.error('Error unsubscribing from symbols', {
        symbols,
        error: error.message
      });
    }
  }

  /**
   * Unsubscribe from a symbol on a specific exchange
   */
  async unsubscribeSymbolFromExchange(exchange, symbol) {
    try {
      const connection = this.connections.get(exchange);
      if (!connection || connection.readyState !== WebSocket.OPEN) {
        return; // Connection already closed
      }
      
      const unsubscribeMessage = this.createUnsubscribeMessage(exchange, symbol);
      if (unsubscribeMessage) {
        connection.send(JSON.stringify(unsubscribeMessage));
        loggingService.debug(`Unsubscribed from ${symbol} on ${exchange}`);
      }
      
    } catch (error) {
      loggingService.error(`Failed to unsubscribe from ${symbol} on ${exchange}`, {
        error: error.message
      });
    }
  }

  /**
   * Create unsubscription message for specific exchange
   */
  createUnsubscribeMessage(exchange, symbol) {
    const exchangeSymbol = this.convertToExchangeSymbol(exchange, symbol);
    
    switch (exchange) {
      case 'binance':
        return {
          method: 'UNSUBSCRIBE',
          params: [`${exchangeSymbol.toLowerCase()}@ticker`],
          id: Date.now()
        };
        
      case 'coinbase':
        return {
          type: 'unsubscribe',
          product_ids: [exchangeSymbol],
          channels: ['ticker']
        };
        
      case 'kraken':
        return {
          event: 'unsubscribe',
          pair: [exchangeSymbol],
          subscription: { name: 'ticker' }
        };
        
      case 'kucoin':
        return {
          id: Date.now(),
          type: 'unsubscribe',
          topic: `/market/ticker:${exchangeSymbol}`,
          privateChannel: false,
          response: true
        };
        
      default:
        return null;
    }
  }

  /**
   * Get current prices for symbols
   */
  async getCurrentPrices(symbols) {
    const prices = new Map();
    
    for (const symbol of symbols) {
      const normalizedSymbol = this.normalizeSymbol(symbol);
      let priceData = this.priceCache.get(normalizedSymbol);
      
      if (!priceData || this.isCacheExpired(priceData)) {
        // Try to fetch fresh data
        priceData = await this.fetchFreshPriceData(normalizedSymbol);
      }
      
      if (priceData) {
        prices.set(normalizedSymbol, priceData);
      }
    }
    
    return prices;
  }

  /**
   * Fetch fresh price data for a symbol
   */
  async fetchFreshPriceData(symbol) {
    try {
      // Try to get data from each exchange
      const supportingExchanges = await this.findSupportingExchanges(symbol);
      
      for (const exchange of supportingExchanges) {
        try {
          const priceData = await exchangeService.getSymbolPrice(exchange, symbol);
          if (priceData) {
            // Update cache
            this.priceCache.set(symbol, {
              ...priceData,
              symbol,
              exchange,
              timestamp: new Date(),
              lastUpdated: new Date()
            });
            
            return this.priceCache.get(symbol);
          }
        } catch (error) {
          loggingService.debug(`Failed to fetch price from ${exchange}`, {
            symbol,
            error: error.message
          });
        }
      }
      
      return null;
    } catch (error) {
      loggingService.error('Error fetching fresh price data', {
        symbol,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Find exchanges that support a symbol
   */
  async findSupportingExchanges(symbol) {
    const supportingExchanges = [];
    
    for (const exchange of this.exchanges) {
      try {
        const isSupported = await exchangeService.isSymbolSupported(exchange, symbol);
        if (isSupported) {
          supportingExchanges.push(exchange);
        }
      } catch (error) {
        loggingService.debug(`Error checking symbol support on ${exchange}`, {
          symbol,
          error: error.message
        });
      }
    }
    
    return supportingExchanges;
  }

  /**
   * Get WebSocket URL for exchange
   */
  getWebSocketUrl(exchange) {
    const urls = {
      binance: 'wss://stream.binance.com:9443/ws/btcusdt@ticker',
      coinbase: 'wss://ws-feed.pro.coinbase.com',
      kraken: 'wss://ws.kraken.com',
      kucoin: 'wss://ws-api.kucoin.com/endpoint' // Need to get actual endpoint from API
    };
    
    return urls[exchange];
  }

  /**
   * Convert symbol to exchange-specific format
   */
  convertToExchangeSymbol(exchange, symbol) {
    // This would typically involve more complex symbol mapping
    // For now, using basic transformations
    const normalizedSymbol = this.normalizeSymbol(symbol);
    
    switch (exchange) {
      case 'binance':
        return normalizedSymbol.replace('-', '');
      case 'coinbase':
        return normalizedSymbol;
      case 'kraken':
        return normalizedSymbol.replace('BTC', 'XBT');
      case 'kucoin':
        return normalizedSymbol;
      default:
        return normalizedSymbol;
    }
  }

  /**
   * Normalize symbol format
   */
  normalizeSymbol(symbol) {
    if (!symbol) return '';
    return symbol.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  }

  /**
   * Check if price change is significant
   */
  isSignificantPriceChange(oldPrice, newPrice) {
    if (!oldPrice || !newPrice) return true;
    const changePercent = Math.abs((newPrice - oldPrice) / oldPrice);
    return changePercent >= this.priceUpdateThreshold;
  }

  /**
   * Check if cached data is expired
   */
  isCacheExpired(priceData) {
    if (!priceData.lastUpdated) return true;
    return (Date.now() - priceData.lastUpdated.getTime()) > this.cacheExpirationTime;
  }

  /**
   * Cache price data in Redis
   */
  async cacheInRedis(symbol, priceData) {
    try {
      if (redis) {
        const cacheKey = `price:${symbol}`;
        await redis.setex(cacheKey, 300, JSON.stringify(priceData)); // 5 minute expiration
      }
    } catch (error) {
      loggingService.debug('Error caching price in Redis', {
        symbol,
        error: error.message
      });
    }
  }

  /**
   * Start health monitoring for connections
   */
  startHealthMonitoring() {
    // Ping connections every 30 seconds
    this.healthMonitorInterval = setInterval(() => {
      this.checkConnectionHealth();
    }, 30000);
  }

  /**
   * Check health of all connections
   */
  checkConnectionHealth() {
    for (const [exchange, connection] of this.connections) {
      if (connection.readyState === WebSocket.OPEN) {
        // Send ping
        connection.isAlive = false;
        connection.ping();
        
        // Check if connection responded to previous ping
        setTimeout(() => {
          if (!connection.isAlive) {
            loggingService.warn(`Connection to ${exchange} appears dead, terminating`);
            connection.terminate();
          }
        }, 5000);
      }
    }
  }

  /**
   * Schedule reconnection for an exchange
   */
  scheduleReconnection(exchange) {
    const attempts = this.reconnectAttempts.get(exchange) || 0;
    
    if (attempts >= this.maxReconnectAttempts) {
      loggingService.error(`Max reconnection attempts reached for ${exchange}`);
      return;
    }
    
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, attempts),
      this.maxReconnectDelay
    );
    
    loggingService.info(`Scheduling reconnection to ${exchange} in ${delay}ms (attempt ${attempts + 1})`);
    
    setTimeout(async () => {
      try {
        this.reconnectAttempts.set(exchange, attempts + 1);
        await this.initializeExchangeConnection(exchange);
        this.metrics.reconnectionCount++;
      } catch (error) {
        loggingService.error(`Reconnection attempt failed for ${exchange}`, {
          error: error.message
        });
        this.scheduleReconnection(exchange);
      }
    }, delay);
  }

  /**
   * Wait for WebSocket connection to open
   */
  waitForConnection(ws) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);
      
      ws.on('open', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Send initial subscription for exchange
   */
  async sendInitialSubscription(exchange, ws) {
    // Send any required initial messages
    // This could include authentication, heartbeat setup, etc.
  }

  /**
   * Setup cleanup handlers
   */
  setupCleanupHandlers() {
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
  }

  /**
   * Get subscribed symbols
   */
  getSubscribedSymbols() {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Get connection status for all exchanges
   */
  getConnectionStatus() {
    const status = {};
    for (const exchange of this.exchanges) {
      status[exchange] = this.connectionStatus.get(exchange) || false;
    }
    return status;
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeConnections: Array.from(this.connectionStatus.values()).filter(Boolean).length,
      totalConnections: this.connections.size,
      subscribedSymbols: this.subscriptions.size,
      cachedPrices: this.priceCache.size
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      loggingService.info('Cleaning up PriceStreamManager');
      
      // Stop health monitoring
      if (this.healthMonitorInterval) {
        clearInterval(this.healthMonitorInterval);
      }
      
      // Close all connections
      for (const [exchange, connection] of this.connections) {
        try {
          if (connection.readyState === WebSocket.OPEN) {
            connection.close();
          }
        } catch (error) {
          loggingService.error(`Error closing connection to ${exchange}`, {
            error: error.message
          });
        }
      }
      
      // Clear all data structures
      this.connections.clear();
      this.subscriptions.clear();
      this.priceCache.clear();
      this.reconnectAttempts.clear();
      this.connectionStatus.clear();
      
      // Remove all listeners
      this.removeAllListeners();
      
    } catch (error) {
      loggingService.error('Error during PriceStreamManager cleanup', {
        error: error.message
      });
    }
  }
}

export { PriceStreamManager };