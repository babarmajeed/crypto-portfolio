import { Router } from 'express';
import { webSocketController } from '../../controllers/exchanges/webSocketController';
import { authMiddleware } from '../../middleware/authMiddleware';
import { rateLimitMiddleware } from '../../middleware/rateLimitMiddleware';
import { validateRequest } from '../../middleware/validateRequest';
import { body, param, query } from 'express-validator';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     StreamData:
 *       type: object
 *       properties:
 *         symbol:
 *           type: string
 *           description: Trading pair symbol
 *         price:
 *           type: number
 *           description: Current price
 *         volume:
 *           type: number
 *           description: Trading volume
 *         change24h:
 *           type: number
 *           description: 24-hour price change percentage
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Data timestamp
 *         exchange:
 *           type: string
 *           description: Exchange name
 *         type:
 *           type: string
 *           enum: [price, trade, orderbook, ticker]
 *           description: Data type
 *
 *     WebSocketConnection:
 *       type: object
 *       properties:
 *         isConnected:
 *           type: boolean
 *           description: Connection status
 *         lastPing:
 *           type: string
 *           format: date-time
 *           description: Last ping timestamp
 *         reconnectAttempts:
 *           type: number
 *           description: Number of reconnection attempts
 *         subscriptionCount:
 *           type: number
 *           description: Active subscription count
 *
 *     StreamSubscription:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Subscription ID
 *         exchange:
 *           type: string
 *           description: Exchange name
 *         symbols:
 *           type: array
 *           items:
 *             type: string
 *           description: Subscribed symbols
 *         types:
 *           type: array
 *           items:
 *             type: string
 *             enum: [price, trade, orderbook, ticker]
 *           description: Subscribed data types
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Subscription creation time
 */

