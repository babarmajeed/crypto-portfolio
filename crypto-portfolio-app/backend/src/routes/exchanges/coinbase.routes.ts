import { Router } from 'express';
import { body } from 'express-validator';
import { authenticateToken } from '../../middleware/authMiddleware';
import { coinbaseController } from '../../controllers/exchanges/coinbaseController';

const router = Router();

// Public endpoints (no authentication required)
router.get('/prices', coinbaseController.getCurrentPrices);
router.get('/prices/historical/:symbol', coinbaseController.getHistoricalPrices);
router.get('/info', coinbaseController.getExchangeInfo);
router.get('/ping', coinbaseController.testConnection);

// Protected endpoints (authentication required)
router.use(authenticateToken);

// Credentials management
router.post('/credentials', [
  body('apiKey').isString().isLength({ min: 1 }).withMessage('API key is required'),
  body('apiSecret').isString().isLength({ min: 1 }).withMessage('API secret is required'),
  body('passphrase').isString().isLength({ min: 1 }).withMessage('Passphrase is required'),
  body('sandbox').optional().isBoolean().withMessage('Sandbox must be a boolean')
], coinbaseController.saveCredentials);

router.delete('/credentials', coinbaseController.removeCredentials);

// Account endpoints
router.get('/account', coinbaseController.getAccountInfo);
router.get('/account/test', coinbaseController.testUserConnection);
router.post('/account/sync', coinbaseController.syncBalances);

// Trading history
router.get('/history', coinbaseController.importTradingHistory);

export default router;