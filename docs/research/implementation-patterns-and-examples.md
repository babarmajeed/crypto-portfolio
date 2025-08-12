# Implementation Patterns and Code Examples

## Overview

This document provides specific implementation patterns, code examples, and architectural blueprints for the cryptocurrency exchange API integration outlined in the main best practices document.

---

## 1. Exchange Client Factory Pattern

```typescript
// src/exchanges/factory.ts
import { ExchangeClient } from './types';
import { BinanceClient } from './binance';
import { CoinbaseClient } from './coinbase';
import { KrakenClient } from './kraken';
import { KucoinClient } from './kucoin';
import { GeminiClient } from './gemini';

export class ExchangeClientFactory {
  private static instances: Map<string, ExchangeClient> = new Map();
  
  static async createClient(exchange: string, config: ExchangeConfig): Promise<ExchangeClient> {
    const key = `${exchange}-${config.apiKey}`;
    
    if (this.instances.has(key)) {
      return this.instances.get(key)!;
    }
    
    let client: ExchangeClient;
    
    switch (exchange.toLowerCase()) {
      case 'binance':
        client = new BinanceClient(config);
        break;
      case 'coinbase':
        client = new CoinbaseClient(config);
        break;
      case 'kraken':
        client = new KrakenClient(config);
        break;
      case 'kucoin':
        client = new KucoinClient(config);
        break;
      case 'gemini':
        client = new GeminiClient(config);
        break;
      default:
        throw new Error(`Unsupported exchange: ${exchange}`);
    }
    
    await client.initialize();
    this.instances.set(key, client);
    
    return client;
  }
}
```

---

## 2. Unified Rate Limiter Implementation

```typescript
// src/ratelimiter/unified-rate-limiter.ts
import Redis from 'ioredis';

interface RateLimitRule {
  requests: number;
  windowMs: number;
  weight?: number;
  burstAllowance?: number;
}

interface RateLimitState {
  remaining: number;
  resetTime: number;
  weight?: number;
}

export class UnifiedRateLimiter {
  private redis: Redis;
  private rules: Map<string, RateLimitRule>;
  
  constructor(redisClient: Redis) {
    this.redis = redisClient;
    this.rules = new Map();
    this.setupRules();
  }
  
  private setupRules(): void {
    // Binance rules
    this.rules.set('binance:rest', { 
      requests: 1200, 
      windowMs: 60000, 
      weight: true 
    });
    this.rules.set('binance:websocket', { 
      requests: 300, 
      windowMs: 300000 
    });
    
    // Coinbase rules
    this.rules.set('coinbase:public', { 
      requests: 120, 
      windowMs: 60000 
    });
    this.rules.set('coinbase:private', { 
      requests: 600, 
      windowMs: 60000 
    });
    
    // Kraken rules - tier-based (assuming tier 3)
    this.rules.set('kraken:rest', { 
      requests: 20, 
      windowMs: 1000, 
      burstAllowance: 10 
    });
    
    // KuCoin rules
    this.rules.set('kucoin:public', { 
      requests: 100, 
      windowMs: 10000 
    });
    this.rules.set('kucoin:private', { 
      requests: 200, 
      windowMs: 10000 
    });
    
    // Gemini rules
    this.rules.set('gemini:public', { 
      requests: 120, 
      windowMs: 60000 
    });
    this.rules.set('gemini:private', { 
      requests: 600, 
      windowMs: 60000 
    });
  }
  
  async acquire(exchange: string, endpoint: string, weight = 1): Promise<void> {
    const key = `${exchange}:${this.getEndpointType(endpoint)}`;
    const rule = this.rules.get(key);
    
    if (!rule) {
      throw new Error(`No rate limit rule found for ${key}`);
    }
    
    const redisKey = `ratelimit:${key}`;
    const now = Date.now();
    const windowStart = now - rule.windowMs;
    
    // Use Redis sliding window log
    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(redisKey, '-inf', windowStart);
    pipeline.zcard(redisKey);
    pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
    pipeline.expire(redisKey, Math.ceil(rule.windowMs / 1000));
    
    const results = await pipeline.exec();
    const currentCount = results![1][1] as number;
    
    const effectiveLimit = rule.weight ? rule.requests * weight : rule.requests;
    
    if (currentCount >= effectiveLimit) {
      const oldestEntry = await this.redis.zrange(redisKey, 0, 0, 'WITHSCORES');
      const resetTime = oldestEntry.length > 0 
        ? parseInt(oldestEntry[1]) + rule.windowMs
        : now + rule.windowMs;
      
      throw new RateLimitError(
        `Rate limit exceeded for ${key}`,
        resetTime,
        currentCount,
        effectiveLimit
      );
    }
  }
  
  async getStatus(exchange: string, endpoint: string): Promise<RateLimitState> {
    const key = `${exchange}:${this.getEndpointType(endpoint)}`;
    const rule = this.rules.get(key);
    
    if (!rule) {
      throw new Error(`No rate limit rule found for ${key}`);
    }
    
    const redisKey = `ratelimit:${key}`;
    const now = Date.now();
    const windowStart = now - rule.windowMs;
    
    await this.redis.zremrangebyscore(redisKey, '-inf', windowStart);
    const currentCount = await this.redis.zcard(redisKey);
    
    const oldestEntry = await this.redis.zrange(redisKey, 0, 0, 'WITHSCORES');
    const resetTime = oldestEntry.length > 0 
      ? parseInt(oldestEntry[1]) + rule.windowMs
      : now + rule.windowMs;
    
    return {
      remaining: Math.max(0, rule.requests - currentCount),
      resetTime,
      weight: rule.weight ? currentCount : undefined
    };
  }
  
  private getEndpointType(endpoint: string): string {
    // Determine if endpoint is public or private based on URL patterns
    const publicPatterns = [
      '/ticker', '/depth', '/klines', '/trades', '/exchangeInfo',
      '/products', '/candles', '/stats', '/orderbook',
      '/pubticker', '/book'
    ];
    
    const isPublic = publicPatterns.some(pattern => endpoint.includes(pattern));
    return isPublic ? 'public' : 'private';
  }
}

class RateLimitError extends Error {
  constructor(
    message: string,
    public resetTime: number,
    public current: number,
    public limit: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}
```

