import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { authenticateSocket } from './middleware/auth.middleware';
import { createRateLimitMiddleware } from './middleware/rateLimit.middleware';
import { setupMarketHandlers } from './handlers/market.handlers';
import { setupPortfolioHandlers } from './handlers/portfolio.handlers';
import { RedisService } from '../services/redisService';
import { RealTimeDataService } from '../services/realTimeDataService';
import { MarketDataService } from '../services/marketDataService';
import { PortfolioCalculationService } from '../services/portfolioCalculationService';
import { logger } from '../utils/logger';

export class WebSocketServer {
  private io: Server;
  private redisService: RedisService;
  private realTimeDataService: RealTimeDataService;
  private marketDataService: MarketDataService;
  private portfolioCalcService: PortfolioCalculationService;
  private priceUpdateInterval?: NodeJS.Timeout;
  
  constructor(httpServer: any) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.redisService = new RedisService();
    this.realTimeDataService = new RealTimeDataService();
    this.marketDataService = new MarketDataService();
    this.portfolioCalcService = new PortfolioCalculationService();

    this.setupRedisAdapter();
    this.setupMiddleware();
    this.setupEventHandlers();
    this.startPriceUpdateBroadcast();
  }

  private async setupRedisAdapter() {
    try {
      const pubClient = this.redisService.getClient();
      const subClient = pubClient.duplicate();
      
      await subClient.connect();
      
      this.io.adapter(createAdapter(pubClient, subClient));
      logger.info('Redis adapter configured for Socket.IO');
    } catch (error) {
      logger.error('Failed to setup Redis adapter:', error);
    }
  }

  private setupMiddleware() {
    // Rate limiting middleware
    this.io.use(createRateLimitMiddleware(this.redisService, {
      maxConnections: 100,
      windowMs: 60000,
      maxEventsPerWindow: 1000
    }));

    // Authentication middleware
    this.io.use(authenticateSocket);
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: any) => {
      logger.info(`Client connected: ${socket.id} (User: ${socket.userId})`);

      // Setup handlers for different types of events
      setupMarketHandlers(socket, this.io, this.redisService);
      setupPortfolioHandlers(socket, this.io, this.redisService);

      // Handle general events
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date().toISOString() });
      });

      socket.on('get_server_status', () => {
        socket.emit('server_status', {
          status: 'online',
          connections: this.io.engine.clientsCount,
          uptime: process.uptime(),
          timestamp: new Date().toISOString()
        });
      });

      socket.on('disconnect', (reason: string) => {
        logger.info(`Client disconnected: ${socket.id} (User: ${socket.userId}) - Reason: ${reason}`);
      });

      socket.on('error', (error: Error) => {
        logger.error(`Socket error for ${socket.id}:`, error);
      });
    });
  }

  private startPriceUpdateBroadcast() {
    // Broadcast price updates every 5 seconds
    this.priceUpdateInterval = setInterval(async () => {
      try {
        await this.broadcastPriceUpdates();
      } catch (error) {
        logger.error('Error broadcasting price updates:', error);
      }
    }, 5000);

    logger.info('Price update broadcast started (5s interval)');
  }

  private async broadcastPriceUpdates() {
    try {
      // Get all rooms that start with 'market:'
      const rooms = this.io.sockets.adapter.rooms;
      const marketRooms = Array.from(rooms.keys()).filter(room => room.startsWith('market:'));

      if (marketRooms.length === 0) return;

      // Extract symbols from room names
      const symbols = marketRooms.map(room => room.replace('market:', ''));
      
      // Get latest price data for all subscribed symbols
      const priceUpdates = await this.realTimeDataService.getLatestPrices(symbols);

      // Broadcast to each market room
      for (const update of priceUpdates) {
        const roomName = `market:${update.symbol}`;
        this.io.to(roomName).emit('price_update', {
          symbol: update.symbol,
          price: update.price,
          change24h: update.change24h || 0,
          changePercent24h: update.changePercent24h || 0,
          volume24h: update.volume24h || 0,
          lastUpdate: update.lastUpdate.toISOString(),
          source: update.source || 'aggregated'
        });
      }

      // Also trigger portfolio recalculations for affected portfolios
      await this.triggerPortfolioUpdates(symbols);
    } catch (error) {
      logger.error('Error in price update broadcast:', error);
    }
  }

  private async triggerPortfolioUpdates(updatedSymbols: string[]) {
    try {
      // Get all portfolio rooms
      const rooms = this.io.sockets.adapter.rooms;
      const portfolioRooms = Array.from(rooms.keys()).filter(room => room.startsWith('portfolio:'));

      for (const roomName of portfolioRooms) {
        const portfolioId = roomName.replace('portfolio:', '');
        
        try {
          // Check if this portfolio has holdings in the updated symbols
          const hasUpdatedSymbols = await this.portfolioCalcService.portfolioHasSymbols(portfolioId, updatedSymbols);
          
          if (hasUpdatedSymbols) {
            // Recalculate and broadcast portfolio data
            const portfolioData = await this.portfolioCalcService.getPortfolioRealTimeData(portfolioId);
            
            if (portfolioData) {
              this.io.to(roomName).emit('portfolio_update', {
                portfolioId,
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
          }
        } catch (portfolioError) {
          logger.warn(`Failed to update portfolio ${portfolioId}:`, portfolioError);
        }
      }
    } catch (error) {
      logger.error('Error triggering portfolio updates:', error);
    }
  }

  public async broadcastToPortfolio(portfolioId: string, event: string, data: any) {
    this.io.to(`portfolio:${portfolioId}`).emit(event, data);
  }

  public async broadcastToMarket(symbol: string, event: string, data: any) {
    this.io.to(`market:${symbol}`).emit(event, data);
  }

  public async broadcastOrderBookUpdate(symbol: string, orderBook: any) {
    this.io.to(`orderbook:${symbol}`).emit('orderbook_update', {
      symbol,
      bids: orderBook.bids,
      asks: orderBook.asks,
      timestamp: new Date().toISOString()
    });
  }

  public async broadcastTradeUpdate(symbol: string, trade: any) {
    this.io.to(`trades:${symbol}`).emit('trade_update', {
      symbol,
      price: trade.price,
      quantity: trade.quantity,
      side: trade.side,
      timestamp: trade.timestamp.toISOString(),
      tradeId: trade.id
    });
  }

  public getConnectionCount(): number {
    return this.io.engine.clientsCount;
  }

  public getActiveRooms(): string[] {
    return Array.from(this.io.sockets.adapter.rooms.keys());
  }

  public async shutdown() {
    logger.info('Shutting down WebSocket server...');
    
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
    }

    // Close all connections
    this.io.close((err) => {
      if (err) {
        logger.error('Error closing WebSocket server:', err);
      } else {
        logger.info('WebSocket server closed successfully');
      }
    });

    // Close Redis connections
    await this.redisService.disconnect();
  }
}

export default WebSocketServer;