# WebSocket Server Architecture

## Overview
Real-time communication architecture using WebSocket servers for live price updates, portfolio changes, and user notifications.

## WebSocket Server Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer                           │
│                 (Sticky Sessions)                          │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                WebSocket Gateway                           │
│              (Connection Management)                       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ WS Server 1 │  │ WS Server 2 │  │ WS Server 3 │
│   Node.js   │  │   Node.js   │  │   Node.js   │
└─────────────┘  └─────────────┘  └─────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Redis Pub/Sub                          │
│              (Cross-server messaging)                      │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Kafka Event Stream                        │
│              (Market data & portfolio events)              │
└─────────────────────────────────────────────────────────────┘
```

### WebSocket Server Implementation

```typescript
import WebSocket from 'ws';
import { Server } from 'http';
import { Redis } from 'ioredis';
import { Kafka, Consumer } from 'kafkajs';
import jwt from 'jsonwebtoken';

interface WSConnection extends WebSocket {
  userId?: string;
  connectionId: string;
  subscriptions: Set<string>;
  lastPing: number;
  isAlive: boolean;
}

interface SubscriptionMessage {
  type: 'subscribe' | 'unsubscribe';
  channels: string[];
}

interface PriceUpdateMessage {
  type: 'price_update';
  symbol: string;
  price: number;
  change24h: number;
  timestamp: number;
}

class WebSocketServer {
  private wss: WebSocket.Server;
  private redis: Redis;
  private connections: Map<string, WSConnection> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map(); // channel -> connectionIds
  private userConnections: Map<string, Set<string>> = new Map(); // userId -> connectionIds
  private kafkaConsumer: Consumer;

  constructor(
    server: Server,
    private redisConfig: any,
    private kafkaConfig: any
  ) {
    this.wss = new WebSocket.Server({
      server,
      path: '/ws',
      verifyClient: this.verifyClient.bind(this)
    });

    this.redis = new Redis(redisConfig);
    this.setupKafkaConsumer();
    this.setupWebSocketHandlers();
    this.setupRedisSubscriptions();
    this.startHeartbeat();
  }

