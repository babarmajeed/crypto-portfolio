import { Router } from 'express'
import { exchangeController } from '@/controllers/exchangeController'
import { authMiddleware } from '@/middleware/authMiddleware'
import { validate, validateMultiple } from '@/middleware/validation.middleware'
import { rateLimiterMiddleware } from '@/middleware/rateLimiterMiddleware'
import { 
  addExchangeCredentialsSchema,
  updateExchangeCredentialsSchema,
  exchangeParamsSchema,
  credentialsParamsSchema,
  syncDataSchema
} from '@/schemas/exchange.schema'

const router = Router()

// Apply authentication to all exchange routes
router.use(authMiddleware.authenticate)

/**
 * @swagger
 * /exchanges:
 *   get:
 *     tags: [Exchanges]
 *     summary: List supported exchanges
 *     description: Get list of all supported cryptocurrency exchanges
 *     responses:
 *       200:
 *         description: Supported exchanges retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "binance"
 *                       name:
 *                         type: string
 *                         example: "Binance"
 *                       displayName:
 *                         type: string
 *                         example: "Binance Exchange"
 *                       logo:
 *                         type: string
 *                         example: "https://logo.clearbit.com/binance.com"
 *                       features:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["spot", "futures", "staking"]
 *                       supportedOperations:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["fetchBalance", "fetchTrades", "fetchOrders"]
 *                       isActive:
 *                         type: boolean
 *                         example: true
 *                       rateLimit:
 *                         type: object
 *                         properties:
 *                           requests:
 *                             type: number
 *                           period:
 *                             type: string
 *                       apiDocumentation:
 *                         type: string
 *                         example: "https://binance-docs.github.io/apidocs/"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/', exchangeController.getSupportedExchanges)

/**
 * @swagger
 * /exchanges/credentials:
 *   get:
 *     tags: [Exchanges]
 *     summary: List user exchange credentials
 *     description: Get list of user's connected exchange credentials (masked for security)
 *     responses:
 *       200:
 *         description: Exchange credentials retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       exchangeId:
 *                         type: string
 *                         example: "binance"
 *                       exchangeName:
 *                         type: string
 *                         example: "Binance"
 *                       label:
 *                         type: string
 *                         example: "Main Trading Account"
 *                       apiKeyMasked:
 *                         type: string
 *                         example: "ABC***XYZ"
 *                       isActive:
 *                         type: boolean
 *                         example: true
 *                       permissions:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["read", "trade"]
 *                       lastSyncAt:
 *                         type: string
 *                         format: date-time
 *                       status:
 *                         type: string
 *                         enum: [connected, error, expired]
 *                         example: "connected"
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/credentials', exchangeController.getUserCredentials)

/**
 * @swagger
 * /exchanges/credentials:
 *   post:
 *     tags: [Exchanges]
 *     summary: Add exchange credentials
 *     description: Add new exchange API credentials for the user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - exchangeId
 *               - apiKey
 *               - apiSecret
 *             properties:
 *               exchangeId:
 *                 type: string
 *                 example: "binance"
 *               label:
 *                 type: string
 *                 example: "Main Trading Account"
 *                 description: Optional label for the credentials
 *               apiKey:
 *                 type: string
 *                 example: "your_api_key_here"
 *               apiSecret:
 *                 type: string
 *                 example: "your_api_secret_here"
 *               passphrase:
 *                 type: string
 *                 example: "your_passphrase_here"
 *                 description: Required for some exchanges like Coinbase Pro
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [read, trade, withdraw]
 *                 example: ["read", "trade"]
 *                 description: API key permissions
 *               testMode:
 *                 type: boolean
 *                 default: false
 *                 description: Whether to use sandbox/testnet environment
 *     responses:
 *       201:
 *         description: Exchange credentials added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Exchange credentials added successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     exchangeId:
 *                       type: string
 *                     label:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: "connected"
 *                     testConnection:
 *                       type: object
 *                       properties:
 *                         success:
 *                           type: boolean
 *                         message:
 *                           type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       409:
 *         description: Credentials for this exchange already exist
 */
