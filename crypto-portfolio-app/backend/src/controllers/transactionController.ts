import { Request, Response } from 'express';
import { PrismaClient, TransactionType, TransactionStatus } from '@prisma/client';
import { z } from 'zod';
import { TransactionService } from '../services/transactionService';
import { logger } from '../utils/logger';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();
const transactionService = new TransactionService(prisma);

// Validation schemas
const createTransactionSchema = z.object({
  portfolioId: z.string(),
  type: z.nativeEnum(TransactionType),
  cryptocurrencyId: z.string(),
  quantity: z.union([z.number(), z.string()]).transform(val => new Decimal(val)),
  price: z.union([z.number(), z.string()]).transform(val => new Decimal(val)).optional(),
  fee: z.union([z.number(), z.string()]).transform(val => new Decimal(val)).optional(),
  feeCurrencyId: z.string().optional(),
  totalValue: z.union([z.number(), z.string()]).transform(val => new Decimal(val)).optional(),
  exchangeId: z.string().optional(),
  exchangeTransactionId: z.string().optional(),
  notes: z.string().max(500).optional(),
  transactionHash: z.string().optional(),
  blockNumber: z.string().transform(val => BigInt(val)).optional(),
  executedAt: z.string().datetime().transform(val => new Date(val)).optional(),
});

const updateTransactionSchema = z.object({
  type: z.nativeEnum(TransactionType).optional(),
  status: z.nativeEnum(TransactionStatus).optional(),
  quantity: z.union([z.number(), z.string()]).transform(val => new Decimal(val)).optional(),
  price: z.union([z.number(), z.string()]).transform(val => new Decimal(val)).optional(),
  fee: z.union([z.number(), z.string()]).transform(val => new Decimal(val)).optional(),
  totalValue: z.union([z.number(), z.string()]).transform(val => new Decimal(val)).optional(),
  notes: z.string().max(500).optional(),
});

