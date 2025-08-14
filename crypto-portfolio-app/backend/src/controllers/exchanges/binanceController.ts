import { Request, Response } from 'express';
import { exchangeService } from '../../services/exchanges/exchangeService';
import { loggingService } from '../../services/loggingService';
import { validationResult } from 'express-validator';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export class BinanceController {
  async getCurrentPrices(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { symbols } = req.query;
      const symbolArray = symbols ? (symbols as string).split(',') : [];

      const prices = await exchangeService.getCurrentPrices('binance', symbolArray);

      res.json({
        success: true,
        data: prices,
        message: 'Current prices retrieved successfully'
      });
    } catch (error) {
      loggingService.error('Failed to get current prices', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        error: 'InternalServerError',
        message: 'Failed to retrieve current prices'
      });
    }
  }

  async getHistoricalPrices(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { symbol } = req.params;
      const { interval = '1d', limit = 100 } = req.query;

      const historicalData = await exchangeService.getHistoricalPrices(
        'binance',
        symbol.toUpperCase(),
        interval as string,
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: historicalData,
        message: 'Historical prices retrieved successfully'
      });
    } catch (error) {
      loggingService.error('Failed to get historical prices', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        symbol: req.params.symbol
      });
      
      res.status(500).json({
        success: false,
        error: 'InternalServerError',
        message: 'Failed to retrieve historical prices'
      });
    }
  }

  async getExchangeInfo(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const exchangeInfo = await exchangeService.getExchangeInfo('binance');

      res.json({
        success: true,
        data: exchangeInfo,
        message: 'Exchange information retrieved successfully'
      });
    } catch (error) {
      loggingService.error('Failed to get exchange info', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        error: 'InternalServerError',
        message: 'Failed to retrieve exchange information'
      });
    }
  }

  async testConnection(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const connectionTest = await exchangeService.testConnection('binance');

      res.json({
        success: true,
        data: connectionTest,
        message: 'Connection test completed'
      });
    } catch (error) {
      loggingService.error('Connection test failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        error: 'InternalServerError',
        message: 'Connection test failed'
      });
    }
  }

  async saveCredentials(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'ValidationError',
          message: 'Invalid input data',
          errors: errors.array()
        });
        return;
      }

      const { apiKey, apiSecret, sandbox = false } = req.body;
      const userId = req.user!.id;

      const credentials = await exchangeService.saveUserCredentials(
        userId,
        'binance',
        apiKey,
        apiSecret,
        sandbox
      );

      res.status(201).json({
        success: true,
        data: {
          id: credentials.id,
          exchange: credentials.exchange,
          sandbox: credentials.sandbox,
          isActive: credentials.isActive,
          createdAt: credentials.createdAt
        },
        message: 'Binance credentials saved successfully'
      });
    } catch (error) {
      loggingService.error('Failed to save credentials', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });
      
      const statusCode = error instanceof Error && error.message.includes('Invalid') ? 400 : 500;
      res.status(statusCode).json({
        success: false,
        error: statusCode === 400 ? 'ValidationError' : 'InternalServerError',
        message: error instanceof Error ? error.message : 'Failed to save credentials'
      });
    }
  }

  async removeCredentials(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      await exchangeService.removeUserCredentials(userId, 'binance');

      res.json({
        success: true,
        message: 'Binance credentials removed successfully'
      });
    } catch (error) {
      loggingService.error('Failed to remove credentials', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        error: 'InternalServerError',
        message: 'Failed to remove credentials'
      });
    }
  }

  async testUserConnection(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const connectionTest = await exchangeService.testUserConnection(userId, 'binance');

      res.json({
        success: true,
        data: connectionTest,
        message: 'User connection test completed'
      });
    } catch (error) {
      loggingService.error('User connection test failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        error: 'InternalServerError',
        message: 'User connection test failed'
      });
    }
  }

  async syncBalances(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const accountInfo = await exchangeService.syncUserBalances(userId, 'binance');

      res.json({
        success: true,
        data: accountInfo,
        message: 'Balances synchronized successfully'
      });
    } catch (error) {
      loggingService.error('Failed to sync balances', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        error: 'InternalServerError',
        message: 'Failed to synchronize balances'
      });
    }
  }

  async importTradingHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { symbol = '', limit = 100 } = req.query;

      const importResult = await exchangeService.importTradingHistory(
        userId,
        'binance',
        symbol as string
      );

      res.json({
        success: true,
        data: importResult,
        message: 'Trading history imported successfully'
      });
    } catch (error) {
      loggingService.error('Failed to import trading history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        error: 'InternalServerError',
        message: 'Failed to import trading history'
      });
    }
  }

  async getAccountInfo(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const accountInfo = await exchangeService.syncUserBalances(userId, 'binance');

      res.json({
        success: true,
        data: accountInfo,
        message: 'Account information retrieved successfully'
      });
    } catch (error) {
      loggingService.error('Failed to get account info', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        error: 'InternalServerError',
        message: 'Failed to retrieve account information'
      });
    }
  }
}

export const binanceController = new BinanceController();