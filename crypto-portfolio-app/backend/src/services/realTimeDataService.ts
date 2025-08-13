import { RealtimePrice, MarketDataSnapshot } from '../types/realtime.types';
import { RedisService } from './redisService';
import { PriceService } from './priceService';
import { logger } from '../utils/logger';

export class RealTimeDataService {
  private redisService: RedisService;
  private priceService: PriceService;
  private priceCache: Map<string, RealtimePrice> = new Map();
  private lastUpdated: Map<string, number> = new Map();
  private readonly PRICE_EXPIRY_MS = 60000; // 1 minute
  private readonly CACHE_PREFIX = 'realtime:price:';

  constructor() {
    this.redisService = new RedisService();
    this.priceService = new PriceService();
  }

  async getLatestPrices(symbols: string[]): Promise<RealtimePrice[]> {
    const results: RealtimePrice[] = [];
    const symbolsToFetch: string[] = [];

    try {
      // Check cache first
      for (const symbol of symbols) {
        const cached = this.priceCache.get(symbol);
        const lastUpdate = this.lastUpdated.get(symbol) || 0;
        const isExpired = Date.now() - lastUpdate > this.PRICE_EXPIRY_MS;

        if (cached && !isExpired) {
          results.push(cached);
        } else {
          symbolsToFetch.push(symbol);
        }
      }

      // Fetch missing or expired prices
      if (symbolsToFetch.length > 0) {
        const freshPrices = await this.fetchLatestPrices(symbolsToFetch);
        results.push(...freshPrices);

        // Update cache
        for (const price of freshPrices) {
          this.priceCache.set(price.symbol, price);
          this.lastUpdated.set(price.symbol, Date.now());
          
          // Store in Redis for persistence
          await this.redisService.setex(
            `${this.CACHE_PREFIX}${price.symbol}`,
            60, // 1 minute TTL
            JSON.stringify(price)
          );
        }
      }

      return results;
    } catch (error) {
      logger.error('Error getting latest prices:', error);
      return results; // Return what we have from cache
    }
  }

  private async fetchLatestPrices(symbols: string[]): Promise<RealtimePrice[]> {
    const prices: RealtimePrice[] = [];

    try {
      // Try to get prices from Redis first
      const redisPromises = symbols.map(symbol => 
        this.redisService.get(`${this.CACHE_PREFIX}${symbol}`)
      );
      const redisResults = await Promise.all(redisPromises);

      for (let i = 0; i < symbols.length; i++) {
        const symbol = symbols[i];
        const redisData = redisResults[i];

        if (redisData) {
          try {
            const cachedPrice = JSON.parse(redisData);
            prices.push({
              ...cachedPrice,
              lastUpdate: new Date(cachedPrice.lastUpdate)
            });
            continue;
          } catch (parseError) {
            logger.warn(`Failed to parse cached price for ${symbol}:`, parseError);
          }
        }

        // If not in Redis, fetch from price service
        try {
          const priceData = await this.priceService.getCurrentPrice(symbol);
          if (priceData) {
            const realtimePrice: RealtimePrice = {
              symbol,
              price: priceData.price,
              change24h: priceData.change24h || 0,
              changePercent24h: priceData.changePercent24h || 0,
              volume24h: priceData.volume24h || 0,
              high24h: priceData.high24h || priceData.price,
              low24h: priceData.low24h || priceData.price,
              lastUpdate: priceData.lastUpdated || new Date(),
              source: priceData.source || 'aggregated'
            };
            prices.push(realtimePrice);
          }
        } catch (priceError) {
          logger.warn(`Failed to fetch price for ${symbol}:`, priceError);
          
          // Return last known price if available
          const lastKnown = this.priceCache.get(symbol);
          if (lastKnown) {
            prices.push(lastKnown);
          }
        }
      }

      return prices;
    } catch (error) {
      logger.error('Error fetching latest prices:', error);
      return [];
    }
  }

