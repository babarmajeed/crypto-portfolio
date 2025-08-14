import { Router } from 'express';
import { body } from 'express-validator';
import { authenticateToken } from '../../middleware/authMiddleware';
import { binanceController } from '../../controllers/exchanges/binanceController';

const router = Router();

// Public endpoints (no authentication required)
router.get('/prices', binanceController.getCurrentPrices);
router.get('/prices/historical/:symbol', binanceController.getHistoricalPrices);
router.get('/info', binanceController.getExchangeInfo);
router.get('/ping', binanceController.testConnection);

// Protected endpoints (authentication required)
router.use(authenticateToken);

// Credentials management
router.post('/credentials', [
  body('apiKey').isString().isLength({ min: 1 }).withMessage('API key is required'),
  body('apiSecret').isString().isLength({ min: 1 }).withMessage('API secret is required'),
  body('sandbox').optional().isBoolean().withMessage('Sandbox must be a boolean')
], binanceController.saveCredentials);

router.delete('/credentials', binanceController.removeCredentials);

// Account endpoints
router.get('/account', binanceController.getAccountInfo);
router.get('/account/test', binanceController.testUserConnection);
router.post('/account/sync', binanceController.syncBalances);

// Trading history
router.get('/history', binanceController.importTradingHistory);

export default router;