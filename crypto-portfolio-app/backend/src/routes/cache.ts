import { Router } from 'express';
import { cacheManager } from '../services/cacheManager';
import { logger } from '../utils/logger';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

/**
 * @swagger
 * /api/v1/cache/status:
 *   get:
 *     summary: Get cache system status and health
 *     tags: [Cache]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Cache status retrieved successfully
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
 *                     health:
 *                       type: object
 *                     statistics:
 *                       type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/status', authMiddleware.authenticate, async (req, res) => {
  try {
    const health = await cacheManager.getHealth();
    const statistics = cacheManager.getStatistics();

    res.json({
      success: true,
      data: {
        health,
        statistics,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    logger.error('Failed to get cache status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cache status',
    });
  }
});

/**
 * @swagger
 * /api/v1/cache/metrics:
 *   get:
 *     summary: Get detailed cache performance metrics
 *     tags: [Cache]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Cache metrics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/metrics', authMiddleware.authenticate, async (req, res) => {
  try {
    const cacheService = cacheManager.getCacheService();
    const databaseCache = cacheManager.getDatabaseCache();
    
    const cacheStats = cacheService.getStatistics();
    const dbStats = databaseCache.getStatistics();

    res.json({
      success: true,
      data: {
        cache: cacheStats,
        database: dbStats,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    logger.error('Failed to get cache metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cache metrics',
    });
  }
});

/**
 * @swagger
 * /api/v1/cache/warm:
 *   post:
 *     summary: Trigger cache warming
 *     tags: [Cache]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               strategy:
 *                 type: string
 *                 enum: [startup, scheduled, manual]
 *                 default: manual
 *     responses:
 *       200:
 *         description: Cache warming initiated successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/warm', authMiddleware.authenticate, async (req, res) => {
  try {
    const { strategy = 'manual' } = req.body;

    await cacheManager.warmCache(strategy);

    res.json({
      success: true,
      message: `Cache warming completed with strategy: ${strategy}`,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Failed to warm cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to warm cache',
    });
  }
});

/**
 * @swagger
 * /api/v1/cache/clear:
 *   delete:
 *     summary: Clear all cache entries
 *     tags: [Cache]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: namespace
 *         schema:
 *           type: string
 *           enum: [price, portfolio, user, exchange, market, session, ratelimit, query, api]
 *         description: Specific namespace to clear (optional, clears all if not specified)
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete('/clear', authMiddleware.authenticate, async (req, res) => {
  try {
    const { namespace } = req.query;

    if (namespace) {
      const cacheService = cacheManager.getCacheService();
      const invalidated = await cacheService.invalidateNamespace(namespace as any);
      
      res.json({
        success: true,
        message: `Cache namespace '${namespace}' cleared`,
        invalidated,
        timestamp: Date.now(),
      });
    } else {
      await cacheManager.clearAll();
      
      res.json({
        success: true,
        message: 'All cache entries cleared',
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    logger.error('Failed to clear cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
    });
  }
});

/**
 * @swagger
 * /api/v1/cache/invalidate:
 *   post:
 *     summary: Invalidate cache by event or pattern
 *     tags: [Cache]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *                 description: Event name for invalidation
 *               data:
 *                 type: object
 *                 description: Additional data for invalidation rules
 *             required:
 *               - event
 *     responses:
 *       200:
 *         description: Cache invalidation completed
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/invalidate', authMiddleware.authenticate, async (req, res) => {
  try {
    const { event, data } = req.body;

    if (!event) {
      return res.status(400).json({
        success: false,
        error: 'Event name is required',
      });
    }

    const invalidated = await cacheManager.invalidateByEvent(event, data);

    res.json({
      success: true,
      message: `Cache invalidation completed for event: ${event}`,
      invalidated,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Failed to invalidate cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to invalidate cache',
    });
  }
});

export { router as cacheRouter };