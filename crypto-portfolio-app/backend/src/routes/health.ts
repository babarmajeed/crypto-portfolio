import { Router } from 'express'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { createClient } from 'redis'
import { config } from '@/config/config'

const healthRouter = Router()

const prisma = new PrismaClient()
const redis = createClient({ url: config.redis.url })

// Basic health check
healthRouter.get('/', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
  })
})

// Detailed health check with dependencies
healthRouter.get('/detailed', async (_req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    services: {
      database: 'unknown',
      redis: 'unknown',
    },
    system: {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    },
  }

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`
    health.services.database = 'healthy'
  } catch (error) {
    health.services.database = 'unhealthy'
    health.status = 'ERROR'
  }

  // Check Redis connection
  try {
    if (!redis.isOpen) {
      await redis.connect()
    }
    await redis.ping()
    health.services.redis = 'healthy'
  } catch (error) {
    health.services.redis = 'unhealthy'
    health.status = 'ERROR'
  } finally {
    if (redis.isOpen) {
      await redis.disconnect()
    }
  }

  const statusCode = health.status === 'OK' ? 200 : 503
  res.status(statusCode).json(health)
})

// Liveness probe
healthRouter.get('/live', (_req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  })
})

// Readiness probe
healthRouter.get('/ready', async (_req, res) => {
  try {
    // Check if database is ready
    await prisma.$queryRaw`SELECT 1`
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Database not available',
    })
  }
})

export { healthRouter }