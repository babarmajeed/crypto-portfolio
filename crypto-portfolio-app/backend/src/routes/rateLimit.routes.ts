import { Router } from 'express';
import { Request, Response } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { rateLimitService } from '../services/rateLimitService';
import { rateLimitMonitor } from '../monitoring/rateLimitMonitor';
import { exchangeRateLimitCoordinator } from '../services/exchangeRateLimitCoordinator';
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware';
import { logger } from '../utils/logger';

const router = Router();

// Apply authentication middleware
router.use(authMiddleware.requireAdmin);

/**
 * @swagger
 * components:
 *   schemas:
 *     RateLimitStats:
 *       type: object
 *       properties:
 *         metrics:
 *           type: array
 *           items:
 *             type: object
 *         analytics:
 *           type: object
 *         activeAlerts:
 *           type: number
 *         isHealthy:
 *           type: boolean
 *
 *     RateLimitAlert:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         type:
 *           type: string
 *         message:
 *           type: string
 *         severity:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         timestamp:
 *           type: string
 *           format: date-time
 *         resolved:
 *           type: boolean
 */

/**
 * @swagger
 * /api/v1/admin/rate-limits/status:
 *   get:
 *     summary: Get rate limiting system status
 *     tags: [Admin, Rate Limiting]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Rate limiting system status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/RateLimitStats'
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const stats = await rateLimitMiddleware.getStats();
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error getting rate limit status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get rate limit status',
    });
  }
});

/**
 * @swagger
 * /api/v1/admin/rate-limits/health:
 *   get:
 *     summary: Check rate limiting system health
 *     tags: [Admin, Rate Limiting]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Health check results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     rateLimitService:
 *                       type: boolean
 *                     monitoring:
 *                       type: boolean
 *                     exchangeCoordinator:
 *                       type: boolean
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = {
      rateLimitService: await rateLimitService.isServiceHealthy(),
      monitoring: await rateLimitMonitor.isHealthy(),
      exchangeCoordinator: await exchangeRateLimitCoordinator.isHealthy(),
    };

    const overallHealth = Object.values(health).every(Boolean);
    
    res.status(overallHealth ? 200 : 503).json({
      success: overallHealth,
      data: health,
    });
  } catch (error) {
    logger.error('Error checking rate limit health:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
    });
  }
});

/**
 * @swagger
 * /api/v1/admin/rate-limits/metrics:
 *   get:
 *     summary: Get rate limiting metrics
 *     tags: [Admin, Rate Limiting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d]
 *           default: 1h
 *         description: Time frame for metrics
 *       - in: query
 *         name: identifier
 *         schema:
 *           type: string
 *         description: Filter by specific identifier
 *     responses:
 *       200:
 *         description: Rate limiting metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const { timeframe = '1h', identifier } = req.query;
    
    const metrics = await rateLimitMonitor.getMetrics(timeframe as '1h' | '24h' | '7d');
    const filteredMetrics = identifier 
      ? metrics.filter(m => m.identifier === identifier)
      : metrics;

    res.json({
      success: true,
      data: {
        timeframe,
        metrics: filteredMetrics,
        total: filteredMetrics.length,
      },
    });
  } catch (error) {
    logger.error('Error getting rate limit metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get metrics',
    });
  }
});

/**
 * @swagger
 * /api/v1/admin/rate-limits/analytics:
 *   get:
 *     summary: Get rate limiting analytics
 *     tags: [Admin, Rate Limiting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d]
 *           default: 24h
 *         description: Time frame for analytics
 *     responses:
 *       200:
 *         description: Rate limiting analytics
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    const analytics = await rateLimitMonitor.getAnalytics(timeframe as '1h' | '24h' | '7d');
    
    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    logger.error('Error getting rate limit analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics',
    });
  }
});

/**
 * @swagger
 * /api/v1/admin/rate-limits/alerts:
 *   get:
 *     summary: Get rate limiting alerts
 *     tags: [Admin, Rate Limiting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Show only active alerts
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of alerts to return
 *     responses:
 *       200:
 *         description: Rate limiting alerts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RateLimitAlert'
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const { active = 'false', limit = '100' } = req.query;
    const isActiveOnly = active === 'true';
    const maxLimit = parseInt(limit as string, 10);
    
    const alerts = isActiveOnly 
      ? await rateLimitMonitor.getActiveAlerts()
      : await rateLimitMonitor.getAlertHistory(maxLimit);
    
    res.json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    logger.error('Error getting rate limit alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get alerts',
    });
  }
});

/**
 * @swagger
 * /api/v1/admin/rate-limits/alerts/{alertId}/resolve:
 *   post:
 *     summary: Resolve a rate limiting alert
 *     tags: [Admin, Rate Limiting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID to resolve
 *     responses:
 *       200:
 *         description: Alert resolved successfully
 */
router.post('/alerts/:alertId/resolve', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    
    await rateLimitMonitor.resolveAlert(alertId);
    
    res.json({
      success: true,
      message: 'Alert resolved successfully',
    });
  } catch (error) {
    logger.error('Error resolving alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert',
    });
  }
});

/**
 * @swagger
 * /api/v1/admin/rate-limits/blacklist:
 *   get:
 *     summary: Get blacklisted identifiers
 *     tags: [Admin, Rate Limiting]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of blacklisted identifiers
 */
router.get('/blacklist', async (req: Request, res: Response) => {
  try {
    const blacklisted = await rateLimitService.getBlacklistedIdentifiers();
    
    res.json({
      success: true,
      data: blacklisted,
    });
  } catch (error) {
    logger.error('Error getting blacklist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get blacklist',
    });
  }
});

