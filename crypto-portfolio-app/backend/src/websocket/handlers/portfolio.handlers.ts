import { Socket, Server } from 'socket.io';
import { PortfolioService } from '../../services/portfolioService';
import { PortfolioCalculationService } from '../../services/portfolioCalculationService';
import { createEventRateLimiter } from '../middleware/rateLimit.middleware';
import { RedisService } from '../../services/redisService';

interface AuthenticatedSocket extends Socket {
  userId: string;
  userRole: string;
}

export const setupPortfolioHandlers = (
  socket: AuthenticatedSocket,
  io: Server,
  redisService: RedisService
) => {
  const portfolioService = new PortfolioService();
  const portfolioCalcService = new PortfolioCalculationService();
  const eventLimiter = createEventRateLimiter(redisService, {
    maxEventsPerWindow: 200, // 200 events per minute per IP
    windowMs: 60000
  });

  // Subscribe to portfolio updates
  socket.on('subscribe_portfolio', async (portfolioId: string) => {
    try {
      if (!await eventLimiter(socket, 'subscribe_portfolio')) {
        return;
      }

      if (!portfolioId || typeof portfolioId !== 'string') {
        return socket.emit('subscription_error', {
          type: 'portfolio',
          error: 'Invalid portfolio ID',
          timestamp: new Date().toISOString()
        });
      }

      // Verify user owns this portfolio
      const hasAccess = await portfolioService.verifyUserAccess(socket.userId, portfolioId);
      
      if (!hasAccess) {
        return socket.emit('subscription_error', {
          type: 'portfolio',
          error: 'Access denied to portfolio',
          portfolioId,
          timestamp: new Date().toISOString()
        });
      }

      await socket.join(`portfolio:${portfolioId}`);
      
      // Send current portfolio data
      try {
        const portfolioData = await portfolioCalcService.getPortfolioRealTimeData(portfolioId);
        if (portfolioData) {
          socket.emit('portfolio_update', {
            portfolioId,
            userId: socket.userId,
            totalValue: portfolioData.totalValue,
            change24h: portfolioData.change24h,
            changePercent: portfolioData.changePercent,
            holdings: portfolioData.holdings.map(holding => ({
              symbol: holding.symbol,
              quantity: holding.quantity,
              averageCost: holding.averageCost,
              currentPrice: holding.currentPrice,
              value: holding.value,
              change24h: holding.change24h,
              changePercent: holding.changePercent
            })),
            lastUpdate: portfolioData.lastCalculated.toISOString()
          });
        }
      } catch (dataError) {
        console.warn(`Failed to get portfolio data for ${portfolioId}:`, dataError);
      }
      
      socket.emit('subscription_confirmed', {
        type: 'portfolio',
        status: 'confirmed',
        portfolioId,
        timestamp: new Date().toISOString()
      });

      console.log(`User ${socket.userId} subscribed to portfolio: ${portfolioId}`);
    } catch (error) {
      console.error('Portfolio subscription error:', error);
      socket.emit('subscription_error', {
        type: 'portfolio',
        error: 'Failed to subscribe to portfolio updates',
        portfolioId,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Subscribe to all user portfolios
  socket.on('subscribe_all_portfolios', async () => {
    try {
      if (!await eventLimiter(socket, 'subscribe_all_portfolios')) {
        return;
      }

      const userPortfolios = await portfolioService.getUserPortfolios(socket.userId);
      const subscribedPortfolios: string[] = [];
      
      for (const portfolio of userPortfolios) {
        await socket.join(`portfolio:${portfolio.id}`);
        subscribedPortfolios.push(portfolio.id);
      }
      
      // Send current portfolio data for all portfolios
      try {
        const portfoliosData = await portfolioCalcService.getAllPortfoliosRealTimeData(socket.userId);
        
        socket.emit('all_portfolios_update', portfoliosData.map(data => ({
          portfolioId: data.portfolioId,
          userId: socket.userId,
          totalValue: data.totalValue,
          change24h: data.change24h,
          changePercent: data.changePercent,
          holdings: data.holdings.map(holding => ({
            symbol: holding.symbol,
            quantity: holding.quantity,
            averageCost: holding.averageCost,
            currentPrice: holding.currentPrice,
            value: holding.value,
            change24h: holding.change24h,
            changePercent: holding.changePercent
          })),
          lastUpdate: data.lastCalculated.toISOString()
        })));
      } catch (dataError) {
        console.warn(`Failed to get all portfolios data for user ${socket.userId}:`, dataError);
      }

      socket.emit('subscription_confirmed', {
        type: 'all_portfolios',
        status: 'confirmed',
        portfolioIds: subscribedPortfolios,
        timestamp: new Date().toISOString()
      });

      console.log(`User ${socket.userId} subscribed to all portfolios: ${subscribedPortfolios.length} portfolios`);
    } catch (error) {
      console.error('All portfolios subscription error:', error);
      socket.emit('subscription_error', {
        type: 'all_portfolios',
        error: 'Failed to subscribe to portfolio updates',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Unsubscribe from portfolio
  socket.on('unsubscribe_portfolio', async (portfolioId: string) => {
    try {
      if (!await eventLimiter(socket, 'unsubscribe_portfolio')) {
        return;
      }

      if (!portfolioId || typeof portfolioId !== 'string') {
        return socket.emit('subscription_error', {
          type: 'portfolio',
          error: 'Invalid portfolio ID',
          timestamp: new Date().toISOString()
        });
      }

      await socket.leave(`portfolio:${portfolioId}`);
      
      socket.emit('unsubscription_confirmed', {
        type: 'portfolio',
        status: 'confirmed',
        portfolioId,
        timestamp: new Date().toISOString()
      });

      console.log(`User ${socket.userId} unsubscribed from portfolio: ${portfolioId}`);
    } catch (error) {
      console.error('Portfolio unsubscription error:', error);
    }
  });

  // Handle manual portfolio refresh
  socket.on('refresh_portfolio', async (portfolioId: string) => {
    try {
      if (!await eventLimiter(socket, 'refresh_portfolio')) {
        return;
      }

      if (!portfolioId || typeof portfolioId !== 'string') {
        return socket.emit('refresh_error', {
          portfolioId,
          error: 'Invalid portfolio ID'
        });
      }

      const hasAccess = await portfolioService.verifyUserAccess(socket.userId, portfolioId);
      
      if (!hasAccess) {
        return socket.emit('refresh_error', {
          portfolioId,
          error: 'Access denied'
        });
      }

      // Trigger fresh data sync
      await portfolioCalcService.syncPortfolioData(portfolioId);
      
      const updatedData = await portfolioCalcService.getPortfolioRealTimeData(portfolioId);
      
      if (updatedData) {
        socket.emit('portfolio_update', {
          portfolioId,
          userId: socket.userId,
          totalValue: updatedData.totalValue,
          change24h: updatedData.change24h,
          changePercent: updatedData.changePercent,
          holdings: updatedData.holdings.map(holding => ({
            symbol: holding.symbol,
            quantity: holding.quantity,
            averageCost: holding.averageCost,
            currentPrice: holding.currentPrice,
            value: holding.value,
            change24h: holding.change24h,
            changePercent: holding.changePercent
          })),
          lastUpdate: updatedData.lastCalculated.toISOString()
        });
      }

      console.log(`Portfolio ${portfolioId} refreshed for user ${socket.userId}`);
    } catch (error) {
      console.error('Portfolio refresh error:', error);
      socket.emit('refresh_error', {
        portfolioId,
        error: 'Failed to refresh portfolio data'
      });
    }
  });

  // Get portfolio summary
  socket.on('get_portfolio_summary', async (portfolioId: string) => {
    try {
      if (!await eventLimiter(socket, 'get_portfolio_summary')) {
        return;
      }

      if (!portfolioId || typeof portfolioId !== 'string') {
        return socket.emit('error', {
          event: 'get_portfolio_summary',
          error: 'Invalid portfolio ID'
        });
      }

      const hasAccess = await portfolioService.verifyUserAccess(socket.userId, portfolioId);
      
      if (!hasAccess) {
        return socket.emit('error', {
          event: 'get_portfolio_summary',
          error: 'Access denied'
        });
      }

      const summary = await portfolioCalcService.getPortfolioSummary(portfolioId);
      socket.emit('portfolio_summary', {
        portfolioId,
        ...summary,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Portfolio summary error:', error);
      socket.emit('error', {
        event: 'get_portfolio_summary',
        error: 'Failed to get portfolio summary'
      });
    }
  });

  // Handle disconnection cleanup
  socket.on('disconnect', () => {
    console.log(`Portfolio subscriptions cleaned up for user ${socket.userId}`);
  });
};