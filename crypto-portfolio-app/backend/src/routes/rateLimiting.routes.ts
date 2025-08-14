import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { rateLimitingController } from '../controllers/rateLimitingController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const router = Router();

// Rate limit check validation
const rateLimitCheckValidation = [
  body('exchange')
    .isIn(['binance', 'coinbase', 'kraken', 'kucoin'])
    .withMessage('Exchange must be one of: binance, coinbase, kraken, kucoin'),
  body('endpoint')
    .optional()
    .isString()
    .withMessage('Endpoint must be a string'),
  body('method')
    .optional()
    .isIn(['GET', 'POST', 'PUT', 'DELETE'])
    .withMessage('Method must be one of: GET, POST, PUT, DELETE'),
  body('weight')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Weight must be between 1 and 100')
];

// Request recording validation
const requestRecordValidation = [
  body('exchange')
    .isIn(['binance', 'coinbase', 'kraken', 'kucoin'])
    .withMessage('Exchange must be one of: binance, coinbase, kraken, kucoin'),
  body('endpoint')
    .optional()
    .isString()
    .withMessage('Endpoint must be a string'),
  body('method')
    .optional()
    .isIn(['GET', 'POST', 'PUT', 'DELETE'])
    .withMessage('Method must be one of: GET, POST, PUT, DELETE'),
  body('weight')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Weight must be between 1 and 100'),
  body('success')
    .optional()
    .isBoolean()
    .withMessage('Success must be a boolean')
];

// Rate limit update validation
const rateLimitUpdateValidation = [
  body('maxRequests')
    .isInt({ min: 1 })
    .withMessage('Max requests must be a positive integer'),
  body('windowMs')
    .isInt({ min: 1000 })
    .withMessage('Window must be at least 1000ms'),
  body('endpoint')
    .optional()
    .isString()
    .withMessage('Endpoint must be a string'),
  body('method')
    .optional()
    .isIn(['GET', 'POST', 'PUT', 'DELETE'])
    .withMessage('Method must be one of: GET, POST, PUT, DELETE'),
  body('weight')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Weight must be between 1 and 100'),
  body('burstAllowed')
    .optional()
    .isBoolean()
    .withMessage('Burst allowed must be a boolean'),
  body('burstLimit')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Burst limit must be a positive integer')
];

// Exchange parameter validation
const exchangeParamValidation = [
  param('exchange')
    .isIn(['binance', 'coinbase', 'kraken', 'kucoin'])
    .withMessage('Exchange must be one of: binance, coinbase, kraken, kucoin')
];

// Limit query validation
const limitQueryValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Limit must be between 1 and 1000')
];

// Apply authentication to all routes
router.use(authenticateToken);

// Check rate limit status
router.post('/check',
  rateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 checks per minute per user
    message: 'Too many rate limit check requests'
  }),
  rateLimitCheckValidation,
  validateRequest,
  rateLimitingController.checkRateLimit
);

// Record a request
router.post('/record',
  rateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    max: 1000, // 1000 records per minute per user (high limit for recording)
    message: 'Too many record requests'
  }),
  requestRecordValidation,
  validateRequest,
  rateLimitingController.recordRequest
);

// Wait for rate limit availability
router.post('/wait',
  rateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 wait requests per minute per user
    message: 'Too many wait requests'
  }),
  rateLimitCheckValidation,
  validateRequest,
  rateLimitingController.waitForRateLimit
);

// Get rate limit status for specific exchange
router.get('/status/:exchange',
  exchangeParamValidation,
  validateRequest,
  rateLimitingController.getRateLimitStatus
);

// Get rate limit status for all exchanges
router.get('/status/all',
  rateLimitingController.getAllRateLimitStatuses
);

// Get request history for specific exchange
router.get('/history/:exchange',
  exchangeParamValidation,
  limitQueryValidation,
  validateRequest,
  rateLimitingController.getRequestHistory
);

// Get rate limiting statistics
router.get('/statistics',
  rateLimitingController.getRateLimitingStats
);

// Get rate limit configuration for specific exchange
router.get('/config/:exchange',
  exchangeParamValidation,
  validateRequest,
  rateLimitingController.getExchangeRateLimits
);

// Get rate limit configuration for all exchanges
router.get('/config/all',
  rateLimitingController.getAllExchangeRateLimits
);

// Update rate limit configuration (admin only)
router.put('/config/:exchange',
  rateLimitMiddleware({
    windowMs: 300 * 1000, // 5 minutes
    max: 10, // 10 config updates per 5 minutes
    message: 'Too many configuration update requests'
  }),
  exchangeParamValidation,
  rateLimitUpdateValidation,
  validateRequest,
  // TODO: Add admin role check middleware
  rateLimitingController.updateRateLimit
);

// Clear rate limit cache
router.delete('/cache/:exchange',
  rateLimitMiddleware({
    windowMs: 300 * 1000, // 5 minutes
    max: 5, // 5 cache clears per 5 minutes
    message: 'Too many cache clear requests'
  }),
  exchangeParamValidation,
  validateRequest,
  // TODO: Add admin role check middleware
  rateLimitingController.clearRateLimitCache
);

// Clear all rate limit cache
router.delete('/cache/all',
  rateLimitMiddleware({
    windowMs: 300 * 1000, // 5 minutes
    max: 2, // 2 global cache clears per 5 minutes
    message: 'Too many cache clear requests'
  }),
  // TODO: Add admin role check middleware
  rateLimitingController.clearRateLimitCache
);

// Get supported exchanges
router.get('/exchanges/supported',
  rateLimitingController.getSupportedExchanges
);

// Cleanup old data (admin only)
router.post('/maintenance/cleanup',
  rateLimitMiddleware({
    windowMs: 3600 * 1000, // 1 hour
    max: 1, // 1 cleanup per hour
    message: 'Too many cleanup requests'
  }),
  // TODO: Add admin role check middleware
  rateLimitingController.cleanupOldData
);

export { router as rateLimitingRoutes };