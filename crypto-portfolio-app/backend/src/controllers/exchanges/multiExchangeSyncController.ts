import { Request, Response } from 'express';
import { multiExchangeSyncService } from '../../services/exchanges/multiExchangeSyncService';
import { loggingService } from '../../services/loggingService';
import { auditService } from '../../services/auditService';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export class MultiExchangeSyncController {
  /**
   * Start multi-exchange synchronization
   * @route POST /api/v1/exchanges/sync/start
   */
  async startSynchronization(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { interval = 30000 } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'User authentication required'
        });
        return;
      }

      // Validate interval
      if (typeof interval !== 'number' || interval < 5000 || interval > 300000) {
        res.status(400).json({
          success: false,
          error: 'Invalid interval',
          message: 'Interval must be between 5000ms and 300000ms'
        });
        return;
      }

      // Check if synchronization is already running
      if (multiExchangeSyncService.isRunning()) {
        res.status(409).json({
          success: false,
          error: 'Synchronization already running',
          message: 'Multi-exchange synchronization is already active'
        });
        return;
      }

      await multiExchangeSyncService.startSynchronization(interval);

      // Audit log
      await auditService.log({
        userId,
        action: 'start_multi_exchange_sync',
        resource: 'sync_service',
        details: { interval }
      });

      loggingService.info('Multi-exchange synchronization started', { userId, interval });

      res.status(200).json({
        success: true,
        data: {
          status: 'started',
          interval,
          exchanges: multiExchangeSyncService.getSupportedExchanges()
        },
        message: 'Multi-exchange synchronization started successfully'
      });
    } catch (error) {
      loggingService.error('Error starting multi-exchange synchronization', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to start synchronization'
      });
    }
  }

  /**
   * Stop multi-exchange synchronization
   * @route POST /api/v1/exchanges/sync/stop
   */
  async stopSynchronization(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'User authentication required'
        });
        return;
      }

      if (!multiExchangeSyncService.isRunning()) {
        res.status(409).json({
          success: false,
          error: 'Synchronization not running',
          message: 'Multi-exchange synchronization is not active'
        });
        return;
      }

      await multiExchangeSyncService.stopSynchronization();

      // Audit log
      await auditService.log({
        userId,
        action: 'stop_multi_exchange_sync',
        resource: 'sync_service',
        details: {}
      });

      loggingService.info('Multi-exchange synchronization stopped', { userId });

      const response: {{ status: string }> = {
        success: true,
        data: { status: 'stopped' },
        message: 'Multi-exchange synchronization stopped successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      loggingService.error('Error stopping multi-exchange synchronization', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to stop synchronization'
      });
    }
  }

  /**
   * Get synchronization status
   * @route GET /api/v1/exchanges/sync/status
   */
  async getSyncStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'User authentication required'
        });
        return;
      }

      const isRunning = multiExchangeSyncService.isRunning();
      const syncStatuses = await multiExchangeSyncService.getSyncStatus();
      const supportedExchanges = multiExchangeSyncService.getSupportedExchanges();

      const response: {{
        isRunning: boolean;
        supportedExchanges: string[];
        exchangeStatuses: any[];
      }> = {
        success: true,
        data: {
          isRunning,
          supportedExchanges,
          exchangeStatuses: syncStatuses
        },
        message: 'Synchronization status retrieved successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      loggingService.error('Error getting sync status', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to get synchronization status'
      });
    }
  }

  /**
   * Trigger full synchronization
   * @route POST /api/v1/exchanges/sync/full
   */
  async performFullSync(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'User authentication required'
        });
        return;
      }

      await multiExchangeSyncService.performFullSync();

      // Audit log
      await auditService.log({
        userId,
        action: 'perform_full_sync',
        resource: 'sync_service',
        details: {}
      });

      loggingService.info('Full synchronization completed', { userId });

      const response: {{ status: string; timestamp: string }> = {
        success: true,
        data: {
          status: 'completed',
          timestamp: new Date().toISOString()
        },
        message: 'Full synchronization completed successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      loggingService.error('Error performing full sync', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to perform full synchronization'
      });
    }
  }

  /**
   * Get unified market data for a symbol
   * @route GET /api/v1/exchanges/sync/market/:symbol
   */
  async getUnifiedMarketData(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { symbol } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'User authentication required'
        });
        return;
      }

      if (!symbol) {
        res.status(400).json({
          success: false,
          error: 'Missing symbol',
          message: 'Symbol parameter is required'
        });
        return;
      }

      const marketData = await multiExchangeSyncService.getUnifiedMarketData(symbol);

      if (!marketData) {
        res.status(404).json({
          success: false,
          error: 'Market data not found',
          message: `No market data available for symbol: ${symbol}`
        });
        return;
      }

      const response: {typeof marketData> = {
        success: true,
        data: marketData,
        message: 'Unified market data retrieved successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      loggingService.error('Error getting unified market data', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to get market data'
      });
    }
  }

  /**
   * Get arbitrage opportunities
   * @route GET /api/v1/exchanges/sync/arbitrage
   */
  async getArbitrageOpportunities(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { minSpread = 0.5 } = req.query;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'User authentication required'
        });
        return;
      }

      const minSpreadNum = parseFloat(minSpread as string);
      if (isNaN(minSpreadNum) || minSpreadNum < 0 || minSpreadNum > 10) {
        res.status(400).json({
          success: false,
          error: 'Invalid minSpread',
          message: 'minSpread must be a number between 0 and 10'
        });
        return;
      }

      const opportunities = await multiExchangeSyncService.detectArbitrageOpportunities(minSpreadNum);

      const response: {{
        opportunities: typeof opportunities;
        count: number;
        minSpreadPercentage: number;
      }> = {
        success: true,
        data: {
          opportunities,
          count: opportunities.length,
          minSpreadPercentage: minSpreadNum
        },
        message: 'Arbitrage opportunities retrieved successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      loggingService.error('Error getting arbitrage opportunities', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to get arbitrage opportunities'
      });
    }
  }

  /**
   * Get cached arbitrage opportunities
   * @route GET /api/v1/exchanges/sync/arbitrage/cached
   */
  async getCachedArbitrageOpportunities(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'User authentication required'
        });
        return;
      }

      const opportunities = await multiExchangeSyncService.getArbitrageOpportunities();

      const response: {{
        opportunities: typeof opportunities;
        count: number;
        cached: boolean;
      }> = {
        success: true,
        data: {
          opportunities,
          count: opportunities.length,
          cached: true
        },
        message: 'Cached arbitrage opportunities retrieved successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      loggingService.error('Error getting cached arbitrage opportunities', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to get cached arbitrage opportunities'
      });
    }
  }

  /**
   * Get aggregated user portfolio
   * @route GET /api/v1/exchanges/sync/portfolio
   */
  async getAggregatedPortfolio(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'User authentication required'
        });
        return;
      }

      const portfolio = await multiExchangeSyncService.aggregateUserPortfolio(userId);

      const response: {{
        portfolio: typeof portfolio;
        totalAssets: number;
        lastUpdated: string;
      }> = {
        success: true,
        data: {
          portfolio,
          totalAssets: portfolio.length,
          lastUpdated: new Date().toISOString()
        },
        message: 'Aggregated portfolio retrieved successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      loggingService.error('Error getting aggregated portfolio', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to get aggregated portfolio'
      });
    }
  }

  /**
   * Reconcile balances across exchanges
   * @route POST /api/v1/exchanges/sync/reconcile
   */
  async reconcileBalances(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'User authentication required'
        });
        return;
      }

      const reconciliation = await multiExchangeSyncService.reconcileBalances(userId);

      // Audit log
      await auditService.log({
        userId,
        action: 'reconcile_balances',
        resource: 'user_portfolio',
        details: {
          discrepanciesFound: reconciliation.discrepancies.length,
          reconciliationTime: reconciliation.lastReconciliation
        }
      });

      loggingService.info('Balance reconciliation completed', {
        userId,
        discrepancies: reconciliation.discrepancies.length
      });

      const response: {typeof reconciliation> = {
        success: true,
        data: reconciliation,
        message: `Balance reconciliation completed. Found ${reconciliation.discrepancies.length} discrepancies.`
      };

      res.status(200).json(response);
    } catch (error) {
      loggingService.error('Error reconciling balances', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to reconcile balances'
      });
    }
  }
}

// Create singleton instance
export const multiExchangeSyncController = new MultiExchangeSyncController();
export default multiExchangeSyncController;