router.post('/credentials', validate(addExchangeCredentialsSchema), exchangeController.addCredentials)

/**
 * @swagger
 * /exchanges/credentials/{credentialId}:
 *   get:
 *     tags: [Exchanges]
 *     summary: Get exchange credential details
 *     description: Get detailed information about specific exchange credentials
 *     parameters:
 *       - in: path
 *         name: credentialId
 *         required: true
 *         schema:
 *           type: string
 *         description: Credential ID
 *     responses:
 *       200:
 *         description: Credential details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     exchangeId:
 *                       type: string
 *                     exchangeName:
 *                       type: string
 *                     label:
 *                       type: string
 *                     apiKeyMasked:
 *                       type: string
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *                     status:
 *                       type: string
 *                     lastSyncAt:
 *                       type: string
 *                       format: date-time
 *                     testMode:
 *                       type: boolean
 *                     connectionHealth:
 *                       type: object
 *                       properties:
 *                         isConnected:
 *                           type: boolean
 *                         lastChecked:
 *                           type: string
 *                           format: date-time
 *                         errorMessage:
 *                           type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Credentials not found
 */
router.get('/credentials/:credentialId', validate(credentialsParamsSchema, 'params'), exchangeController.getCredentialDetails)

/**
 * @swagger
 * /exchanges/credentials/{credentialId}:
 *   put:
 *     tags: [Exchanges]
 *     summary: Update exchange credentials
 *     description: Update existing exchange credentials
 *     parameters:
 *       - in: path
 *         name: credentialId
 *         required: true
 *         schema:
 *           type: string
 *         description: Credential ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label:
 *                 type: string
 *                 example: "Updated Label"
 *               apiKey:
 *                 type: string
 *                 example: "new_api_key_here"
 *               apiSecret:
 *                 type: string
 *                 example: "new_api_secret_here"
 *               passphrase:
 *                 type: string
 *                 example: "new_passphrase_here"
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["read", "trade"]
 *               isActive:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Credentials updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Credentials updated successfully
 *                 data:
 *                   type: object
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Credentials not found
 */
router.put(
  '/credentials/:credentialId',
  validateMultiple({
    params: credentialsParamsSchema,
    body: updateExchangeCredentialsSchema
  }),
  exchangeController.updateCredentials
)

/**
 * @swagger
 * /exchanges/credentials/{credentialId}:
 *   delete:
 *     tags: [Exchanges]
 *     summary: Remove exchange credentials
 *     description: Permanently remove exchange credentials
 *     parameters:
 *       - in: path
 *         name: credentialId
 *         required: true
 *         schema:
 *           type: string
 *         description: Credential ID
 *     responses:
 *       200:
 *         description: Credentials removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Credentials removed successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Credentials not found
 */
router.delete('/credentials/:credentialId', validate(credentialsParamsSchema, 'params'), exchangeController.removeCredentials)

/**
 * @swagger
 * /exchanges/credentials/{credentialId}/test:
 *   post:
 *     tags: [Exchanges]
 *     summary: Test exchange connection
 *     description: Test the connection to an exchange using stored credentials
 *     parameters:
 *       - in: path
 *         name: credentialId
 *         required: true
 *         schema:
 *           type: string
 *         description: Credential ID
 *     responses:
 *       200:
 *         description: Connection test completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     connected:
 *                       type: boolean
 *                       example: true
 *                     message:
 *                       type: string
 *                       example: "Connection successful"
 *                     exchangeInfo:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                         permissions:
 *                           type: array
 *                           items:
 *                             type: string
 *                         accountInfo:
 *                           type: object
 *                     testResults:
 *                       type: object
 *                       properties:
 *                         balanceAccess:
 *                           type: boolean
 *                         orderAccess:
 *                           type: boolean
 *                         tradeAccess:
 *                           type: boolean
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Credentials not found
 */
router.post('/credentials/:credentialId/test', validate(credentialsParamsSchema, 'params'), exchangeController.testConnection)