---

## 3. WebSocket Connection Manager

```typescript
// src/websocket/connection-manager.ts
import WebSocket from 'ws';
import { EventEmitter } from 'events';

interface WebSocketConfig {
  url: string;
  maxReconnectAttempts: number;
  reconnectIntervalMs: number;
  heartbeatIntervalMs: number;
  maxConnectionAgeMs: number;
  compressionEnabled: boolean;
}

interface Subscription {
  channel: string;
  symbol?: string;
  callback: (data: any) => void;
}

export class WebSocketConnectionManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private subscriptions: Map<string, Subscription> = new Map();
  private reconnectAttempts = 0;
  private heartbeatInterval?: NodeJS.Timeout;
  private connectionAgeTimer?: NodeJS.Timeout;
  private lastPongReceived = 0;
  private isReconnecting = false;
  
  constructor(config: WebSocketConfig) {
    super();
    this.config = config;
  }
  
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url, {
          perMessageDeflate: this.config.compressionEnabled
        });
        
        this.ws.on('open', () => {
          console.log(`WebSocket connected to ${this.config.url}`);
          this.reconnectAttempts = 0;
          this.setupHeartbeat();
          this.setupConnectionAging();
          this.resubscribeAll();
          this.emit('connected');
          resolve();
        });
        
        this.ws.on('message', (data) => {
          this.handleMessage(data);
        });
        
        this.ws.on('ping', () => {
          this.ws?.pong();
        });
        
        this.ws.on('pong', () => {
          this.lastPongReceived = Date.now();
        });
        
        this.ws.on('close', (code, reason) => {
          console.log(`WebSocket closed: ${code} - ${reason}`);
          this.cleanup();
          if (!this.isReconnecting) {
            this.handleReconnection();
          }
        });
        
        this.ws.on('error', (error) => {
          console.error('WebSocket error:', error);
          this.emit('error', error);
          if (this.reconnectAttempts === 0) {
            reject(error);
          }
        });
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  subscribe(channel: string, symbol: string | undefined, callback: (data: any) => void): void {
    const key = symbol ? `${channel}:${symbol}` : channel;
    this.subscriptions.set(key, { channel, symbol, callback });
    
    if (this.isConnected()) {
      this.sendSubscription(channel, symbol);
    }
  }
  
  unsubscribe(channel: string, symbol?: string): void {
    const key = symbol ? `${channel}:${symbol}` : channel;
    this.subscriptions.delete(key);
    
    if (this.isConnected()) {
      this.sendUnsubscription(channel, symbol);
    }
  }
  
  private setupHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (!this.isConnected()) return;
      
      const timeSinceLastPong = Date.now() - this.lastPongReceived;
      if (timeSinceLastPong > this.config.heartbeatIntervalMs * 2) {
        console.warn('Heartbeat timeout, closing connection');
        this.ws?.close();
        return;
      }
      
      this.ws?.ping();
    }, this.config.heartbeatIntervalMs);
    
    this.lastPongReceived = Date.now();
  }
  
  private setupConnectionAging(): void {
    this.connectionAgeTimer = setTimeout(() => {
      console.log('Connection age limit reached, reconnecting');
      this.ws?.close(1000, 'Connection age limit');
    }, this.config.maxConnectionAgeMs);
  }
  
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());
      this.routeMessage(message);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }
  
  private routeMessage(message: any): void {
    // This method should be overridden by exchange-specific implementations
    // to route messages to appropriate subscription callbacks
    this.emit('message', message);
  }
  
  private async handleReconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('maxReconnectsReached');
      return;
    }
    
    this.isReconnecting = true;
    this.reconnectAttempts++;
    
    const delay = Math.min(
      this.config.reconnectIntervalMs * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );
    
    console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.config.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(async () => {
      try {
        await this.connect();
        this.isReconnecting = false;
      } catch (error) {
        this.isReconnecting = false;
        this.handleReconnection();
      }
    }, delay);
  }
  
  private resubscribeAll(): void {
    for (const [key, subscription] of this.subscriptions) {
      this.sendSubscription(subscription.channel, subscription.symbol);
    }
  }
  
  private sendSubscription(channel: string, symbol?: string): void {
    // Override in exchange-specific implementations
  }
  
  private sendUnsubscription(channel: string, symbol?: string): void {
    // Override in exchange-specific implementations
  }
  
  private isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
  
  private cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
    
    if (this.connectionAgeTimer) {
      clearTimeout(this.connectionAgeTimer);
      this.connectionAgeTimer = undefined;
    }
  }
  
  close(): void {
    this.cleanup();
    this.ws?.close();
    this.ws = null;
  }
}
```