/**
 * @swagger
 * /api/v1/exchanges/websocket/connect:
 *   post:
 *     summary: Connect to exchange WebSocket
 *     description: Establishes a WebSocket connection to the specified exchange
 *     tags: [WebSocket]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - exchange
 *             properties:
 *               exchange:
 *                 type: string
 *                 enum: [binance, coinbase, kraken, kucoin]
 *                 description: Exchange to connect to
 *                 example: binance
 *               symbols:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Initial symbols to subscribe to
 *                 example: ["BTCUSDT", "ETHUSDT"]
 *     responses:
 *       200:
 *         description: WebSocket connected successfully
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
 *                     connected:
 *                       type: boolean
 *                     exchange:
 *                       type: string
 *                     symbols:
 *                       type: array
 *                       items:
 *                         type: string
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post(
  '/connect',
  authMiddleware,
  rateLimitMiddleware('websocket-connect', 10, 60000), // 10 connections per minute
  [
    body('exchange')
      .notEmpty()
      .isIn(['binance', 'coinbase', 'kraken', 'kucoin'])
      .withMessage('Exchange must be one of: binance, coinbase, kraken, kucoin'),
    body('symbols')
      .optional()
      .isArray()
      .withMessage('Symbols must be an array')
  ],
  validateRequest,
  webSocketController.connect
);

/**
 * @swagger
 * /api/v1/exchanges/websocket/disconnect:
 *   post:
 *     summary: Disconnect from exchange WebSocket
 *     description: Closes the WebSocket connection to the specified exchange
 *     tags: [WebSocket]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - exchange
 *             properties:
 *               exchange:
 *                 type: string
 *                 enum: [binance, coinbase, kraken, kucoin]
 *                 description: Exchange to disconnect from
 *                 example: binance
 *     responses:
 *       200:
 *         description: WebSocket disconnected successfully
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
 *                     disconnected:
 *                       type: boolean
 *                     exchange:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Connection not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/disconnect',
  authMiddleware,
  rateLimitMiddleware('websocket-disconnect', 20, 60000), // 20 disconnections per minute
  [
    body('exchange')
      .notEmpty()
      .isIn(['binance', 'coinbase', 'kraken', 'kucoin'])
      .withMessage('Exchange must be one of: binance, coinbase, kraken, kucoin')
  ],
  validateRequest,
  webSocketController.disconnect
);

/**
 * @swagger
 * /api/v1/exchanges/websocket/subscribe:
 *   post:
 *     summary: Subscribe to WebSocket streams
 *     description: Creates a subscription to receive real-time data for specified symbols and types
 *     tags: [WebSocket]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - exchange
 *               - symbols
 *             properties:
 *               exchange:
 *                 type: string
 *                 enum: [binance, coinbase, kraken, kucoin]
 *                 description: Exchange to subscribe to
 *                 example: binance
 *               symbols:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 1
 *                 description: Symbols to subscribe to
 *                 example: ["BTCUSDT", "ETHUSDT"]
 *               types:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [price, trade, orderbook, ticker]
 *                 description: Data types to subscribe to
 *                 default: ["ticker"]
 *                 example: ["ticker", "trade"]
 *     responses:
 *       201:
 *         description: Subscription created successfully
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
 *                     subscriptionId:
 *                       type: string
 *                     exchange:
 *                       type: string
 *                     symbols:
 *                       type: array
 *                       items:
 *                         type: string
 *                     types:
 *                       type: array
 *                       items:
 *                         type: string
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post(
  '/subscribe',
  authMiddleware,
  rateLimitMiddleware('websocket-subscribe', 30, 60000), // 30 subscriptions per minute
  [
    body('exchange')
      .notEmpty()
      .isIn(['binance', 'coinbase', 'kraken', 'kucoin'])
      .withMessage('Exchange must be one of: binance, coinbase, kraken, kucoin'),
    body('symbols')
      .isArray({ min: 1 })
      .withMessage('Symbols must be a non-empty array'),
    body('types')
      .optional()
      .isArray()
      .custom((types) => {
        const validTypes = ['price', 'trade', 'orderbook', 'ticker'];
        return types.every((type: string) => validTypes.includes(type));
      })
      .withMessage('Types must contain only: price, trade, orderbook, ticker')
  ],
  validateRequest,
  webSocketController.subscribe
);

/**
 * @swagger
 * /api/v1/exchanges/websocket/subscribe/{subscriptionId}:
 *   delete:
 *     summary: Unsubscribe from WebSocket streams
 *     description: Removes an existing WebSocket subscription
 *     tags: [WebSocket]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subscriptionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription ID to remove
 *         example: binance_1234567890_abc123
 *     responses:
 *       200:
 *         description: Unsubscribed successfully
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
 *                     unsubscribed:
 *                       type: boolean
 *                     subscriptionId:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid subscription ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Subscription not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/subscribe/:subscriptionId',
  authMiddleware,
  rateLimitMiddleware('websocket-unsubscribe', 50, 60000), // 50 unsubscriptions per minute
  [
    param('subscriptionId')
      .notEmpty()
      .isLength({ min: 10 })
      .withMessage('Invalid subscription ID format')
  ],
  validateRequest,
  webSocketController.unsubscribe
);

/**
 * @swagger
 * /api/v1/exchanges/websocket/status:
 *   get:
 *     summary: Get WebSocket connection status
 *     description: Returns the current status of all WebSocket connections and subscriptions
 *     tags: [WebSocket]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: WebSocket status retrieved successfully
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
 *                     connections:
 *                       type: object
 *                       additionalProperties:
 *                         $ref: '#/components/schemas/WebSocketConnection'
 *                     activeSubscriptions:
 *                       type: number
 *                     subscriptions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/StreamSubscription'
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
router.get(
  '/status',
  authMiddleware,
  rateLimitMiddleware('websocket-status', 60, 60000), // 60 status requests per minute
  webSocketController.getStatus
);

/**
 * @swagger
 * /api/v1/exchanges/websocket/data/{exchange}/{symbol}:
 *   get:
 *     summary: Get cached stream data
 *     description: Retrieves cached real-time data for a specific symbol from an exchange
 *     tags: [WebSocket]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: exchange
 *         required: true
 *         schema:
 *           type: string
 *           enum: [binance, coinbase, kraken, kucoin]
 *         description: Exchange name
 *         example: binance
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *         description: Trading pair symbol
 *         example: BTCUSDT
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [price, trade, orderbook, ticker]
 *           default: ticker
 *         description: Data type to retrieve
 *         example: ticker
 *     responses:
 *       200:
 *         description: Cached data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/StreamData'
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Data not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/data/:exchange/:symbol',
  authMiddleware,
  rateLimitMiddleware('websocket-data', 100, 60000), // 100 data requests per minute
  [
    param('exchange')
      .isIn(['binance', 'coinbase', 'kraken', 'kucoin'])
      .withMessage('Exchange must be one of: binance, coinbase, kraken, kucoin'),
    param('symbol')
      .notEmpty()
      .isLength({ min: 3, max: 20 })
      .withMessage('Symbol must be between 3 and 20 characters'),
    query('type')
      .optional()
      .isIn(['price', 'trade', 'orderbook', 'ticker'])
      .withMessage('Type must be one of: price, trade, orderbook, ticker')
  ],
  validateRequest,
  webSocketController.getCachedData
);

/**
 * @swagger
 * /api/v1/exchanges/websocket/disconnect-all:
 *   post:
 *     summary: Disconnect all WebSocket connections
 *     description: Closes all active WebSocket connections (Admin only)
 *     tags: [WebSocket]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All WebSocket connections disconnected successfully
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
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       500:
 *         description: Internal server error
 */
router.post(
  '/disconnect-all',
  authMiddleware,
  rateLimitMiddleware('websocket-admin', 5, 300000), // 5 admin operations per 5 minutes
  webSocketController.disconnectAll
);

export default router;