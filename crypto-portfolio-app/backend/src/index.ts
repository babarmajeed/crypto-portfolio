import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import session from 'express-session'
import passport from 'passport'
import { PrismaClient } from '@prisma/client'
import { config } from '@/config/config'
import { logger } from '@/utils/logger'
import { errorHandler } from '@/middleware/errorHandler'
import { notFoundHandler } from '@/middleware/notFoundHandler'
import { securityMiddleware } from '@/middleware/securityMiddleware'
import { rateLimiterMiddleware } from '@/middleware/rateLimiterMiddleware'
import { healthRouter } from '@/routes/health'
import { apiRouter } from '@/routes/api'

// Initialize Prisma client
const prisma = new PrismaClient()

const app = express()

// Trust proxy for rate limiting and IP detection
app.set('trust proxy', 1)

// Apply comprehensive security middleware
app.use(securityMiddleware.applySecurityMiddleware())

// Session configuration for OAuth
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}))

// Initialize Passport for OAuth
app.use(passport.initialize())
app.use(passport.session())

// Compression
app.use(compression())

// Logging
app.use(morgan('combined', { stream: { write: (message: string) => logger.info(message.trim()) } }))

// Body parsing with size limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req: any, res, buf) => {
    // Store raw body for webhook verification if needed
    req.rawBody = buf
  }
}))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Apply general API rate limiting
app.use('/api', rateLimiterMiddleware.apiLimiter)

// Health check endpoints
app.use('/health', healthRouter)

// Security info endpoint
app.get('/security', (req, res) => {
  res.status(200).json({
    success: true,
    security: {
      https: req.secure || req.headers['x-forwarded-proto'] === 'https',
      headers: {
        hsts: !!res.getHeader('Strict-Transport-Security'),
        csp: !!res.getHeader('Content-Security-Policy'),
        xframe: !!res.getHeader('X-Frame-Options'),
        xcontent: !!res.getHeader('X-Content-Type-Options'),
        xxss: !!res.getHeader('X-XSS-Protection')
      }
    }
  })
})

// API routes
app.use('/api/v1', apiRouter)

// Error handling
app.use(notFoundHandler)
app.use(errorHandler)

// Start server
const PORT = config.port || 3001

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect()
    logger.info('✅ Database connected successfully')

    const server = app.listen(PORT, () => {
      logger.info(`🚀 Crypto Portfolio Backend Server started`)
      logger.info(`📍 Environment: ${config.nodeEnv}`)
      logger.info(`🌐 Server URL: http://localhost:${PORT}`)
      logger.info(`📋 API Documentation: http://localhost:${PORT}/api/v1`)
      logger.info(`💚 Health Check: http://localhost:${PORT}/health`)
      logger.info(`🔒 Security Info: http://localhost:${PORT}/security`)
      
      // Log security features
      logger.info('🛡️  Security Features Enabled:')
      logger.info('   ✓ Helmet security headers')
      logger.info('   ✓ CORS protection')
      logger.info('   ✓ Rate limiting')
      logger.info('   ✓ SQL injection protection')
      logger.info('   ✓ XSS protection')
      logger.info('   ✓ Request sanitization')
      logger.info('   ✓ Authentication middleware')
      logger.info('   ✓ Role-based access control')
      logger.info('   ✓ Session management')
      logger.info('   ✓ OAuth2 integration')
      logger.info('   ✓ Two-factor authentication')
    })

    // Set server timeout
    server.timeout = 30000 // 30 seconds

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, starting graceful shutdown...`)
      
      server.close(async () => {
        logger.info('📴 HTTP server closed')
        
        try {
          await prisma.$disconnect()
          logger.info('📴 Database connections closed')
          
          await rateLimiterMiddleware.cleanupRateLimitEntries()
          logger.info('🧹 Rate limit entries cleaned up')
          
          logger.info('✅ Graceful shutdown completed')
          process.exit(0)
        } catch (error) {
          logger.error('❌ Error during graceful shutdown:', error)
          process.exit(1)
        }
      })
      
      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('⚠️  Forced shutdown after timeout')
        process.exit(1)
      }, 10000)
    }

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('💥 Uncaught Exception:', error)
      gracefulShutdown('UNCAUGHT_EXCEPTION')
    })

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason)
      gracefulShutdown('UNHANDLED_REJECTION')
    })

    // Setup periodic cleanup tasks
    setInterval(async () => {
      try {
        await rateLimiterMiddleware.cleanupRateLimitEntries()
        logger.info('🧹 Periodic cleanup completed')
      } catch (error) {
        logger.error('❌ Periodic cleanup failed:', error)
      }
    }, 60 * 60 * 1000) // Every hour

  } catch (error) {
    logger.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

// Start the server
startServer().catch((error) => {
  logger.error('💥 Fatal error during startup:', error)
  process.exit(1)
})

export default app