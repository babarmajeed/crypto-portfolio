import { Router } from 'express'
import { authRouter } from './auth'
import { portfoliosRouter } from './portfolios'
import { assetsRouter } from './assets'
import { transactionsRouter } from './transactions'
import { exchangesRouter } from './exchanges'
import { pricesRouter } from './prices'
import userRoutes from './users'
import preferencesRoutes from './preferences'
import securityRoutes from './security'

const apiRouter = Router()

// Mount routes
apiRouter.use('/auth', authRouter)
apiRouter.use('/portfolios', portfoliosRouter)
apiRouter.use('/assets', assetsRouter)
apiRouter.use('/transactions', transactionsRouter)
apiRouter.use('/exchanges', exchangesRouter)
apiRouter.use('/prices', pricesRouter)
apiRouter.use('/users', userRoutes)
apiRouter.use('/preferences', preferencesRoutes)
apiRouter.use('/security', securityRoutes)

export { apiRouter }