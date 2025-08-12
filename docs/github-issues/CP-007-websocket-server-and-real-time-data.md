# CP-007: WebSocket Server and Real-Time Data

## 📋 Issue Type
**Feature** - Real-Time Infrastructure

## 🎯 Objective
Implement a high-performance WebSocket server for real-time cryptocurrency price updates, portfolio value changes, and live market data streaming to connected clients.

## 📝 Description
Build a robust WebSocket infrastructure that handles thousands of concurrent connections, provides real-time cryptocurrency price feeds, portfolio updates, and market data. The system must be scalable, fault-tolerant, and provide sub-second latency for critical updates.

## ✅ Acceptance Criteria

### WebSocket Server Infrastructure
- [ ] Socket.IO server with clustering support
- [ ] Connection authentication and authorization
- [ ] Room-based subscription management
- [ ] Connection state management and recovery
- [ ] Rate limiting for WebSocket connections
- [ ] Heartbeat mechanism for connection health
- [ ] Graceful connection handling and cleanup

### Real-Time Data Streams
- [ ] Live cryptocurrency price updates
- [ ] Portfolio value changes
- [ ] Exchange order book updates
- [ ] Trade execution notifications
- [ ] Market trend alerts
- [ ] Technical analysis indicator updates
- [ ] News and announcement feeds

### Performance and Scalability
- [ ] Horizontal scaling with Redis adapter
- [ ] Message queuing for reliable delivery
- [ ] Connection pooling and load balancing
- [ ] Memory-efficient message handling
- [ ] Configurable update intervals per data type
- [ ] Bandwidth optimization and compression
- [ ] Performance monitoring and metrics

### Client Communication Patterns
- [ ] Subscribe/unsubscribe to data feeds
- [ ] Personal portfolio updates
- [ ] Broadcast market-wide updates
- [ ] Private user notifications
- [ ] System status and maintenance alerts
- [ ] Error handling and reconnection logic

## 🛠️ Technical Implementation

### WebSocket Server Architecture
```typescript
// websocket/server.ts
import { Server } from 'socket.io';
import { createServer } from 'http';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import jwt from 'jsonwebtoken';
import { authenticateSocket } from './middleware/auth.middleware';
import { rateLimitSocket } from './middleware/rateLimit.middleware';
import { portfolioHandlers } from './handlers/portfolio.handlers';
import { marketHandlers } from './handlers/market.handlers';

export class WebSocketServer {
  private io: Server;
  private redisClient: any;

  constructor(httpServer: any) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupRedisAdapter();
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private async setupRedisAdapter() {
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();
    
    await Promise.all([pubClient.connect(), subClient.connect()]);
    
    this.io.adapter(createAdapter(pubClient, subClient));
    this.redisClient = pubClient;
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(authenticateSocket);
    
    // Rate limiting middleware
    this.io.use(rateLimitSocket);
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}, User: ${socket.userId}`);

      // Join user to personal room
      socket.join(`user:${socket.userId}`);

      // Setup handlers
      portfolioHandlers(socket, this.io);
      marketHandlers(socket, this.io);

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${socket.id}, Reason: ${reason}`);
        this.handleDisconnection(socket);
      });
    });
  }

  private handleDisconnection(socket: any) {
    // Clean up subscriptions
    socket.rooms.forEach((room: string) => {
      if (room.startsWith('portfolio:') || room.startsWith('market:')) {
        socket.leave(room);
      }
    });
  }

  // Broadcast methods
  public broadcastPriceUpdate(symbol: string, data: PriceData) {
    this.io.to(`market:${symbol}`).emit('price_update', data);
  }

  public broadcastPortfolioUpdate(userId: string, portfolioData: PortfolioData) {
    this.io.to(`user:${userId}`).emit('portfolio_update', portfolioData);
  }

  public broadcastMarketAlert(alertData: MarketAlert) {
    this.io.emit('market_alert', alertData);
  }
}
```

### Authentication Middleware
```typescript
// middleware/auth.middleware.ts
import jwt from 'jsonwebtoken';
import { Socket } from 'socket.io';

export const authenticateSocket = async (socket: Socket, next: Function) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Attach user info to socket
    socket.userId = decoded.userId;
    socket.userRole = decoded.role;
    
    next();
  } catch (error) {
    next(new Error('Invalid authentication token'));
  }
};

export const rateLimitSocket = async (socket: Socket, next: Function) => {
  const clientIP = socket.handshake.address;
  const key = `socket_rate_limit:${clientIP}`;
  
  // Implement rate limiting logic
  // Allow 100 connections per IP per minute
  const connectionCount = await redis.incr(key);
  if (connectionCount === 1) {
    await redis.expire(key, 60);
  }
  
  if (connectionCount > 100) {
    return next(new Error('Rate limit exceeded'));
  }
  
  next();
};
```

