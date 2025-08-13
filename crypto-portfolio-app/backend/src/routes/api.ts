import { Router } from 'express'
import { authRouter } from './auth'
import { portfoliosRouter } from './portfolios'
import { assetsRouter } from './assets'
import { transactionsRouter } from './transactions'

const apiRouter = Router()

// Mount routes
apiRouter.use('/auth', authRouter)
apiRouter.use('/portfolios', portfoliosRouter)
apiRouter.use('/assets', assetsRouter)
apiRouter.use('/transactions', transactionsRouter)

export { apiRouter }