/**
 * @swagger
 * /api/v1/admin/rate-limits/blacklist:
 *   post:
 *     summary: Add identifier to blacklist
 *     tags: [Admin, Rate Limiting]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *               - reason
 *             properties:
 *               identifier:
 *                 type: string
 *               reason:
 *                 type: string
 *               duration:
 *                 type: number
 *                 description: Duration in milliseconds
 *     responses:
 *       200:
 *         description: Identifier blacklisted successfully
 */
router.post('/blacklist', async (req: Request, res: Response) => {
  try {
    const { identifier, reason, duration } = req.body;
    
    if (!identifier || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Identifier and reason are required',
      });
    }
    
    await rateLimitService.addToBlacklist(identifier, reason, duration);
    
    res.json({
      success: true,
      message: 'Identifier blacklisted successfully',
    });
  } catch (error) {
    logger.error('Error adding to blacklist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add to blacklist',
    });
  }
});

/**
 * @swagger
 * /api/v1/admin/rate-limits/blacklist/{identifier}:
 *   delete:
 *     summary: Remove identifier from blacklist
 *     tags: [Admin, Rate Limiting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: identifier
 *         required: true
 *         schema:
 *           type: string
 *         description: Identifier to remove from blacklist
 *     responses:
 *       200:
 *         description: Identifier removed from blacklist
 */
router.delete('/blacklist/:identifier', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;
    
    await rateLimitService.removeFromBlacklist(decodeURIComponent(identifier));
    
    res.json({
      success: true,
      message: 'Identifier removed from blacklist',
    });
  } catch (error) {
    logger.error('Error removing from blacklist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove from blacklist',
    });
  }
});

/**
 * @swagger
 * /api/v1/admin/rate-limits/reset:
 *   post:
 *     summary: Reset rate limits for an identifier
 *     tags: [Admin, Rate Limiting]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *               - userTier
 *             properties:
 *               identifier:
 *                 type: string
 *               userTier:
 *                 type: string
 *                 enum: [ADMIN, PREMIUM, BASIC, ANONYMOUS, INTERNAL]
 *     responses:
 *       200:
 *         description: Rate limits reset successfully
 */
router.post('/reset', async (req: Request, res: Response) => {
  try {
    const { identifier, userTier } = req.body;
    
    if (!identifier || !userTier) {
      return res.status(400).json({
        success: false,
        error: 'Identifier and userTier are required',
      });
    }
    
    await rateLimitService.resetRateLimit(identifier, userTier);
    
    res.json({
      success: true,
      message: 'Rate limits reset successfully',
    });
  } catch (error) {
    logger.error('Error resetting rate limits:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset rate limits',
    });
  }
});

/**
 * @swagger
 * /api/v1/admin/rate-limits/exchanges:
 *   get:
 *     summary: Get exchange rate limiting status
 *     tags: [Admin, Rate Limiting]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Exchange rate limiting status
 */
router.get('/exchanges', async (req: Request, res: Response) => {
  try {
    const exchanges = ['binance', 'coinbase', 'kraken', 'kucoin'];
    const status = {};
    
    for (const exchange of exchanges) {
      const queueStats = await exchangeRateLimitCoordinator.getQueueStats(exchange);
      const rateLimitStatus = await exchangeRateLimitCoordinator.getRateLimitStatus(exchange);
      
      status[exchange] = {
        queue: queueStats,
        rateLimit: rateLimitStatus,
      };
    }
    
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Error getting exchange status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get exchange status',
    });
  }
});

/**
 * @swagger
 * /api/v1/admin/rate-limits/exchanges/{exchange}/pause:
 *   post:
 *     summary: Pause exchange request processing
 *     tags: [Admin, Rate Limiting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: exchange
 *         required: true
 *         schema:
 *           type: string
 *         description: Exchange name to pause
 *     responses:
 *       200:
 *         description: Exchange paused successfully
 */
router.post('/exchanges/:exchange/pause', async (req: Request, res: Response) => {
  try {
    const { exchange } = req.params;
    
    await exchangeRateLimitCoordinator.pause(exchange);
    
    res.json({
      success: true,
      message: `Exchange ${exchange} paused successfully`,
    });
  } catch (error) {
    logger.error('Error pausing exchange:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to pause exchange',
    });
  }
});

/**
 * @swagger
 * /api/v1/admin/rate-limits/exchanges/{exchange}/resume:
 *   post:
 *     summary: Resume exchange request processing
 *     tags: [Admin, Rate Limiting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: exchange
 *         required: true
 *         schema:
 *           type: string
 *         description: Exchange name to resume
 *     responses:
 *       200:
 *         description: Exchange resumed successfully
 */
router.post('/exchanges/:exchange/resume', async (req: Request, res: Response) => {
  try {
    const { exchange } = req.params;
    
    await exchangeRateLimitCoordinator.resume(exchange);
    
    res.json({
      success: true,
      message: `Exchange ${exchange} resumed successfully`,
    });
  } catch (error) {
    logger.error('Error resuming exchange:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resume exchange',
    });
  }
});

/**
 * @swagger
 * /api/v1/admin/rate-limits/exchanges/{exchange}/clear:
 *   post:
 *     summary: Clear exchange request queue
 *     tags: [Admin, Rate Limiting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: exchange
 *         required: true
 *         schema:
 *           type: string
 *         description: Exchange name to clear queue
 *     responses:
 *       200:
 *         description: Exchange queue cleared successfully
 */
router.post('/exchanges/:exchange/clear', async (req: Request, res: Response) => {
  try {
    const { exchange } = req.params;
    
    const clearedCount = await exchangeRateLimitCoordinator.clearQueue(exchange);
    
    res.json({
      success: true,
      message: `Cleared ${clearedCount} requests from ${exchange} queue`,
      data: { clearedCount },
    });
  } catch (error) {
    logger.error('Error clearing exchange queue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear exchange queue',
    });
  }
});

export default router;