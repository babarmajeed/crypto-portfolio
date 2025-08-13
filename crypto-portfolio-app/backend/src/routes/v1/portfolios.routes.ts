import { Router } from 'express'
import { portfolioController } from '@/controllers/portfolioController'
import { authMiddleware } from '@/middleware/authMiddleware'
import { validate, validateMultiple } from '@/middleware/validation.middleware'
import { 
  createPortfolioSchema,
  updatePortfolioSchema,
  addHoldingSchema,
  updateHoldingSchema,
  portfolioParamsSchema,
  holdingParamsSchema,
  paginationQuerySchema
} from '@/schemas/portfolio.schema'

const router = Router()

// Apply authentication to all portfolio routes
router.use(authMiddleware.authenticate)

/**
 * @swagger
 * /portfolios:
 *   get:
 *     tags: [Portfolios]
 *     summary: List user portfolios
 *     description: Retrieve all portfolios owned by the authenticated user
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [name, createdAt, -name, -createdAt, totalValue, -totalValue]
 *           default: -createdAt
 *         description: Sort field and direction
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search portfolios by name or description
 *     responses:
 *       200:
 *         description: Portfolios retrieved successfully
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
 *                       name:
 *                         type: string
 *                         example: "Main Portfolio"
 *                       description:
 *                         type: string
 *                         example: "My primary investment portfolio"
 *                       totalValue:
 *                         type: number
 *                         example: 50000.00
 *                       currency:
 *                         type: string
 *                         example: "USD"
 *                       holdingsCount:
 *                         type: integer
 *                         example: 15
 *                       performance24h:
 *                         type: number
 *                         example: 2.5
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/', validate(paginationQuerySchema, 'query'), portfolioController.getPortfolios)

/**
 * @swagger
 * /portfolios:
 *   post:
 *     tags: [Portfolios]
 *     summary: Create new portfolio
 *     description: Create a new portfolio for the authenticated user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "DeFi Portfolio"
 *               description:
 *                 type: string
 *                 example: "Portfolio focused on DeFi tokens"
 *               currency:
 *                 type: string
 *                 default: "USD"
 *                 example: "USD"
 *               isPublic:
 *                 type: boolean
 *                 default: false
 *                 example: false
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["defi", "ethereum", "yield-farming"]
 *     responses:
 *       201:
 *         description: Portfolio created successfully
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
 *                   example: Portfolio created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     currency:
 *                       type: string
 *                     isPublic:
 *                       type: boolean
 *                     tags:
 *                       type: array
 *                       items:
 *                         type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/', validate(createPortfolioSchema), portfolioController.createPortfolio)

/**
 * @swagger
 * /portfolios/{portfolioId}:
 *   get:
 *     tags: [Portfolios]
 *     summary: Get portfolio details
 *     description: Retrieve detailed information about a specific portfolio
 *     parameters:
 *       - in: path
 *         name: portfolioId
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio ID
 *     responses:
 *       200:
 *         description: Portfolio details retrieved successfully
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
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     currency:
 *                       type: string
 *                     isPublic:
 *                       type: boolean
 *                     totalValue:
 *                       type: number
 *                     totalCost:
 *                       type: number
 *                     totalGainLoss:
 *                       type: number
 *                     totalGainLossPercentage:
 *                       type: number
 *                     holdings:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           symbol:
 *                             type: string
 *                           name:
 *                             type: string
 *                           quantity:
 *                             type: number
 *                           averagePrice:
 *                             type: number
 *                           currentPrice:
 *                             type: number
 *                           value:
 *                             type: number
 *                           gainLoss:
 *                             type: number
 *                           gainLossPercentage:
 *                             type: number
 *                     performance:
 *                       type: object
 *                       properties:
 *                         '24h':
 *                           type: number
 *                         '7d':
 *                           type: number
 *                         '30d':
 *                           type: number
 *                         '1y':
 *                           type: number
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Portfolio not found
 */
router.get('/:portfolioId', validate(portfolioParamsSchema, 'params'), portfolioController.getPortfolio)

/**
 * @swagger
 * /portfolios/{portfolioId}:
 *   put:
 *     tags: [Portfolios]
 *     summary: Update portfolio
 *     description: Update portfolio information
 *     parameters:
 *       - in: path
 *         name: portfolioId
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Portfolio Name"
 *               description:
 *                 type: string
 *                 example: "Updated description"
 *               isPublic:
 *                 type: boolean
 *                 example: true
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["bitcoin", "ethereum", "altcoins"]
 *     responses:
 *       200:
 *         description: Portfolio updated successfully
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
 *                   example: Portfolio updated successfully
 *                 data:
 *                   type: object
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Portfolio not found
 */
router.put(
  '/:portfolioId',
  validateMultiple({
    params: portfolioParamsSchema,
    body: updatePortfolioSchema
  }),
  portfolioController.updatePortfolio
)

/**
 * @swagger
 * /portfolios/{portfolioId}:
 *   delete:
 *     tags: [Portfolios]
 *     summary: Delete portfolio
 *     description: Permanently delete a portfolio and all its holdings
 *     parameters:
 *       - in: path
 *         name: portfolioId
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio ID
 *     responses:
 *       200:
 *         description: Portfolio deleted successfully
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
 *                   example: Portfolio deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Portfolio not found
 */
router.delete('/:portfolioId', validate(portfolioParamsSchema, 'params'), portfolioController.deletePortfolio)

