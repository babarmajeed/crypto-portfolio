import { Request, Response } from 'express';
import { rateLimitingService } from '../services/exchanges/rateLimitingService';
import { auditService } from '../services/auditService';
import { loggingService } from '../services/loggingService';

export class RateLimitingController {
  async getRateLimitStatus(req: Request, res: Response) {
    try {
      const { exchange } = req.params;
      const userId = (req as any).user?.id;

      if (!exchange) {
        return res.status(400).json({
          success: false,
          error: 'Exchange parameter is required'
        });
      }

      const supportedExchanges = rateLimitingService.getSupportedExchanges();
      if (!supportedExchanges.includes(exchange)) {
        return res.status(400).json({
          success: false,
          error: 'Unsupported exchange',
          supportedExchanges
        });
      }

      const statuses = await rateLimitingService.getRateLimitStatus(exchange, userId);

      res.status(200).json({
        success: true,
        data: {
          exchange,
          userId: userId || 'anonymous',
          statuses,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Failed to get rate limit status', {
        exchange: req.params.exchange,
        userId: (req as any).user?.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get rate limit status',
        message: 'Internal server error'
      });
    }
  }

  async getAllRateLimitStatuses(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const supportedExchanges = rateLimitingService.getSupportedExchanges();

      const allStatuses = await Promise.allSettled(
        supportedExchanges.map(async (exchange) => {
          const statuses = await rateLimitingService.getRateLimitStatus(exchange, userId);
          return { exchange, statuses };
        })
      );

      const results = allStatuses.map((result, index) => {
        const exchange = supportedExchanges[index];
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            exchange,
            error: result.reason?.message || 'Unknown error',
            statuses: []
          };
        }
      });

