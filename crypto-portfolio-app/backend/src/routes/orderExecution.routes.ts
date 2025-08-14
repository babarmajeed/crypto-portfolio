import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { orderExecutionController } from '../controllers/orderExecutionController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const router = Router();

// Order execution validation rules
const orderExecutionValidation = [
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
  body('type')
    .isIn(['market', 'limit', 'stop', 'stop_limit'])
    .withMessage('Type must be one of: market, limit, stop, stop_limit'),
  body('quantity')
    .isFloat({ gt: 0 })
    .withMessage('Quantity must be a positive number'),
  body('price')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('Price must be a positive number'),
  body('stopPrice')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('Stop price must be a positive number'),
  body('timeInForce')
    .optional()
    .isIn(['GTC', 'IOC', 'FOK'])
    .withMessage('Time in force must be one of: GTC, IOC, FOK'),
  body('clientOrderId')
    .optional()
    .isString()
    .withMessage('Client order ID must be a string')
];

const orderValidationRules = [
  body('exchange')
    .isIn(['binance', 'coinbase', 'kraken', 'kucoin'])
    .withMessage('Exchange must be one of: binance, coinbase, kraken, kucoin'),
  body('symbol')
    .notEmpty()
    .withMessage('Symbol is required'),
  body('side')
    .isIn(['buy', 'sell'])
    .withMessage('Side must be buy or sell'),
  body('type')
    .isIn(['market', 'limit', 'stop', 'stop_limit'])
    .withMessage('Type must be one of: market, limit, stop, stop_limit'),
  body('quantity')
    .isFloat({ gt: 0 })
    .withMessage('Quantity must be a positive number')
];

const exchangeParamValidation = [
  param('exchange')
    .isIn(['binance', 'coinbase', 'kraken', 'kucoin'])
    .withMessage('Exchange must be one of: binance, coinbase, kraken, kucoin')
];

const orderIdParamValidation = [
  param('orderId')
    .notEmpty()
    .withMessage('Order ID is required')
];

const paginationValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('symbol')
    .optional()
    .isString()
    .withMessage('Symbol must be a string')
];

// Apply authentication to all routes
router.use(authenticateToken);

// Execute order
router.post('/orders/execute',
  rateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 orders per minute per user
    message: 'Too many order requests'
  }),
  orderExecutionValidation,
  validateRequest,
  orderExecutionController.executeOrder
);

// Validate order (dry run)
router.post('/orders/validate',
  rateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 validations per minute per user
    message: 'Too many validation requests'
  }),
  orderValidationRules,
  validateRequest,
  orderExecutionController.validateOrder
);

// Get order status
router.get('/orders/:exchange/:orderId',
  exchangeParamValidation,
  orderIdParamValidation,
  validateRequest,
  orderExecutionController.getOrderStatus
);

// Cancel order
router.delete('/orders/:exchange/:orderId',
  rateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 cancellations per minute per user
    message: 'Too many cancellation requests'
  }),
  exchangeParamValidation,
  orderIdParamValidation,
  validateRequest,
  orderExecutionController.cancelOrder
);

// Get user orders for specific exchange
router.get('/orders/:exchange',
  exchangeParamValidation,
  paginationValidation,
  validateRequest,
  orderExecutionController.getUserOrders
);

// Get pending orders (admin only)
router.get('/orders/pending/all',
  rateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
    message: 'Too many requests'
  }),
  // TODO: Add admin role check middleware
  orderExecutionController.getPendingOrders
);

// Get supported exchanges
router.get('/exchanges/supported',
  orderExecutionController.getSupportedExchanges
);

export { router as orderExecutionRoutes };