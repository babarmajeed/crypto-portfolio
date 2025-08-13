import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { priceController } from '../controllers/priceController';

const pricesRouter = Router();

// Public price endpoints
// GET /api/v1/prices/market/overview - Get market overview
pricesRouter.get('/market/overview', priceController.getMarketOverview);

// GET /api/v1/prices/search - Search cryptocurrencies
pricesRouter.get('/search', priceController.searchCryptocurrencies);

// GET /api/v1/prices/trending - Get trending cryptocurrencies
pricesRouter.get('/trending', priceController.getTrendingCryptocurrencies);

// GET /api/v1/prices/cryptocurrencies - Get all cryptocurrencies with pagination
pricesRouter.get('/cryptocurrencies', priceController.getAllCryptocurrencies);

// GET /api/v1/prices/cryptocurrencies/symbol/:symbol - Get cryptocurrency by symbol
pricesRouter.get('/cryptocurrencies/symbol/:symbol', priceController.getCryptocurrencyBySymbol);

// POST /api/v1/prices/multiple - Get multiple prices by symbols
pricesRouter.post('/multiple', priceController.getMultiplePrices);

// GET /api/v1/prices/cryptocurrencies/:cryptocurrencyId/current - Get current price
pricesRouter.get('/cryptocurrencies/:cryptocurrencyId/current', priceController.getCurrentPrice);

// GET /api/v1/prices/cryptocurrencies/:cryptocurrencyId/history - Get price history
pricesRouter.get('/cryptocurrencies/:cryptocurrencyId/history', priceController.getPriceHistory);

// GET /api/v1/prices/cryptocurrencies/:cryptocurrencyId/stats - Get price statistics
pricesRouter.get('/cryptocurrencies/:cryptocurrencyId/stats', priceController.getPriceStatistics);

// Protected admin endpoints
pricesRouter.use(authMiddleware);

// POST /api/v1/prices/update-all - Update all prices (Admin only)
pricesRouter.post('/update-all', priceController.updateAllPrices);

// POST /api/v1/prices/cryptocurrencies/:cryptocurrencyId/update - Update specific price (Admin only)
pricesRouter.post('/cryptocurrencies/:cryptocurrencyId/update', priceController.updateCryptocurrencyPrice);

// POST /api/v1/prices/cryptocurrencies/:cryptocurrencyId/import-historical - Import historical data (Admin only)
pricesRouter.post('/cryptocurrencies/:cryptocurrencyId/import-historical', priceController.importHistoricalData);

// POST /api/v1/prices/cleanup - Clean up old price data (Admin only)
pricesRouter.post('/cleanup', priceController.cleanupOldPriceData);

export { pricesRouter };