      res.status(200).json({
        success: true,
        data: {
          userId: userId || 'anonymous',
          exchanges: results,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Failed to get all rate limit statuses', {
        userId: (req as any).user?.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get rate limit statuses',
        message: 'Internal server error'
      });
    }
  }

  async getRequestHistory(req: Request, res: Response) {
    try {
      const { exchange } = req.params;
      const userId = (req as any).user?.id;
      const { limit = 100 } = req.query;

      if (!exchange) {
        return res.status(400).json({
          success: false,
          error: 'Exchange parameter is required'
        });
      }

      const limitNum = parseInt(limit as string);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
        return res.status(400).json({
          success: false,
          error: 'Limit must be a number between 1 and 1000'
        });
      }

      const history = await rateLimitingService.getRequestHistory(exchange, userId, limitNum);

      res.status(200).json({
        success: true,
        data: {
          exchange,
          userId: userId || 'anonymous',
          history,
          count: history.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Failed to get request history', {
        exchange: req.params.exchange,
        userId: (req as any).user?.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get request history',
        message: 'Internal server error'
      });
    }
  }

  async getRateLimitingStats(req: Request, res: Response) {
    try {
      const stats = await rateLimitingService.getRateLimitingStats();

      res.status(200).json({
        success: true,
        data: {
          statistics: {
            totalRequests: stats.totalRequests,
            rateLimitedRequests: stats.rateLimitedRequests,
            successRate: stats.successRate
          },
          topEndpoints: stats.topEndpoints,
          exchangeStats: Object.fromEntries(stats.exchangeStats),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Failed to get rate limiting stats', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get rate limiting statistics',
        message: 'Internal server error'
      });
    }
  }

  async getExchangeRateLimits(req: Request, res: Response) {
    try {
      const { exchange } = req.params;

      if (!exchange) {
        return res.status(400).json({
          success: false,
          error: 'Exchange parameter is required'
        });
      }

      const rateLimits = rateLimitingService.getExchangeRateLimits(exchange);
      if (!rateLimits) {
        return res.status(404).json({
          success: false,
          error: 'Rate limits not found for exchange',
          exchange
        });
      }

      // Convert Map to object for JSON serialization
      const endpointLimits = Object.fromEntries(rateLimits.endpointLimits);

      res.status(200).json({
        success: true,
        data: {
          exchange: rateLimits.exchange,
          globalLimit: rateLimits.globalLimit,
          endpointLimits,
          endpointCount: rateLimits.endpointLimits.size,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Failed to get exchange rate limits', {
        exchange: req.params.exchange,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get exchange rate limits',
        message: 'Internal server error'
      });
    }
  }

  async getAllExchangeRateLimits(req: Request, res: Response) {
    try {
      const allRateLimits = rateLimitingService.getAllExchangeRateLimits();

      const result = Object.fromEntries(
        Array.from(allRateLimits.entries()).map(([exchange, limits]) => [
          exchange,
          {
            exchange: limits.exchange,
            globalLimit: limits.globalLimit,
            endpointLimits: Object.fromEntries(limits.endpointLimits),
            endpointCount: limits.endpointLimits.size
          }
        ])
      );

      res.status(200).json({
        success: true,
        data: {
          rateLimits: result,
          exchangeCount: allRateLimits.size,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Failed to get all exchange rate limits', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get all exchange rate limits',
        message: 'Internal server error'
      });
    }
  }

  async updateRateLimit(req: Request, res: Response) {
    try {
      const { exchange } = req.params;
      const {
        endpoint,
        method,
        maxRequests,
        windowMs,
        weight,
        burstAllowed,
        burstLimit
      } = req.body;

      if (!exchange) {
        return res.status(400).json({
          success: false,
          error: 'Exchange parameter is required'
        });
      }

      if (!maxRequests || !windowMs) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters',
          required: ['maxRequests', 'windowMs']
        });
      }

      const rule = {
        exchange,
        endpoint,
        method,
        maxRequests: parseInt(maxRequests),
        windowMs: parseInt(windowMs),
        weight: weight ? parseInt(weight) : 1,
        burstAllowed: Boolean(burstAllowed),
        burstLimit: burstLimit ? parseInt(burstLimit) : undefined
      };

      await rateLimitingService.updateRateLimit(exchange, rule);

      await auditService.log({
        userId: (req as any).user.id,
        action: 'rate_limit_updated',
        resource: 'rate_limit',
        details: {
          exchange,
          endpoint: endpoint || 'global',
          maxRequests: rule.maxRequests,
          windowMs: rule.windowMs
        }
      });

      res.status(200).json({
        success: true,
        data: {
          message: 'Rate limit updated successfully',
          rule,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Failed to update rate limit', {
        exchange: req.params.exchange,
        userId: (req as any).user.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to update rate limit',
        message: 'Internal server error'
      });
    }
  }

  async clearRateLimitCache(req: Request, res: Response) {
    try {
      const { exchange } = req.params;
      const { endpoint } = req.query;

      await rateLimitingService.clearRateLimitCache(exchange, endpoint as string);

      await auditService.log({
        userId: (req as any).user.id,
        action: 'rate_limit_cache_cleared',
        resource: 'cache',
        details: {
          exchange,
          endpoint: endpoint || 'all',
          scope: exchange ? (endpoint ? 'endpoint' : 'exchange') : 'global'
        }
      });

      res.status(200).json({
        success: true,
        data: {
          message: 'Rate limit cache cleared successfully',
          exchange,
          endpoint: endpoint || 'all',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Failed to clear rate limit cache', {
        exchange: req.params.exchange,
        endpoint: req.query.endpoint,
        userId: (req as any).user.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to clear rate limit cache',
        message: 'Internal server error'
      });
    }
  }

  async checkRateLimit(req: Request, res: Response) {
    try {
      const {
        exchange,
        endpoint = 'default',
        method = 'GET',
        weight = 1
      } = req.body;

      const userId = (req as any).user?.id;

      if (!exchange) {
        return res.status(400).json({
          success: false,
          error: 'Exchange is required'
        });
      }

      const status = await rateLimitingService.checkRateLimit(
        exchange,
        endpoint,
        method,
        userId,
        parseInt(weight)
      );

      res.status(200).json({
        success: true,
        data: {
          rateLimitStatus: status,
          allowed: !status.isBlocked,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Failed to check rate limit', {
        userId: (req as any).user?.id,
        request: req.body,
        error: error.message
      });

      if (error.message.includes('not configured')) {
        return res.status(400).json({
          success: false,
          error: 'Unsupported exchange',
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to check rate limit',
        message: 'Internal server error'
      });
    }
  }

  async recordRequest(req: Request, res: Response) {
    try {
      const {
        exchange,
        endpoint = 'default',
        method = 'GET',
        weight = 1,
        success = true
      } = req.body;

      const userId = (req as any).user?.id;

      if (!exchange) {
        return res.status(400).json({
          success: false,
          error: 'Exchange is required'
        });
      }

      await rateLimitingService.recordRequest(
        exchange,
        endpoint,
        method,
        userId,
        parseInt(weight),
        Boolean(success)
      );

      res.status(200).json({
        success: true,
        data: {
          message: 'Request recorded successfully',
          exchange,
          endpoint,
          method,
          weight: parseInt(weight),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Failed to record request', {
        userId: (req as any).user?.id,
        request: req.body,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to record request',
        message: 'Internal server error'
      });
    }
  }

  async getSupportedExchanges(req: Request, res: Response) {
    try {
      const supportedExchanges = rateLimitingService.getSupportedExchanges();

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

  async cleanupOldData(req: Request, res: Response) {
    try {
      await rateLimitingService.cleanupOldData();

      await auditService.log({
        userId: (req as any).user.id,
        action: 'rate_limit_data_cleanup',
        resource: 'maintenance',
        details: { type: 'cleanup_old_data' }
      });

      res.status(200).json({
        success: true,
        data: {
          message: 'Old rate limiting data cleaned up successfully',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Failed to cleanup old data', {
        userId: (req as any).user.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to cleanup old data',
        message: 'Internal server error'
      });
    }
  }

  async waitForRateLimit(req: Request, res: Response) {
    try {
      const {
        exchange,
        endpoint = 'default',
        method = 'GET',
        weight = 1
      } = req.body;

      const userId = (req as any).user?.id;

      if (!exchange) {
        return res.status(400).json({
          success: false,
          error: 'Exchange is required'
        });
      }

      const startTime = Date.now();
      
      await rateLimitingService.waitForRateLimit(
        exchange,
        endpoint,
        method,
        userId,
        parseInt(weight)
      );

      const waitTime = Date.now() - startTime;

      res.status(200).json({
        success: true,
        data: {
          message: 'Rate limit wait completed',
          exchange,
          endpoint,
          method,
          waitTime,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Failed to wait for rate limit', {
        userId: (req as any).user?.id,
        request: req.body,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to wait for rate limit',
        message: 'Internal server error'
      });
    }
  }
}

export const rateLimitingController = new RateLimitingController();