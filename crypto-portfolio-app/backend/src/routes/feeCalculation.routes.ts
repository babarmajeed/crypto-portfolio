import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { feeCalculationController } from '../controllers/feeCalculationController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const router = Router();

// Trade fee calculation validation
const tradeFeeValidation = [
  body('exchange')
    .isIn(['binance', 'coinbase', 'kraken', 'kucoin'])
    .withMessage('Exchange must be one of: binance, coinbase, kraken, kucoin'),
  body('symbol')
    .notEmpty()
    .withMessage('Symbol is required')
    .isString()
    .withMessage('Symbol must be a string'),
  body('side')
    .isIn(['buy', 'sell'])
    .withMessage('Side must be buy or sell'),
  body('orderType')
    .isIn(['market', 'limit'])
    .withMessage('Order type must be market or limit'),
  body('quantity')
    .isFloat({ gt: 0 })
    .withMessage('Quantity must be a positive number'),
  body('price')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('Price must be a positive number')
];

// Withdrawal/deposit fee validation
const withdrawalDepositFeeValidation = [
  body('exchange')
    .isIn(['binance', 'coinbase', 'kraken', 'kucoin'])
    .withMessage('Exchange must be one of: binance, coinbase, kraken, kucoin'),
  body('asset')
    .notEmpty()
    .withMessage('Asset is required')
    .isString()
    .withMessage('Asset must be a string'),
  body('network')
    .optional()
    .isString()
    .withMessage('Network must be a string')
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
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

// Total fee estimation validation
const totalFeeValidation = [
  body('exchange')
    .isIn(['binance', 'coinbase', 'kraken', 'kucoin'])
    .withMessage('Exchange must be one of: binance, coinbase, kraken, kucoin'),
  body('trades')
    .isArray({ min: 1, max: 50 })
    .withMessage('Trades must be an array with 1-50 items'),
  body('trades.*.symbol')
    .notEmpty()
    .withMessage('Each trade must have a symbol'),
  body('trades.*.side')
    .isIn(['buy', 'sell'])
    .withMessage('Each trade side must be buy or sell'),
  body('trades.*.type')
    .isIn(['market', 'limit'])
    .withMessage('Each trade type must be market or limit'),
  body('trades.*.quantity')
    .isFloat({ gt: 0 })
    .withMessage('Each trade quantity must be a positive number')
];

// Multiple fee calculation validation
const multipleFeeValidation = [
  body('requests')
    .isArray({ min: 1, max: 20 })
    .withMessage('Requests must be an array with 1-20 items'),
  body('requests.*.exchange')
    .isIn(['binance', 'coinbase', 'kraken', 'kucoin'])
    .withMessage('Each request exchange must be one of: binance, coinbase, kraken, kucoin'),
  body('requests.*.type')
    .isIn(['trade', 'withdrawal', 'deposit'])
    .withMessage('Each request type must be trade, withdrawal, or deposit')
];

// Fee comparison validation
const feeComparisonValidation = [
  body('exchanges')
    .isArray({ min: 2, max: 4 })
    .withMessage('Exchanges must be an array with 2-4 items'),
  body('exchanges.*')
    .isIn(['binance', 'coinbase', 'kraken', 'kucoin'])
    .withMessage('Each exchange must be one of: binance, coinbase, kraken, kucoin'),
  body('symbol')
    .notEmpty()
    .withMessage('Symbol is required'),
  body('side')
    .isIn(['buy', 'sell'])
    .withMessage('Side must be buy or sell'),
  body('orderType')
    .isIn(['market', 'limit'])
    .withMessage('Order type must be market or limit'),
  body('quantity')
    .isFloat({ gt: 0 })
    .withMessage('Quantity must be a positive number')
];

// Apply authentication to all routes
router.use(authenticateToken);

// Calculate trade fee
router.post('/trade',
  rateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 calculations per minute per user
    message: 'Too many fee calculation requests'
  }),
  tradeFeeValidation,
  validateRequest,
  feeCalculationController.calculateTradeFee
);

// Calculate withdrawal fee
router.post('/withdrawal',
  rateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 calculations per minute per user
    message: 'Too many fee calculation requests'
  }),
  withdrawalDepositFeeValidation,
  validateRequest,
  feeCalculationController.calculateWithdrawalFee
);

// Calculate deposit fee
router.post('/deposit',
  rateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 calculations per minute per user
    message: 'Too many fee calculation requests'
  }),
  withdrawalDepositFeeValidation,
  validateRequest,
  feeCalculationController.calculateDepositFee
);

// Estimate total fees for multiple trades
router.post('/estimate-total',
  rateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 estimations per minute per user
    message: 'Too many fee estimation requests'
  }),
  totalFeeValidation,
  validateRequest,
  feeCalculationController.estimateTotalFees
);

// Calculate multiple fees in batch
router.post('/batch',
  rateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 batch calculations per minute per user
    message: 'Too many batch calculation requests'
  }),
  multipleFeeValidation,
  validateRequest,
  feeCalculationController.calculateMultipleFees
);

// Compare fees across exchanges
router.post('/compare',
  rateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 comparisons per minute per user
    message: 'Too many fee comparison requests'
  }),
  feeComparisonValidation,
  validateRequest,
  feeCalculationController.compareFees
);

// Get fee history for user on specific exchange
router.get('/history/:exchange',
  exchangeParamValidation,
  limitQueryValidation,
  validateRequest,
  feeCalculationController.getFeeHistory
);

// Get fee structure for specific exchange
router.get('/structure/:exchange',
  exchangeParamValidation,
  validateRequest,
  feeCalculationController.getFeeStructure
);

// Get withdrawal fees for specific exchange
router.get('/withdrawal-fees/:exchange',
  exchangeParamValidation,
  validateRequest,
  feeCalculationController.getWithdrawalFees
);

// Get supported exchanges
router.get('/exchanges/supported',
  feeCalculationController.getSupportedExchanges
);

// Get supported fee types
router.get('/types/supported',
  feeCalculationController.getSupportedFeeTypes
);

// Clear fee cache (admin only)
router.delete('/cache',
  rateLimitMiddleware({
    windowMs: 300 * 1000, // 5 minutes
    max: 2, // 2 cache clears per 5 minutes
    message: 'Too many cache clear requests'
  }),
  // TODO: Add admin role check middleware
  feeCalculationController.clearFeeCache
);

export { router as feeCalculationRoutes };