/**
 * @swagger
 * /exchanges/sync:
 *   post:
 *     tags: [Exchanges]
 *     summary: Sync exchange data
 *     description: Sync portfolio data from connected exchanges
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               exchangeIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["binance", "coinbase"]
 *                 description: Specific exchanges to sync (optional - syncs all if not provided)
 *               dataTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [balances, trades, orders, deposits, withdrawals]
 *                 example: ["balances", "trades"]
 *                 description: Types of data to sync
 *               force:
 *                 type: boolean
 *                 default: false
 *                 description: Force sync even if recently synced
 *     responses:
 *       200:
 *         description: Sync initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Data sync initiated
 *                 data:
 *                   type: object
 *                   properties:
 *                     syncId:
 *                       type: string
 *                       example: "sync_123456"
 *                     status:
 *                       type: string
 *                       example: "in_progress"
 *                     exchanges:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           exchangeId:
 *                             type: string
 *                           status:
 *                             type: string
 *                           estimatedTime:
 *                             type: number
 *                     estimatedCompletion:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         description: Sync rate limit exceeded
 */
router.post(
  '/sync',
  rateLimiterMiddleware.exchangeSyncLimiter,
  validate(syncDataSchema),
  exchangeController.syncData
)

/**
 * @swagger
 * /exchanges/sync/{syncId}/status:
 *   get:
 *     tags: [Exchanges]
 *     summary: Get sync status
 *     description: Get the status of a data synchronization operation
 *     parameters:
 *       - in: path
 *         name: syncId
 *         required: true
 *         schema:
 *           type: string
 *         description: Sync operation ID
 *     responses:
 *       200:
 *         description: Sync status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     syncId:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [pending, in_progress, completed, failed, partial]
 *                       example: "completed"
 *                     progress:
 *                       type: number
 *                       example: 100
 *                       description: Progress percentage (0-100)
 *                     startedAt:
 *                       type: string
 *                       format: date-time
 *                     completedAt:
 *                       type: string
 *                       format: date-time
 *                     exchanges:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           exchangeId:
 *                             type: string
 *                           status:
 *                             type: string
 *                           recordsProcessed:
 *                             type: number
 *                           errors:
 *                             type: array
 *                             items:
 *                               type: string
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalRecords:
 *                           type: number
 *                         successfulRecords:
 *                           type: number
 *                         failedRecords:
 *                           type: number
 *                         newPortfolios:
 *                           type: number
 *                         updatedHoldings:
 *                           type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Sync operation not found
 */
router.get('/sync/:syncId/status', exchangeController.getSyncStatus)

/**
 * @swagger
 * /exchanges/{exchangeId}/pairs:
 *   get:
 *     tags: [Exchanges]
 *     summary: Get exchange trading pairs
 *     description: Get available trading pairs for a specific exchange
 *     parameters:
 *       - in: path
 *         name: exchangeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Exchange ID
 *       - in: query
 *         name: base
 *         schema:
 *           type: string
 *         description: Filter by base currency
 *       - in: query
 *         name: quote
 *         schema:
 *           type: string
 *         description: Filter by quote currency
 *     responses:
 *       200:
 *         description: Trading pairs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       symbol:
 *                         type: string
 *                         example: "BTC/USDT"
 *                       base:
 *                         type: string
 *                         example: "BTC"
 *                       quote:
 *                         type: string
 *                         example: "USDT"
 *                       active:
 *                         type: boolean
 *                       precision:
 *                         type: object
 *                         properties:
 *                           amount:
 *                             type: number
 *                           price:
 *                             type: number
 *                       limits:
 *                         type: object
 *                         properties:
 *                           amount:
 *                             type: object
 *                             properties:
 *                               min:
 *                                 type: number
 *                               max:
 *                                 type: number
 *                           price:
 *                             type: object
 *                             properties:
 *                               min:
 *                                 type: number
 *                               max:
 *                                 type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Exchange not found
 */
router.get('/:exchangeId/pairs', validate(exchangeParamsSchema, 'params'), exchangeController.getTradingPairs)

export default router