### Market Data Handlers
```typescript
// handlers/market.handlers.ts
import { Socket, Server } from 'socket.io';
import { MarketDataService } from '../services/marketData.service';

export const marketHandlers = (socket: Socket, io: Server) => {
  const marketService = new MarketDataService();

  // Subscribe to price updates for specific symbols
  socket.on('subscribe_prices', async (symbols: string[]) => {
    try {
      for (const symbol of symbols) {
        await socket.join(`market:${symbol}`);
        
        // Send current price immediately
        const currentPrice = await marketService.getCurrentPrice(symbol);
        socket.emit('price_update', { symbol, ...currentPrice });
      }
      
      socket.emit('subscription_confirmed', { 
        type: 'prices', 
        symbols,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      socket.emit('subscription_error', { 
        type: 'prices', 
        error: error.message 
      });
    }
  });

  // Unsubscribe from price updates
  socket.on('unsubscribe_prices', async (symbols: string[]) => {
    for (const symbol of symbols) {
      await socket.leave(`market:${symbol}`);
    }
    
    socket.emit('unsubscription_confirmed', { 
      type: 'prices', 
      symbols 
    });
  });

  // Subscribe to order book updates
  socket.on('subscribe_orderbook', async (data: { symbol: string, depth?: number }) => {
    const { symbol, depth = 20 } = data;
    
    await socket.join(`orderbook:${symbol}`);
    
    // Send current order book
    const orderBook = await marketService.getOrderBook(symbol, depth);
    socket.emit('orderbook_update', { symbol, ...orderBook });
  });

  // Subscribe to trade stream
  socket.on('subscribe_trades', async (symbol: string) => {
    await socket.join(`trades:${symbol}`);
    
    // Send recent trades
    const recentTrades = await marketService.getRecentTrades(symbol, 50);
    socket.emit('recent_trades', { symbol, trades: recentTrades });
  });
};
```

### Portfolio Data Handlers
```typescript
// handlers/portfolio.handlers.ts
import { Socket, Server } from 'socket.io';
import { PortfolioService } from '../services/portfolio.service';

export const portfolioHandlers = (socket: Socket, io: Server) => {
  const portfolioService = new PortfolioService();

  // Subscribe to portfolio updates
  socket.on('subscribe_portfolio', async (portfolioId: string) => {
    try {
      // Verify user owns this portfolio
      const hasAccess = await portfolioService.verifyUserAccess(
        socket.userId, 
        portfolioId
      );
      
      if (!hasAccess) {
        return socket.emit('subscription_error', {
          type: 'portfolio',
          error: 'Access denied to portfolio'
        });
      }

      await socket.join(`portfolio:${portfolioId}`);
      
      // Send current portfolio data
      const portfolioData = await portfolioService.getPortfolioRealTimeData(portfolioId);
      socket.emit('portfolio_update', portfolioData);
      
      socket.emit('subscription_confirmed', {
        type: 'portfolio',
        portfolioId
      });
    } catch (error) {
      socket.emit('subscription_error', {
        type: 'portfolio',
        error: error.message
      });
    }
  });

  // Subscribe to all user portfolios
  socket.on('subscribe_all_portfolios', async () => {
    try {
      const userPortfolios = await portfolioService.getUserPortfolios(socket.userId);
      
      for (const portfolio of userPortfolios) {
        await socket.join(`portfolio:${portfolio.id}`);
      }
      
      // Send current portfolio data for all portfolios
      const portfoliosData = await portfolioService.getAllPortfoliosRealTimeData(
        socket.userId
      );
      
      socket.emit('all_portfolios_update', portfoliosData);
    } catch (error) {
      socket.emit('subscription_error', {
        type: 'all_portfolios',
        error: error.message
      });
    }
  });

  // Handle manual portfolio refresh
  socket.on('refresh_portfolio', async (portfolioId: string) => {
    try {
      const hasAccess = await portfolioService.verifyUserAccess(
        socket.userId, 
        portfolioId
      );
      
      if (!hasAccess) {
        return socket.emit('refresh_error', {
          portfolioId,
          error: 'Access denied'
        });
      }

      // Trigger fresh data sync
      await portfolioService.syncPortfolioData(portfolioId);
      
      const updatedData = await portfolioService.getPortfolioRealTimeData(portfolioId);
      socket.emit('portfolio_update', updatedData);
    } catch (error) {
      socket.emit('refresh_error', {
        portfolioId,
        error: error.message
      });
    }
  });
};
```

