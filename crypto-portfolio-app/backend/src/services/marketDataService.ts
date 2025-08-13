import { OrderBookSnapshot, TradeSnapshot, OrderBookLevel } from '../types/realtime.types';
import { RedisService } from './redisService';
import { PriceService } from './priceService';
import { logger } from '../utils/logger';
import axios from 'axios';

export class MarketDataService {
  private redisService: RedisService;
  private priceService: PriceService;
  private readonly ORDER_BOOK_CACHE_TTL = 10; // 10 seconds
  private readonly TRADES_CACHE_TTL = 30; // 30 seconds
  private readonly MARKET_STATS_CACHE_TTL = 60; // 1 minute

  constructor() {
    this.redisService = new RedisService();
    this.priceService = new PriceService();
  }

  async getOrderBook(symbol: string, depth: number = 20): Promise<OrderBookSnapshot | null> {
    try {
      const cacheKey = `orderbook:${symbol}:${depth}`;
      const cached = await this.redisService.get(cacheKey);

      if (cached) {
        const data = JSON.parse(cached);
        return {
          ...data,
          timestamp: new Date(data.timestamp)
        };
      }

      // Fetch fresh order book data
      const orderBook = await this.fetchOrderBookFromExchange(symbol, depth);
      
      if (orderBook) {
        // Cache the result
        await this.redisService.setex(
          cacheKey,
          this.ORDER_BOOK_CACHE_TTL,
          JSON.stringify(orderBook)
        );
      }

      return orderBook;
    } catch (error) {
      logger.error(`Error getting order book for ${symbol}:`, error);
      return null;
    }
  }

  private async fetchOrderBookFromExchange(symbol: string, depth: number): Promise<OrderBookSnapshot | null> {
    try {
      // This would integrate with actual exchange APIs
      // For demo purposes, simulate order book data
      const mockOrderBook = this.generateMockOrderBook(symbol, depth);
      return mockOrderBook;
    } catch (error) {
      logger.error(`Error fetching order book from exchange for ${symbol}:`, error);
      return null;
    }
  }

  private generateMockOrderBook(symbol: string, depth: number): OrderBookSnapshot {
    // Get current price for reference
    const basePrice = Math.random() * 50000 + 1000; // Random price between 1000-51000
    
    const bids: OrderBookLevel[] = [];
    const asks: OrderBookLevel[] = [];

    // Generate bid levels (below current price)
    for (let i = 0; i < depth; i++) {
      const priceOffset = (i + 1) * 0.001; // 0.1% spread between levels
      const price = basePrice * (1 - priceOffset);
      const quantity = Math.random() * 10 + 0.1;
      
      bids.push({
        price: Number(price.toFixed(2)),
        quantity: Number(quantity.toFixed(6)),
        total: Number((price * quantity).toFixed(2))
      });
    }

    // Generate ask levels (above current price)
    for (let i = 0; i < depth; i++) {
      const priceOffset = (i + 1) * 0.001; // 0.1% spread between levels
      const price = basePrice * (1 + priceOffset);
      const quantity = Math.random() * 10 + 0.1;
      
      asks.push({
        price: Number(price.toFixed(2)),
        quantity: Number(quantity.toFixed(6)),
        total: Number((price * quantity).toFixed(2))
      });
    }

    // Calculate running totals
    let runningBidTotal = 0;
    bids.forEach(bid => {
      runningBidTotal += bid.quantity;
      bid.total = Number(runningBidTotal.toFixed(6));
    });

    let runningAskTotal = 0;
    asks.forEach(ask => {
      runningAskTotal += ask.quantity;
      ask.total = Number(runningAskTotal.toFixed(6));
    });

    const spread = asks[0].price - bids[0].price;

    return {
      symbol,
      bids: bids.sort((a, b) => b.price - a.price), // Highest bid first
      asks: asks.sort((a, b) => a.price - b.price), // Lowest ask first
      spread: Number(spread.toFixed(2)),
      timestamp: new Date()
    };
  }

