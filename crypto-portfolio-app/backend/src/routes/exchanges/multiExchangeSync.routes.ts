import { Router } from 'express';
import { multiExchangeSyncController } from '../../controllers/exchanges/multiExchangeSyncController';
import { authMiddleware } from '../../middleware/authMiddleware';
import { rateLimitMiddleware } from '../../middleware/rateLimitMiddleware';
import { validateRequest } from '../../middleware/validateRequest';
import { body, param, query } from 'express-validator';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     SyncStatus:
 *       type: object
 *       properties:
 *         exchange:
 *           type: string
 *           description: Exchange name
 *         lastSync:
 *           type: string
 *           format: date-time
 *           description: Last synchronization timestamp
 *         status:
 *           type: string
 *           enum: [success, error, pending]
 *           description: Synchronization status
 *         nextSync:
 *           type: string
 *           format: date-time
 *           description: Next scheduled sync
 *         error:
 *           type: string
 *           description: Error message if status is error
 *
 *     MarketData:
 *       type: object
 *       properties:
 *         symbol:
 *           type: string
 *           description: Trading pair symbol
 *         baseSymbol:
 *           type: string
 *           description: Base asset symbol
 *         prices:
 *           type: object
 *           description: Prices from different exchanges
 *         bestBid:
 *           type: object
 *           properties:
 *             exchange:
 *               type: string
 *             price:
 *               type: number
 *         bestAsk:
 *           type: object
 *           properties:
 *             exchange:
 *               type: string
 *             price:
 *               type: number
 *         spread:
 *           type: number
 *           description: Price spread
 *         lastUpdated:
 *           type: string
 *           format: date-time
 *
 *     ArbitrageOpportunity:
 *       type: object
 *       properties:
 *         symbol:
 *           type: string
 *           description: Trading pair symbol
 *         baseSymbol:
 *           type: string
 *           description: Base asset symbol
 *         buyExchange:
 *           type: string
 *           description: Exchange to buy from
 *         sellExchange:
 *           type: string
 *           description: Exchange to sell on
 *         buyPrice:
 *           type: number
 *           description: Buy price
 *         sellPrice:
 *           type: number
 *           description: Sell price
 *         spread:
 *           type: number
 *           description: Absolute spread
 *         spreadPercentage:
 *           type: number
 *           description: Spread percentage
 *         timestamp:
 *           type: string
 *           format: date-time
 *         confidence:
 *           type: number
 *           description: Confidence score (0-100)
 *
 *     PortfolioBalance:
 *       type: object
 *       properties:
 *         userId:
 *           type: string
 *           description: User ID
 *         asset:
 *           type: string
 *           description: Asset symbol
 *         totalBalance:
 *           type: number
 *           description: Total balance across all exchanges
 *         exchanges:
 *           type: object
 *           description: Balances per exchange
 *         lastUpdated:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/v1/exchanges/sync/start:
 *   post:
 *     summary: Start multi-exchange synchronization
 *     description: Starts the automatic synchronization of price data across all supported exchanges
 *     tags: [Multi-Exchange Sync]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               interval:
 *                 type: number
 *                 minimum: 5000
 *                 maximum: 300000
 *                 default: 30000
 *                 description: Synchronization interval in milliseconds
 *     responses:
 *       200:
 *         description: Synchronization started successfully
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
 *                     status:
 *                       type: string
 *                     interval:
 *                       type: number
 *                     exchanges:
 *                       type: array
 *                       items:
 *                         type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Synchronization already running
 *       500:
 *         description: Internal server error
 */
router.post(
  '/start',
  authMiddleware,
  rateLimitMiddleware('exchange-sync', 5, 60000), // 5 requests per minute
  [
    body('interval')
      .optional()
      .isInt({ min: 5000, max: 300000 })
      .withMessage('Interval must be between 5000ms and 300000ms')
  ],
  validateRequest,
  multiExchangeSyncController.startSynchronization
);

/**
 * @swagger
 * /api/v1/exchanges/sync/stop:
 *   post:
 *     summary: Stop multi-exchange synchronization
 *     description: Stops the automatic synchronization of price data
 *     tags: [Multi-Exchange Sync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Synchronization stopped successfully
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
 *                     status:
 *                       type: string
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Synchronization not running
 *       500:
 *         description: Internal server error
 */
router.post(
  '/stop',
  authMiddleware,
  rateLimitMiddleware('exchange-sync', 10, 60000), // 10 requests per minute
  multiExchangeSyncController.stopSynchronization
);