---

## 4. Exchange-Specific WebSocket Implementations

### Binance WebSocket Client

```typescript
// src/exchanges/binance/websocket.ts
import { WebSocketConnectionManager } from '../../websocket/connection-manager';

export class BinanceWebSocket extends WebSocketConnectionManager {
  private streamId = 1;
  
  constructor() {
    super({
      url: 'wss://stream.binance.com:9443/ws/',
      maxReconnectAttempts: 5,
      reconnectIntervalMs: 1000,
      heartbeatIntervalMs: 30000, // 30 seconds
      maxConnectionAgeMs: 24 * 60 * 60 * 1000, // 24 hours
      compressionEnabled: true
    });
  }
  
  protected sendSubscription(channel: string, symbol?: string): void {
    if (!symbol) return;
    
    const stream = this.buildStreamName(channel, symbol);
    const message = {
      method: 'SUBSCRIBE',
      params: [stream],
      id: this.streamId++
    };
    
    this.ws?.send(JSON.stringify(message));
  }
  
  protected sendUnsubscription(channel: string, symbol?: string): void {
    if (!symbol) return;
    
    const stream = this.buildStreamName(channel, symbol);
    const message = {
      method: 'UNSUBSCRIBE',
      params: [stream],
      id: this.streamId++
    };
    
    this.ws?.send(JSON.stringify(message));
  }
  
  protected routeMessage(message: any): void {
    if (message.stream && message.data) {
      // Parse stream name to determine channel and symbol
      const { channel, symbol } = this.parseStreamName(message.stream);
      const key = `${channel}:${symbol}`;
      const subscription = this.subscriptions.get(key);
      
      if (subscription) {
        subscription.callback(this.transformData(channel, message.data));
      }
    }
    
    super.routeMessage(message);
  }
  
  private buildStreamName(channel: string, symbol: string): string {
    const lowerSymbol = symbol.toLowerCase().replace('/', '');
    
    switch (channel) {
      case 'ticker':
        return `${lowerSymbol}@ticker`;
      case 'orderbook':
        return `${lowerSymbol}@depth20@100ms`;
      case 'trades':
        return `${lowerSymbol}@trade`;
      case 'kline':
        return `${lowerSymbol}@kline_1m`;
      default:
        return `${lowerSymbol}@${channel}`;
    }
  }
  
  private parseStreamName(stream: string): { channel: string; symbol: string } {
    const parts = stream.split('@');
    const symbol = parts[0].toUpperCase();
    const channel = parts[1].split('_')[0]; // Handle kline_1m format
    
    return { channel, symbol };
  }
  
  private transformData(channel: string, data: any): any {
    // Transform Binance data to unified format
    switch (channel) {
      case 'ticker':
        return {
          symbol: data.s,
          price: parseFloat(data.c),
          change24h: parseFloat(data.P),
          volume24h: parseFloat(data.v),
          timestamp: data.E
        };
      // Add other transformations...
      default:
        return data;
    }
  }
}
```

