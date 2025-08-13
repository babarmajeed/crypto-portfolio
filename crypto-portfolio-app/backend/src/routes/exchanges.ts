import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { exchangeController } from '../controllers/exchangeController';

const exchangesRouter = Router();

// GET /api/v1/exchanges - Get all exchanges (public)
exchangesRouter.get('/', exchangeController.getAllExchanges);

// GET /api/v1/exchanges/:exchangeId - Get exchange by ID (public)
exchangesRouter.get('/:exchangeId', exchangeController.getExchangeById);

// GET /api/v1/exchanges/:exchangeId/trading-pairs - Get exchange trading pairs (public)
exchangesRouter.get('/:exchangeId/trading-pairs', exchangeController.getExchangeTradingPairs);

// GET /api/v1/exchanges/:exchangeId/stats - Get exchange statistics (public)
exchangesRouter.get('/:exchangeId/stats', exchangeController.getExchangeStats);

// Protected routes require authentication
exchangesRouter.use(authMiddleware);

// POST /api/v1/exchanges - Create new exchange (Admin only)
exchangesRouter.post('/', exchangeController.createExchange);

// PUT /api/v1/exchanges/:exchangeId/status - Update exchange status (Admin only)
exchangesRouter.put('/:exchangeId/status', exchangeController.updateExchangeStatus);

// GET /api/v1/exchanges/user/connected - Get user's connected exchanges
exchangesRouter.get('/user/connected', exchangeController.getUserExchanges);

// POST /api/v1/exchanges/user/sync-all - Sync all user exchanges
exchangesRouter.post('/user/sync-all', exchangeController.syncAllUserExchanges);

// POST /api/v1/exchanges/:exchangeId/credentials - Add user credentials
exchangesRouter.post('/:exchangeId/credentials', exchangeController.addUserCredentials);

// PUT /api/v1/exchanges/:exchangeId/credentials - Update user credentials
exchangesRouter.put('/:exchangeId/credentials', exchangeController.updateUserCredentials);

// DELETE /api/v1/exchanges/:exchangeId/credentials - Remove user credentials
exchangesRouter.delete('/:exchangeId/credentials', exchangeController.removeUserCredentials);

// POST /api/v1/exchanges/:exchangeId/test-connection - Test API connection
exchangesRouter.post('/:exchangeId/test-connection', exchangeController.testConnection);

// POST /api/v1/exchanges/:exchangeId/sync - Sync data from exchange
exchangesRouter.post('/:exchangeId/sync', exchangeController.syncExchangeData);

// GET /api/v1/exchanges/:exchangeId/credentials/status - Get credential status
exchangesRouter.get('/:exchangeId/credentials/status', exchangeController.getCredentialStatus);

export { exchangesRouter };