import { PrismaClient, Cryptocurrency, TradingPair, PriceHistory, CurrentPrice } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { logger } from '../utils/logger';
import axios, { AxiosResponse } from 'axios';

interface PriceData {
  price: Decimal;
  volume24h?: Decimal;
  marketCap?: Decimal;
  change24h?: Decimal;
  timestamp: Date;
  source: string;
}

interface CryptoWithCurrentPrice extends Cryptocurrency {
  currentPrices: CurrentPrice[];
}

interface MarketData {
  symbol: string;
  price: number;
  volume_24h: number;
  market_cap: number;
  percent_change_24h: number;
}

interface CoingeckoResponse {
  [key: string]: {
    usd: number;
    usd_24h_vol: number;
    usd_market_cap: number;
    usd_24h_change: number;
  };
}

interface HistoricalPriceResponse {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

export class PriceService {
  private prisma: PrismaClient;
  private coingeckoApiKey: string;
  private coinmarketcapApiKey: string;
  private rateLimit = new Map<string, number>();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.coingeckoApiKey = process.env.COINGECKO_API_KEY || '';
    this.coinmarketcapApiKey = process.env.COINMARKETCAP_API_KEY || '';
  }

  /**
   * Update current prices for all active cryptocurrencies
   */
  async updateAllCurrentPrices(): Promise<void> {
    try {
      const cryptocurrencies = await this.prisma.cryptocurrency.findMany({
        where: { 
          isActive: true,
          OR: [
            { coingeckoId: { not: null } },
            { symbol: { not: null } },
          ],
        },
      });

      logger.info(`Updating prices for ${cryptocurrencies.length} cryptocurrencies`);

      // Update in batches to respect API rate limits
      const batchSize = 100;
      for (let i = 0; i < cryptocurrencies.length; i += batchSize) {
        const batch = cryptocurrencies.slice(i, i + batchSize);
        await this.updatePriceBatch(batch);
        
        // Rate limiting - wait between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      logger.info('Finished updating all cryptocurrency prices');
    } catch (error) {
      logger.error('Error updating all current prices:', error);
      throw error;
    }
  }

  /**
   * Update price for a specific cryptocurrency
   */
  async updateCryptocurrencyPrice(cryptocurrencyId: string): Promise<CurrentPrice | null> {
    const cryptocurrency = await this.prisma.cryptocurrency.findUnique({
      where: { id: cryptocurrencyId },
    });

    if (!cryptocurrency) {
      throw new Error('Cryptocurrency not found');
    }

    try {
      const priceData = await this.fetchPriceFromCoingecko([cryptocurrency]);
      
      if (priceData.length > 0) {
        return await this.updateCurrentPrice(cryptocurrency.id, priceData[0]);
      }

      return null;
    } catch (error) {
      logger.error(`Error updating price for ${cryptocurrency.symbol}:`, error);
      return null;
    }
  }

  /**
   * Get current price for a cryptocurrency
   */
  async getCurrentPrice(cryptocurrencyId: string): Promise<CurrentPrice | null> {
    // First try to get from trading pairs
    const tradingPair = await this.prisma.tradingPair.findFirst({
      where: {
        OR: [
          { baseCurrencyId: cryptocurrencyId },
          { quoteCurrencyId: cryptocurrencyId },
        ],
        isActive: true,
      },
      include: {
        currentPrice: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (tradingPair?.currentPrice) {
      return tradingPair.currentPrice;
    }

    // Fall back to cryptocurrency current prices
    return this.prisma.currentPrice.findFirst({
      where: {
        cryptocurrencyId,
      },
      orderBy: {
        lastUpdated: 'desc',
      },
    });
  }

  /**
   * Get price history for a cryptocurrency
   */
  async getPriceHistory(
    cryptocurrencyId: string,
    startDate: Date,
    endDate: Date,
    interval: '1h' | '1d' | '1w' = '1d'
  ): Promise<PriceHistory[]> {
    return this.prisma.priceHistory.findMany({
      where: {
        cryptocurrencyId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });
  }

  /**
   * Import historical price data
   */
  async importHistoricalData(
    cryptocurrencyId: string,
    days: number = 365
  ): Promise<number> {
    const cryptocurrency = await this.prisma.cryptocurrency.findUnique({
      where: { id: cryptocurrencyId },
    });

    if (!cryptocurrency || !cryptocurrency.coingeckoId) {
      throw new Error('Cryptocurrency not found or missing CoinGecko ID');
    }

    try {
      const historicalData = await this.fetchHistoricalDataFromCoingecko(
        cryptocurrency.coingeckoId,
        days
      );

      let importedCount = 0;

      for (const dataPoint of historicalData) {
        await this.prisma.priceHistory.upsert({
          where: {
            cryptocurrencyId_timestamp: {
              cryptocurrencyId,
              timestamp: dataPoint.timestamp,
            },
          },
          update: {
            price: dataPoint.price,
            volume24h: dataPoint.volume24h,
            marketCap: dataPoint.marketCap,
          },
          create: {
            cryptocurrencyId,
            price: dataPoint.price,
            volume24h: dataPoint.volume24h,
            marketCap: dataPoint.marketCap,
            timestamp: dataPoint.timestamp,
            source: 'coingecko',
          },
        });

        importedCount++;
      }

      logger.info(`Imported ${importedCount} historical data points for ${cryptocurrency.symbol}`);
      return importedCount;
    } catch (error) {
      logger.error(`Error importing historical data for ${cryptocurrency.symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get market overview data
   */
  async getMarketOverview(): Promise<{
    totalMarketCap: Decimal;
    total24hVolume: Decimal;
    marketCapChange24h: Decimal;
    activeCoins: number;
    topGainers: CryptoWithCurrentPrice[];
    topLosers: CryptoWithCurrentPrice[];
  }> {
    // Get aggregated market data
    const marketStats = await this.prisma.currentPrice.aggregate({
      _sum: {
        marketCap: true,
        volume24h: true,
      },
      _count: {
        id: true,
      },
    });

    // Get top gainers (top 10 by 24h change)
    const topGainers = await this.prisma.cryptocurrency.findMany({
      where: {
        isActive: true,
        currentPrices: {
          some: {
            change24h: {
              gt: 0,
            },
          },
        },
      },
      include: {
        currentPrices: {
          orderBy: {
            lastUpdated: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        currentPrices: {
          _min: {
            change24h: 'desc',
          },
        },
      },
      take: 10,
    });

    // Get top losers (top 10 by 24h change)
    const topLosers = await this.prisma.cryptocurrency.findMany({
      where: {
        isActive: true,
        currentPrices: {
          some: {
            change24h: {
              lt: 0,
            },
          },
        },
      },
      include: {
        currentPrices: {
          orderBy: {
            lastUpdated: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        currentPrices: {
          _min: {
            change24h: 'asc',
          },
        },
      },
      take: 10,
    });

    return {
      totalMarketCap: marketStats._sum.marketCap || new Decimal(0),
      total24hVolume: marketStats._sum.volume24h || new Decimal(0),
      marketCapChange24h: new Decimal(0), // This would be calculated from historical data
      activeCoins: marketStats._count.id,
      topGainers: topGainers as CryptoWithCurrentPrice[],
      topLosers: topLosers as CryptoWithCurrentPrice[],
    };
  }

  /**
   * Search cryptocurrencies by symbol or name
   */
  async searchCryptocurrencies(query: string, limit: number = 20): Promise<CryptoWithCurrentPrice[]> {
    return this.prisma.cryptocurrency.findMany({
      where: {
        isActive: true,
        OR: [
          {
            symbol: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            name: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
      },
      include: {
        currentPrices: {
          orderBy: {
            lastUpdated: 'desc',
          },
          take: 1,
        },
      },
      orderBy: [
        { marketCapRank: 'asc' },
        { symbol: 'asc' },
      ],
      take: limit,
    }) as Promise<CryptoWithCurrentPrice[]>;
  }

  /**
   * Get trending cryptocurrencies
   */
  async getTrendingCryptocurrencies(limit: number = 10): Promise<CryptoWithCurrentPrice[]> {
    // This could be based on various factors like volume change, price change, etc.
    return this.prisma.cryptocurrency.findMany({
      where: {
        isActive: true,
        currentPrices: {
          some: {
            volume24h: {
              gt: 1000000, // Minimum volume threshold
            },
          },
        },
      },
      include: {
        currentPrices: {
          orderBy: {
            lastUpdated: 'desc',
          },
          take: 1,
        },
      },
      orderBy: [
        { marketCapRank: 'asc' },
      ],
      take: limit,
    }) as Promise<CryptoWithCurrentPrice[]>;
  }

  // Private helper methods
  private async updatePriceBatch(cryptocurrencies: Cryptocurrency[]): Promise<void> {
    try {
      const priceData = await this.fetchPriceFromCoingecko(cryptocurrencies);
      
      for (let i = 0; i < cryptocurrencies.length; i++) {
        const crypto = cryptocurrencies[i];
        const price = priceData[i];
        
        if (price) {
          await this.updateCurrentPrice(crypto.id, price);
          
          // Also save to price history
          await this.savePriceHistory(crypto.id, price);
        }
      }
    } catch (error) {
      logger.error('Error updating price batch:', error);
      throw error;
    }
  }

  private async fetchPriceFromCoingecko(cryptocurrencies: Cryptocurrency[]): Promise<PriceData[]> {
    const coingeckoIds = cryptocurrencies
      .filter(crypto => crypto.coingeckoId)
      .map(crypto => crypto.coingeckoId);

    if (coingeckoIds.length === 0) {
      return [];
    }

    const url = 'https://api.coingecko.com/api/v3/simple/price';
    const params = {
      ids: coingeckoIds.join(','),
      vs_currencies: 'usd',
      include_market_cap: 'true',
      include_24hr_vol: 'true',
      include_24hr_change: 'true',
    };

    const headers: any = {
      'Accept': 'application/json',
    };

    if (this.coingeckoApiKey) {
      headers['X-CG-Pro-API-Key'] = this.coingeckoApiKey;
    }

    try {
      const response: AxiosResponse<CoingeckoResponse> = await axios.get(url, {
        params,
        headers,
        timeout: 30000,
      });

      return cryptocurrencies.map(crypto => {
        if (!crypto.coingeckoId) return null;
        
        const data = response.data[crypto.coingeckoId];
        if (!data) return null;

        return {
          price: new Decimal(data.usd),
          volume24h: new Decimal(data.usd_24h_vol || 0),
          marketCap: new Decimal(data.usd_market_cap || 0),
          change24h: new Decimal(data.usd_24h_change || 0),
          timestamp: new Date(),
          source: 'coingecko',
        };
      }).filter(Boolean) as PriceData[];
    } catch (error) {
      logger.error('Error fetching prices from CoinGecko:', error);
      throw error;
    }
  }

  private async fetchHistoricalDataFromCoingecko(
    coingeckoId: string,
    days: number
  ): Promise<PriceData[]> {
    const url = `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart`;
    const params = {
      vs_currency: 'usd',
      days: days.toString(),
      interval: days > 90 ? 'daily' : 'hourly',
    };

    const headers: any = {
      'Accept': 'application/json',
    };

    if (this.coingeckoApiKey) {
      headers['X-CG-Pro-API-Key'] = this.coingeckoApiKey;
    }

    try {
      const response: AxiosResponse<HistoricalPriceResponse> = await axios.get(url, {
        params,
        headers,
        timeout: 30000,
      });

      const { prices, market_caps, total_volumes } = response.data;

      return prices.map((pricePoint, index) => ({
        price: new Decimal(pricePoint[1]),
        volume24h: total_volumes[index] ? new Decimal(total_volumes[index][1]) : undefined,
        marketCap: market_caps[index] ? new Decimal(market_caps[index][1]) : undefined,
        timestamp: new Date(pricePoint[0]),
        source: 'coingecko',
      }));
    } catch (error) {
      logger.error(`Error fetching historical data for ${coingeckoId}:`, error);
      throw error;
    }
  }

  private async updateCurrentPrice(cryptocurrencyId: string, priceData: PriceData): Promise<CurrentPrice> {
    // First, try to find a trading pair for this cryptocurrency
    const tradingPair = await this.prisma.tradingPair.findFirst({
      where: {
        baseCurrencyId: cryptocurrencyId,
        isActive: true,
      },
    });

    if (tradingPair) {
      return this.prisma.currentPrice.upsert({
        where: {
          tradingPairId: tradingPair.id,
        },
        update: {
          price: priceData.price,
          change24h: priceData.change24h,
          volume24h: priceData.volume24h,
          marketCap: priceData.marketCap,
          lastUpdated: priceData.timestamp,
        },
        create: {
          tradingPairId: tradingPair.id,
          cryptocurrencyId,
          price: priceData.price,
          change24h: priceData.change24h,
          volume24h: priceData.volume24h,
          marketCap: priceData.marketCap,
          lastUpdated: priceData.timestamp,
        },
      });
    }

    // If no trading pair, create a standalone current price entry
    const existingPrice = await this.prisma.currentPrice.findFirst({
      where: {
        cryptocurrencyId,
        tradingPairId: null,
      },
    });

    if (existingPrice) {
      return this.prisma.currentPrice.update({
        where: { id: existingPrice.id },
        data: {
          price: priceData.price,
          change24h: priceData.change24h,
          volume24h: priceData.volume24h,
          marketCap: priceData.marketCap,
          lastUpdated: priceData.timestamp,
        },
      });
    }

    // Create a temporary trading pair ID for standalone prices
    const tempTradingPair = await this.prisma.tradingPair.findFirst({
      where: {
        symbol: 'TEMP_USD',
        baseCurrencyId: cryptocurrencyId,
      },
    });

    if (!tempTradingPair) {
      throw new Error('Cannot create current price without trading pair');
    }

    return this.prisma.currentPrice.create({
      data: {
        tradingPairId: tempTradingPair.id,
        cryptocurrencyId,
        price: priceData.price,
        change24h: priceData.change24h,
        volume24h: priceData.volume24h,
        marketCap: priceData.marketCap,
        lastUpdated: priceData.timestamp,
      },
    });
  }

  private async savePriceHistory(cryptocurrencyId: string, priceData: PriceData): Promise<void> {
    try {
      await this.prisma.priceHistory.upsert({
        where: {
          cryptocurrencyId_timestamp: {
            cryptocurrencyId,
            timestamp: priceData.timestamp,
          },
        },
        update: {
          price: priceData.price,
          volume24h: priceData.volume24h,
          marketCap: priceData.marketCap,
          change24h: priceData.change24h,
        },
        create: {
          cryptocurrencyId,
          price: priceData.price,
          volume24h: priceData.volume24h,
          marketCap: priceData.marketCap,
          change24h: priceData.change24h,
          timestamp: priceData.timestamp,
          source: priceData.source,
        },
      });
    } catch (error) {
      logger.error('Error saving price history:', error);
    }
  }

  /**
   * Clean up old price history data
   */
  async cleanupOldPriceData(daysToKeep: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.prisma.priceHistory.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    logger.info(`Cleaned up ${result.count} old price history records`);
    return result.count;
  }
}