### Coinbase WebSocket Client

```typescript
// src/exchanges/coinbase/websocket.ts
import { WebSocketConnectionManager } from '../../websocket/connection-manager';

export class CoinbaseWebSocket extends WebSocketConnectionManager {
  private subscribedChannels: Set<string> = new Set();
  
  constructor() {
    super({
      url: 'wss://ws-feed.exchange.coinbase.com',
      maxReconnectAttempts: 5,
      reconnectIntervalMs: 1000,
      heartbeatIntervalMs: 30000,
      maxConnectionAgeMs: 24 * 60 * 60 * 1000,
      compressionEnabled: false
    });
  }
  
  protected sendSubscription(channel: string, symbol?: string): void {
    const products = symbol ? [symbol.replace('/', '-')] : [];
    
    const message = {
      type: 'subscribe',
      product_ids: products,
      channels: [channel]
    };
    
    this.ws?.send(JSON.stringify(message));
    this.subscribedChannels.add(`${channel}:${symbol || 'all'}`);
  }
  
  protected sendUnsubscription(channel: string, symbol?: string): void {
    const products = symbol ? [symbol.replace('/', '-')] : [];
    
    const message = {
      type: 'unsubscribe',
      product_ids: products,
      channels: [channel]
    };
    
    this.ws?.send(JSON.stringify(message));
    this.subscribedChannels.delete(`${channel}:${symbol || 'all'}`);
  }
  
  protected routeMessage(message: any): void {
    if (message.type && message.product_id) {
      const symbol = message.product_id.replace('-', '/');
      const key = `${message.type}:${symbol}`;
      const subscription = this.subscriptions.get(key);
      
      if (subscription) {
        subscription.callback(this.transformData(message.type, message));
      }
    }
    
    super.routeMessage(message);
  }
  
  private transformData(type: string, data: any): any {
    switch (type) {
      case 'ticker':
        return {
          symbol: data.product_id,
          price: parseFloat(data.price),
          volume24h: parseFloat(data.volume_24h),
          timestamp: new Date(data.time).getTime()
        };
      case 'snapshot':
      case 'l2update':
        return {
          symbol: data.product_id,
          bids: data.bids?.map(([price, size]: [string, string]) => 
            [parseFloat(price), parseFloat(size)]
          ),
          asks: data.asks?.map(([price, size]: [string, string]) => 
            [parseFloat(price), parseFloat(size)]
          ),
          timestamp: new Date().getTime()
        };
      default:
        return data;
    }
  }
}
```

---

## 5. Data Normalization Layer

