import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { portfolioSyncController } from '../controllers/portfolioSyncController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const router = Router();

// Portfolio sync validation rules
const portfolioSyncValidation = [
  body('exchange')
    .isIn(['binance', 'coinbase', 'kraken', 'kucoin'])
    .withMessage('Exchange must be one of: binance, coinbase, kraken, kucoin'),
  body('syncType')
    .optional()
    .isIn(['full', 'balances', 'transactions', 'orders'])
    .withMessage('Sync type must be one of: full, balances, transactions, orders'),
  body('forceRefresh')
    .optional()
    .isBoolean()
    .withMessage('Force refresh must be a boolean')
];

const exchangeParamValidation = [
  param('exchange')
    .isIn(['binance', 'coinbase', 'kraken', 'kucoin'])
    .withMessage('Exchange must be one of: binance, coinbase, kraken, kucoin')
];

const forceQueryValidation = [
  query('force')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('Force parameter must be true or false')
];

const syncAllValidation = [
  body('syncType')
    .optional()
    .isIn(['full', 'balances', 'transactions', 'orders'])
    .withMessage('Sync type must be one of: full, balances, transactions, orders'),
  body('forceRefresh')
    .optional()
    .isBoolean()
    .withMessage('Force refresh must be a boolean')
];

// Apply authentication to all routes
router.use(authenticateToken);

// Sync portfolio (general endpoint)
router.post('/sync',
  rateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 syncs per minute per user
    message: 'Too many sync requests'
  }),
  portfolioSyncValidation,
  validateRequest,
  portfolioSyncController.syncPortfolio
);

// Sync balances for specific exchange
router.post('/sync/:exchange/balances',
  rateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 balance syncs per minute per user
    message: 'Too many balance sync requests'
  }),
  exchangeParamValidation,
  forceQueryValidation,
  validateRequest,
  portfolioSyncController.syncBalances
);

// Sync transactions for specific exchange
router.post('/sync/:exchange/transactions',
  rateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    max: 3, // 3 transaction syncs per minute per user
    message: 'Too many transaction sync requests'
  }),
  exchangeParamValidation,
  forceQueryValidation,
  validateRequest,
  portfolioSyncController.syncTransactions
);

// Sync orders for specific exchange
router.post('/sync/:exchange/orders',
  rateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 order syncs per minute per user
    message: 'Too many order sync requests'
  }),
  exchangeParamValidation,
  forceQueryValidation,
  validateRequest,
  portfolioSyncController.syncOrders
);

// Force full sync for specific exchange
router.post('/sync/:exchange/force-full',
  rateLimitMiddleware({
    windowMs: 300 * 1000, // 5 minutes
    max: 2, // 2 full force syncs per 5 minutes per user
    message: 'Too many force sync requests'
  }),
  exchangeParamValidation,
  validateRequest,
  portfolioSyncController.forceFullSync
);

// Sync all connected exchanges
router.post('/sync-all',
  rateLimitMiddleware({
    windowMs: 300 * 1000, // 5 minutes
    max: 1, // 1 sync-all per 5 minutes per user
    message: 'Too many sync-all requests'
  }),
  syncAllValidation,
  validateRequest,
  portfolioSyncController.syncAllExchanges
);

// Get sync status for specific exchange
router.get('/sync/:exchange/status',
  exchangeParamValidation,
  validateRequest,
  portfolioSyncController.getSyncStatus
);

// Get all sync statuses for user
router.get('/sync/status/all',
  portfolioSyncController.getAllSyncStatuses
);

// Cancel sync for specific exchange
router.delete('/sync/:exchange',
  rateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 cancellations per minute per user
    message: 'Too many cancellation requests'
  }),
  exchangeParamValidation,
  validateRequest,
  portfolioSyncController.cancelSync
);

// Get supported exchanges
router.get('/exchanges/supported',
  portfolioSyncController.getSupportedExchanges
);

// Get portfolio summary (aggregated across all exchanges)
router.get('/summary',
  rateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 summary requests per minute per user
    message: 'Too many summary requests'
  }),
  portfolioSyncController.getPortfolioSummary
);

export { router as portfolioSyncRoutes };