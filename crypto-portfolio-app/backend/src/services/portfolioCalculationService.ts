import { PortfolioRealTimeData, HoldingRealTimeData } from '../types/realtime.types';
import { PrismaService } from './prismaService';
import { RealTimeDataService } from './realTimeDataService';
import { RedisService } from './redisService';
import { logger } from '../utils/logger';

export class PortfolioCalculationService {
  private prisma: PrismaService;
  private realTimeDataService: RealTimeDataService;
  private redisService: RedisService;
  private readonly PORTFOLIO_CACHE_TTL = 30; // 30 seconds
  private readonly CACHE_PREFIX = 'portfolio:realtime:';

  constructor() {
    this.prisma = new PrismaService();
    this.realTimeDataService = new RealTimeDataService();
    this.redisService = new RedisService();
  }

  async getPortfolioRealTimeData(portfolioId: string): Promise<PortfolioRealTimeData | null> {
    try {
      // Check cache first
      const cacheKey = `${this.CACHE_PREFIX}${portfolioId}`;
      const cached = await this.redisService.get(cacheKey);
      
      if (cached) {
        const data = JSON.parse(cached);
        return {
          ...data,
          lastCalculated: new Date(data.lastCalculated)
        };
      }

      // Fetch portfolio data from database
      const portfolio = await this.prisma.portfolio.findUnique({
        where: { id: portfolioId },
        include: {
          holdings: {
            include: {
              cryptocurrency: true
            }
          }
        }
      });

      if (!portfolio) {
        return null;
      }

      // Get symbols for price lookup
      const symbols = portfolio.holdings.map(h => h.cryptocurrency.symbol);
      
      if (symbols.length === 0) {
        return {
          portfolioId,
          totalValue: 0,
          totalCost: 0,
          unrealizedPnl: 0,
          change24h: 0,
          changePercent: 0,
          holdings: [],
          lastCalculated: new Date()
        };
      }

      // Get real-time prices
      const prices = await this.realTimeDataService.getLatestPrices(symbols);
      const priceMap = new Map(prices.map(p => [p.symbol, p]));

      // Calculate holdings data
      const holdingsData: HoldingRealTimeData[] = [];
      let totalValue = 0;
      let totalCost = 0;

      for (const holding of portfolio.holdings) {
        const symbol = holding.cryptocurrency.symbol;
        const priceData = priceMap.get(symbol);
        
        if (!priceData) {
          logger.warn(`No price data found for ${symbol} in portfolio ${portfolioId}`);
          continue;
        }

        const quantity = holding.quantity.toNumber();
        const averageCost = holding.averageCost?.toNumber() || 0;
        const currentPrice = priceData.price;
        const value = quantity * currentPrice;
        const cost = quantity * averageCost;
        const unrealizedPnl = value - cost;
        const change24h = quantity * (priceData.change24h || 0);
        const changePercent = averageCost > 0 ? ((currentPrice - averageCost) / averageCost) * 100 : 0;

        holdingsData.push({
          cryptocurrencyId: holding.cryptocurrencyId,
          symbol,
          quantity,
          averageCost,
          currentPrice,
          value,
          unrealizedPnl,
          change24h,
          changePercent,
          allocation: 0 // Will be calculated after total value
        });

        totalValue += value;
        totalCost += cost;
      }

      // Calculate allocations
      if (totalValue > 0) {
        holdingsData.forEach(holding => {
          holding.allocation = (holding.value / totalValue) * 100;
        });
      }

      const unrealizedPnl = totalValue - totalCost;
      const change24h = holdingsData.reduce((sum, h) => sum + h.change24h, 0);
      const changePercent = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0;

      const portfolioData: PortfolioRealTimeData = {
        portfolioId,
        totalValue,
        totalCost,
        unrealizedPnl,
        change24h,
        changePercent,
        holdings: holdingsData,
        lastCalculated: new Date()
      };

      // Cache the result
      await this.redisService.setex(
        cacheKey,
        this.PORTFOLIO_CACHE_TTL,
        JSON.stringify(portfolioData)
      );

      return portfolioData;
    } catch (error) {
      logger.error(`Error calculating portfolio data for ${portfolioId}:`, error);
      return null;
    }
  }

  async getAllPortfoliosRealTimeData(userId: string): Promise<PortfolioRealTimeData[]> {
    try {
      const portfolios = await this.prisma.portfolio.findMany({
        where: { userId },
        select: { id: true }
      });

      const results = await Promise.all(
        portfolios.map(p => this.getPortfolioRealTimeData(p.id))
      );

      return results.filter(Boolean) as PortfolioRealTimeData[];
    } catch (error) {
      logger.error(`Error getting all portfolios data for user ${userId}:`, error);
      return [];
    }
  }

  async portfolioHasSymbols(portfolioId: string, symbols: string[]): Promise<boolean> {
    try {
      const portfolio = await this.prisma.portfolio.findUnique({
        where: { id: portfolioId },
        include: {
          holdings: {
            include: {
              cryptocurrency: true
            }
          }
        }
      });

      if (!portfolio) {
        return false;
      }

      const portfolioSymbols = new Set(
        portfolio.holdings.map(h => h.cryptocurrency.symbol)
      );

      return symbols.some(symbol => portfolioSymbols.has(symbol));
    } catch (error) {
      logger.error(`Error checking portfolio symbols for ${portfolioId}:`, error);
      return false;
    }
  }

