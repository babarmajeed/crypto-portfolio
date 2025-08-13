import { Router } from 'express'
import { priceController } from '@/controllers/priceController'
import { authMiddleware } from '@/middleware/authMiddleware'
import { validate } from '@/middleware/validation.middleware'
import { rateLimiterMiddleware } from '@/middleware/rateLimiterMiddleware'
import { 
  pricesQuerySchema,
  historicalDataQuerySchema,
  symbolParamsSchema,
  marketStatsQuerySchema
} from '@/schemas/common.schema'

const router = Router()

// Apply authentication to all market routes
router.use(authMiddleware.authenticate)

/**
 * @swagger
 * /market/prices:
 *   get:
 *     tags: [Market Data]
 *     summary: Get current cryptocurrency prices
 *     description: Retrieve current prices for specified cryptocurrencies
 *     parameters:
 *       - in: query
 *         name: symbols
 *         schema:
 *           type: string
 *         description: Comma-separated list of symbols (e.g., BTC,ETH,ADA)
 *         example: "BTC,ETH,ADA"
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *           default: USD
 *         description: Base currency for prices
 *         example: "USD"
 *       - in: query
 *         name: includeChange
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include price change data
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
 *                   example: true
 *                 data:
 *                   type: object
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       symbol:
 *                         type: string
 *                         example: "BTC"
 *                       name:
 *                         type: string
 *                         example: "Bitcoin"
 *                       price:
 *                         type: number
 *                         example: 50000.00
 *                       currency:
 *                         type: string
 *                         example: "USD"
 *                       change24h:
 *                         type: number
 *                         example: 2.5
 *                       changePercent24h:
 *                         type: number
 *                         example: 0.05
 *                       volume24h:
 *                         type: number
 *                         example: 25000000000
 *                       marketCap:
 *                         type: number
 *                         example: 950000000000
 *                       rank:
 *                         type: integer
 *                         example: 1
 *                       lastUpdated:
 *                         type: string
 *                         format: date-time
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     source:
 *                       type: string
 *                       example: "CoinGecko"
 *                     requestedSymbols:
 *                       type: array
 *                       items:
 *                         type: string
 *                     foundSymbols:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.get(
  '/prices',
  rateLimiterMiddleware.marketDataLimiter,
  validate(pricesQuerySchema, 'query'),
  priceController.getCurrentPrices
)

/**
 * @swagger
 * /market/prices/{symbol}:
 *   get:
 *     tags: [Market Data]
 *     summary: Get detailed price information for a symbol
 *     description: Retrieve comprehensive price data for a specific cryptocurrency
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *         description: Cryptocurrency symbol
 *         example: "BTC"
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *           default: USD
 *         description: Base currency for price data
 *     responses:
 *       200:
 *         description: Price data retrieved successfully
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
 *                     symbol:
 *                       type: string
 *                       example: "BTC"
 *                     name:
 *                       type: string
 *                       example: "Bitcoin"
 *                     price:
 *                       type: number
 *                       example: 50000.00
 *                     currency:
 *                       type: string
 *                       example: "USD"
 *                     marketData:
 *                       type: object
 *                       properties:
 *                         marketCap:
 *                           type: number
 *                         volume24h:
 *                           type: number
 *                         circulatingSupply:
 *                           type: number
 *                         totalSupply:
 *                           type: number
 *                         maxSupply:
 *                           type: number
 *                     priceChanges:
 *                       type: object
 *                       properties:
 *                         '1h':
 *                           type: number
 *                         '24h':
 *                           type: number
 *                         '7d':
 *                           type: number
 *                         '30d':
 *                           type: number
 *                         '1y':
 *                           type: number
 *                     technicalIndicators:
 *                       type: object
 *                       properties:
 *                         rsi:
 *                           type: number
 *                         movingAverage50:
 *                           type: number
 *                         movingAverage200:
 *                           type: number
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Symbol not found
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.get(
  '/prices/:symbol',
  rateLimiterMiddleware.marketDataLimiter,
  validate(symbolParamsSchema, 'params'),
  priceController.getPriceDetails
)

/**
 * @swagger
 * /market/history/{symbol}:
 *   get:
 *     tags: [Market Data]
 *     summary: Get historical price data
 *     description: Retrieve historical price data for a cryptocurrency
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         schema:
 *           type: string
 *         description: Cryptocurrency symbol
 *         example: "BTC"
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [1h, 1d, 7d, 30d, 90d, 1y, all]
 *           default: 30d
 *         description: Time period for historical data
 *       - in: query
 *         name: interval
 *         schema:
 *           type: string
 *           enum: [1m, 5m, 15m, 1h, 4h, 1d]
 *           default: 1h
 *         description: Data point interval
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *           default: USD
 *         description: Base currency for historical data
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
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     symbol:
 *                       type: string
 *                       example: "BTC"
 *                     period:
 *                       type: string
 *                       example: "30d"
 *                     interval:
 *                       type: string
 *                       example: "1h"
 *                     currency:
 *                       type: string
 *                       example: "USD"
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           open:
 *                             type: number
 *                           high:
 *                             type: number
 *                           low:
 *                             type: number
 *                           close:
 *                             type: number
 *                           volume:
 *                             type: number
 *                     statistics:
 *                       type: object
 *                       properties:
 *                         high:
 *                           type: number
 *                         low:
 *                           type: number
 *                         average:
 *                           type: number
 *                         volatility:
 *                           type: number
 *                         totalReturn:
 *                           type: number
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Symbol not found
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.get(
  '/history/:symbol',
  rateLimiterMiddleware.marketDataLimiter,
  validate(symbolParamsSchema, 'params'),
  validate(historicalDataQuerySchema, 'query'),
  priceController.getHistoricalData
)

/**
 * @swagger
 * /market/trending:
 *   get:
 *     tags: [Market Data]
 *     summary: Get trending cryptocurrencies
 *     description: Retrieve list of trending cryptocurrencies based on various metrics
 *     parameters:
 *       - in: query
 *         name: metric
 *         schema:
 *           type: string
 *           enum: [price_change, volume, market_cap, social_mentions]
 *           default: price_change
 *         description: Trending metric to sort by
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d]
 *           default: 24h
 *         description: Time period for trending calculation
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of trending coins to return
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *           default: USD
 *         description: Base currency for price data
 *     responses:
 *       200:
 *         description: Trending cryptocurrencies retrieved successfully
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
 *                       rank:
 *                         type: integer
 *                         example: 1
 *                       symbol:
 *                         type: string
 *                         example: "DOGE"
 *                       name:
 *                         type: string
 *                         example: "Dogecoin"
 *                       price:
 *                         type: number
 *                         example: 0.25
 *                       changePercent:
 *                         type: number
 *                         example: 15.5
 *                       volume24h:
 *                         type: number
 *                         example: 2500000000
 *                       marketCap:
 *                         type: number
 *                         example: 35000000000
 *                       trendingScore:
 *                         type: number
 *                         example: 95.5
 *                         description: Trending score (0-100)
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     metric:
 *                       type: string
 *                     period:
 *                       type: string
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.get('/trending', validate(marketStatsQuerySchema, 'query'), priceController.getTrending)

/**
 * @swagger
 * /market/search:
 *   get:
 *     tags: [Market Data]
 *     summary: Search cryptocurrencies
 *     description: Search for cryptocurrencies by name or symbol
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *         description: Search query (name or symbol)
 *         example: "bitcoin"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Maximum number of results
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
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
 *                         example: "BTC"
 *                       name:
 *                         type: string
 *                         example: "Bitcoin"
 *                       id:
 *                         type: string
 *                         example: "bitcoin"
 *                       price:
 *                         type: number
 *                         example: 50000.00
 *                       rank:
 *                         type: integer
 *                         example: 1
 *                       logo:
 *                         type: string
 *                         example: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png"
 *                       description:
 *                         type: string
 *                         example: "Bitcoin is a cryptocurrency and worldwide payment system."
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.get('/search', priceController.searchCryptocurrencies)

/**
 * @swagger
 * /market/stats:
 *   get:
 *     tags: [Market Data]
 *     summary: Get global market statistics
 *     description: Retrieve global cryptocurrency market statistics
 *     responses:
 *       200:
 *         description: Market statistics retrieved successfully
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
 *                     totalMarketCap:
 *                       type: number
 *                       example: 2500000000000
 *                     total24hVolume:
 *                       type: number
 *                       example: 150000000000
 *                     marketCapChange24h:
 *                       type: number
 *                       example: 2.5
 *                     activeCryptocurrencies:
 *                       type: integer
 *                       example: 10000
 *                     activeMarkets:
 *                       type: integer
 *                       example: 75000
 *                     bitcoinDominance:
 *                       type: number
 *                       example: 42.5
 *                     ethereumDominance:
 *                       type: number
 *                       example: 18.5
 *                     marketCapDistribution:
 *                       type: object
 *                       properties:
 *                         top10:
 *                           type: number
 *                           example: 85.5
 *                         top50:
 *                           type: number
 *                           example: 95.2
 *                         top100:
 *                           type: number
 *                           example: 98.1
 *                     fearGreedIndex:
 *                       type: object
 *                       properties:
 *                         value:
 *                           type: integer
 *                           example: 65
 *                         classification:
 *                           type: string
 *                           example: "Greed"
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.get('/stats', priceController.getMarketStats)

/**
 * @swagger
 * /market/exchanges:
 *   get:
 *     tags: [Market Data]
 *     summary: Get exchange market data
 *     description: Retrieve market data from various exchanges
 *     parameters:
 *       - in: query
 *         name: symbol
 *         schema:
 *           type: string
 *         description: Filter by trading pair symbol
 *         example: "BTC/USDT"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of exchanges to return
 *     responses:
 *       200:
 *         description: Exchange market data retrieved successfully
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
 *                       exchange:
 *                         type: string
 *                         example: "Binance"
 *                       symbol:
 *                         type: string
 *                         example: "BTC/USDT"
 *                       price:
 *                         type: number
 *                         example: 50000.00
 *                       volume24h:
 *                         type: number
 *                         example: 1000000000
 *                       spread:
 *                         type: number
 *                         example: 0.01
 *                       lastUpdated:
 *                         type: string
 *                         format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.get('/exchanges', priceController.getExchangeData)

export default router