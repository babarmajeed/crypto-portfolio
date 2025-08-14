import { Router } from 'express';
import { krakenController, validateCredentials, validateWebSocketSetup } from '../../controllers/exchanges/krakenController';
import { authenticateToken } from '../../middleware/authMiddleware';
import { rateLimitMiddleware } from '../../middleware/rateLimitMiddleware';
import { auditMiddleware } from '../../middleware/auditMiddleware';

const router = Router();

// Apply authentication, rate limiting, and audit logging to all routes
router.use(authenticateToken);
router.use(rateLimitMiddleware);
router.use(auditMiddleware);

/**
 * @swagger
 * /api/v1/exchanges/kraken/test:
 *   get:
 *     summary: Test Kraken API connection
 *     tags: [Kraken Exchange]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Connection test result
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
 *                     serverTime:
 *                       type: string
 *                       format: date-time
 *                     latency:
 *                       type: number
 *                 message:
 *                   type: string
 *       500:
 *         description: Connection test failed
 */
router.get('/test', krakenController.testConnection.bind(krakenController));

/**
 * @swagger
 * /api/v1/exchanges/kraken/prices:
 *   get:
 *     summary: Get current prices from Kraken
 *     tags: [Kraken Exchange]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: symbols
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Cryptocurrency symbols (e.g. XXBTZUSD, XETHZUSD)
 *     responses:
 *       200:
 *         description: Current prices retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       symbol:
 *                         type: string
 *                       price:
 *                         type: number
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       exchange:
 *                         type: string
 *       500:
 *         description: Failed to fetch prices
 */
router.get('/prices', krakenController.getCurrentPrices.bind(krakenController));

/**
 * @swagger
 * /api/v1/exchanges/kraken/historical:
 *   get:
 *     summary: Get historical price data from Kraken
 *     tags: [Kraken Exchange]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *         description: Cryptocurrency symbol (e.g. XXBTZUSD)
 *       - in: query
 *         name: interval
 *         schema:
 *           type: string
 *           default: "3600"
 *         description: Time interval in seconds
 *       - in: query
 *         name: limit
 *         schema:
 *           type: string
 *           default: "100"
 *         description: Number of data points to return
 *     responses:
 *       200:
 *         description: Historical data retrieved successfully
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
 *                     type: object
 *                     properties:
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       open:
 *                         type: number
 *                       high:
 *                         type: number
 *                       low:
 *                         type: number
 *                       close:
 *                         type: number
 *                       volume:
 *                         type: number
 *       400:
 *         description: Missing symbol parameter
 *       500:
 *         description: Failed to fetch historical data
 */
router.get('/historical', krakenController.getHistoricalPrices.bind(krakenController));

/**
 * @swagger
 * /api/v1/exchanges/kraken/info:
 *   get:
 *     summary: Get Kraken exchange information
 *     tags: [Kraken Exchange]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Exchange information retrieved successfully
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
 *                     timezone:
 *                       type: string
 *                     serverTime:
 *                       type: string
 *                       format: date-time
 *                     tradingPairs:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           symbol:
 *                             type: string
 *                           baseAsset:
 *                             type: string
 *                           quoteAsset:
 *                             type: string
 *                           status:
 *                             type: string
 *                           minOrderSize:
 *                             type: number
 *                           tickSize:
 *                             type: number
 *                     totalPairs:
 *                       type: number
 *       500:
 *         description: Failed to fetch exchange info
 */
router.get('/info', krakenController.getExchangeInfo.bind(krakenController));

/**
 * @swagger
 * /api/v1/exchanges/kraken/credentials:
 *   post:
 *     summary: Save Kraken API credentials
 *     tags: [Kraken Exchange]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - apiKey
 *               - apiSecret
 *             properties:
 *               apiKey:
 *                 type: string
 *                 description: Kraken API key
 *               apiSecret:
 *                 type: string
 *                 description: Kraken API secret
 *     responses:
 *       200:
 *         description: Credentials saved successfully
 *       400:
 *         description: Invalid credentials or validation failed
 *       401:
 *         description: User not authenticated
 *       500:
 *         description: Failed to save credentials
 *   get:
 *     summary: Get Kraken credential status
 *     tags: [Kraken Exchange]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Credential status retrieved successfully
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
 *                     hasCredentials:
 *                       type: boolean
 *                     exchange:
 *                       type: string
 *                     status:
 *                       type: string
 *       401:
 *         description: User not authenticated
 *   delete:
 *     summary: Delete Kraken API credentials
 *     tags: [Kraken Exchange]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Credentials deleted successfully
 *       401:
 *         description: User not authenticated
 *       500:
 *         description: Failed to delete credentials
 */
router.post('/credentials', validateCredentials, krakenController.saveCredentials.bind(krakenController));
router.get('/credentials', krakenController.getCredentialStatus.bind(krakenController));
router.delete('/credentials', krakenController.deleteCredentials.bind(krakenController));

/**
 * @swagger
 * /api/v1/exchanges/kraken/account:
 *   get:
 *     summary: Get Kraken account information
 *     tags: [Kraken Exchange]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account information retrieved successfully
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
 *                     balances:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           asset:
 *                             type: string
 *                           balance:
 *                             type: number
 *                           available:
 *                             type: number
 *                           reserved:
 *                             type: number
 *                     accountType:
 *                       type: string
 *                     canTrade:
 *                       type: boolean
 *                     canWithdraw:
 *                       type: boolean
 *                     canDeposit:
 *                       type: boolean
 *                     updateTime:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Credentials not found or invalid
 *       401:
 *         description: User not authenticated
 *       500:
 *         description: Failed to fetch account info
 */
router.get('/account', krakenController.getAccountInfo.bind(krakenController));

/**
 * @swagger
 * /api/v1/exchanges/kraken/trades:
 *   get:
 *     summary: Get Kraken trade history
 *     tags: [Kraken Exchange]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: symbol
 *         schema:
 *           type: string
 *         description: Filter by specific trading pair
 *       - in: query
 *         name: limit
 *         schema:
 *           type: string
 *           default: "50"
 *         description: Number of trades to return
 *     responses:
 *       200:
 *         description: Trade history retrieved successfully
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
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       symbol:
 *                         type: string
 *                       side:
 *                         type: string
 *                         enum: [buy, sell]
 *                       quantity:
 *                         type: number
 *                       price:
 *                         type: number
 *                       commission:
 *                         type: number
 *                       commissionAsset:
 *                         type: string
 *                       time:
 *                         type: string
 *                         format: date-time
 *                       isMaker:
 *                         type: boolean
 *       400:
 *         description: Credentials not found or invalid
 *       401:
 *         description: User not authenticated
 *       500:
 *         description: Failed to fetch trade history
 */
router.get('/trades', krakenController.getTradeHistory.bind(krakenController));

/**
 * @swagger
 * /api/v1/exchanges/kraken/websocket:
 *   post:
 *     summary: Setup Kraken WebSocket connection
 *     tags: [Kraken Exchange]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - symbols
 *             properties:
 *               symbols:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of symbols to subscribe to
 *     responses:
 *       200:
 *         description: WebSocket connection established
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     symbols:
 *                       type: array
 *                       items:
 *                         type: string
 *                     status:
 *                       type: string
 *       400:
 *         description: Invalid symbols array
 *       500:
 *         description: Failed to setup WebSocket connection
 */
router.post('/websocket', validateWebSocketSetup, krakenController.setupWebSocket.bind(krakenController));

export default router;