```typescript
// src/normalization/data-normalizer.ts
import { UnifiedTicker, UnifiedOrderBook, UnifiedTrade, UnifiedCandle } from './types';

export class DataNormalizer {
  private symbolNormalizer: SymbolNormalizer;
  
  constructor() {
    this.symbolNormalizer = new SymbolNormalizer();
  }
  
  normalizeTicker(exchange: string, rawData: any): UnifiedTicker {
    const symbol = this.symbolNormalizer.normalize(exchange, rawData.symbol || rawData.product_id || rawData.pair);
    
    switch (exchange) {
      case 'binance':
        return {
          exchange,
          symbol,
          price: parseFloat(rawData.price || rawData.lastPrice),
          change24h: parseFloat(rawData.priceChange || '0'),
          changePercent24h: parseFloat(rawData.priceChangePercent || '0'),
          volume24h: parseFloat(rawData.volume || '0'),
          high24h: parseFloat(rawData.highPrice || '0'),
          low24h: parseFloat(rawData.lowPrice || '0'),
          timestamp: rawData.closeTime || Date.now()
        };
        
      case 'coinbase':
        return {
          exchange,
          symbol,
          price: parseFloat(rawData.price || '0'),
          change24h: 0, // Calculate from previous price if available
          changePercent24h: 0,
          volume24h: parseFloat(rawData.volume_24h || '0'),
          high24h: parseFloat(rawData.high_24h || '0'),
          low24h: parseFloat(rawData.low_24h || '0'),
          timestamp: new Date(rawData.time || Date.now()).getTime()
        };
        
      case 'kraken':
        const tickerData = rawData[symbol] || rawData;
        return {
          exchange,
          symbol,
          price: parseFloat(tickerData.c?.[0] || '0'),
          change24h: 0,
          changePercent24h: 0,
          volume24h: parseFloat(tickerData.v?.[1] || '0'),
          high24h: parseFloat(tickerData.h?.[1] || '0'),
          low24h: parseFloat(tickerData.l?.[1] || '0'),
          timestamp: Date.now()
        };
        
      case 'kucoin':
        return {
          exchange,
          symbol,
          price: parseFloat(rawData.last || '0'),
          change24h: parseFloat(rawData.changePrice || '0'),
          changePercent24h: parseFloat(rawData.changeRate || '0') * 100,
          volume24h: parseFloat(rawData.vol || '0'),
          high24h: parseFloat(rawData.high || '0'),
          low24h: parseFloat(rawData.low || '0'),
          timestamp: rawData.time || Date.now()
        };
        
      case 'gemini':
        return {
          exchange,
          symbol,
          price: parseFloat(rawData.last || '0'),
          change24h: 0,
          changePercent24h: 0,
          volume24h: parseFloat(rawData.volume?.USD || '0'),
          high24h: 0,
          low24h: 0,
          timestamp: Date.now()
        };
        
      default:
        throw new Error(`Unsupported exchange for ticker normalization: ${exchange}`);
    }
  }
  
  normalizeOrderBook(exchange: string, rawData: any): UnifiedOrderBook {
    const symbol = this.symbolNormalizer.normalize(exchange, rawData.symbol || rawData.product_id);
    
    switch (exchange) {
      case 'binance':
        return {
          exchange,
          symbol,
          bids: rawData.bids.map(([price, qty]: [string, string]) => 
            [parseFloat(price), parseFloat(qty)]
          ),
          asks: rawData.asks.map(([price, qty]: [string, string]) => 
            [parseFloat(price), parseFloat(qty)]
          ),
          timestamp: rawData.E || Date.now()
        };
        
      case 'coinbase':
        return {
          exchange,
          symbol,
          bids: (rawData.bids || []).map(([price, size]: [string, string]) => 
            [parseFloat(price), parseFloat(size)]
          ),
          asks: (rawData.asks || []).map(([price, size]: [string, string]) => 
            [parseFloat(price), parseFloat(size)]
          ),
          timestamp: Date.now()
        };
        
      // Add other exchanges...
      default:
        throw new Error(`Unsupported exchange for orderbook normalization: ${exchange}`);
    }
  }
  
  normalizeCandles(exchange: string, rawData: any[]): UnifiedCandle[] {
    return rawData.map(candle => this.normalizeCandle(exchange, candle));
  }
  
  private normalizeCandle(exchange: string, rawData: any): UnifiedCandle {
    switch (exchange) {
      case 'binance':
        return {
          exchange,
          symbol: '', // Should be provided by caller
          interval: '', // Should be provided by caller
          openTime: rawData[0],
          closeTime: rawData[6],
          open: parseFloat(rawData[1]),
          high: parseFloat(rawData[2]),
          low: parseFloat(rawData[3]),
          close: parseFloat(rawData[4]),
          volume: parseFloat(rawData[5]),
          quoteVolume: parseFloat(rawData[7]),
          trades: rawData[8]
        };
        
      case 'coinbase':
        return {
          exchange,
          symbol: '',
          interval: '',
          openTime: rawData[0] * 1000, // Coinbase uses seconds
          closeTime: (rawData[0] + 60) * 1000, // Assuming 1-minute candles
          open: rawData[3],
          high: rawData[2],
          low: rawData[1],
          close: rawData[4],
          volume: rawData[5],
          quoteVolume: rawData[5] * rawData[4], // Approximate
          trades: 0 // Not provided by Coinbase
        };
        
      // Add other exchanges...
      default:
        throw new Error(`Unsupported exchange for candle normalization: ${exchange}`);
    }
  }
}

class SymbolNormalizer {
  private mappings: Map<string, Map<string, string>>;
  
  constructor() {
    this.mappings = new Map();
    this.setupMappings();
  }
  
  private setupMappings(): void {
    // Binance mappings
    this.mappings.set('binance', new Map([
      ['BTCUSDT', 'BTC/USDT'],
      ['ETHUSDT', 'ETH/USDT'],
      ['ADAUSDT', 'ADA/USDT'],
      ['SOLUSDT', 'SOL/USDT'],
      // Add more mappings...
    ]));
    
    // Coinbase mappings
    this.mappings.set('coinbase', new Map([
      ['BTC-USD', 'BTC/USD'],
      ['ETH-USD', 'ETH/USD'],
      ['ADA-USD', 'ADA/USD'],
      ['SOL-USD', 'SOL/USD'],
      // Add more mappings...
    ]));
    
    // Add other exchange mappings...
  }
  
  normalize(exchange: string, symbol: string): string {
    const mapping = this.mappings.get(exchange);
    if (mapping && mapping.has(symbol)) {
      return mapping.get(symbol)!;
    }
    
    // Fallback to generic normalization
    return this.genericNormalize(symbol);
  }
  
  private genericNormalize(symbol: string): string {
    // Convert various formats to standard BASE/QUOTE format
    return symbol.replace(/[-_]/, '/').toUpperCase();
  }
}
```

