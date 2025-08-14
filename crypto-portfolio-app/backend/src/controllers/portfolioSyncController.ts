import { Request, Response } from 'express';
import { portfolioSyncService } from '../services/exchanges/portfolioSyncService';
import { auditService } from '../services/auditService';
import { loggingService } from '../services/loggingService';

export class PortfolioSyncController {
  async syncPortfolio(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const {
        exchange,
        syncType = 'full',
        forceRefresh = false
      } = req.body;

      if (!exchange) {
        return res.status(400).json({
          success: false,
          error: 'Exchange is required'
        });
      }

      const supportedExchanges = portfolioSyncService.getSupportedExchanges();
      if (!supportedExchanges.includes(exchange)) {
        return res.status(400).json({
          success: false,
          error: 'Unsupported exchange',
          supportedExchanges
        });
      }

      const syncRequest = {
        userId,
        exchange,
        syncType,
        forceRefresh
      };

      const syncResponse = await portfolioSyncService.syncPortfolio(syncRequest);

      await auditService.log({
        userId,
        action: 'portfolio_sync',
        resource: 'portfolio',
        details: {
          exchange,
          syncType,
          balancesCount: syncResponse.balances.length,
          totalValue: syncResponse.totalValue,
          forceRefresh
        }
      });

      res.status(200).json({
        success: true,
        data: {
          sync: syncResponse,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Portfolio sync failed', {
        userId: (req as any).user.id,
        exchange: req.body.exchange,
        error: error.message
      });

      if (error.message.includes('already in progress')) {
        return res.status(409).json({
          success: false,
          error: 'Sync already in progress',
          message: error.message
        });
      }

      if (error.message.includes('Unsupported exchange')) {
        return res.status(400).json({
          success: false,
          error: 'Unsupported exchange',
          message: error.message
        });
      }

      if (error.message.includes('Invalid credentials')) {
        return res.status(401).json({
          success: false,
          error: 'Invalid exchange credentials',
          message: 'Please check your API keys'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Portfolio sync failed',
        message: 'Internal server error'
      });
    }
  }

  async syncBalances(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { exchange } = req.params;

      const syncRequest = {
        userId,
        exchange,
        syncType: 'balances' as const,
        forceRefresh: req.query.force === 'true'
      };

      const syncResponse = await portfolioSyncService.syncPortfolio(syncRequest);

      res.status(200).json({
        success: true,
        data: {
          exchange,
          balances: syncResponse.balances,
          totalValue: syncResponse.totalValue,
          syncedAt: syncResponse.syncedAt,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Balance sync failed', {
        userId: (req as any).user.id,
        exchange: req.params.exchange,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Balance sync failed',
        message: error.message
      });
    }
  }

  async syncTransactions(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { exchange } = req.params;

      const syncRequest = {
        userId,
        exchange,
        syncType: 'transactions' as const,
        forceRefresh: req.query.force === 'true'
      };

      const syncResponse = await portfolioSyncService.syncPortfolio(syncRequest);

      res.status(200).json({
        success: true,
        data: {
          exchange,
          balances: syncResponse.balances,
          totalValue: syncResponse.totalValue,
          lastTransactionId: syncResponse.lastTransactionId,
          syncedAt: syncResponse.syncedAt,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Transaction sync failed', {
        userId: (req as any).user.id,
        exchange: req.params.exchange,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Transaction sync failed',
        message: error.message
      });
    }
  }

  async syncOrders(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { exchange } = req.params;

      const syncRequest = {
        userId,
        exchange,
        syncType: 'orders' as const,
        forceRefresh: req.query.force === 'true'
      };

      const syncResponse = await portfolioSyncService.syncPortfolio(syncRequest);

      res.status(200).json({
        success: true,
        data: {
          exchange,
          balances: syncResponse.balances,
          totalValue: syncResponse.totalValue,
          syncedAt: syncResponse.syncedAt,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Order sync failed', {
        userId: (req as any).user.id,
        exchange: req.params.exchange,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Order sync failed',
        message: error.message
      });
    }
  }

  async getSyncStatus(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { exchange } = req.params;

      const syncStatus = portfolioSyncService.getSyncStatus(userId, exchange);

      if (!syncStatus) {
        return res.status(404).json({
          success: false,
          error: 'No sync status found',
          message: 'No active or recent sync found for this exchange'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          status: syncStatus,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Failed to get sync status', {
        userId: (req as any).user.id,
        exchange: req.params.exchange,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get sync status'
      });
    }
  }

  async getAllSyncStatuses(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      
      const allStatuses = portfolioSyncService.getAllSyncStatuses()
        .filter(status => status.userId === userId);

      res.status(200).json({
        success: true,
        data: {
          statuses: allStatuses,
          count: allStatuses.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Failed to get all sync statuses', {
        userId: (req as any).user.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get sync statuses'
      });
    }
  }

  async cancelSync(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { exchange } = req.params;

      const cancelled = await portfolioSyncService.cancelSync(userId, exchange);

      if (!cancelled) {
        return res.status(400).json({
          success: false,
          error: 'No active sync to cancel',
          message: 'There is no active sync process for this exchange'
        });
      }

      await auditService.log({
        userId,
        action: 'portfolio_sync_cancelled',
        resource: 'portfolio',
        details: { exchange }
      });

      res.status(200).json({
        success: true,
        data: {
          cancelled: true,
          exchange,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Failed to cancel sync', {
        userId: (req as any).user.id,
        exchange: req.params.exchange,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to cancel sync'
      });
    }
  }

  async syncAllExchanges(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { syncType = 'balances', forceRefresh = false } = req.body;

      // Get user's connected exchanges (this would come from user credentials/settings)
      const supportedExchanges = portfolioSyncService.getSupportedExchanges();
      
      const syncPromises = supportedExchanges.map(async (exchange) => {
        try {
          const syncRequest = {
            userId,
            exchange,
            syncType,
            forceRefresh
          };

          const result = await portfolioSyncService.syncPortfolio(syncRequest);
          return { exchange, success: true, data: result };
        } catch (error: any) {
          return { 
            exchange, 
            success: false, 
            error: error.message 
          };
        }
      });

      const results = await Promise.allSettled(syncPromises);
      const syncResults = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            exchange: supportedExchanges[index],
            success: false,
            error: result.reason?.message || 'Unknown error'
          };
        }
      });

      const successCount = syncResults.filter(r => r.success).length;
      const failureCount = syncResults.filter(r => !r.success).length;

      await auditService.log({
        userId,
        action: 'portfolio_sync_all',
        resource: 'portfolio',
        details: {
          syncType,
          forceRefresh,
          successCount,
          failureCount,
          exchanges: supportedExchanges
        }
      });

      res.status(200).json({
        success: true,
        data: {
          results: syncResults,
          summary: {
            total: syncResults.length,
            successful: successCount,
            failed: failureCount
          },
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Sync all exchanges failed', {
        userId: (req as any).user.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Sync all exchanges failed',
        message: 'Internal server error'
      });
    }
  }

  async getSupportedExchanges(req: Request, res: Response) {
    try {
      const supportedExchanges = portfolioSyncService.getSupportedExchanges();

      res.status(200).json({
        success: true,
        data: {
          exchanges: supportedExchanges,
          count: supportedExchanges.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Failed to get supported exchanges', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get supported exchanges'
      });
    }
  }

  async getPortfolioSummary(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      
      // This would aggregate portfolio data across all exchanges
      // For now, return a placeholder response
      res.status(200).json({
        success: true,
        data: {
          userId,
          totalValue: 0,
          exchanges: [],
          lastSyncAt: new Date(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Failed to get portfolio summary', {
        userId: (req as any).user.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get portfolio summary'
      });
    }
  }

  async forceFullSync(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { exchange } = req.params;

      if (!exchange) {
        return res.status(400).json({
          success: false,
          error: 'Exchange parameter is required'
        });
      }

      const syncRequest = {
        userId,
        exchange,
        syncType: 'full' as const,
        forceRefresh: true
      };

      const syncResponse = await portfolioSyncService.syncPortfolio(syncRequest);

      await auditService.log({
        userId,
        action: 'portfolio_force_sync',
        resource: 'portfolio',
        details: {
          exchange,
          balancesCount: syncResponse.balances.length,
          totalValue: syncResponse.totalValue
        }
      });

      res.status(200).json({
        success: true,
        data: {
          sync: syncResponse,
          message: 'Full sync completed successfully',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Force full sync failed', {
        userId: (req as any).user.id,
        exchange: req.params.exchange,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Force full sync failed',
        message: error.message
      });
    }
  }
}

export const portfolioSyncController = new PortfolioSyncController();