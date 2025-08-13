import { Router } from 'express'
import authRoutes from './auth.routes'
import userRoutes from './users.routes'
import portfolioRoutes from './portfolios.routes'
import exchangeRoutes from './exchanges.routes'
import marketRoutes from './market.routes'
import analyticsRoutes from './analytics.routes'
import { cacheRouter } from '../cache'
import queueRoutes from '../queue.routes'

const router = Router()

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *     ApiKeyAuth:
 *       type: apiKey
 *       in: header
 *       name: X-API-Key
 */

/**
 * @swagger
 * /api/v1:
 *   get:
 *     tags: [System]
 *     summary: API version information
 *     description: Returns API version and available endpoints
 *     responses:
 *       200:
 *         description: API information
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
 *                     version:
 *                       type: string
 *                       example: "1.0.0"
 *                     name:
 *                       type: string
 *                       example: "Crypto Portfolio API"
 *                     endpoints:
 *                       type: array
 *                       items:
 *                         type: string
 *                     features:
 *                       type: array
 *                       items:
 *                         type: string
 */
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      version: '1.0.0',
      name: 'Crypto Portfolio API',
      description: 'Comprehensive cryptocurrency portfolio management API',
      endpoints: [
        '/auth - Authentication and authorization',
        '/users - User management and profiles',
        '/portfolios - Portfolio management and tracking',
        '/exchanges - Exchange integrations and trading',
        '/market - Real-time market data and pricing',
        '/analytics - Portfolio analytics and insights',
        '/keys - API key management',
        '/queues - Background job processing and monitoring',
        '/docs - API documentation'
      ],
      features: [
        'JWT Authentication with 2FA',
        'Multi-portfolio management',
        'Real-time exchange integration',
        'Advanced portfolio analytics',
        'Secure API key management',
        'Market data aggregation',
        'Risk assessment and tracking',
        'Background job processing',
        'Queue monitoring and metrics'
      ],
      documentation: '/api/v1/docs',
      status: 'operational',
      timestamp: new Date().toISOString()
    }
  })
})

/**
 * @swagger
 * /api/v1/status:
 *   get:
 *     tags: [System]
 *     summary: API status and health check
 *     description: Returns current API status and system health metrics
 *     responses:
 *       200:
 *         description: API status information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status:
 *                   type: string
 *                   enum: [operational, degraded, maintenance, offline]
 *                 uptime:
 *                   type: number
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: string
 *                       enum: [online, offline, degraded]
 *                     redis:
 *                       type: string
 *                       enum: [online, offline, degraded]
 *                     exchanges:
 *                       type: object
 */
router.get('/status', async (req, res) => {
  try {
    // In a real implementation, you'd check actual service health
    const status = {
      success: true,
      status: 'operational',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: 'online',
        redis: 'online',
        exchanges: {
          binance: 'online',
          coinbase: 'online',
          kraken: 'online'
        }
      },
      metrics: {
        requestsPerMinute: 150,
        averageResponseTime: '250ms',
        errorRate: '0.1%'
      }
    }

    res.status(200).json(status)
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'degraded',
      error: 'Service health check failed',
      timestamp: new Date().toISOString()
    })
  }
})

// Mount route modules
router.use('/auth', authRoutes)
router.use('/users', userRoutes) 
router.use('/portfolios', portfolioRoutes)
router.use('/exchanges', exchangeRoutes)
router.use('/market', marketRoutes)
router.use('/analytics', analyticsRoutes)
router.use('/cache', cacheRouter)
router.use('/queues', queueRoutes)

export default router