/**
 * @swagger
 * /api/v1/exchanges/sync/status:
 *   get:
 *     summary: Get synchronization status
 *     description: Returns the current status of multi-exchange synchronization
 *     tags: [Multi-Exchange Sync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Synchronization status retrieved successfully
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
 *                     isRunning:
 *                       type: boolean
 *                     supportedExchanges:
 *                       type: array
 *                       items:
 *                         type: string
 *                     exchangeStatuses:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SyncStatus'
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  '/status',
  authMiddleware,
  rateLimitMiddleware('exchange-sync-read', 20, 60000), // 20 requests per minute
  multiExchangeSyncController.getSyncStatus
);

/**
 * @swagger
 * /api/v1/exchanges/sync/full:
 *   post:
 *     summary: Perform full synchronization
 *     description: Triggers a one-time full synchronization across all exchanges
 *     tags: [Multi-Exchange Sync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Full synchronization completed successfully
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
 *                     status:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post(
  '/full',
  authMiddleware,
  rateLimitMiddleware('exchange-sync', 2, 60000), // 2 requests per minute
  multiExchangeSyncController.performFullSync
);

/**
 * @swagger
 * /api/v1/exchanges/sync/market/{symbol}:
 *   get:
 *     summary: Get unified market data
 *     description: Returns unified market data for a specific symbol across all exchanges
 *     tags: [Multi-Exchange Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *         description: Trading pair symbol (e.g., BTC/USDT)
 *         example: BTC/USDT
 *     responses:
 *       200:
 *         description: Unified market data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/MarketData'
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid symbol parameter
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Market data not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/market/:symbol',
  authMiddleware,
  rateLimitMiddleware('exchange-data', 30, 60000), // 30 requests per minute
  [
    param('symbol')
      .notEmpty()
      .matches(/^[A-Z]+\/[A-Z]+$/)
      .withMessage('Symbol must be in format SYMBOL/SYMBOL (e.g., BTC/USDT)')
  ],
  validateRequest,
  multiExchangeSyncController.getUnifiedMarketData
);

/**
 * @swagger
 * /api/v1/exchanges/sync/arbitrage:
 *   get:
 *     summary: Get arbitrage opportunities
 *     description: Detects and returns current arbitrage opportunities across exchanges
 *     tags: [Multi-Exchange Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: minSpread
 *         required: false
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 10
 *           default: 0.5
 *         description: Minimum spread percentage to consider
 *     responses:
 *       200:
 *         description: Arbitrage opportunities retrieved successfully
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
 *                     opportunities:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ArbitrageOpportunity'
 *                     count:
 *                       type: number
 *                     minSpreadPercentage:
 *                       type: number
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  '/arbitrage',
  authMiddleware,
  rateLimitMiddleware('arbitrage', 15, 60000), // 15 requests per minute
  [
    query('minSpread')
      .optional()
      .isFloat({ min: 0, max: 10 })
      .withMessage('minSpread must be between 0 and 10')
  ],
  validateRequest,
  multiExchangeSyncController.getArbitrageOpportunities
);

/**
 * @swagger
 * /api/v1/exchanges/sync/arbitrage/cached:
 *   get:
 *     summary: Get cached arbitrage opportunities
 *     description: Returns cached arbitrage opportunities without recalculation
 *     tags: [Multi-Exchange Sync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cached arbitrage opportunities retrieved successfully
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
 *                     opportunities:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ArbitrageOpportunity'
 *                     count:
 *                       type: number
 *                     cached:
 *                       type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  '/arbitrage/cached',
  authMiddleware,
  rateLimitMiddleware('arbitrage-read', 30, 60000), // 30 requests per minute
  multiExchangeSyncController.getCachedArbitrageOpportunities
);

/**
 * @swagger
 * /api/v1/exchanges/sync/portfolio:
 *   get:
 *     summary: Get aggregated portfolio
 *     description: Returns user's portfolio aggregated across all connected exchanges
 *     tags: [Multi-Exchange Sync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Aggregated portfolio retrieved successfully
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
 *                     portfolio:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/PortfolioBalance'
 *                     totalAssets:
 *                       type: number
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  '/portfolio',
  authMiddleware,
  rateLimitMiddleware('portfolio', 10, 60000), // 10 requests per minute
  multiExchangeSyncController.getAggregatedPortfolio
);

/**
 * @swagger
 * /api/v1/exchanges/sync/reconcile:
 *   post:
 *     summary: Reconcile balances
 *     description: Performs balance reconciliation across all connected exchanges
 *     tags: [Multi-Exchange Sync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Balance reconciliation completed successfully
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
 *                     discrepancies:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           asset:
 *                             type: string
 *                           expectedTotal:
 *                             type: number
 *                           actualTotal:
 *                             type: number
 *                           difference:
 *                             type: number
 *                           exchanges:
 *                             type: array
 *                             items:
 *                               type: string
 *                     lastReconciliation:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post(
  '/reconcile',
  authMiddleware,
  rateLimitMiddleware('reconcile', 5, 300000), // 5 requests per 5 minutes
  multiExchangeSyncController.reconcileBalances
);

export default router;