  async syncPortfolioData(portfolioId: string): Promise<void> {
    try {
      // Invalidate cache to force fresh calculation
      const cacheKey = `${this.CACHE_PREFIX}${portfolioId}`;
      await this.redisService.del(cacheKey);

      // Trigger fresh calculation
      await this.getPortfolioRealTimeData(portfolioId);
      
      logger.info(`Portfolio data synced for ${portfolioId}`);
    } catch (error) {
      logger.error(`Error syncing portfolio data for ${portfolioId}:`, error);
    }
  }

  async getPortfolioSummary(portfolioId: string): Promise<any> {
    try {
      const realTimeData = await this.getPortfolioRealTimeData(portfolioId);
      
      if (!realTimeData) {
        return null;
      }

      // Calculate additional metrics
      const topHoldings = realTimeData.holdings
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
        .map(h => ({
          symbol: h.symbol,
          allocation: h.allocation,
          value: h.value,
          changePercent: h.changePercent
        }));

      const portfolioMetrics = await this.calculatePortfolioMetrics(portfolioId);

      return {
        totalValue: realTimeData.totalValue,
        totalCost: realTimeData.totalCost,
        unrealizedPnl: realTimeData.unrealizedPnl,
        change24h: realTimeData.change24h,
        changePercent: realTimeData.changePercent,
        topHoldings,
        totalHoldings: realTimeData.holdings.length,
        diversificationScore: this.calculateDiversificationScore(realTimeData.holdings),
        ...portfolioMetrics
      };
    } catch (error) {
      logger.error(`Error getting portfolio summary for ${portfolioId}:`, error);
      return null;
    }
  }

  private async calculatePortfolioMetrics(portfolioId: string): Promise<any> {
    try {
      // Get historical portfolio value data for metrics calculation
      // This would typically involve more complex calculations
      // For now, return basic metrics
      
      return {
        volatility: 0, // Would calculate from historical data
        sharpeRatio: 0, // Would need risk-free rate and historical returns
        maxDrawdown: 0, // Would need historical peaks and troughs
        beta: 0, // Would need market benchmark comparison
        alpha: 0 // Would need benchmark comparison
      };
    } catch (error) {
      logger.error('Error calculating portfolio metrics:', error);
      return {};
    }
  }

  private calculateDiversificationScore(holdings: HoldingRealTimeData[]): number {
    if (holdings.length === 0) return 0;
    if (holdings.length === 1) return 10; // Single holding = low diversification

    // Calculate Herfindahl-Hirschman Index (HHI) for concentration
    const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
    
    if (totalValue === 0) return 0;

    const hhi = holdings.reduce((sum, holding) => {
      const marketShare = holding.value / totalValue;
      return sum + (marketShare * marketShare);
    }, 0);

    // Convert HHI to diversification score (0-100)
    // Lower HHI = better diversification = higher score
    const maxHHI = 1; // Fully concentrated
    const minHHI = 1 / holdings.length; // Perfectly diversified
    
    const normalizedHHI = (hhi - minHHI) / (maxHHI - minHHI);
    const diversificationScore = Math.max(0, Math.min(100, (1 - normalizedHHI) * 100));

    return Math.round(diversificationScore);
  }

  async invalidatePortfolioCache(portfolioId?: string): Promise<void> {
    try {
      if (portfolioId) {
        const cacheKey = `${this.CACHE_PREFIX}${portfolioId}`;
        await this.redisService.del(cacheKey);
      } else {
        const keys = await this.redisService.keys(`${this.CACHE_PREFIX}*`);
        if (keys.length > 0) {
          await this.redisService.del(...keys);
        }
      }
    } catch (error) {
      logger.error('Error invalidating portfolio cache:', error);
    }
  }

  async bulkCalculatePortfolios(portfolioIds: string[]): Promise<Map<string, PortfolioRealTimeData>> {
    const results = new Map<string, PortfolioRealTimeData>();
    
    try {
      // Process in batches to avoid overwhelming the system
      const batchSize = 10;
      
      for (let i = 0; i < portfolioIds.length; i += batchSize) {
        const batch = portfolioIds.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (portfolioId) => {
          const data = await this.getPortfolioRealTimeData(portfolioId);
          if (data) {
            results.set(portfolioId, data);
          }
          return data;
        });

        await Promise.all(batchPromises);
        
        // Small delay between batches
        if (i + batchSize < portfolioIds.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      logger.error('Error in bulk portfolio calculation:', error);
    }

    return results;
  }

  getCacheStats(): { 
    cacheHits: number; 
    cacheMisses: number; 
    cacheSize: number; 
  } {
    // This would track cache statistics in a real implementation
    return {
      cacheHits: 0,
      cacheMisses: 0,
      cacheSize: 0
    };
  }
}