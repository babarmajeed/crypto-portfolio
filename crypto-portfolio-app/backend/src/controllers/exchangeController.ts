import { Request, Response } from 'express';
import { PrismaClient, ExchangeStatus } from '@prisma/client';
import { z } from 'zod';
import { ExchangeService } from '../services/exchangeService';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();
const exchangeService = new ExchangeService(prisma);

// Validation schemas
const createExchangeSchema = z.object({
  name: z.string().min(1).max(50),
  displayName: z.string().min(1).max(100),
  websiteUrl: z.string().url().optional(),
  apiBaseUrl: z.string().url(),
  websocketUrl: z.string().url().optional(),
  rateLimitPerMinute: z.number().min(1).max(10000).optional(),
  requiresKyc: z.boolean().optional(),
  supportedCountries: z.array(z.string()).optional(),
  tradingFees: z.record(z.any()).optional(),
});

const addCredentialsSchema = z.object({
  exchangeId: z.string(),
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
  passphrase: z.string().optional(),
  sandboxMode: z.boolean().optional(),
  permissions: z.array(z.string()).optional(),
});

const updateCredentialsSchema = z.object({
  apiKey: z.string().min(1).optional(),
  apiSecret: z.string().min(1).optional(),
  passphrase: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

const updateExchangeStatusSchema = z.object({
  status: z.nativeEnum(ExchangeStatus),
});

export const exchangeController = {
  /**
   * Create a new exchange (Admin only)
   */
  async createExchange(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin
      if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        return;
      }

      const validatedData = createExchangeSchema.parse(req.body);

      const exchange = await exchangeService.createExchange(validatedData);

      res.status(201).json({
        success: true,
        data: exchange,
        message: 'Exchange created successfully',
      });
    } catch (error) {
      logger.error('Error creating exchange:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to create exchange',
      });
    }
  },

  /**
   * Get all exchanges
   */
  async getAllExchanges(req: Request, res: Response): Promise<void> {
    try {
      const exchanges = await exchangeService.getAllExchanges();

      res.json({
        success: true,
        data: exchanges,
      });
    } catch (error) {
      logger.error('Error getting exchanges:', error);
      res.status(500).json({
        error: 'Failed to get exchanges',
      });
    }
  },

  /**
   * Get exchange by ID
   */
  async getExchangeById(req: Request, res: Response): Promise<void> {
    try {
      const { exchangeId } = req.params;

      const exchange = await exchangeService.getExchangeById(exchangeId);

      if (!exchange) {
        res.status(404).json({ error: 'Exchange not found' });
        return;
      }

      res.json({
        success: true,
        data: exchange,
      });
    } catch (error) {
      logger.error('Error getting exchange:', error);
      res.status(500).json({
        error: 'Failed to get exchange',
      });
    }
  },

  /**
   * Get user's exchanges with credentials
   */
  async getUserExchanges(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const exchanges = await exchangeService.getUserExchanges(userId);

      // Remove sensitive credential data from response
      const sanitizedExchanges = exchanges.map(exchange => ({
        ...exchange,
        userCredentials: exchange.userCredentials.map(cred => ({
          id: cred.id,
          exchangeId: cred.exchangeId,
          sandboxMode: cred.sandboxMode,
          permissions: cred.permissions,
          lastSync: cred.lastSync,
          syncStatus: cred.syncStatus,
          errorMessage: cred.errorMessage,
          isActive: cred.isActive,
          createdAt: cred.createdAt,
          updatedAt: cred.updatedAt,
        })),
      }));

      res.json({
        success: true,
        data: sanitizedExchanges,
      });
    } catch (error) {
      logger.error('Error getting user exchanges:', error);
      res.status(500).json({
        error: 'Failed to get user exchanges',
      });
    }
  },

  /**
   * Add user credentials for an exchange
   */
  async addUserCredentials(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const validatedData = addCredentialsSchema.parse(req.body);

      const credentials = await exchangeService.addUserCredentials({
        userId,
        ...validatedData,
      });

      // Remove sensitive data from response
      const sanitizedCredentials = {
        id: credentials.id,
        exchangeId: credentials.exchangeId,
        sandboxMode: credentials.sandboxMode,
        permissions: credentials.permissions,
        syncStatus: credentials.syncStatus,
        isActive: credentials.isActive,
        createdAt: credentials.createdAt,
        updatedAt: credentials.updatedAt,
      };

      res.status(201).json({
        success: true,
        data: sanitizedCredentials,
        message: 'Exchange credentials added successfully',
      });
    } catch (error) {
      logger.error('Error adding user credentials:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      if (error instanceof Error && error.message.includes('already exist')) {
        res.status(409).json({
          error: 'Credentials already exist for this exchange',
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to add exchange credentials',
      });
    }
  },

  /**
   * Update user credentials for an exchange
   */
  async updateUserCredentials(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { exchangeId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const validatedData = updateCredentialsSchema.parse(req.body);

      const credentials = await exchangeService.updateUserCredentials(
        userId,
        exchangeId,
        validatedData
      );

      // Remove sensitive data from response
      const sanitizedCredentials = {
        id: credentials.id,
        exchangeId: credentials.exchangeId,
        sandboxMode: credentials.sandboxMode,
        permissions: credentials.permissions,
        syncStatus: credentials.syncStatus,
        isActive: credentials.isActive,
        updatedAt: credentials.updatedAt,
      };

      res.json({
        success: true,
        data: sanitizedCredentials,
        message: 'Exchange credentials updated successfully',
      });
    } catch (error) {
      logger.error('Error updating user credentials:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          error: 'Credentials not found',
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to update exchange credentials',
      });
    }
  },

  /**
   * Remove user credentials for an exchange
   */
  async removeUserCredentials(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { exchangeId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await exchangeService.removeUserCredentials(userId, exchangeId);

      res.json({
        success: true,
        message: 'Exchange credentials removed successfully',
      });
    } catch (error) {
      logger.error('Error removing user credentials:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          error: 'Credentials not found',
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to remove exchange credentials',
      });
    }
  },

  /**
   * Test connection to exchange API
   */
  async testConnection(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { exchangeId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const result = await exchangeService.testConnection(userId, exchangeId);

      res.json({
        success: result.success,
        data: result,
        message: result.message,
      });
    } catch (error) {
      logger.error('Error testing exchange connection:', error);
      res.status(500).json({
        error: 'Failed to test exchange connection',
      });
    }
  },

  /**
   * Sync data from exchange
   */
  async syncExchangeData(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { exchangeId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const result = await exchangeService.syncExchangeData(userId, exchangeId);

      res.json({
        success: result.success,
        data: result,
        message: result.message,
      });
    } catch (error) {
      logger.error('Error syncing exchange data:', error);
      res.status(500).json({
        error: 'Failed to sync exchange data',
      });
    }
  },

  /**
   * Update exchange status (Admin only)
   */
  async updateExchangeStatus(req: Request, res: Response): Promise<void> {
    try {
      const { exchangeId } = req.params;

      // Check if user is admin
      if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        return;
      }

      const { status } = updateExchangeStatusSchema.parse(req.body);

      const exchange = await exchangeService.updateExchangeStatus(exchangeId, status);

      res.json({
        success: true,
        data: exchange,
        message: 'Exchange status updated successfully',
      });
    } catch (error) {
      logger.error('Error updating exchange status:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to update exchange status',
      });
    }
  },

  /**
   * Get user credential status for an exchange
   */
  async getCredentialStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { exchangeId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const status = await exchangeService.getUserCredentialStatus(userId, exchangeId);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error('Error getting credential status:', error);
      res.status(500).json({
        error: 'Failed to get credential status',
      });
    }
  },

  /**
   * Get exchange trading pairs
   */
  async getExchangeTradingPairs(req: Request, res: Response): Promise<void> {
    try {
      const { exchangeId } = req.params;
      const { active = 'true' } = req.query;

      const tradingPairs = await prisma.tradingPair.findMany({
        where: {
          exchangeId,
          isActive: active === 'true',
        },
        include: {
          baseCurrency: {
            select: {
              symbol: true,
              name: true,
              logoUrl: true,
            },
          },
          quoteCurrency: {
            select: {
              symbol: true,
              name: true,
              logoUrl: true,
            },
          },
          currentPrice: true,
        },
        orderBy: {
          symbol: 'asc',
        },
      });

      res.json({
        success: true,
        data: tradingPairs,
      });
    } catch (error) {
      logger.error('Error getting exchange trading pairs:', error);
      res.status(500).json({
        error: 'Failed to get trading pairs',
      });
    }
  },

  /**
   * Get exchange statistics
   */
  async getExchangeStats(req: Request, res: Response): Promise<void> {
    try {
      const { exchangeId } = req.params;

      const [
        tradingPairsCount,
        activeUsersCount,
        totalTransactions,
        totalVolume,
      ] = await Promise.all([
        prisma.tradingPair.count({
          where: { exchangeId, isActive: true },
        }),
        prisma.userExchangeCredential.count({
          where: { exchangeId, isActive: true },
        }),
        prisma.transaction.count({
          where: { exchangeId },
        }),
        prisma.transaction.aggregate({
          where: { exchangeId },
          _sum: { totalValue: true },
        }),
      ]);

      const stats = {
        tradingPairsCount,
        activeUsersCount,
        totalTransactions,
        totalVolume: totalVolume._sum.totalValue || 0,
      };

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error getting exchange stats:', error);
      res.status(500).json({
        error: 'Failed to get exchange statistics',
      });
    }
  },

  /**
   * Sync all user exchanges
   */
  async syncAllUserExchanges(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const userExchanges = await exchangeService.getUserExchanges(userId);
      const results: Array<{ exchangeId: string; success: boolean; message: string }> = [];

      for (const exchange of userExchanges) {
        try {
          const result = await exchangeService.syncExchangeData(userId, exchange.id);
          results.push({
            exchangeId: exchange.id,
            success: result.success,
            message: result.message,
          });
        } catch (error) {
          results.push({
            exchangeId: exchange.id,
            success: false,
            message: 'Sync failed',
          });
        }
      }

      const successCount = results.filter(r => r.success).length;

      res.json({
        success: true,
        data: {
          totalExchanges: userExchanges.length,
          successfulSyncs: successCount,
          results,
        },
        message: `Synced ${successCount} of ${userExchanges.length} exchanges`,
      });
    } catch (error) {
      logger.error('Error syncing all user exchanges:', error);
      res.status(500).json({
        error: 'Failed to sync exchanges',
      });
    }
  },
};