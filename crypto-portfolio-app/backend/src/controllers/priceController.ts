import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { PriceService } from '../services/priceService';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();
const priceService = new PriceService(prisma);

// Validation schemas
const historicalDataSchema = z.object({
  days: z.number().min(1).max(365).optional().default(90),
  interval: z.enum(['1h', '1d', '1w']).optional().default('1d'),
});

const priceHistorySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  interval: z.enum(['1h', '1d', '1w']).optional().default('1d'),
});

const searchSchema = z.object({
  query: z.string().min(1).max(100),
  limit: z.number().min(1).max(100).optional().default(20),
});

const trendingSchema = z.object({
  limit: z.number().min(1).max(50).optional().default(10),
});

export const priceController = {
  /**
   * Update all cryptocurrency prices
   */
  async updateAllPrices(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin (or this could be triggered by a cron job)
      if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        return;
      }

      await priceService.updateAllCurrentPrices();

      res.json({
        success: true,
        message: 'All cryptocurrency prices updated successfully',
      });
    } catch (error) {
      logger.error('Error updating all prices:', error);
      res.status(500).json({
        error: 'Failed to update prices',
      });
    }
  },

  /**
   * Update price for a specific cryptocurrency
   */
  async updateCryptocurrencyPrice(req: Request, res: Response): Promise<void> {
    try {
      const { cryptocurrencyId } = req.params;

      const currentPrice = await priceService.updateCryptocurrencyPrice(cryptocurrencyId);

      if (!currentPrice) {
        res.status(404).json({
          error: 'Cryptocurrency not found or price update failed',
        });
        return;
      }

      res.json({
        success: true,
        data: currentPrice,
        message: 'Cryptocurrency price updated successfully',
      });
    } catch (error) {
      logger.error('Error updating cryptocurrency price:', error);
      res.status(500).json({
        error: 'Failed to update cryptocurrency price',
      });
    }
  },

  /**
   * Get current price for a cryptocurrency
   */
  async getCurrentPrice(req: Request, res: Response): Promise<void> {
    try {
      const { cryptocurrencyId } = req.params;

      const currentPrice = await priceService.getCurrentPrice(cryptocurrencyId);

      if (!currentPrice) {
        res.status(404).json({
          error: 'Price not found for this cryptocurrency',
        });
        return;
      }

      res.json({
        success: true,
        data: currentPrice,
      });
    } catch (error) {
      logger.error('Error getting current price:', error);
      res.status(500).json({
        error: 'Failed to get current price',
      });
    }
  },

  /**
   * Get price history for a cryptocurrency
   */
  async getPriceHistory(req: Request, res: Response): Promise<void> {
    try {
      const { cryptocurrencyId } = req.params;
      const { startDate, endDate, interval } = priceHistorySchema.parse(req.query);

      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: 30 days ago
      const end = endDate ? new Date(endDate) : new Date();

      const priceHistory = await priceService.getPriceHistory(
        cryptocurrencyId,
        start,
        end,
        interval
      );

      res.json({
        success: true,
        data: {
          cryptocurrency_id: cryptocurrencyId,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          interval,
          prices: priceHistory,
        },
      });
    } catch (error) {
      logger.error('Error getting price history:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to get price history',
      });
    }
  },

  /**
   * Import historical data for a cryptocurrency
   */
  async importHistoricalData(req: Request, res: Response): Promise<void> {
    try {
      const { cryptocurrencyId } = req.params;
      const { days } = historicalDataSchema.parse(req.body);

      // Check if user is admin
      if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        return;
      }

      const importedCount = await priceService.importHistoricalData(cryptocurrencyId, days);

      res.json({
        success: true,
        data: {
          cryptocurrencyId,
          daysImported: days,
          recordsImported: importedCount,
        },
        message: `Imported ${importedCount} historical price records`,
      });
    } catch (error) {
      logger.error('Error importing historical data:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to import historical data',
      });
    }
  },

  /**
   * Get market overview
   */
  async getMarketOverview(req: Request, res: Response): Promise<void> {
    try {
      const marketData = await priceService.getMarketOverview();

      res.json({
        success: true,
        data: marketData,
      });
    } catch (error) {
      logger.error('Error getting market overview:', error);
      res.status(500).json({
        error: 'Failed to get market overview',
      });
    }
  },

  /**
   * Search cryptocurrencies
   */
  async searchCryptocurrencies(req: Request, res: Response): Promise<void> {
    try {
      const { query, limit } = searchSchema.parse(req.query);

      const cryptocurrencies = await priceService.searchCryptocurrencies(query, limit);

      res.json({
        success: true,
        data: {
          query,
          limit,
          results: cryptocurrencies,
        },
      });
    } catch (error) {
      logger.error('Error searching cryptocurrencies:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to search cryptocurrencies',
      });
    }
  },

  /**
   * Get trending cryptocurrencies
   */
  async getTrendingCryptocurrencies(req: Request, res: Response): Promise<void> {
    try {
      const { limit } = trendingSchema.parse(req.query);

      const trending = await priceService.getTrendingCryptocurrencies(limit);

      res.json({
        success: true,
        data: trending,
      });
    } catch (error) {
      logger.error('Error getting trending cryptocurrencies:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to get trending cryptocurrencies',
      });
    }
  },

  /**
   * Get all cryptocurrencies with pagination
   */
  async getAllCryptocurrencies(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = '1',
        limit = '50',
        sortBy = 'marketCapRank',
        sortOrder = 'asc',
        search = '',
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const where: any = {
        isActive: true,
      };

      if (search) {
        where.OR = [
          {
            symbol: {
              contains: search as string,
              mode: 'insensitive',
            },
          },
          {
            name: {
              contains: search as string,
              mode: 'insensitive',
            },
          },
        ];
      }

      const [cryptocurrencies, totalCount] = await Promise.all([
        prisma.cryptocurrency.findMany({
          where,
          include: {
            currentPrices: {
              orderBy: {
                lastUpdated: 'desc',
              },
              take: 1,
            },
          },
          orderBy: {
            [sortBy as string]: sortOrder as 'asc' | 'desc',
          },
          skip: offset,
          take: limitNum,
        }),
        prisma.cryptocurrency.count({ where }),
      ]);

      res.json({
        success: true,
        data: {
          cryptocurrencies,
          pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(totalCount / limitNum),
            totalItems: totalCount,
            itemsPerPage: limitNum,
          },
        },
      });
    } catch (error) {
      logger.error('Error getting all cryptocurrencies:', error);
      res.status(500).json({
        error: 'Failed to get cryptocurrencies',
      });
    }
  },

  /**
   * Get cryptocurrency by symbol
   */
  async getCryptocurrencyBySymbol(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.params;

      const cryptocurrency = await prisma.cryptocurrency.findFirst({
        where: {
          symbol: symbol.toUpperCase(),
          isActive: true,
        },
        include: {
          currentPrices: {
            orderBy: {
              lastUpdated: 'desc',
            },
            take: 1,
          },
          priceHistory: {
            orderBy: {
              timestamp: 'desc',
            },
            take: 100, // Last 100 price points
          },
        },
      });

      if (!cryptocurrency) {
        res.status(404).json({
          error: 'Cryptocurrency not found',
        });
        return;
      }

      res.json({
        success: true,
        data: cryptocurrency,
      });
    } catch (error) {
      logger.error('Error getting cryptocurrency by symbol:', error);
      res.status(500).json({
        error: 'Failed to get cryptocurrency',
      });
    }
  },

  /**
   * Get multiple current prices by symbols
   */
  async getMultiplePrices(req: Request, res: Response): Promise<void> {
    try {
      const { symbols } = req.body;

      if (!Array.isArray(symbols) || symbols.length === 0) {
        res.status(400).json({
          error: 'Symbols array is required',
        });
        return;
      }

      const cryptocurrencies = await prisma.cryptocurrency.findMany({
        where: {
          symbol: {
            in: symbols.map((s: string) => s.toUpperCase()),
          },
          isActive: true,
        },
        include: {
          currentPrices: {
            orderBy: {
              lastUpdated: 'desc',
            },
            take: 1,
          },
        },
      });

      const priceMap = cryptocurrencies.reduce((acc, crypto) => {
        const currentPrice = crypto.currentPrices[0];
        if (currentPrice) {
          acc[crypto.symbol] = {
            symbol: crypto.symbol,
            name: crypto.name,
            price: currentPrice.price,
            change24h: currentPrice.change24h,
            volume24h: currentPrice.volume24h,
            marketCap: currentPrice.marketCap,
            lastUpdated: currentPrice.lastUpdated,
          };
        }
        return acc;
      }, {} as any);

      res.json({
        success: true,
        data: priceMap,
      });
    } catch (error) {
      logger.error('Error getting multiple prices:', error);
      res.status(500).json({
        error: 'Failed to get prices',
      });
    }
  },

  /**
   * Clean up old price data
   */
  async cleanupOldPriceData(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin
      if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        return;
      }

      const { daysToKeep = 365 } = req.body;

      const deletedCount = await priceService.cleanupOldPriceData(daysToKeep);

      res.json({
        success: true,
        data: {
          deletedRecords: deletedCount,
          daysToKeep,
        },
        message: `Cleaned up ${deletedCount} old price records`,
      });
    } catch (error) {
      logger.error('Error cleaning up old price data:', error);
      res.status(500).json({
        error: 'Failed to clean up old price data',
      });
    }
  },

  /**
   * Get price statistics for a cryptocurrency
   */
  async getPriceStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { cryptocurrencyId } = req.params;
      const { days = 30 } = req.query;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days as string));

      const priceHistory = await priceService.getPriceHistory(
        cryptocurrencyId,
        startDate,
        new Date(),
        '1d'
      );

      if (priceHistory.length === 0) {
        res.status(404).json({
          error: 'No price data found for this cryptocurrency',
        });
        return;
      }

      const prices = priceHistory.map(p => parseFloat(p.price.toString()));
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      
      const firstPrice = prices[0];
      const lastPrice = prices[prices.length - 1];
      const totalChange = lastPrice - firstPrice;
      const totalChangePercent = (totalChange / firstPrice) * 100;

      // Calculate volatility (standard deviation)
      const variance = prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / prices.length;
      const volatility = Math.sqrt(variance);

      const statistics = {
        period: `${days} days`,
        minPrice,
        maxPrice,
        avgPrice,
        totalChange,
        totalChangePercent,
        volatility,
        volatilityPercent: (volatility / avgPrice) * 100,
        dataPoints: priceHistory.length,
      };

      res.json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      logger.error('Error getting price statistics:', error);
      res.status(500).json({
        error: 'Failed to get price statistics',
      });
    }
  },
};