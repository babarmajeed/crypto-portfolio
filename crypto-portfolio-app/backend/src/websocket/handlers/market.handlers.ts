import { Socket, Server } from 'socket.io';
import { PriceService } from '../../services/priceService';
import { MarketDataService } from '../../services/marketDataService';
import { createEventRateLimiter } from '../middleware/rateLimit.middleware';
import { RedisService } from '../../services/redisService';

interface AuthenticatedSocket extends Socket {
  userId: string;
  userRole: string;
}

export const setupMarketHandlers = (
  socket: AuthenticatedSocket,
  io: Server,
  redisService: RedisService
) => {
  const priceService = new PriceService();
  const marketDataService = new MarketDataService();
  const eventLimiter = createEventRateLimiter(redisService, {
    maxEventsPerWindow: 500, // 500 events per minute per IP
    windowMs: 60000
  });

  // Subscribe to price updates for specific symbols
  socket.on('subscribe_prices', async (symbols: string[]) => {
    try {
      // Rate limiting check
      if (!await eventLimiter(socket, 'subscribe_prices')) {
        return;
      }

      // Validate symbols array
      if (!Array.isArray(symbols) || symbols.length === 0) {
        return socket.emit('subscription_error', {
          type: 'prices',
          error: 'Invalid symbols array',
          timestamp: new Date().toISOString()
        });
      }

      // Limit number of subscriptions per user
      if (symbols.length > 50) {
        return socket.emit('subscription_error', {
          type: 'prices',
          error: 'Maximum 50 symbols allowed per subscription',
          timestamp: new Date().toISOString()
        });
      }

      const validSymbols: string[] = [];
      
      for (const symbol of symbols) {
        if (typeof symbol === 'string' && symbol.length <= 20) {
          const upperSymbol = symbol.toUpperCase();
          await socket.join(`market:${upperSymbol}`);
          validSymbols.push(upperSymbol);
          
          // Send current price immediately
          try {
            const currentPrice = await priceService.getCurrentPrice(upperSymbol);
            if (currentPrice) {
              socket.emit('price_update', {
                symbol: upperSymbol,
                price: currentPrice.price,
                change24h: currentPrice.change24h || 0,
                changePercent24h: currentPrice.changePercent24h || 0,
                volume24h: currentPrice.volume24h || 0,
                lastUpdate: currentPrice.lastUpdated?.toISOString() || new Date().toISOString(),
                source: 'aggregated'
              });
            }
          } catch (priceError) {
            console.warn(`Failed to get current price for ${upperSymbol}:`, priceError);
          }
        }
      }
      
      socket.emit('subscription_confirmed', {
        type: 'prices',
        status: 'confirmed',
        symbols: validSymbols,
        timestamp: new Date().toISOString()
      });

      console.log(`User ${socket.userId} subscribed to prices: ${validSymbols.join(', ')}`);
    } catch (error) {
      console.error('Price subscription error:', error);
      socket.emit('subscription_error', {
        type: 'prices',
        error: 'Failed to subscribe to price updates',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Unsubscribe from price updates
  socket.on('unsubscribe_prices', async (symbols: string[]) => {
    try {
      if (!await eventLimiter(socket, 'unsubscribe_prices')) {
        return;
      }

      if (!Array.isArray(symbols)) {
        return socket.emit('subscription_error', {
          type: 'prices',
          error: 'Invalid symbols array',
          timestamp: new Date().toISOString()
        });
      }

      const unsubscribedSymbols: string[] = [];
      
      for (const symbol of symbols) {
        if (typeof symbol === 'string') {
          const upperSymbol = symbol.toUpperCase();
          await socket.leave(`market:${upperSymbol}`);
          unsubscribedSymbols.push(upperSymbol);
        }
      }
      
      socket.emit('unsubscription_confirmed', {
        type: 'prices',
        status: 'confirmed',
        symbols: unsubscribedSymbols,
        timestamp: new Date().toISOString()
      });

      console.log(`User ${socket.userId} unsubscribed from prices: ${unsubscribedSymbols.join(', ')}`);
    } catch (error) {
      console.error('Price unsubscription error:', error);
    }
  });

  // Subscribe to order book updates
  socket.on('subscribe_orderbook', async (data: { symbol: string; depth?: number }) => {
    try {
      if (!await eventLimiter(socket, 'subscribe_orderbook')) {
        return;
      }

      const { symbol, depth = 20 } = data;
      
      if (!symbol || typeof symbol !== 'string') {
        return socket.emit('subscription_error', {
          type: 'orderbook',
          error: 'Invalid symbol',
          timestamp: new Date().toISOString()
        });
      }

      // Validate depth
      const validDepth = Math.min(Math.max(depth, 5), 100); // Between 5 and 100
      const upperSymbol = symbol.toUpperCase();
      
      await socket.join(`orderbook:${upperSymbol}`);
      
      // Send current order book
      try {
        const orderBook = await marketDataService.getOrderBook(upperSymbol, validDepth);
        if (orderBook) {
          socket.emit('orderbook_update', {
            symbol: upperSymbol,
            bids: orderBook.bids || [],
            asks: orderBook.asks || [],
            timestamp: new Date().toISOString()
          });
        }
      } catch (orderBookError) {
        console.warn(`Failed to get order book for ${upperSymbol}:`, orderBookError);
      }

      socket.emit('subscription_confirmed', {
        type: 'orderbook',
        status: 'confirmed',
        symbols: [upperSymbol],
        timestamp: new Date().toISOString()
      });

      console.log(`User ${socket.userId} subscribed to orderbook: ${upperSymbol} (depth: ${validDepth})`);
    } catch (error) {
      console.error('Orderbook subscription error:', error);
      socket.emit('subscription_error', {
        type: 'orderbook',
        error: 'Failed to subscribe to order book',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Subscribe to trade stream
  socket.on('subscribe_trades', async (symbol: string) => {
    try {
      if (!await eventLimiter(socket, 'subscribe_trades')) {
        return;
      }

      if (!symbol || typeof symbol !== 'string') {
        return socket.emit('subscription_error', {
          type: 'trades',
          error: 'Invalid symbol',
          timestamp: new Date().toISOString()
        });
      }

      const upperSymbol = symbol.toUpperCase();
      await socket.join(`trades:${upperSymbol}`);
      
      // Send recent trades
      try {
        const recentTrades = await marketDataService.getRecentTrades(upperSymbol, 20);
        if (recentTrades && recentTrades.length > 0) {
          socket.emit('recent_trades', {
            symbol: upperSymbol,
            trades: recentTrades.map(trade => ({
              symbol: upperSymbol,
              price: trade.price,
              quantity: trade.quantity,
              side: trade.side,
              timestamp: trade.timestamp.toISOString(),
              tradeId: trade.id
            }))
          });
        }
      } catch (tradesError) {
        console.warn(`Failed to get recent trades for ${upperSymbol}:`, tradesError);
      }

      socket.emit('subscription_confirmed', {
        type: 'trades',
        status: 'confirmed',
        symbols: [upperSymbol],
        timestamp: new Date().toISOString()
      });

      console.log(`User ${socket.userId} subscribed to trades: ${upperSymbol}`);
    } catch (error) {
      console.error('Trades subscription error:', error);
      socket.emit('subscription_error', {
        type: 'trades',
        error: 'Failed to subscribe to trades',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Get market statistics
  socket.on('get_market_stats', async () => {
    try {
      if (!await eventLimiter(socket, 'get_market_stats')) {
        return;
      }

      const marketStats = await marketDataService.getMarketStats();
      socket.emit('market_stats', {
        ...marketStats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Market stats error:', error);
      socket.emit('error', {
        event: 'get_market_stats',
        error: 'Failed to get market statistics'
      });
    }
  });

  // Handle disconnection cleanup
  socket.on('disconnect', () => {
    console.log(`Market subscriptions cleaned up for user ${socket.userId}`);
  });
};