import { Request, Response } from 'express';
import { feeCalculationService } from '../services/exchanges/feeCalculationService';
import { auditService } from '../services/auditService';
import { loggingService } from '../services/loggingService';

export class FeeCalculationController {
  async calculateTradeFee(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const {
        exchange,
        symbol,
        side,
        orderType,
        quantity,
        price
      } = req.body;

      if (!exchange || !symbol || !side || !orderType || !quantity) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters',
          required: ['exchange', 'symbol', 'side', 'orderType', 'quantity']
        });
      }

      if (orderType === 'limit' && !price) {
        return res.status(400).json({
          success: false,
          error: 'Price is required for limit orders'
        });
      }

      const feeRequest = {
        userId,
        exchange,
        type: 'trade' as const,
        symbol,
        side,
        orderType,
        quantity,
        price
      };

      const feeResponse = await feeCalculationService.calculateFee(feeRequest);

      await auditService.log({
        userId,
        action: 'fee_calculated',
        resource: 'fee',
        details: {
          exchange,
          type: 'trade',
          symbol,
          side,
          orderType,
          quantity,
          fee: feeResponse.fee,
          feeAsset: feeResponse.feeAsset
        }
      });

      res.status(200).json({
        success: true,
        data: {
          fee: feeResponse,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Trade fee calculation failed', {
        userId: (req as any).user.id,
        request: req.body,
        error: error.message
      });

      if (error.message.includes('Missing required parameters')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid parameters',
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

      res.status(500).json({
        success: false,
        error: 'Fee calculation failed',
        message: 'Internal server error'
      });
    }
  }

  async calculateWithdrawalFee(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const {
        exchange,
        asset,
        network
      } = req.body;

      if (!exchange || !asset) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters',
          required: ['exchange', 'asset']
        });
      }

      const feeRequest = {
        userId,
        exchange,
        type: 'withdrawal' as const,
        asset,
        network
      };

      const feeResponse = await feeCalculationService.calculateFee(feeRequest);

      await auditService.log({
        userId,
        action: 'withdrawal_fee_calculated',
        resource: 'fee',
        details: {
          exchange,
          asset,
          network,
          fee: feeResponse.fee
        }
      });

      res.status(200).json({
        success: true,
        data: {
          fee: feeResponse,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Withdrawal fee calculation failed', {
        userId: (req as any).user.id,
        request: req.body,
        error: error.message
      });

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Asset not found',
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Withdrawal fee calculation failed',
        message: 'Internal server error'
      });
    }
  }

  async calculateDepositFee(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const {
        exchange,
        asset,
        network
      } = req.body;

      if (!exchange || !asset) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters',
          required: ['exchange', 'asset']
        });
      }

      const feeRequest = {
        userId,
        exchange,
        type: 'deposit' as const,
        asset,
        network
      };

      const feeResponse = await feeCalculationService.calculateFee(feeRequest);

      await auditService.log({
        userId,
        action: 'deposit_fee_calculated',
        resource: 'fee',
        details: {
          exchange,
          asset,
          network,
          fee: feeResponse.fee
        }
      });

      res.status(200).json({
        success: true,
        data: {
          fee: feeResponse,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Deposit fee calculation failed', {
        userId: (req as any).user.id,
        request: req.body,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Deposit fee calculation failed',
        message: 'Internal server error'
      });
    }
  }

  async estimateTotalFees(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const {
        exchange,
        trades
      } = req.body;

      if (!exchange || !trades || !Array.isArray(trades)) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters',
          required: ['exchange', 'trades (array)']
        });
      }

      const estimate = await feeCalculationService.estimateTotalFees(userId, exchange, trades);

      await auditService.log({
        userId,
        action: 'total_fees_estimated',
        resource: 'fee',
        details: {
          exchange,
          tradesCount: trades.length,
          totalFee: estimate.totalFee
        }
      });

      res.status(200).json({
        success: true,
        data: {
          totalFee: estimate.totalFee,
          breakdown: estimate.breakdown,
          tradesCount: trades.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Total fee estimation failed', {
        userId: (req as any).user.id,
        request: req.body,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Total fee estimation failed',
        message: 'Internal server error'
      });
    }
  }

  async getFeeHistory(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { exchange } = req.params;
      const { limit = 50 } = req.query;

      if (!exchange) {
        return res.status(400).json({
          success: false,
          error: 'Exchange parameter is required'
        });
      }

      const limitNum = parseInt(limit as string);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({
          success: false,
          error: 'Limit must be a number between 1 and 100'
        });
      }

      const feeHistory = await feeCalculationService.getFeeHistory(userId, exchange, limitNum);

      res.status(200).json({
        success: true,
        data: {
          exchange,
          fees: feeHistory,
          count: feeHistory.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Failed to get fee history', {
        userId: (req as any).user.id,
        exchange: req.params.exchange,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get fee history',
        message: 'Internal server error'
      });
    }
  }

  async getFeeStructure(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { exchange } = req.params;

      if (!exchange) {
        return res.status(400).json({
          success: false,
          error: 'Exchange parameter is required'
        });
      }

      // Get fee structure by calling the private method
      const feeStructure = await (feeCalculationService as any).getFeeStructure(userId, exchange);

      res.status(200).json({
        success: true,
        data: {
          exchange,
          feeStructure,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Failed to get fee structure', {
        userId: (req as any).user.id,
        exchange: req.params.exchange,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get fee structure',
        message: 'Internal server error'
      });
    }
  }

  async getWithdrawalFees(req: Request, res: Response) {
    try {
      const { exchange } = req.params;

      if (!exchange) {
        return res.status(400).json({
          success: false,
          error: 'Exchange parameter is required'
        });
      }

      // Get withdrawal fees by calling the private method
      const withdrawalFees = await (feeCalculationService as any).getWithdrawalFees(exchange);

      res.status(200).json({
        success: true,
        data: {
          exchange,
          withdrawalFees,
          count: Object.keys(withdrawalFees).length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Failed to get withdrawal fees', {
        exchange: req.params.exchange,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get withdrawal fees',
        message: 'Internal server error'
      });
    }
  }

  async getSupportedExchanges(req: Request, res: Response) {
    try {
      const supportedExchanges = feeCalculationService.getSupportedExchanges();

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
        error: 'Failed to get supported exchanges',
        message: 'Internal server error'
      });
    }
  }

  async getSupportedFeeTypes(req: Request, res: Response) {
    try {
      const supportedTypes = feeCalculationService.getSupportedFeeTypes();

      res.status(200).json({
        success: true,
        data: {
          feeTypes: supportedTypes,
          count: supportedTypes.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Failed to get supported fee types', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get supported fee types',
        message: 'Internal server error'
      });
    }
  }

  async clearFeeCache(req: Request, res: Response) {
    try {
      // Only allow admins to clear cache (this would be implemented in middleware)
      feeCalculationService.clearCache();

      await auditService.log({
        userId: (req as any).user.id,
        action: 'fee_cache_cleared',
        resource: 'cache',
        details: { type: 'fee_calculation_cache' }
      });

      res.status(200).json({
        success: true,
        data: {
          message: 'Fee calculation cache cleared successfully',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Failed to clear fee cache', {
        userId: (req as any).user.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to clear cache',
        message: 'Internal server error'
      });
    }
  }

  async calculateMultipleFees(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { requests } = req.body;

      if (!requests || !Array.isArray(requests)) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameter: requests (array)'
        });
      }

      if (requests.length > 20) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 20 fee calculations allowed per request'
        });
      }

      const results = [];

      for (const [index, request] of requests.entries()) {
        try {
          const feeRequest = {
            ...request,
            userId
          };

          const feeResponse = await feeCalculationService.calculateFee(feeRequest);
          results.push({
            index,
            success: true,
            data: feeResponse
          });
        } catch (error: any) {
          results.push({
            index,
            success: false,
            error: error.message
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      await auditService.log({
        userId,
        action: 'multiple_fees_calculated',
        resource: 'fee',
        details: {
          totalRequests: requests.length,
          successCount,
          failureCount
        }
      });

      res.status(200).json({
        success: true,
        data: {
          results,
          summary: {
            total: requests.length,
            successful: successCount,
            failed: failureCount
          },
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Multiple fee calculation failed', {
        userId: (req as any).user.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Multiple fee calculation failed',
        message: 'Internal server error'
      });
    }
  }

  async compareFees(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const {
        exchanges,
        symbol,
        side,
        orderType,
        quantity,
        price
      } = req.body;

      if (!exchanges || !Array.isArray(exchanges) || exchanges.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'At least 2 exchanges required for comparison'
        });
      }

      if (!symbol || !side || !orderType || !quantity) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters',
          required: ['exchanges', 'symbol', 'side', 'orderType', 'quantity']
        });
      }

      const comparisons = [];

      for (const exchange of exchanges) {
        try {
          const feeRequest = {
            userId,
            exchange,
            type: 'trade' as const,
            symbol,
            side,
            orderType,
            quantity,
            price
          };

          const feeResponse = await feeCalculationService.calculateFee(feeRequest);
          comparisons.push({
            exchange,
            success: true,
            fee: feeResponse.fee,
            feeAsset: feeResponse.feeAsset,
            feeRate: feeResponse.feeRate,
            data: feeResponse
          });
        } catch (error: any) {
          comparisons.push({
            exchange,
            success: false,
            error: error.message
          });
        }
      }

      const successfulComparisons = comparisons.filter(c => c.success);
      const cheapest = successfulComparisons.length > 0 
        ? successfulComparisons.reduce((min, current) => 
            (current as any).fee < (min as any).fee ? current : min
          )
        : null;

      await auditService.log({
        userId,
        action: 'fees_compared',
        resource: 'fee',
        details: {
          exchanges,
          symbol,
          side,
          orderType,
          quantity,
          cheapestExchange: (cheapest as any)?.exchange
        }
      });

      res.status(200).json({
        success: true,
        data: {
          comparisons,
          cheapest,
          summary: {
            total: exchanges.length,
            successful: successfulComparisons.length,
            failed: comparisons.length - successfulComparisons.length
          },
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Fee comparison failed', {
        userId: (req as any).user.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Fee comparison failed',
        message: 'Internal server error'
      });
    }
  }
}

export const feeCalculationController = new FeeCalculationController();