import { Request, Response } from 'express';
import { PrismaClient, PortfolioType } from '@prisma/client';
import { z } from 'zod';
import { PortfolioService } from '../services/portfolioService';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();
const portfolioService = new PortfolioService(prisma);

// Validation schemas
const createPortfolioSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.nativeEnum(PortfolioType).optional(),
  exchangeId: z.string().optional(),
  isDefault: z.boolean().optional(),
});

const updatePortfolioSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  type: z.nativeEnum(PortfolioType).optional(),
  isActive: z.boolean().optional(),
});

const performanceMetricsSchema = z.object({
  period: z.enum(['1d', '7d', '30d', '1y', 'all']).optional().default('30d'),
});

export const portfolioController = {
  /**
   * Create a new portfolio
   */
  async createPortfolio(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const validatedData = createPortfolioSchema.parse(req.body);

      const portfolio = await portfolioService.createPortfolio({
        userId,
        ...validatedData,
      });

      res.status(201).json({
        success: true,
        data: portfolio,
        message: 'Portfolio created successfully',
      });
    } catch (error) {
      logger.error('Error creating portfolio:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to create portfolio',
      });
    }
  },

  /**
   * Get all user portfolios
   */
  async getUserPortfolios(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const portfolios = await portfolioService.getUserPortfolios(userId);

      res.json({
        success: true,
        data: portfolios,
      });
    } catch (error) {
      logger.error('Error getting user portfolios:', error);
      res.status(500).json({
        error: 'Failed to get portfolios',
      });
    }
  },

  /**
   * Get portfolio by ID
   */
  async getPortfolioById(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { portfolioId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const portfolio = await portfolioService.getPortfolioById(portfolioId, userId);

      if (!portfolio) {
        res.status(404).json({ error: 'Portfolio not found' });
        return;
      }

      res.json({
        success: true,
        data: portfolio,
      });
    } catch (error) {
      logger.error('Error getting portfolio:', error);
      res.status(500).json({
        error: 'Failed to get portfolio',
      });
    }
  },

  /**
   * Update portfolio
   */
  async updatePortfolio(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { portfolioId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const validatedData = updatePortfolioSchema.parse(req.body);

      const portfolio = await portfolioService.updatePortfolio(portfolioId, userId, validatedData);

      res.json({
        success: true,
        data: portfolio,
        message: 'Portfolio updated successfully',
      });
    } catch (error) {
      logger.error('Error updating portfolio:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      if (error instanceof Error && error.message === 'Portfolio not found') {
        res.status(404).json({ error: 'Portfolio not found' });
        return;
      }

      res.status(500).json({
        error: 'Failed to update portfolio',
      });
    }
  },

  /**
   * Delete portfolio
   */
  async deletePortfolio(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { portfolioId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await portfolioService.deletePortfolio(portfolioId, userId);

      res.json({
        success: true,
        message: 'Portfolio deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting portfolio:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: 'Portfolio not found' });
        return;
      }

      if (error instanceof Error && error.message.includes('Cannot delete default')) {
        res.status(400).json({ error: 'Cannot delete default portfolio' });
        return;
      }

      res.status(500).json({
        error: 'Failed to delete portfolio',
      });
    }
  },

  /**
   * Set portfolio as default
   */
  async setAsDefault(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { portfolioId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const portfolio = await portfolioService.setAsDefault(portfolioId, userId);

      res.json({
        success: true,
        data: portfolio,
        message: 'Portfolio set as default successfully',
      });
    } catch (error) {
      logger.error('Error setting portfolio as default:', error);
      res.status(500).json({
        error: 'Failed to set portfolio as default',
      });
    }
  },

  /**
   * Get portfolio analytics
   */
  async getPortfolioAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { portfolioId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify portfolio ownership
      const portfolio = await portfolioService.getPortfolioById(portfolioId, userId);
      if (!portfolio) {
        res.status(404).json({ error: 'Portfolio not found' });
        return;
      }

      const analytics = await portfolioService.getPortfolioAnalytics(portfolioId);

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      logger.error('Error getting portfolio analytics:', error);
      res.status(500).json({
        error: 'Failed to get portfolio analytics',
      });
    }
  },

  /**
   * Update portfolio values
   */
  async updatePortfolioValues(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { portfolioId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify portfolio ownership
      const portfolio = await portfolioService.getPortfolioById(portfolioId, userId);
      if (!portfolio) {
        res.status(404).json({ error: 'Portfolio not found' });
        return;
      }

      await portfolioService.updatePortfolioValues(portfolioId);

      res.json({
        success: true,
        message: 'Portfolio values updated successfully',
      });
    } catch (error) {
      logger.error('Error updating portfolio values:', error);
      res.status(500).json({
        error: 'Failed to update portfolio values',
      });
    }
  },

  /**
   * Create portfolio snapshot
   */
  async createSnapshot(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { portfolioId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify portfolio ownership
      const portfolio = await portfolioService.getPortfolioById(portfolioId, userId);
      if (!portfolio) {
        res.status(404).json({ error: 'Portfolio not found' });
        return;
      }

      const snapshot = await portfolioService.createSnapshot(portfolioId);

      res.status(201).json({
        success: true,
        data: snapshot,
        message: 'Portfolio snapshot created successfully',
      });
    } catch (error) {
      logger.error('Error creating portfolio snapshot:', error);
      res.status(500).json({
        error: 'Failed to create portfolio snapshot',
      });
    }
  },

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { portfolioId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { period } = performanceMetricsSchema.parse(req.query);

      // Verify portfolio ownership
      const portfolio = await portfolioService.getPortfolioById(portfolioId, userId);
      if (!portfolio) {
        res.status(404).json({ error: 'Portfolio not found' });
        return;
      }

      const metrics = await portfolioService.calculatePerformanceMetrics(portfolioId, period);

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      logger.error('Error getting performance metrics:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to get performance metrics',
      });
    }
  },

  /**
   * Get portfolio holdings
   */
  async getPortfolioHoldings(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { portfolioId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const portfolio = await portfolioService.getPortfolioById(portfolioId, userId);
      
      if (!portfolio) {
        res.status(404).json({ error: 'Portfolio not found' });
        return;
      }

      res.json({
        success: true,
        data: portfolio.holdings,
      });
    } catch (error) {
      logger.error('Error getting portfolio holdings:', error);
      res.status(500).json({
        error: 'Failed to get portfolio holdings',
      });
    }
  },

  /**
   * Get portfolio snapshots history
   */
  async getSnapshotHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { portfolioId } = req.params;
      const { limit = '30' } = req.query;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify portfolio ownership
      const portfolio = await portfolioService.getPortfolioById(portfolioId, userId);
      if (!portfolio) {
        res.status(404).json({ error: 'Portfolio not found' });
        return;
      }

      const snapshots = await prisma.portfolioSnapshot.findMany({
        where: { portfolioId },
        orderBy: { snapshotDate: 'desc' },
        take: parseInt(limit as string),
      });

      res.json({
        success: true,
        data: snapshots,
      });
    } catch (error) {
      logger.error('Error getting snapshot history:', error);
      res.status(500).json({
        error: 'Failed to get snapshot history',
      });
    }
  },

  /**
   * Sync all portfolios for a user (update values, create snapshots)
   */
  async syncUserPortfolios(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const portfolios = await portfolioService.getUserPortfolios(userId);
      let syncedCount = 0;

      // Update values for each portfolio
      for (const portfolio of portfolios) {
        try {
          await portfolioService.updatePortfolioValues(portfolio.id);
          await portfolioService.createSnapshot(portfolio.id);
          syncedCount++;
        } catch (error) {
          logger.error(`Error syncing portfolio ${portfolio.id}:`, error);
        }
      }

      res.json({
        success: true,
        message: `Synced ${syncedCount} of ${portfolios.length} portfolios`,
        data: {
          totalPortfolios: portfolios.length,
          syncedPortfolios: syncedCount,
        },
      });
    } catch (error) {
      logger.error('Error syncing user portfolios:', error);
      res.status(500).json({
        error: 'Failed to sync portfolios',
      });
    }
  },
};