  async getRecentTrades(symbol: string, limit: number = 20): Promise<TradeSnapshot[]> {
    try {
      const cacheKey = `trades:${symbol}:${limit}`;
      const cached = await this.redisService.get(cacheKey);

      if (cached) {
        const data = JSON.parse(cached);
        return data.map((trade: any) => ({
          ...trade,
          timestamp: new Date(trade.timestamp)
        }));
      }

      // Fetch fresh trade data
      const trades = await this.fetchRecentTradesFromExchange(symbol, limit);
      
      if (trades.length > 0) {
        // Cache the result
        await this.redisService.setex(
          cacheKey,
          this.TRADES_CACHE_TTL,
          JSON.stringify(trades)
        );
      }

      return trades;
    } catch (error) {
      logger.error(`Error getting recent trades for ${symbol}:`, error);
      return [];
    }
  }

  private async fetchRecentTradesFromExchange(symbol: string, limit: number): Promise<TradeSnapshot[]> {
    try {
      // This would integrate with actual exchange APIs
      // For demo purposes, generate mock trade data
      return this.generateMockTrades(symbol, limit);
    } catch (error) {
      logger.error(`Error fetching recent trades from exchange for ${symbol}:`, error);
      return [];
    }
  }

  private generateMockTrades(symbol: string, limit: number): TradeSnapshot[] {
    const trades: TradeSnapshot[] = [];
    const basePrice = Math.random() * 50000 + 1000;
    
    for (let i = 0; i < limit; i++) {
      const priceVariation = (Math.random() - 0.5) * 0.02; // ±1% price variation
      const price = basePrice * (1 + priceVariation);
      const quantity = Math.random() * 5 + 0.01;
      const side = Math.random() > 0.5 ? 'buy' : 'sell';
      const timestamp = new Date(Date.now() - (i * 1000 * Math.random() * 60)); // Random times in last hour

      trades.push({
        symbol,
        price: Number(price.toFixed(2)),
        quantity: Number(quantity.toFixed(6)),
        side,
        timestamp,
        tradeId: `${symbol}-${Date.now()}-${i}`,
        exchange: 'simulated'
      });
    }

    // Sort by timestamp descending (most recent first)
    return trades.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getMarketStats(): Promise<any> {
    try {
      const cacheKey = 'market:stats:global';
      const cached = await this.redisService.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Calculate global market statistics
      const stats = await this.calculateMarketStats();
      
      // Cache the result
      await this.redisService.setex(
        cacheKey,
        this.MARKET_STATS_CACHE_TTL,
        JSON.stringify(stats)
      );

      return stats;
    } catch (error) {
      logger.error('Error getting market stats:', error);
      return {
        totalMarketCap: 0,
        total24hVolume: 0,
        btcDominance: 0,
        activeCryptocurrencies: 0,
        marketCapChange24h: 0,
        volumeChange24h: 0
      };
    }
  }

  private async calculateMarketStats(): Promise<any> {
    try {
      // This would typically fetch from a market data API like CoinGecko or CoinMarketCap
      // For demo purposes, return simulated data
      
      return {
        totalMarketCap: 2500000000000, // $2.5T
        total24hVolume: 95000000000, // $95B
        btcDominance: 42.5, // 42.5%
        activeCryptocurrencies: 8500,
        marketCapChange24h: 1.85, // +1.85%
        volumeChange24h: -5.2, // -5.2%
        lastUpdated: new Date().toISOString(),
        topGainers: [
          { symbol: 'ETH', change: 8.5 },
          { symbol: 'BNB', change: 6.2 },
          { symbol: 'ADA', change: 5.8 }
        ],
        topLosers: [
          { symbol: 'DOGE', change: -4.2 },
          { symbol: 'MATIC', change: -3.8 },
          { symbol: 'DOT', change: -3.1 }
        ]
      };
    } catch (error) {
      logger.error('Error calculating market stats:', error);
      return {};
    }
  }

  async subscribeToExchangeWebSocket(symbols: string[], onUpdate: (data: any) => void): Promise<void> {
    try {
      // This would establish WebSocket connections to exchange APIs
      // For demo purposes, simulate periodic updates
      
      logger.info(`Subscribing to market data for symbols: ${symbols.join(', ')}`);
      
      // Simulate market data updates every 1-5 seconds
      const updateInterval = setInterval(async () => {
        for (const symbol of symbols) {
          try {
            // Simulate different types of market updates
            const updateType = Math.random();
            
            if (updateType < 0.6) {
              // Price update (60% of the time)
              const priceData = await this.priceService.getCurrentPrice(symbol);
              if (priceData) {
                onUpdate({
                  type: 'price',
                  symbol,
                  data: priceData
                });
              }
            } else if (updateType < 0.8) {
              // Order book update (20% of the time)
              const orderBook = await this.getOrderBook(symbol, 10);
              if (orderBook) {
                onUpdate({
                  type: 'orderbook',
                  symbol,
                  data: orderBook
                });
              }
            } else {
              // Trade update (20% of the time)
              const recentTrades = await this.getRecentTrades(symbol, 1);
              if (recentTrades.length > 0) {
                onUpdate({
                  type: 'trade',
                  symbol,
                  data: recentTrades[0]
                });
              }
            }
          } catch (error) {
            logger.warn(`Error simulating market update for ${symbol}:`, error);
          }
        }
      }, Math.random() * 4000 + 1000); // Random interval between 1-5 seconds

      // Store interval reference for cleanup
      // In a real implementation, this would be managed differently
      (global as any).marketDataIntervals = (global as any).marketDataIntervals || [];
      (global as any).marketDataIntervals.push(updateInterval);
      
    } catch (error) {
      logger.error('Error subscribing to exchange WebSocket:', error);
    }
  }

  async unsubscribeFromExchangeWebSocket(symbols: string[]): Promise<void> {
    try {
      logger.info(`Unsubscribing from market data for symbols: ${symbols.join(', ')}`);
      
      // In a real implementation, this would close specific WebSocket connections
      // For demo purposes, just log the action
      
    } catch (error) {
      logger.error('Error unsubscribing from exchange WebSocket:', error);
    }
  }

  async getVolumeProfile(symbol: string, timeframe: string = '1h'): Promise<any> {
    try {
      const cacheKey = `volume:profile:${symbol}:${timeframe}`;
      const cached = await this.redisService.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Calculate volume profile
      const volumeProfile = await this.calculateVolumeProfile(symbol, timeframe);
      
      // Cache for 5 minutes
      await this.redisService.setex(cacheKey, 300, JSON.stringify(volumeProfile));

      return volumeProfile;
    } catch (error) {
      logger.error(`Error getting volume profile for ${symbol}:`, error);
      return null;
    }
  }

  private async calculateVolumeProfile(symbol: string, timeframe: string): Promise<any> {
    // This would analyze historical trade data to create volume profile
    // For demo purposes, return mock data
    
    const levels: Array<{ price: number; volume: number; percentage: number }> = [];
    const basePrice = Math.random() * 50000 + 1000;
    
    for (let i = 0; i < 20; i++) {
      const priceLevel = basePrice * (0.95 + (i * 0.005)); // Price levels from 95% to 105% of base
      const volume = Math.random() * 1000000 + 50000; // Random volume
      
      levels.push({
        price: Number(priceLevel.toFixed(2)),
        volume: Number(volume.toFixed(0)),
        percentage: 0 // Will be calculated
      });
    }

    // Calculate percentages
    const totalVolume = levels.reduce((sum, level) => sum + level.volume, 0);
    levels.forEach(level => {
      level.percentage = Number(((level.volume / totalVolume) * 100).toFixed(2));
    });

    return {
      symbol,
      timeframe,
      levels: levels.sort((a, b) => b.volume - a.volume), // Sort by volume descending
      pocPrice: levels[0].price, // Point of Control (highest volume)
      totalVolume,
      timestamp: new Date()
    };
  }

  async invalidateCache(symbol?: string): Promise<void> {
    try {
      const patterns = symbol 
        ? [`orderbook:${symbol}:*`, `trades:${symbol}:*`, `volume:profile:${symbol}:*`]
        : ['orderbook:*', 'trades:*', 'volume:profile:*', 'market:stats:*'];

      for (const pattern of patterns) {
        const keys = await this.redisService.keys(pattern);
        if (keys.length > 0) {
          await this.redisService.del(...keys);
        }
      }
    } catch (error) {
      logger.error('Error invalidating market data cache:', error);
    }
  }

  async healthCheck(): Promise<{ status: string; latency: number; errors: string[] }> {
    const errors: string[] = [];
    const startTime = Date.now();

    try {
      // Test Redis connection
      await this.redisService.ping();
    } catch (error) {
      errors.push('Redis connection failed');
    }

    try {
      // Test price service
      await this.priceService.getCurrentPrice('BTC');
    } catch (error) {
      errors.push('Price service failed');
    }

    const latency = Date.now() - startTime;
    const status = errors.length === 0 ? 'healthy' : 'degraded';

    return { status, latency, errors };
  }
}