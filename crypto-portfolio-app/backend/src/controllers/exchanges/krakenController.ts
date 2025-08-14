import { Response } from 'express';
import { KrakenClient } from '../../services/exchanges/krakenClient';
import { loggingService } from '../../services/loggingService';
import { exchangeService } from '../../services/exchanges/exchangeService';
import { AuthenticatedRequest } from '../../types/auth';
import { body, validationResult } from 'express-validator';

export class KrakenController {
  private krakenClient: KrakenClient;

  constructor() {
    this.krakenClient = KrakenClient.createPublic();
  }

  async testConnection(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const connectionTest = await this.krakenClient.testConnection();
      
      res.status(200).json({
        success: true,
        data: connectionTest,
        message: 'Kraken connection test completed'
      });
    } catch (error) {
      loggingService.error('Kraken connection test failed', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test Kraken connection',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getCurrentPrices(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { symbols } = req.query;
      const symbolArray = symbols ? 
        (Array.isArray(symbols) ? symbols as string[] : [symbols as string]) : 
        undefined;

      const prices = await this.krakenClient.getCurrentPrices(symbolArray);
      
      res.status(200).json({
        success: true,
        data: prices,
        message: 'Current prices fetched successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      loggingService.error('Error fetching Kraken current prices', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch current prices',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getHistoricalPrices(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { symbol, interval = '3600', limit = '100' } = req.query;
      
      if (!symbol) {
        res.status(400).json({
          success: false,
          error: 'Symbol parameter is required'
        });
        return;
      }

      const historicalData = await this.krakenClient.getHistoricalPrices(
        symbol as string,
        interval as string,
        parseInt(limit as string)
      );
      
      res.status(200).json({
        success: true,
        data: historicalData,
        message: 'Historical prices fetched successfully',
        metadata: {
          symbol,
          interval,
          count: historicalData.length
        }
      });
    } catch (error) {
      loggingService.error('Error fetching Kraken historical prices', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch historical prices',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getExchangeInfo(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const exchangeInfo = await this.krakenClient.getExchangeInfo();
      
      res.status(200).json({
        success: true,
        data: exchangeInfo,
        message: 'Exchange info fetched successfully'
      });
    } catch (error) {
      loggingService.error('Error fetching Kraken exchange info', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch exchange info',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async saveCredentials(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate request body
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
        return;
      }

      const { apiKey, apiSecret } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      // Validate credentials by testing connection
      const isValid = await exchangeService.validateCredentials(
        userId,
        'kraken',
        apiKey,
        apiSecret
      );

      if (!isValid) {
        res.status(400).json({
          success: false,
          error: 'Invalid Kraken credentials'
        });
        return;
      }

      // Save credentials through exchange service
      await exchangeService.saveCredentials(
        userId,
        'kraken',
        apiKey,
        apiSecret
      );

      res.status(200).json({
        success: true,
        message: 'Kraken credentials saved successfully'
      });
    } catch (error) {
      loggingService.error('Error saving Kraken credentials', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save credentials',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getAccountInfo(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      const client = await exchangeService.getAuthenticatedClient(userId, 'kraken') as KrakenClient;
      
      if (!client) {
        res.status(400).json({
          success: false,
          error: 'Kraken credentials not found or invalid'
        });
        return;
      }

      const accountInfo = await client.getAccountInfo();
      
      res.status(200).json({
        success: true,
        data: accountInfo,
        message: 'Account info fetched successfully'
      });
    } catch (error) {
      loggingService.error('Error fetching Kraken account info', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch account info',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getTradeHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { symbol, limit = '50' } = req.query;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      const client = await exchangeService.getAuthenticatedClient(userId, 'kraken') as KrakenClient;
      
      if (!client) {
        res.status(400).json({
          success: false,
          error: 'Kraken credentials not found or invalid'
        });
        return;
      }

      const trades = await client.getTradeHistory(
        symbol as string,
        parseInt(limit as string)
      );
      
      res.status(200).json({
        success: true,
        data: trades,
        message: 'Trade history fetched successfully',
        metadata: {
          count: trades.length,
          symbol: symbol || 'all'
        }
      });
    } catch (error) {
      loggingService.error('Error fetching Kraken trade history', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch trade history',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async deleteCredentials(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      await exchangeService.deleteCredentials(userId, 'kraken');
      
      res.status(200).json({
        success: true,
        message: 'Kraken credentials deleted successfully'
      });
    } catch (error) {
      loggingService.error('Error deleting Kraken credentials', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete credentials',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getCredentialStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      const hasCredentials = await exchangeService.hasValidCredentials(userId, 'kraken');
      
      res.status(200).json({
        success: true,
        data: {
          hasCredentials,
          exchange: 'kraken',
          status: hasCredentials ? 'active' : 'inactive'
        },
        message: 'Credential status retrieved successfully'
      });
    } catch (error) {
      loggingService.error('Error checking Kraken credential status', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check credential status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async setupWebSocket(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { symbols } = req.body;
      
      if (!symbols || !Array.isArray(symbols)) {
        res.status(400).json({
          success: false,
          error: 'Symbols array is required'
        });
        return;
      }

      // Setup WebSocket through exchange service for real-time updates
      exchangeService.setupRealTimeUpdates('kraken', symbols, (data) => {
        // WebSocket data would be handled by Socket.IO in real implementation
        loggingService.info('Kraken WebSocket data received', data);
      });
      
      res.status(200).json({
        success: true,
        message: 'WebSocket connection established for Kraken',
        data: {
          symbols,
          status: 'connected'
        }
      });
    } catch (error) {
      loggingService.error('Error setting up Kraken WebSocket', error);
      res.status(500).json({
        success: false,
        error: 'Failed to setup WebSocket connection',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const krakenController = new KrakenController();

// Validation middleware
export const validateCredentials = [
  body('apiKey')
    .isString()
    .isLength({ min: 1 })
    .withMessage('API key is required'),
  body('apiSecret')
    .isString()
    .isLength({ min: 1 })
    .withMessage('API secret is required')
];

export const validateWebSocketSetup = [
  body('symbols')
    .isArray({ min: 1 })
    .withMessage('Symbols array with at least one symbol is required'),
  body('symbols.*')
    .isString()
    .withMessage('Each symbol must be a string')
];