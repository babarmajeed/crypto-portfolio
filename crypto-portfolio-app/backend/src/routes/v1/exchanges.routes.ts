import { Router } from 'express'
import exchangeRoutes from '../exchanges'
import { orderExecutionRoutes } from '../orderExecution.routes'
import { portfolioSyncRoutes } from '../portfolioSync.routes'

const router = Router()

// Mount all exchange routes  
router.use('/', exchangeRoutes)

// Mount order execution routes
router.use('/', orderExecutionRoutes)

// Mount portfolio sync routes
router.use('/portfolio', portfolioSyncRoutes)

// Exchange status endpoint
router.get('/status', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        supportedExchanges: ['binance', 'coinbase', 'kraken', 'kucoin'],
        status: {
          binance: 'active',
          coinbase: 'active',
          kraken: 'active', 
          kucoin: 'active'
        },
        features: [
          'Real-time price data',
          'Account balance sync',
          'Trading history import',
          'WebSocket streaming',
          'API key management',
          'Rate limiting compliance'
        ]
      },
      message: 'Exchange integration status'
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get exchange status'
    })
  }
})

export default router