---

## 6. Caching Layer with Redis

```typescript
// src/cache/cache-manager.ts
import Redis from 'ioredis';
import { createHash } from 'crypto';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

interface CacheOptions {
  ttl: number;
  compress: boolean;
  namespace?: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  compressed: boolean;
}

export class CacheManager {
  private redis: Redis;
  private defaultTTL = 300; // 5 minutes
  private compressionThreshold = 1024; // Compress if > 1KB
  
  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }
  
  async set<T>(
    key: string, 
    data: T, 
    options: Partial<CacheOptions> = {}
  ): Promise<void> {
    const opts = {
      ttl: this.defaultTTL,
      compress: false,
      ...options
    };
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      compressed: false
    };
    
    let serialized = JSON.stringify(entry);
    
    // Compress if data is large enough and compression is enabled
    if (opts.compress && serialized.length > this.compressionThreshold) {
      const compressed = await gzipAsync(Buffer.from(serialized));
      serialized = compressed.toString('base64');
      entry.compressed = true;
    }
    
    const cacheKey = this.buildKey(key, opts.namespace);
    await this.redis.setex(cacheKey, opts.ttl, serialized);
  }
  
  async get<T>(key: string, namespace?: string): Promise<T | null> {
    const cacheKey = this.buildKey(key, namespace);
    const cached = await this.redis.get(cacheKey);
    
    if (!cached) {
      return null;
    }
    
    try {
      let entry: CacheEntry<T>;
      
      // Check if data is compressed
      if (cached.startsWith('{')) {
        // Not compressed
        entry = JSON.parse(cached);
      } else {
        // Compressed
        const buffer = Buffer.from(cached, 'base64');
        const decompressed = await gunzipAsync(buffer);
        entry = JSON.parse(decompressed.toString());
      }
      
      return entry.data;
    } catch (error) {
      console.error('Error parsing cached data:', error);
      await this.redis.del(cacheKey);
      return null;
    }
  }
  
  async del(key: string, namespace?: string): Promise<void> {
    const cacheKey = this.buildKey(key, namespace);
    await this.redis.del(cacheKey);
  }
  
  async exists(key: string, namespace?: string): Promise<boolean> {
    const cacheKey = this.buildKey(key, namespace);
    const result = await this.redis.exists(cacheKey);
    return result === 1;
  }
  
  async mget<T>(keys: string[], namespace?: string): Promise<(T | null)[]> {
    const cacheKeys = keys.map(key => this.buildKey(key, namespace));
    const results = await this.redis.mget(...cacheKeys);
    
    return Promise.all(
      results.map(async (cached, index) => {
        if (!cached) return null;
        
        try {
          let entry: CacheEntry<T>;
          
          if (cached.startsWith('{')) {
            entry = JSON.parse(cached);
          } else {
            const buffer = Buffer.from(cached, 'base64');
            const decompressed = await gunzipAsync(buffer);
            entry = JSON.parse(decompressed.toString());
          }
          
          return entry.data;
        } catch (error) {
          console.error(`Error parsing cached data for key ${keys[index]}:`, error);
          await this.redis.del(cacheKeys[index]);
          return null;
        }
      })
    );
  }
  
  async getOrSet<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    options: Partial<CacheOptions> = {}
  ): Promise<T> {
    const cached = await this.get<T>(key, options.namespace);
    
    if (cached !== null) {
      return cached;
    }
    
    const data = await fetcher();
    await this.set(key, data, options);
    
    return data;
  }
  
  // Smart caching for market data with different TTLs based on data type
  async cacheMarketData(
    exchange: string, 
    symbol: string, 
    dataType: 'ticker' | 'orderbook' | 'trades' | 'candles',
    data: any,
    interval?: string
  ): Promise<void> {
    const ttlMap = {
      ticker: 60,      // 1 minute
      orderbook: 30,   // 30 seconds
      trades: 300,     // 5 minutes
      candles: this.getCandleTTL(interval || '1m')
    };
    
    const key = `${exchange}:${symbol}:${dataType}${interval ? `:${interval}` : ''}`;
    await this.set(key, data, {
      ttl: ttlMap[dataType],
      compress: dataType === 'candles',
      namespace: 'market-data'
    });
  }
  
  private getCandleTTL(interval: string): number {
    const ttlMap = {
      '1m': 60,      // 1 minute
      '5m': 300,     // 5 minutes
      '15m': 900,    // 15 minutes
      '1h': 3600,    // 1 hour
      '4h': 14400,   // 4 hours
      '1d': 86400    // 1 day
    };
    return ttlMap[interval as keyof typeof ttlMap] || 300;
  }
  
  private buildKey(key: string, namespace?: string): string {
    const hash = createHash('md5').update(key).digest('hex');
    return namespace ? `${namespace}:${hash}` : hash;
  }
}
```