  private async verifyClient(info: any): Promise<boolean> {
    try {
      const url = new URL(info.req.url, 'ws://localhost');
      const token = url.searchParams.get('token');
      
      if (!token) {
        return false;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      info.req.userId = decoded.userId;
      
      return true;
    } catch (error) {
      console.error('WebSocket authentication failed:', error);
      return false;
    }
  }

  private setupWebSocketHandlers(): void {
    this.wss.on('connection', (ws: WSConnection, req: any) => {
      const connectionId = this.generateConnectionId();
      const userId = req.userId;

      // Initialize connection
      ws.connectionId = connectionId;
      ws.userId = userId;
      ws.subscriptions = new Set();
      ws.lastPing = Date.now();
      ws.isAlive = true;

      // Store connection
      this.connections.set(connectionId, ws);
      
      // Track user connections
      if (!this.userConnections.has(userId)) {
        this.userConnections.set(userId, new Set());
      }
      this.userConnections.get(userId)!.add(connectionId);

      // Set up message handlers
      ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(ws, data);
      });

      ws.on('pong', () => {
        ws.isAlive = true;
        ws.lastPing = Date.now();
      });

      ws.on('close', () => {
        this.handleDisconnection(ws);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for connection ${connectionId}:`, error);
        this.handleDisconnection(ws);
      });

      // Send welcome message
      this.sendMessage(ws, {
        type: 'connection_established',
        connectionId,
        timestamp: Date.now()
      });

      console.log(`WebSocket connection established: ${connectionId} for user ${userId}`);
    });
  }

  private handleMessage(ws: WSConnection, data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(ws, message);
          break;
        
        case 'unsubscribe':
          this.handleUnsubscribe(ws, message);
          break;
        
        case 'ping':
          this.handlePing(ws);
          break;
        
        case 'get_portfolio':
          this.handleGetPortfolio(ws, message);
          break;
        
        default:
          this.sendError(ws, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      this.sendError(ws, 'Invalid message format');
    }
  }

  private handleSubscribe(ws: WSConnection, message: SubscriptionMessage): void {
    const { channels } = message;

    for (const channel of channels) {
      // Validate subscription permissions
      if (!this.canSubscribeToChannel(ws.userId!, channel)) {
        this.sendError(ws, `Not authorized to subscribe to channel: ${channel}`);
        continue;
      }

      // Add to connection subscriptions
      ws.subscriptions.add(channel);

      // Add to global subscriptions
      if (!this.subscriptions.has(channel)) {
        this.subscriptions.set(channel, new Set());
      }
      this.subscriptions.get(channel)!.add(ws.connectionId);

      // Subscribe to Redis channel if needed
      this.subscribeToRedisChannel(channel);
    }

    this.sendMessage(ws, {
      type: 'subscription_confirmed',
      channels: Array.from(ws.subscriptions),
      timestamp: Date.now()
    });
  }

  private handleUnsubscribe(ws: WSConnection, message: SubscriptionMessage): void {
    const { channels } = message;

    for (const channel of channels) {
      // Remove from connection subscriptions
      ws.subscriptions.delete(channel);

      // Remove from global subscriptions
      if (this.subscriptions.has(channel)) {
        this.subscriptions.get(channel)!.delete(ws.connectionId);
        
        // Clean up empty subscription sets
        if (this.subscriptions.get(channel)!.size === 0) {
          this.subscriptions.delete(channel);
          this.unsubscribeFromRedisChannel(channel);
        }
      }
    }

    this.sendMessage(ws, {
      type: 'unsubscription_confirmed',
      channels: Array.from(ws.subscriptions),
      timestamp: Date.now()
    });
  }

  private handlePing(ws: WSConnection): void {
    ws.lastPing = Date.now();
    this.sendMessage(ws, {
      type: 'pong',
      timestamp: Date.now()
    });
  }

  private async handleGetPortfolio(ws: WSConnection, message: any): Promise<void> {
    try {
      const portfolio = await this.getPortfolioData(ws.userId!);
      
      this.sendMessage(ws, {
        type: 'portfolio_data',
        data: portfolio,
        timestamp: Date.now()
      });
    } catch (error) {
      this.sendError(ws, 'Failed to fetch portfolio data');
    }
  }

  private handleDisconnection(ws: WSConnection): void {
    const { connectionId, userId } = ws;

    // Remove from connections
    this.connections.delete(connectionId);

    // Remove from user connections
    if (userId && this.userConnections.has(userId)) {
      this.userConnections.get(userId)!.delete(connectionId);
      
      if (this.userConnections.get(userId)!.size === 0) {
        this.userConnections.delete(userId);
      }
    }

    // Clean up subscriptions
    for (const channel of ws.subscriptions) {
      if (this.subscriptions.has(channel)) {
        this.subscriptions.get(channel)!.delete(connectionId);
        
        if (this.subscriptions.get(channel)!.size === 0) {
          this.subscriptions.delete(channel);
          this.unsubscribeFromRedisChannel(channel);
        }
      }
    }

    console.log(`WebSocket connection closed: ${connectionId}`);
  }

  private canSubscribeToChannel(userId: string, channel: string): boolean {
    // Price channels are public
    if (channel.startsWith('price:')) {
      return true;
    }

    // Portfolio channels require user ownership
    if (channel.startsWith('portfolio:')) {
      const channelUserId = channel.split(':')[1];
      return channelUserId === userId;
    }

    // Market data channels are public
    if (channel.startsWith('market:')) {
      return true;
    }

    return false;
  }

  private setupRedisSubscriptions(): void {
    const subscriber = new Redis(this.redisConfig);
    
    subscriber.on('message', (channel, message) => {
      this.broadcastToChannel(channel, JSON.parse(message));
    });

    // Subscribe to relevant Redis channels
    subscriber.psubscribe('price:*', 'portfolio:*', 'market:*');
  }

  private setupKafkaConsumer(): void {
    const kafka = new Kafka(this.kafkaConfig);
    this.kafkaConsumer = kafka.consumer({ groupId: 'websocket-server' });

    this.kafkaConsumer.subscribe({
      topics: [
        'market.prices.updated',
        'portfolio.holdings.updated',
        'notifications.push.send'
      ]
    });

    this.kafkaConsumer.run({
      eachMessage: async ({ topic, message }) => {
        const event = JSON.parse(message.value?.toString() || '{}');
        await this.handleKafkaEvent(topic, event);
      }
    });
  }

  private async handleKafkaEvent(topic: string, event: any): Promise<void> {
    switch (topic) {
      case 'market.prices.updated':
        await this.handlePriceUpdate(event);
        break;
      
      case 'portfolio.holdings.updated':
        await this.handlePortfolioUpdate(event);
        break;
      
      case 'notifications.push.send':
        await this.handleNotification(event);
        break;
    }
  }

  private async handlePriceUpdate(event: any): Promise<void> {
    const { symbol, price, change24h, timestamp } = event.data;
    
    const priceUpdate: PriceUpdateMessage = {
      type: 'price_update',
      symbol,
      price: parseFloat(price),
      change24h: parseFloat(change24h),
      timestamp
    };

    // Broadcast to price channel subscribers
    this.broadcastToChannel(`price:${symbol}`, priceUpdate);
    this.broadcastToChannel('price:*', priceUpdate);
  }

  private async handlePortfolioUpdate(event: any): Promise<void> {
    const { userId, totalValue, holdings } = event.data;
    
    const portfolioUpdate = {
      type: 'portfolio_update',
      totalValue: parseFloat(totalValue),
      holdings,
      timestamp: Date.now()
    };

    // Send to specific user's portfolio channel
    this.broadcastToChannel(`portfolio:${userId}`, portfolioUpdate);
  }

  private async handleNotification(event: any): Promise<void> {
    const { userId, message, type } = event.data;
    
    const notification = {
      type: 'notification',
      message,
      notificationType: type,
      timestamp: Date.now()
    };

    // Send to specific user
    this.sendToUser(userId, notification);
  }

  private broadcastToChannel(channel: string, message: any): void {
    const connectionIds = this.subscriptions.get(channel);
    
    if (!connectionIds || connectionIds.size === 0) {
      return;
    }

    const messageStr = JSON.stringify(message);
    
    for (const connectionId of connectionIds) {
      const connection = this.connections.get(connectionId);
      
      if (connection && connection.readyState === WebSocket.OPEN) {
        connection.send(messageStr);
      }
    }
  }

  private sendToUser(userId: string, message: any): void {
    const connectionIds = this.userConnections.get(userId);
    
    if (!connectionIds || connectionIds.size === 0) {
      return;
    }

    const messageStr = JSON.stringify(message);
    
    for (const connectionId of connectionIds) {
      const connection = this.connections.get(connectionId);
      
      if (connection && connection.readyState === WebSocket.OPEN) {
        connection.send(messageStr);
      }
    }
  }

  private sendMessage(ws: WSConnection, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WSConnection, error: string): void {
    this.sendMessage(ws, {
      type: 'error',
      message: error,
      timestamp: Date.now()
    });
  }

  private startHeartbeat(): void {
    setInterval(() => {
      this.wss.clients.forEach((ws: WSConnection) => {
        if (!ws.isAlive) {
          ws.terminate();
          return;
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 seconds
  }

  private subscribeToRedisChannel(channel: string): void {
    // Redis subscription logic here
    // This would typically be handled by the Redis subscriber instance
  }

  private unsubscribeFromRedisChannel(channel: string): void {
    // Redis unsubscription logic here
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getPortfolioData(userId: string): Promise<any> {
    // Fetch portfolio data from database or cache
    // This would integrate with your portfolio service
    return {
      userId,
      totalValue: 15000.50,
      holdings: [
        { symbol: 'BTC', quantity: 0.5, value: 22500 },
        { symbol: 'ETH', quantity: 10, value: 25000 }
      ]
    };
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down WebSocket server...');
    
    // Close all connections gracefully
    this.wss.clients.forEach((ws: WSConnection) => {
      ws.close(1000, 'Server shutting down');
    });

    // Disconnect from Kafka
    await this.kafkaConsumer.disconnect();

    // Close Redis connections
    await this.redis.quit();

    console.log('WebSocket server shut down complete');
  }
}
```

### WebSocket Gateway for Load Balancing

```typescript
import { createProxyMiddleware } from 'http-proxy-middleware';
import { Server } from 'http';
import Redis from 'ioredis';

interface ServerNode {
  id: string;
  host: string;
  port: number;
  connections: number;
  lastHeartbeat: number;
  isHealthy: boolean;
}

class WebSocketGateway {
  private servers: Map<string, ServerNode> = new Map();
  private redis: Redis;
  private userServerMap: Map<string, string> = new Map(); // userId -> serverId

  constructor(private redisConfig: any) {
    this.redis = new Redis(redisConfig);
    this.startHealthChecks();
    this.setupServerDiscovery();
  }

  async routeConnection(userId: string): Promise<ServerNode | null> {
    // Check if user has an existing server assignment
    const existingServerId = this.userServerMap.get(userId);
    
    if (existingServerId && this.servers.has(existingServerId)) {
      const server = this.servers.get(existingServerId)!;
      if (server.isHealthy) {
        return server;
      }
    }

    // Find the least loaded healthy server
    const healthyServers = Array.from(this.servers.values())
      .filter(server => server.isHealthy)
      .sort((a, b) => a.connections - b.connections);

    if (healthyServers.length === 0) {
      return null;
    }

    const selectedServer = healthyServers[0];
    
    // Store user-server mapping
    this.userServerMap.set(userId, selectedServer.id);
    await this.redis.hset('user_server_mapping', userId, selectedServer.id);

    return selectedServer;
  }

  private async setupServerDiscovery(): Promise<void> {
    // Subscribe to server registration events
    const subscriber = new Redis(this.redisConfig);
    
    subscriber.on('message', (channel, message) => {
      if (channel === 'ws_server_heartbeat') {
        const serverInfo = JSON.parse(message);
        this.updateServerInfo(serverInfo);
      }
    });

    subscriber.subscribe('ws_server_heartbeat');
  }

  private updateServerInfo(serverInfo: any): void {
    const server: ServerNode = {
      id: serverInfo.id,
      host: serverInfo.host,
      port: serverInfo.port,
      connections: serverInfo.connections,
      lastHeartbeat: Date.now(),
      isHealthy: true
    };

    this.servers.set(server.id, server);
  }

  private startHealthChecks(): void {
    setInterval(() => {
      const now = Date.now();
      const staleThreshold = 60000; // 1 minute

      for (const [serverId, server] of this.servers.entries()) {
        if (now - server.lastHeartbeat > staleThreshold) {
          server.isHealthy = false;
          console.warn(`Server ${serverId} marked as unhealthy`);
        }
      }
    }, 30000); // Check every 30 seconds
  }
}
```

### Client-Side WebSocket Implementation

```typescript
class CryptoPortfolioWebSocket {
  private ws: WebSocket | null = null;
  private subscriptions: Set<string> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(private baseUrl: string, private token: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.baseUrl}/ws?token=${this.token}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket closed', event.code, event.reason);
        this.handleReconnection();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
    });
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'price_update':
        this.onPriceUpdate?.(message);
        break;
      
      case 'portfolio_update':
        this.onPortfolioUpdate?.(message);
        break;
      
      case 'notification':
        this.onNotification?.(message);
        break;
      
      case 'error':
        console.error('WebSocket error:', message.message);
        break;
    }
  }

  subscribe(channels: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected');
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'subscribe',
      channels
    }));

    channels.forEach(channel => this.subscriptions.add(channel));
  }

  unsubscribe(channels: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'unsubscribe',
      channels
    }));

    channels.forEach(channel => this.subscriptions.delete(channel));
  }

  private handleReconnection(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect().then(() => {
          // Resubscribe to previous subscriptions
          if (this.subscriptions.size > 0) {
            this.subscribe(Array.from(this.subscriptions));
          }
        });
      }, delay);
    }
  }

  // Event handlers (to be set by client)
  onPriceUpdate?: (message: any) => void;
  onPortfolioUpdate?: (message: any) => void;
  onNotification?: (message: any) => void;

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }
}

// Usage example
const wsClient = new CryptoPortfolioWebSocket('ws://localhost:3000', 'jwt-token');

wsClient.onPriceUpdate = (message) => {
  console.log('Price update:', message);
  // Update UI with new price data
};

wsClient.onPortfolioUpdate = (message) => {
  console.log('Portfolio update:', message);
  // Update portfolio display
};

wsClient.connect().then(() => {
  wsClient.subscribe(['price:BTC', 'price:ETH', 'portfolio:user123']);
});
```

## Scaling Considerations

### Horizontal Scaling

1. **Multiple WebSocket Server Instances**
   - Load balancer with sticky sessions
   - Redis for cross-server messaging
   - Consistent user-to-server mapping

2. **Connection Distribution**
   - Round-robin with health checks
   - Least-connections algorithm
   - Geographic proximity routing

3. **State Management**
   - Stateless server design
   - Redis for connection tracking
   - Database for subscription persistence

### Performance Optimization

1. **Connection Pooling**
   - Limit connections per server
   - Graceful connection handling
   - Memory usage monitoring

2. **Message Batching**
   - Batch price updates
   - Compress large messages
   - Debounce rapid updates

3. **Caching Strategy**
   - Cache subscription data
   - Local connection state
   - Redis for cross-server cache

This WebSocket architecture provides:
- **Real-time Performance**: Sub-100ms message delivery
- **Scalability**: Horizontal scaling with load balancing
- **Reliability**: Automatic reconnection and failover
- **Security**: JWT authentication and channel authorization
- **Monitoring**: Connection tracking and health checks