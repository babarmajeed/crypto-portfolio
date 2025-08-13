import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { portfolioController } from '../controllers/portfolioController';

const portfoliosRouter = Router();

// All portfolio routes require authentication
portfoliosRouter.use(authMiddleware);

// GET /api/v1/portfolios - Get user's portfolios
portfoliosRouter.get('/', portfolioController.getUserPortfolios);

// POST /api/v1/portfolios - Create new portfolio
portfoliosRouter.post('/', portfolioController.createPortfolio);

// POST /api/v1/portfolios/sync - Sync all user portfolios
portfoliosRouter.post('/sync', portfolioController.syncUserPortfolios);

// GET /api/v1/portfolios/:portfolioId - Get specific portfolio
portfoliosRouter.get('/:portfolioId', portfolioController.getPortfolioById);

// PUT /api/v1/portfolios/:portfolioId - Update portfolio
portfoliosRouter.put('/:portfolioId', portfolioController.updatePortfolio);

// DELETE /api/v1/portfolios/:portfolioId - Delete portfolio
portfoliosRouter.delete('/:portfolioId', portfolioController.deletePortfolio);

// POST /api/v1/portfolios/:portfolioId/default - Set portfolio as default
portfoliosRouter.post('/:portfolioId/default', portfolioController.setAsDefault);

// GET /api/v1/portfolios/:portfolioId/analytics - Get portfolio analytics
portfoliosRouter.get('/:portfolioId/analytics', portfolioController.getPortfolioAnalytics);

// POST /api/v1/portfolios/:portfolioId/update-values - Update portfolio values
portfoliosRouter.post('/:portfolioId/update-values', portfolioController.updatePortfolioValues);

// GET /api/v1/portfolios/:portfolioId/holdings - Get portfolio holdings
portfoliosRouter.get('/:portfolioId/holdings', portfolioController.getPortfolioHoldings);

// POST /api/v1/portfolios/:portfolioId/snapshot - Create portfolio snapshot
portfoliosRouter.post('/:portfolioId/snapshot', portfolioController.createSnapshot);

// GET /api/v1/portfolios/:portfolioId/snapshots - Get portfolio snapshot history
portfoliosRouter.get('/:portfolioId/snapshots', portfolioController.getSnapshotHistory);

// GET /api/v1/portfolios/:portfolioId/performance - Get performance metrics
portfoliosRouter.get('/:portfolioId/performance', portfolioController.getPerformanceMetrics);

export { portfoliosRouter };