### Real-Time Data Service
```typescript
// services/realTimeData.service.ts
import { WebSocketServer } from '../websocket/server';
import { PriceUpdateService } from './priceUpdate.service';
import { PortfolioCalculationService } from './portfolioCalculation.service';

export class RealTimeDataService {
  private wsServer: WebSocketServer;
  private priceService: PriceUpdateService;
  private portfolioCalcService: PortfolioCalculationService;

  constructor(wsServer: WebSocketServer) {
    this.wsServer = wsServer;
    this.priceService = new PriceUpdateService();
    this.portfolioCalcService = new PortfolioCalculationService();
    
    this.startPriceUpdateStreams();
    this.startPortfolioCalculations();
  }

  private startPriceUpdateStreams() {
    // Connect to multiple exchange WebSocket feeds
    const exchanges = ['binance', 'coinbase', 'kraken'];
    
    exchanges.forEach(exchange => {
      this.priceService.connectToExchange(exchange, (priceUpdate) => {
        // Broadcast price update to all subscribers
        this.wsServer.broadcastPriceUpdate(priceUpdate.symbol, priceUpdate);
        
        // Trigger portfolio recalculations for affected portfolios
        this.triggerPortfolioUpdates(priceUpdate.symbol, priceUpdate.price);
      });
    });
  }

  private startPortfolioCalculations() {
    // Run portfolio calculations every 30 seconds
    setInterval(async () => {
      await this.calculateAllPortfolioValues();
    }, 30000);
  }

  private async triggerPortfolioUpdates(symbol: string, newPrice: number) {
    // Find all portfolios that hold this cryptocurrency
    const affectedPortfolios = await this.portfolioCalcService
      .getPortfoliosWithSymbol(symbol);
    
    for (const portfolio of affectedPortfolios) {
      const updatedValue = await this.portfolioCalcService
        .calculatePortfolioValue(portfolio.id, { [symbol]: newPrice });
      
      this.wsServer.broadcastPortfolioUpdate(portfolio.userId, {
        portfolioId: portfolio.id,
        totalValue: updatedValue.total,
        change24h: updatedValue.change24h,
        changePercent: updatedValue.changePercent,
        lastUpdate: new Date().toISOString()
      });
    }
  }

  private async calculateAllPortfolioValues() {
    const allPortfolios = await this.portfolioCalcService.getAllActivePortfolios();
    
    const batches = this.chunkArray(allPortfolios, 50); // Process in batches
    
    for (const batch of batches) {
      await Promise.all(batch.map(async (portfolio) => {
        try {
          const updatedValue = await this.portfolioCalcService
            .calculatePortfolioValue(portfolio.id);
          
          this.wsServer.broadcastPortfolioUpdate(portfolio.userId, {
            portfolioId: portfolio.id,
            ...updatedValue,
            lastUpdate: new Date().toISOString()
          });
        } catch (error) {
          console.error(`Error calculating portfolio ${portfolio.id}:`, error);
        }
      }));
    }
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
```

### Client-Side Integration Example
```typescript
// Frontend WebSocket client example
import { io, Socket } from 'socket.io-client';

class CryptoWebSocketClient {
  private socket: Socket;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(token: string) {
    this.socket = io(process.env.REACT_APP_WS_URL!, {
      auth: { token },
      transports: ['websocket'],
      autoConnect: false
    });

    this.setupEventHandlers();
  }

  connect() {
    this.socket.connect();
  }

  private setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('Connected to WebSocket server');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      this.handleReconnection();
    });

    this.socket.on('price_update', (data) => {
      // Update price in UI
      this.updatePriceInUI(data);
    });

    this.socket.on('portfolio_update', (data) => {
      // Update portfolio values in UI
      this.updatePortfolioInUI(data);
    });
  }

  subscribeToPrices(symbols: string[]) {
    this.socket.emit('subscribe_prices', symbols);
  }

  subscribeToPortfolio(portfolioId: string) {
    this.socket.emit('subscribe_portfolio', portfolioId);
  }

  private handleReconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.socket.connect();
      }, Math.pow(2, this.reconnectAttempts) * 1000);
    }
  }
}
```

## 🧪 Testing Requirements
- [ ] WebSocket connection and authentication tests
- [ ] Message broadcasting and delivery tests
- [ ] Load testing with thousands of concurrent connections
- [ ] Failover and reconnection testing
- [ ] Memory leak detection
- [ ] Performance benchmarking

## 🔗 Dependencies
- **Depends on**: CP-006 (API Foundation), CP-004 (Database)
- **Blocks**: CP-026 (Frontend Dashboard), CP-036 (Real-time Charts)

## 🎯 Definition of Done
- [ ] WebSocket server handles 1000+ concurrent connections
- [ ] Real-time price updates with <500ms latency
- [ ] Portfolio updates triggered by price changes
- [ ] Authentication and authorization working
- [ ] Graceful connection handling implemented
- [ ] Performance monitoring active
- [ ] Load testing benchmarks met
- [ ] Client reconnection logic functional

## 📚 Resources
- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [WebSocket Performance Best Practices](https://blog.websocket.org/articles/best-practices-for-websocket-performance/)
- [Real-time Architecture Patterns](https://blog.logrocket.com/websockets-tutorial-how-to-go-real-time-with-node-and-react-8e4693fbf843/)

## 🏷️ Labels
`websocket`, `real-time`, `performance`, `scalability`, `backend`

## ⏱️ Estimated Time
**20-28 hours** for experienced real-time systems developer

## 👥 Assignee
Requires developer with:
- WebSocket and Socket.IO expertise
- Real-time systems experience
- Performance optimization skills
- Scalability architecture knowledge

---
*Real-time data is the heart of a crypto portfolio app. Design for scale from day one.*