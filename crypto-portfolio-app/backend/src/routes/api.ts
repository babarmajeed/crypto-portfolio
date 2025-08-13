import { Router } from 'express'
import { requestLoggingMiddleware, securityLoggingMiddleware } from '@/middleware/logging.middleware'
import v1Routes from './v1'
import rateLimitRoutes from './rateLimit.routes'

const apiRouter = Router()

// Apply logging middleware to all API routes
apiRouter.use(requestLoggingMiddleware)
apiRouter.use(securityLoggingMiddleware)

/**
 * @swagger
 * /api:
 *   get:
 *     tags: [System]
 *     summary: API Information
 *     description: Get API version information and available endpoints
 *     security: []
 *     responses:
 *       200:
 *         description: API information retrieved successfully
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
 *                     name:
 *                       type: string
 *                       example: "Crypto Portfolio API"
 *                     version:
 *                       type: string
 *                       example: "1.0.0"
 *                     description:
 *                       type: string
 *                       example: "REST API for cryptocurrency portfolio management"
 *                     versions:
 *                       type: object
 *                       properties:
 *                         v1:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                               example: "stable"
 *                             basePath:
 *                               type: string
 *                               example: "/api/v1"
 *                             documentation:
 *                               type: string
 *                               example: "/api/v1/docs"
 *                     features:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example:
 *                         - "JWT Authentication"
 *                         - "Two-Factor Authentication"
 *                         - "Portfolio Management"
 *                         - "Exchange Integration"
 *                         - "Real-time Market Data"
 *                         - "Analytics & Reporting"
 *                     rateLimit:
 *                       type: object
 *                       properties:
 *                         requests:
 *                           type: number
 *                           example: 100
 *                         period:
 *                           type: string
 *                           example: "15 minutes"
 *                     contact:
 *                       type: object
 *                       properties:
 *                         email:
 *                           type: string
 *                           example: "support@cryptoportfolio.dev"
 *                         documentation:
 *                           type: string
 *                           example: "https://docs.cryptoportfolio.dev"
 */
apiRouter.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      name: 'Crypto Portfolio API',
      version: '1.0.0',
      description: 'REST API for cryptocurrency portfolio management',
      versions: {
        v1: {
          status: 'stable',
          basePath: '/api/v1',
          documentation: '/api/v1/docs'
        }
      },
      features: [
        'JWT Authentication with 2FA',
        'Comprehensive Portfolio Management',
        'Multi-Exchange Integration',
        'Real-time Market Data',
        'Advanced Analytics & Risk Assessment',
        'Secure API Key Management',
        'Automated Data Synchronization',
        'Performance Tracking & Benchmarking'
      ],
      rateLimit: {
        requests: 100,
        period: '15 minutes'
      },
      security: {
        encryption: 'AES-256-GCM',
        authentication: 'JWT with RS256',
        twoFactor: 'TOTP',
        dataProtection: 'GDPR Compliant'
      },
      contact: {
        email: 'support@cryptoportfolio.dev',
        documentation: '/api/v1/docs',
        status: '/health'
      },
      timestamp: new Date().toISOString()
    }
  })
})

// Mount API versions
apiRouter.use('/v1', v1Routes)

// Mount admin routes
apiRouter.use('/admin/rate-limits', rateLimitRoutes)

// Handle unknown API versions
apiRouter.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API Version Not Found',
    message: `API version not found. Available versions: v1`,
    code: 'API_VERSION_NOT_FOUND',
    availableVersions: ['v1'],
    requestedPath: req.originalUrl
  })
})

export { apiRouter }