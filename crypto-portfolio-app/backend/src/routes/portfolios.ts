import { Router } from 'express'

const portfoliosRouter = Router()

// GET /api/v1/portfolios
portfoliosRouter.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    data: [],
    message: 'No portfolios found',
  })
})

// GET /api/v1/portfolios/:id
portfoliosRouter.get('/:id', (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Get portfolio endpoint not implemented yet',
  })
})

// POST /api/v1/portfolios
portfoliosRouter.post('/', (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Create portfolio endpoint not implemented yet',
  })
})

// PUT /api/v1/portfolios/:id
portfoliosRouter.put('/:id', (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Update portfolio endpoint not implemented yet',
  })
})

// DELETE /api/v1/portfolios/:id
portfoliosRouter.delete('/:id', (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Delete portfolio endpoint not implemented yet',
  })
})

export { portfoliosRouter }