/**
 * @swagger
 * /portfolios/{portfolioId}/holdings:
 *   get:
 *     tags: [Portfolios]
 *     summary: Get portfolio holdings
 *     description: Retrieve all holdings in a specific portfolio
 *     parameters:
 *       - in: path
 *         name: portfolioId
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio ID
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [symbol, value, -symbol, -value, gainLoss, -gainLoss]
 *           default: -value
 *         description: Sort holdings by field
 *     responses:
 *       200:
 *         description: Holdings retrieved successfully
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
 *                       symbol:
 *                         type: string
 *                         example: "BTC"
 *                       name:
 *                         type: string
 *                         example: "Bitcoin"
 *                       quantity:
 *                         type: number
 *                         example: 1.5
 *                       averagePrice:
 *                         type: number
 *                         example: 45000.00
 *                       currentPrice:
 *                         type: number
 *                         example: 50000.00
 *                       value:
 *                         type: number
 *                         example: 75000.00
 *                       gainLoss:
 *                         type: number
 *                         example: 7500.00
 *                       gainLossPercentage:
 *                         type: number
 *                         example: 11.11
 *                       allocation:
 *                         type: number
 *                         example: 60.5
 *                         description: Percentage of total portfolio value
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Portfolio not found
 */
router.get('/:portfolioId/holdings', validate(portfolioParamsSchema, 'params'), portfolioController.getHoldings)

/**
 * @swagger
 * /portfolios/{portfolioId}/holdings:
 *   post:
 *     tags: [Portfolios]
 *     summary: Add holding to portfolio
 *     description: Add a new cryptocurrency holding to the portfolio
 *     parameters:
 *       - in: path
 *         name: portfolioId
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - symbol
 *               - quantity
 *               - averagePrice
 *             properties:
 *               symbol:
 *                 type: string
 *                 example: "ETH"
 *               quantity:
 *                 type: number
 *                 minimum: 0
 *                 example: 10.5
 *               averagePrice:
 *                 type: number
 *                 minimum: 0
 *                 example: 3500.00
 *               notes:
 *                 type: string
 *                 example: "Bought during the dip"
 *     responses:
 *       201:
 *         description: Holding added successfully
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
 *                   example: Holding added successfully
 *                 data:
 *                   type: object
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Portfolio not found
 */
router.post(
  '/:portfolioId/holdings',
  validateMultiple({
    params: portfolioParamsSchema,
    body: addHoldingSchema
  }),
  portfolioController.addHolding
)

/**
 * @swagger
 * /portfolios/{portfolioId}/holdings/{holdingId}:
 *   put:
 *     tags: [Portfolios]
 *     summary: Update holding
 *     description: Update an existing holding in the portfolio
 *     parameters:
 *       - in: path
 *         name: portfolioId
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio ID
 *       - in: path
 *         name: holdingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Holding ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quantity:
 *                 type: number
 *                 minimum: 0
 *                 example: 12.0
 *               averagePrice:
 *                 type: number
 *                 minimum: 0
 *                 example: 3400.00
 *               notes:
 *                 type: string
 *                 example: "Updated after additional purchase"
 *     responses:
 *       200:
 *         description: Holding updated successfully
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
 *                   example: Holding updated successfully
 *                 data:
 *                   type: object
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Portfolio or holding not found
 */
router.put(
  '/:portfolioId/holdings/:holdingId',
  validateMultiple({
    params: holdingParamsSchema,
    body: updateHoldingSchema
  }),
  portfolioController.updateHolding
)

/**
 * @swagger
 * /portfolios/{portfolioId}/holdings/{holdingId}:
 *   delete:
 *     tags: [Portfolios]
 *     summary: Remove holding
 *     description: Remove a holding from the portfolio
 *     parameters:
 *       - in: path
 *         name: portfolioId
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio ID
 *       - in: path
 *         name: holdingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Holding ID
 *     responses:
 *       200:
 *         description: Holding removed successfully
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
 *                   example: Holding removed successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Portfolio or holding not found
 */
router.delete('/:portfolioId/holdings/:holdingId', validate(holdingParamsSchema, 'params'), portfolioController.removeHolding)

/**
 * @swagger
 * /portfolios/{portfolioId}/performance:
 *   get:
 *     tags: [Portfolios]
 *     summary: Get portfolio performance
 *     description: Retrieve detailed performance metrics for a portfolio
 *     parameters:
 *       - in: path
 *         name: portfolioId
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio ID
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [24h, 7d, 30d, 90d, 1y, all]
 *           default: 30d
 *         description: Performance period
 *     responses:
 *       200:
 *         description: Performance data retrieved successfully
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
 *                     currentValue:
 *                       type: number
 *                       example: 75000.00
 *                     initialValue:
 *                       type: number
 *                       example: 50000.00
 *                     gainLoss:
 *                       type: number
 *                       example: 25000.00
 *                     gainLossPercentage:
 *                       type: number
 *                       example: 50.0
 *                     highestValue:
 *                       type: number
 *                       example: 80000.00
 *                     lowestValue:
 *                       type: number
 *                       example: 45000.00
 *                     volatility:
 *                       type: number
 *                       example: 15.5
 *                     sharpeRatio:
 *                       type: number
 *                       example: 1.2
 *                     historicalData:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           value:
 *                             type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Portfolio not found
 */
router.get('/:portfolioId/performance', validate(portfolioParamsSchema, 'params'), portfolioController.getPerformance)

export default router