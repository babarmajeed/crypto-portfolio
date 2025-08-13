import { Router } from 'express'

const assetsRouter = Router()

// GET /api/v1/assets
assetsRouter.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    data: [],
    message: 'No assets found',
  })
})

// GET /api/v1/assets/:id
assetsRouter.get('/:id', (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Get asset endpoint not implemented yet',
  })
})

// GET /api/v1/assets/search
assetsRouter.get('/search', (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Asset search endpoint not implemented yet',
  })
})

export { assetsRouter }