---

## 7. Configuration and Environment Management

```typescript
// src/config/configuration.ts
import { z } from 'zod';

const ExchangeConfigSchema = z.object({
  name: z.string(),
  enabled: z.boolean().default(true),
  baseUrl: z.string().url(),
  websocketUrl: z.string().url(),
  timeout: z.number().min(1000).max(30000),
  rateLimit: z.object({
    requests: z.number().positive(),
    windowMs: z.number().positive(),
    weight: z.boolean().optional()
  }),
  features: z.array(z.string()).default([])
});

const ConfigSchema = z.object({
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.number().min(1).max(65535).default(6379),
    password: z.string().optional(),
    db: z.number().min(0).max(15).default(0)
  }),
  vault: z.object({
    endpoint: z.string().url(),
    token: z.string().optional(),
    namespace: z.string().optional(),
    mountPath: z.string().default('crypto-apis')
  }),
  exchanges: z.record(ExchangeConfigSchema),
  monitoring: z.object({
    enabled: z.boolean().default(true),
    metricsPort: z.number().min(1024).max(65535).default(9090),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info')
  })
});

export type Config = z.infer<typeof ConfigSchema>;
export type ExchangeConfig = z.infer<typeof ExchangeConfigSchema>;

export class Configuration {
  private static instance: Configuration;
  private config: Config;
  
  private constructor() {
    this.config = this.loadConfiguration();
  }
  
  static getInstance(): Configuration {
    if (!Configuration.instance) {
      Configuration.instance = new Configuration();
    }
    return Configuration.instance;
  }
  
  private loadConfiguration(): Config {
    const baseConfig = {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0')
      },
      vault: {
        endpoint: process.env.VAULT_ENDPOINT || 'http://localhost:8200',
        token: process.env.VAULT_TOKEN,
        namespace: process.env.VAULT_NAMESPACE,
        mountPath: process.env.VAULT_MOUNT_PATH || 'crypto-apis'
      },
      exchanges: {
        binance: {
          name: 'binance',
          enabled: process.env.BINANCE_ENABLED !== 'false',
          baseUrl: 'https://api.binance.com',
          websocketUrl: 'wss://stream.binance.com:9443/ws/',
          timeout: 5000,
          rateLimit: {
            requests: 1200,
            windowMs: 60000,
            weight: true
          },
          features: ['spot', 'futures', 'options']
        },
        coinbase: {
          name: 'coinbase',
          enabled: process.env.COINBASE_ENABLED !== 'false',
          baseUrl: 'https://api.exchange.coinbase.com',
          websocketUrl: 'wss://ws-feed.exchange.coinbase.com',
          timeout: 5000,
          rateLimit: {
            requests: 600,
            windowMs: 60000
          },
          features: ['spot']
        },
        kraken: {
          name: 'kraken',
          enabled: process.env.KRAKEN_ENABLED !== 'false',
          baseUrl: 'https://api.kraken.com',
          websocketUrl: 'wss://ws.kraken.com/',
          timeout: 5000,
          rateLimit: {
            requests: 20,
            windowMs: 1000
          },
          features: ['spot', 'futures']
        },
        kucoin: {
          name: 'kucoin',
          enabled: process.env.KUCOIN_ENABLED !== 'false',
          baseUrl: 'https://api.kucoin.com',
          websocketUrl: '', // Dynamic endpoint
          timeout: 5000,
          rateLimit: {
            requests: 200,
            windowMs: 10000
          },
          features: ['spot', 'futures']
        },
        gemini: {
          name: 'gemini',
          enabled: process.env.GEMINI_ENABLED !== 'false',
          baseUrl: 'https://api.gemini.com',
          websocketUrl: 'wss://api.gemini.com/v1/marketdata/',
          timeout: 5000,
          rateLimit: {
            requests: 600,
            windowMs: 60000
          },
          features: ['spot']
        }
      },
      monitoring: {
        enabled: process.env.MONITORING_ENABLED !== 'false',
        metricsPort: parseInt(process.env.METRICS_PORT || '9090'),
        logLevel: (process.env.LOG_LEVEL as any) || 'info'
      }
    };
    
    return ConfigSchema.parse(baseConfig);
  }
  
  get(): Config {
    return this.config;
  }
  
  getExchange(name: string): ExchangeConfig | undefined {
    return this.config.exchanges[name];
  }
  
  getEnabledExchanges(): ExchangeConfig[] {
    return Object.values(this.config.exchanges).filter(exchange => exchange.enabled);
  }
}
```

This implementation provides a solid foundation for building a production-ready cryptocurrency exchange API integration system. Each pattern addresses specific challenges while maintaining scalability, reliability, and maintainability.