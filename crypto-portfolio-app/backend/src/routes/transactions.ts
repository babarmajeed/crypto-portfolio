import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { transactionController } from '../controllers/transactionController';

const transactionsRouter = Router();

// All transaction routes require authentication
transactionsRouter.use(authMiddleware);

// GET /api/v1/transactions - Get user transactions with filters
transactionsRouter.get('/', transactionController.getUserTransactions);

// POST /api/v1/transactions - Create new transaction
transactionsRouter.post('/', transactionController.createTransaction);

// POST /api/v1/transactions/import - Import transactions from exchange
transactionsRouter.post('/import', transactionController.importTransactions);

// GET /api/v1/transactions/by-period - Get transactions by period
transactionsRouter.get('/by-period', transactionController.getTransactionsByPeriod);

// GET /api/v1/transactions/:transactionId - Get transaction by ID
transactionsRouter.get('/:transactionId', transactionController.getTransactionById);

// PUT /api/v1/transactions/:transactionId - Update transaction
transactionsRouter.put('/:transactionId', transactionController.updateTransaction);

// DELETE /api/v1/transactions/:transactionId - Delete transaction
transactionsRouter.delete('/:transactionId', transactionController.deleteTransaction);

// Portfolio-specific transaction endpoints
// GET /api/v1/transactions/portfolios/:portfolioId/summary - Get transaction summary for portfolio
transactionsRouter.get('/portfolios/:portfolioId/summary', transactionController.getTransactionSummary);

// GET /api/v1/transactions/portfolios/:portfolioId/type-stats - Get transaction type statistics
transactionsRouter.get('/portfolios/:portfolioId/type-stats', transactionController.getTransactionTypeStats);

// GET /api/v1/transactions/portfolios/:portfolioId/monthly-volume - Get monthly transaction volume
transactionsRouter.get('/portfolios/:portfolioId/monthly-volume', transactionController.getMonthlyVolume);

// GET /api/v1/transactions/portfolios/:portfolioId/top-traded - Get top traded cryptocurrencies
transactionsRouter.get('/portfolios/:portfolioId/top-traded', transactionController.getTopTradedCryptocurrencies);

// GET /api/v1/transactions/portfolios/:portfolioId/fees-summary - Get fees summary
transactionsRouter.get('/portfolios/:portfolioId/fees-summary', transactionController.getFeesSummary);

// GET /api/v1/transactions/portfolios/:portfolioId/crypto/:cryptocurrencyId/realized-pnl - Get realized P&L
transactionsRouter.get('/portfolios/:portfolioId/crypto/:cryptocurrencyId/realized-pnl', transactionController.getRealizedPnL);

export { transactionsRouter };