const transactionQuerySchema = z.object({
  portfolioId: z.string().optional(),
  cryptocurrencyId: z.string().optional(),
  exchangeId: z.string().optional(),
  type: z.nativeEnum(TransactionType).optional(),
  status: z.nativeEnum(TransactionStatus).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.string().transform(val => parseInt(val)).optional().default('1'),
  limit: z.string().transform(val => parseInt(val)).optional().default('50'),
  sortBy: z.enum(['executedAt', 'totalValue', 'quantity']).optional().default('executedAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

const importTransactionsSchema = z.object({
  portfolioId: z.string(),
  exchangeId: z.string(),
  transactions: z.array(z.object({
    id: z.string(),
    type: z.string(),
    symbol: z.string(),
    quantity: z.number(),
    price: z.number().optional(),
    fee: z.number().optional(),
    total: z.number().optional(),
    timestamp: z.string(),
  })),
});

const periodSummarySchema = z.object({
  portfolioId: z.string().optional(),
  period: z.enum(['day', 'week', 'month', 'year']).optional().default('day'),
  limit: z.string().transform(val => parseInt(val)).optional().default('30'),
});

export const transactionController = {
  /**
   * Create a new transaction
   */
  async createTransaction(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const validatedData = createTransactionSchema.parse(req.body);

      const transaction = await transactionService.createTransaction({
        userId,
        ...validatedData,
      });

      res.status(201).json({
        success: true,
        data: transaction,
        message: 'Transaction created successfully',
      });
    } catch (error) {
      logger.error('Error creating transaction:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      if (error instanceof Error) {
        if (error.message.includes('Portfolio not found')) {
          res.status(404).json({ error: 'Portfolio not found or access denied' });
          return;
        }
        if (error.message.includes('insufficient quantity')) {
          res.status(400).json({ error: 'Insufficient quantity for sell transaction' });
          return;
        }
      }

      res.status(500).json({
        error: 'Failed to create transaction',
      });
    }
  },

  /**
   * Get transaction by ID
   */
  async getTransactionById(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { transactionId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const transaction = await transactionService.getTransactionById(transactionId, userId);

      if (!transaction) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      res.json({
        success: true,
        data: transaction,
      });
    } catch (error) {
      logger.error('Error getting transaction:', error);
      res.status(500).json({
        error: 'Failed to get transaction',
      });
    }
  },

  /**
   * Get user transactions with filters and pagination
   */
  async getUserTransactions(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const options = transactionQuerySchema.parse(req.query);

      // Convert date strings to Date objects
      const queryOptions: any = { ...options };
      if (options.startDate) queryOptions.startDate = new Date(options.startDate);
      if (options.endDate) queryOptions.endDate = new Date(options.endDate);

      const result = await transactionService.getUserTransactions(userId, queryOptions);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Error getting user transactions:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to get transactions',
      });
    }
  },

  /**
   * Update transaction
   */
  async updateTransaction(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { transactionId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const validatedData = updateTransactionSchema.parse(req.body);

      const transaction = await transactionService.updateTransaction(transactionId, userId, validatedData);

      res.json({
        success: true,
        data: transaction,
        message: 'Transaction updated successfully',
      });
    } catch (error) {
      logger.error('Error updating transaction:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      res.status(500).json({
        error: 'Failed to update transaction',
      });
    }
  },

  /**
   * Delete transaction
   */
  async deleteTransaction(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { transactionId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await transactionService.deleteTransaction(transactionId, userId);

      res.json({
        success: true,
        message: 'Transaction deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting transaction:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      res.status(500).json({
        error: 'Failed to delete transaction',
      });
    }
  },

  /**
   * Import transactions from exchange
   */
  async importTransactions(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { portfolioId, exchangeId, transactions } = importTransactionsSchema.parse(req.body);

      const importedCount = await transactionService.importExchangeTransactions(
        userId,
        portfolioId,
        exchangeId,
        transactions
      );

      res.json({
        success: true,
        data: {
          importedCount,
          totalTransactions: transactions.length,
        },
        message: `Imported ${importedCount} transactions successfully`,
      });
    } catch (error) {
      logger.error('Error importing transactions:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to import transactions',
      });
    }
  },

  /**
   * Get transaction summary for a portfolio
   */
  async getTransactionSummary(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { portfolioId } = req.params;
      const { startDate, endDate } = req.query;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const summary = await transactionService.getTransactionSummary(
        portfolioId,
        userId,
        start,
        end
      );

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error('Error getting transaction summary:', error);
      res.status(500).json({
        error: 'Failed to get transaction summary',
      });
    }
  },

  /**
   * Get transactions by period
   */
  async getTransactionsByPeriod(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { portfolioId, period, limit } = periodSummarySchema.parse(req.query);

      if (!portfolioId) {
        res.status(400).json({ error: 'portfolioId is required' });
        return;
      }

      const periodSummary = await transactionService.getTransactionsByPeriod(
        portfolioId,
        userId,
        period,
        limit
      );

      res.json({
        success: true,
        data: {
          period,
          limit,
          summary: periodSummary,
        },
      });
    } catch (error) {
      logger.error('Error getting transactions by period:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to get transactions by period',
      });
    }
  },

  /**
   * Calculate realized P&L for a cryptocurrency
   */
  async getRealizedPnL(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { portfolioId, cryptocurrencyId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const pnlData = await transactionService.calculateRealizedPnL(
        portfolioId,
        cryptocurrencyId,
        userId
      );

      res.json({
        success: true,
        data: pnlData,
      });
    } catch (error) {
      logger.error('Error calculating realized P&L:', error);
      res.status(500).json({
        error: 'Failed to calculate realized P&L',
      });
    }
  },

  /**
   * Get transaction types statistics
   */
  async getTransactionTypeStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { portfolioId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const stats = await prisma.transaction.groupBy({
        by: ['type'],
        where: {
          portfolioId,
          userId,
          status: TransactionStatus.COMPLETED,
        },
        _count: {
          id: true,
        },
        _sum: {
          totalValue: true,
        },
      });

      const formattedStats = stats.map(stat => ({
        type: stat.type,
        count: stat._count.id,
        totalValue: stat._sum.totalValue || 0,
      }));

      res.json({
        success: true,
        data: formattedStats,
      });
    } catch (error) {
      logger.error('Error getting transaction type stats:', error);
      res.status(500).json({
        error: 'Failed to get transaction type statistics',
      });
    }
  },

  /**
   * Get monthly transaction volume
   */
  async getMonthlyVolume(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { portfolioId } = req.params;
      const { months = '12' } = req.query;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const monthsNum = parseInt(months as string);
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsNum);

      // This would benefit from database-specific date functions
      // For now, we'll use a basic implementation
      const transactions = await prisma.transaction.findMany({
        where: {
          portfolioId,
          userId,
          status: TransactionStatus.COMPLETED,
          executedAt: {
            gte: startDate,
          },
        },
        select: {
          executedAt: true,
          totalValue: true,
          type: true,
        },
        orderBy: {
          executedAt: 'asc',
        },
      });

      // Group by month
      const monthlyData = new Map<string, { buy: Decimal; sell: Decimal; total: Decimal }>();

      transactions.forEach(tx => {
        const month = tx.executedAt.toISOString().substr(0, 7); // YYYY-MM
        const value = tx.totalValue || new Decimal(0);

        if (!monthlyData.has(month)) {
          monthlyData.set(month, { buy: new Decimal(0), sell: new Decimal(0), total: new Decimal(0) });
        }

        const data = monthlyData.get(month)!;
        if (tx.type === TransactionType.BUY) {
          data.buy = data.buy.add(value);
        } else if (tx.type === TransactionType.SELL) {
          data.sell = data.sell.add(value);
        }
        data.total = data.total.add(value);
      });

      const result = Array.from(monthlyData.entries()).map(([month, data]) => ({
        month,
        buyVolume: data.buy,
        sellVolume: data.sell,
        totalVolume: data.total,
      }));

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Error getting monthly volume:', error);
      res.status(500).json({
        error: 'Failed to get monthly volume',
      });
    }
  },

  /**
   * Get top traded cryptocurrencies by volume
   */
  async getTopTradedCryptocurrencies(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { portfolioId } = req.params;
      const { limit = '10', period = '30' } = req.query;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const limitNum = parseInt(limit as string);
      const periodDays = parseInt(period as string);
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      const topTraded = await prisma.transaction.groupBy({
        by: ['cryptocurrencyId'],
        where: {
          portfolioId,
          userId,
          status: TransactionStatus.COMPLETED,
          executedAt: {
            gte: startDate,
          },
        },
        _count: {
          id: true,
        },
        _sum: {
          totalValue: true,
          quantity: true,
        },
        orderBy: {
          _sum: {
            totalValue: 'desc',
          },
        },
        take: limitNum,
      });

      // Enrich with cryptocurrency details
      const enrichedData = await Promise.all(
        topTraded.map(async (item) => {
          const crypto = await prisma.cryptocurrency.findUnique({
            where: { id: item.cryptocurrencyId },
            select: {
              symbol: true,
              name: true,
              logoUrl: true,
            },
          });

          return {
            cryptocurrency: crypto,
            transactionCount: item._count.id,
            totalVolume: item._sum.totalValue || 0,
            totalQuantity: item._sum.quantity || 0,
          };
        })
      );

      res.json({
        success: true,
        data: {
          period: `${periodDays} days`,
          results: enrichedData,
        },
      });
    } catch (error) {
      logger.error('Error getting top traded cryptocurrencies:', error);
      res.status(500).json({
        error: 'Failed to get top traded cryptocurrencies',
      });
    }
  },

  /**
   * Get transaction fees summary
   */
  async getFeesSummary(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { portfolioId } = req.params;
      const { startDate, endDate } = req.query;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const where: any = {
        portfolioId,
        userId,
        status: TransactionStatus.COMPLETED,
      };

      if (startDate || endDate) {
        where.executedAt = {};
        if (startDate) where.executedAt.gte = new Date(startDate as string);
        if (endDate) where.executedAt.lte = new Date(endDate as string);
      }

      const feesAgg = await prisma.transaction.aggregate({
        where,
        _sum: {
          fee: true,
        },
        _count: {
          id: true,
        },
      });

      const feesByExchange = await prisma.transaction.groupBy({
        by: ['exchangeId'],
        where,
        _sum: {
          fee: true,
        },
        _count: {
          id: true,
        },
      });

      const enrichedFeesByExchange = await Promise.all(
        feesByExchange.map(async (item) => {
          let exchangeName = 'Manual Entry';
          if (item.exchangeId) {
            const exchange = await prisma.exchange.findUnique({
              where: { id: item.exchangeId },
              select: { displayName: true },
            });
            exchangeName = exchange?.displayName || 'Unknown Exchange';
          }

          return {
            exchangeName,
            totalFees: item._sum.fee || 0,
            transactionCount: item._count.id,
          };
        })
      );

      res.json({
        success: true,
        data: {
          totalFees: feesAgg._sum.fee || 0,
          totalTransactions: feesAgg._count.id,
          feesByExchange: enrichedFeesByExchange,
        },
      });
    } catch (error) {
      logger.error('Error getting fees summary:', error);
      res.status(500).json({
        error: 'Failed to get fees summary',
      });
    }
  },
};