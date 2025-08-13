import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import { config } from '@/config/config'
import { logger } from '@/utils/logger'
import { errorHandler } from '@/middleware/errorHandler'
import { notFoundHandler } from '@/middleware/notFoundHandler'
import { healthRouter } from '@/routes/health'
import { apiRouter } from '@/routes/api'

const app = express()

// Security middleware
app.use(helmet())
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
})
app.use('/api', limiter)

// General middleware
app.use(compression())
app.use(morgan('combined', { stream: { write: (message: string) => logger.info(message.trim()) } }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Health check endpoint
app.use('/health', healthRouter)

// API routes
app.use('/api/v1', apiRouter)

// Error handling
app.use(notFoundHandler)
app.use(errorHandler)

const server = app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...')
  server.close(() => {
    logger.info('Process terminated')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...')
  server.close(() => {
    logger.info('Process terminated')
    process.exit(0)
  })
})

export default app