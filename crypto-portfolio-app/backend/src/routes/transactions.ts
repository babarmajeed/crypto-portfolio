import { Router } from 'express'

const transactionsRouter = Router()

// GET /api/v1/transactions
transactionsRouter.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    data: [],
    message: 'No transactions found',
  })
})

// GET /api/v1/transactions/:id
transactionsRouter.get('/:id', (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Get transaction endpoint not implemented yet',
  })
})

// POST /api/v1/transactions
transactionsRouter.post('/', (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Create transaction endpoint not implemented yet',
  })
})

// PUT /api/v1/transactions/:id
transactionsRouter.put('/:id', (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Update transaction endpoint not implemented yet',
  })
})

// DELETE /api/v1/transactions/:id
transactionsRouter.delete('/:id', (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Delete transaction endpoint not implemented yet',
  })
})

export { transactionsRouter }