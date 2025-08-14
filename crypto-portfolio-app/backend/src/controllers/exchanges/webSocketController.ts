import { Request, Response } from 'express';
import { webSocketManager } from '../../services/exchanges/webSocketManager';
import { loggingService } from '../../services/loggingService';
import { auditService } from '../../services/auditService';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export class WebSocketController {
  /**
   * Connect to exchange WebSocket
   * @route POST /api/v1/exchanges/websocket/connect
   */
  async connect(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { exchange, symbols = [] } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'User authentication required'
        });
        return;
      }

      if (!exchange) {
        res.status(400).json({
          success: false,
          error: 'Missing exchange',
          message: 'Exchange parameter is required'
        });
        return;
      }

      // Validate exchange
      const supportedExchanges = ['binance', 'coinbase', 'kraken', 'kucoin'];
      if (!supportedExchanges.includes(exchange)) {
        res.status(400).json({
          success: false,
          error: 'Invalid exchange',
          message: `Exchange must be one of: ${supportedExchanges.join(', ')}`
        });
        return;
      }

      // Connect to WebSocket
      const connected = await webSocketManager.connect(exchange, symbols);

      // Audit log
      await auditService.log({
        userId,
        action: 'websocket_connect',
        resource: 'websocket',
        details: { exchange, symbols }
      });

      loggingService.info('WebSocket connected via API', { userId, exchange, symbols });

      res.status(200).json({
        success: true,
        data: {
          connected,
          exchange,
          symbols,
          timestamp: new Date().toISOString()
        },
        message: `WebSocket connected to ${exchange} successfully`
      });
    } catch (error) {
      loggingService.error('Error connecting WebSocket via API', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to connect WebSocket'
      });
    }
  }

  /**
   * Disconnect from exchange WebSocket
   * @route POST /api/v1/exchanges/websocket/disconnect
   */
  async disconnect(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { exchange } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'User authentication required'
        });
        return;
      }

      if (!exchange) {
        res.status(400).json({
          success: false,
          error: 'Missing exchange',
          message: 'Exchange parameter is required'
        });
        return;
      }

      // Disconnect WebSocket
      const disconnected = await webSocketManager.disconnect(exchange);

      if (!disconnected) {
        res.status(404).json({
          success: false,
          error: 'Connection not found',
          message: `No active WebSocket connection found for ${exchange}`
        });
        return;
      }

      // Audit log
      await auditService.log({
        userId,
        action: 'websocket_disconnect',
        resource: 'websocket',
        details: { exchange }
      });

      loggingService.info('WebSocket disconnected via API', { userId, exchange });

      res.status(200).json({
        success: true,
        data: {
          disconnected,
          exchange,
          timestamp: new Date().toISOString()
        },
        message: `WebSocket disconnected from ${exchange} successfully`
      });
    } catch (error) {
      loggingService.error('Error disconnecting WebSocket via API', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to disconnect WebSocket'
      });
    }
  }

  /**
   * Subscribe to WebSocket streams
   * @route POST /api/v1/exchanges/websocket/subscribe
   */
  async subscribe(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { exchange, symbols = [], types = ['ticker'] } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'User authentication required'
        });
        return;
      }

      if (!exchange || !symbols.length) {
        res.status(400).json({
          success: false,
          error: 'Missing parameters',
          message: 'Exchange and symbols are required'
        });
        return;
      }

      // Validate stream types
      const validTypes = ['price', 'trade', 'orderbook', 'ticker'];
      const invalidTypes = types.filter((type: string) => !validTypes.includes(type));
      if (invalidTypes.length > 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid stream types',
          message: `Invalid types: ${invalidTypes.join(', ')}. Valid types: ${validTypes.join(', ')}`
        });
        return;
      }

      // Create subscription
      const subscriptionId = await webSocketManager.subscribe({
        exchange,
        symbols,
        types,
        userId
      });

      // Audit log
      await auditService.log({
        userId,
        action: 'websocket_subscribe',
        resource: 'websocket_subscription',
        details: { subscriptionId, exchange, symbols, types }
      });

      loggingService.info('WebSocket subscription created via API', {
        userId,
        subscriptionId,
        exchange,
        symbols,
        types
      });

      res.status(201).json({
        success: true,
        data: {
          subscriptionId,
          exchange,
          symbols,
          types,
          timestamp: new Date().toISOString()
        },
        message: 'WebSocket subscription created successfully'
      });
    } catch (error) {
      loggingService.error('Error creating WebSocket subscription via API', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to create WebSocket subscription'
      });
    }
  }

  /**
   * Unsubscribe from WebSocket streams
   * @route DELETE /api/v1/exchanges/websocket/subscribe/:subscriptionId
   */
  async unsubscribe(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { subscriptionId } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'User authentication required'
        });
        return;
      }

      if (!subscriptionId) {
        res.status(400).json({
          success: false,
          error: 'Missing subscription ID',
          message: 'Subscription ID parameter is required'
        });
        return;
      }

      // Unsubscribe
      const unsubscribed = await webSocketManager.unsubscribe(subscriptionId);

      if (!unsubscribed) {
        res.status(404).json({
          success: false,
          error: 'Subscription not found',
          message: `Subscription ${subscriptionId} not found`
        });
        return;
      }

      // Audit log
      await auditService.log({
        userId,
        action: 'websocket_unsubscribe',
        resource: 'websocket_subscription',
        details: { subscriptionId }
      });

      loggingService.info('WebSocket unsubscribed via API', { userId, subscriptionId });

      res.status(200).json({
        success: true,
        data: {
          unsubscribed,
          subscriptionId,
          timestamp: new Date().toISOString()
        },
        message: 'WebSocket unsubscribed successfully'
      });
    } catch (error) {
      loggingService.error('Error unsubscribing WebSocket via API', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to unsubscribe WebSocket'
      });
    }
  }

  /**
   * Get WebSocket connection status
   * @route GET /api/v1/exchanges/websocket/status
   */
  async getStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'User authentication required'
        });
        return;
      }

      const connectionStatus = webSocketManager.getConnectionStatus();
      const activeSubscriptions = webSocketManager.getActiveSubscriptions();

      // Filter subscriptions by user
      const userSubscriptions = activeSubscriptions.filter(sub => sub.userId === userId);

      res.status(200).json({
        success: true,
        data: {
          connections: connectionStatus,
          activeSubscriptions: userSubscriptions.length,
          subscriptions: userSubscriptions.map(sub => ({
            id: sub.id,
            exchange: sub.exchange,
            symbols: sub.symbols,
            types: sub.types,
            createdAt: sub.createdAt
          })),
          timestamp: new Date().toISOString()
        },
        message: 'WebSocket status retrieved successfully'
      });
    } catch (error) {
      loggingService.error('Error getting WebSocket status via API', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to get WebSocket status'
      });
    }
  }

  /**
   * Get cached stream data
   * @route GET /api/v1/exchanges/websocket/data/:exchange/:symbol
   */
  async getCachedData(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { exchange, symbol } = req.params;
      const { type = 'ticker' } = req.query;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'User authentication required'
        });
        return;
      }

      if (!exchange || !symbol) {
        res.status(400).json({
          success: false,
          error: 'Missing parameters',
          message: 'Exchange and symbol parameters are required'
        });
        return;
      }

      // Get cached data
      const cachedData = await webSocketManager.getCachedData(exchange, symbol, type as string);

      if (!cachedData) {
        res.status(404).json({
          success: false,
          error: 'Data not found',
          message: `No cached data found for ${symbol} on ${exchange}`
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: cachedData,
        message: 'Cached stream data retrieved successfully'
      });
    } catch (error) {
      loggingService.error('Error getting cached stream data via API', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to get cached stream data'
      });
    }
  }

  /**
   * Disconnect all WebSocket connections
   * @route POST /api/v1/exchanges/websocket/disconnect-all
   */
  async disconnectAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'User authentication required'
        });
        return;
      }

      // Check if user has admin role for this operation
      if (req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Admin role required for this operation'
        });
        return;
      }

      await webSocketManager.disconnectAll();

      // Audit log
      await auditService.log({
        userId,
        action: 'websocket_disconnect_all',
        resource: 'websocket',
        details: {}
      });

      loggingService.info('All WebSocket connections disconnected via API', { userId });

      res.status(200).json({
        success: true,
        data: {
          timestamp: new Date().toISOString()
        },
        message: 'All WebSocket connections disconnected successfully'
      });
    } catch (error) {
      loggingService.error('Error disconnecting all WebSocket connections via API', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to disconnect all WebSocket connections'
      });
    }
  }
}

// Create singleton instance
export const webSocketController = new WebSocketController();
export default webSocketController;