  async getMarketSnapshot(symbol: string): Promise<MarketDataSnapshot | null> {
    try {
      const cacheKey = `market:snapshot:${symbol}`;
      const cached = await this.redisService.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Fetch fresh market data
      const priceData = await this.priceService.getCurrentPrice(symbol);
      
      if (!priceData) {
        return null;
      }

      const snapshot: MarketDataSnapshot = {
        symbol,
        price: priceData.price,
        volume24h: priceData.volume24h || 0,
        change24h: priceData.change24h || 0,
        changePercent24h: priceData.changePercent24h || 0,
        high24h: priceData.high24h || priceData.price,
        low24h: priceData.low24h || priceData.price,
        marketCap: priceData.marketCap,
        rank: priceData.rank,
        lastUpdate: priceData.lastUpdated || new Date()
      };

      // Cache for 30 seconds
      await this.redisService.setex(cacheKey, 30, JSON.stringify(snapshot));

      return snapshot;
    } catch (error) {
      logger.error(`Error getting market snapshot for ${symbol}:`, error);
      return null;
    }
  }

  async invalidateCache(symbol?: string): Promise<void> {
    try {
      if (symbol) {
        // Invalidate specific symbol
        this.priceCache.delete(symbol);
        this.lastUpdated.delete(symbol);
        await this.redisService.del(`${this.CACHE_PREFIX}${symbol}`);
        await this.redisService.del(`market:snapshot:${symbol}`);
      } else {
        // Invalidate all cache
        this.priceCache.clear();
        this.lastUpdated.clear();
        
        const keys = await this.redisService.keys(`${this.CACHE_PREFIX}*`);
        const snapshotKeys = await this.redisService.keys('market:snapshot:*');
        
        if (keys.length > 0) {
          await this.redisService.del(...keys);
        }
        if (snapshotKeys.length > 0) {
          await this.redisService.del(...snapshotKeys);
        }
      }
    } catch (error) {
      logger.error('Error invalidating cache:', error);
    }
  }

  async warmupCache(symbols: string[]): Promise<void> {
    try {
      logger.info(`Warming up price cache for ${symbols.length} symbols...`);
      
      const batchSize = 10;
      for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        await this.getLatestPrices(batch);
        
        // Small delay to avoid overwhelming APIs
        if (i + batchSize < symbols.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      logger.info('Price cache warmup completed');
    } catch (error) {
      logger.error('Error warming up cache:', error);
    }
  }

  getCacheStats(): {
    cacheSize: number;
    symbols: string[];
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    const symbols = Array.from(this.priceCache.keys());
    const timestamps = Array.from(this.lastUpdated.values());
    
    return {
      cacheSize: this.priceCache.size,
      symbols,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : null,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : null
    };
  }

  async startPriceStream(symbols: string[], onUpdate: (price: RealtimePrice) => void): Promise<void> {
    // This would integrate with external price feeds
    // For now, simulate with periodic updates
    setInterval(async () => {
      try {
        const prices = await this.getLatestPrices(symbols);
        prices.forEach(onUpdate);
      } catch (error) {
        logger.error('Error in price stream:', error);
      }
    }, 5000); // Update every 5 seconds
  }

  async calculateAggregatedPrice(symbol: string, sources: string[]): Promise<RealtimePrice | null> {
    try {
      const prices: number[] = [];
      const volumes: number[] = [];
      let totalVolume = 0;
      let weightedPrice = 0;

      // Get prices from different sources
      for (const source of sources) {
        try {
          const price = await this.priceService.getPriceFromSource(symbol, source);
          if (price && price.price > 0) {
            prices.push(price.price);
            const volume = price.volume24h || 1;
            volumes.push(volume);
            totalVolume += volume;
            weightedPrice += price.price * volume;
          }
        } catch (sourceError) {
          logger.warn(`Failed to get price from ${source} for ${symbol}:`, sourceError);
        }
      }

      if (prices.length === 0) {
        return null;
      }

      // Calculate volume-weighted average price
      const avgPrice = totalVolume > 0 ? weightedPrice / totalVolume : prices.reduce((sum, p) => sum + p, 0) / prices.length;

      // Get additional market data
      const marketData = await this.getMarketSnapshot(symbol);

      return {
        symbol,
        price: avgPrice,
        change24h: marketData?.change24h || 0,
        changePercent24h: marketData?.changePercent24h || 0,
        volume24h: marketData?.volume24h || totalVolume,
        high24h: marketData?.high24h || Math.max(...prices),
        low24h: marketData?.low24h || Math.min(...prices),
        lastUpdate: new Date(),
        source: 'aggregated'
      };
    } catch (error) {
      logger.error(`Error calculating aggregated price for ${symbol}:`, error);
      return null;
    }
  }
}