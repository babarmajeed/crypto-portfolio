import { Socket } from 'socket.io';
import { logger } from '@/utils/logger';
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '@/types/websocket.types';

type SocketType = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

interface ConnectionLog {
  socketId: string;
  userId?: string;
  connectedAt: Date;
  ipAddress: string;
  userAgent?: string;
  events: Array<{
    event: string;
    timestamp: Date;
    data?: any;
    error?: string;
  }>;
}

class SocketLogger {
  private connections = new Map<string, ConnectionLog>();
  private eventCounts = new Map<string, number>();

  logConnection(socket: SocketType): void {
    const connectionData: ConnectionLog = {
      socketId: socket.id,
      userId: socket.data?.user?.id,
      connectedAt: new Date(),
      ipAddress: this.getClientIP(socket),
      userAgent: socket.handshake.headers['user-agent'],
      events: []
    };

    this.connections.set(socket.id, connectionData);

    logger.info('🔌 WebSocket Connection', {
      socketId: socket.id,
      userId: socket.data?.user?.id,
      userEmail: socket.data?.user?.email,
      ipAddress: connectionData.ipAddress,
      userAgent: connectionData.userAgent,
      timestamp: connectionData.connectedAt.toISOString()
    });
  }

  logEvent(socket: SocketType, eventName: string, data?: any, error?: string): void {
    const connection = this.connections.get(socket.id);
    if (connection) {
      connection.events.push({
        event: eventName,
        timestamp: new Date(),
        data: this.sanitizeData(data),
        error
      });

      // Keep only last 100 events per connection
      if (connection.events.length > 100) {
        connection.events = connection.events.slice(-100);
      }
    }

    // Track event counts
    const countKey = `${eventName}_${socket.data?.user?.id || 'anonymous'}`;
    this.eventCounts.set(countKey, (this.eventCounts.get(countKey) || 0) + 1);

    // Log based on event type and error status
    if (error) {
      logger.error(`❌ WebSocket Event Error: ${eventName}`, {
        socketId: socket.id,
        userId: socket.data?.user?.id,
        error,
        data: this.sanitizeData(data),
        timestamp: new Date().toISOString()
      });
    } else if (this.isImportantEvent(eventName)) {
      logger.info(`📡 WebSocket Event: ${eventName}`, {
        socketId: socket.id,
        userId: socket.data?.user?.id,
        data: this.sanitizeData(data),
        timestamp: new Date().toISOString()
      });
    } else {
      logger.debug(`📡 WebSocket Event: ${eventName}`, {
        socketId: socket.id,
        userId: socket.data?.user?.id,
        timestamp: new Date().toISOString()
      });
    }
  }

  logDisconnection(socket: SocketType, reason: string): void {
    const connection = this.connections.get(socket.id);
    if (connection) {
      const duration = Date.now() - connection.connectedAt.getTime();
      const eventCount = connection.events.length;

      logger.info('🔌 WebSocket Disconnection', {
        socketId: socket.id,
        userId: connection.userId,
        reason,
        duration: `${Math.round(duration / 1000)}s`,
        eventCount,
        timestamp: new Date().toISOString()
      });

      // Log session summary for authenticated users
      if (connection.userId) {
        this.logSessionSummary(connection, duration);
      }

      this.connections.delete(socket.id);
    }
  }

  private logSessionSummary(connection: ConnectionLog, duration: number): void {
    const eventSummary = connection.events.reduce((summary, event) => {
      summary[event.event] = (summary[event.event] || 0) + 1;
      return summary;
    }, {} as Record<string, number>);

    const errors = connection.events.filter(e => e.error).length;

    logger.info('📊 WebSocket Session Summary', {
      socketId: connection.socketId,
      userId: connection.userId,
      duration: `${Math.round(duration / 1000)}s`,
      totalEvents: connection.events.length,
      uniqueEvents: Object.keys(eventSummary).length,
      errors,
      eventBreakdown: eventSummary,
      timestamp: new Date().toISOString()
    });
  }

  private getClientIP(socket: SocketType): string {
    const forwarded = socket.handshake.headers['x-forwarded-for'];
    const realIP = socket.handshake.headers['x-real-ip'];
    
    if (forwarded) {
      return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
    }
    
    if (realIP) {
      return Array.isArray(realIP) ? realIP[0] : realIP;
    }
    
    return socket.handshake.address || 'unknown';
  }

  private sanitizeData(data: any): any {
    if (!data) return data;
    
    // Create a copy to avoid modifying original data
    const sanitized = JSON.parse(JSON.stringify(data));
    
    // Remove sensitive fields
    const sensitiveFields = ['token', 'password', 'apiKey', 'secret', 'privateKey'];
    
    const removeSensitiveFields = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      if (Array.isArray(obj)) {
        return obj.map(removeSensitiveFields);
      }
      
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = removeSensitiveFields(value);
        }
      }
      return result;
    };
    
    return removeSensitiveFields(sanitized);
  }

  private isImportantEvent(eventName: string): boolean {
    const importantEvents = [
      'authenticate',
      'subscribe_prices',
      'subscribe_portfolio',
      'unsubscribe_prices',
      'unsubscribe_portfolio',
      'error'
    ];
    
    return importantEvents.includes(eventName) || eventName.includes('error');
  }

  getConnectionStats(): any {
    const stats = {
      activeConnections: this.connections.size,
      authenticatedConnections: Array.from(this.connections.values())
        .filter(c => c.userId).length,
      totalEvents: Array.from(this.connections.values())
        .reduce((sum, c) => sum + c.events.length, 0),
      eventBreakdown: {},
      averageEventsPerConnection: 0
    };

    // Calculate event breakdown
    const eventBreakdown: Record<string, number> = {};
    for (const connection of this.connections.values()) {
      for (const event of connection.events) {
        eventBreakdown[event.event] = (eventBreakdown[event.event] || 0) + 1;
      }
    }

    stats.eventBreakdown = eventBreakdown;
    stats.averageEventsPerConnection = stats.activeConnections > 0 
      ? Math.round(stats.totalEvents / stats.activeConnections) 
      : 0;

    return stats;
  }

  cleanup(): void {
    // Clean up old connections (shouldn't happen normally, but safety measure)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const expiredConnections: string[] = [];

    for (const [socketId, connection] of this.connections.entries()) {
      if (connection.connectedAt.getTime() < oneHourAgo) {
        expiredConnections.push(socketId);
      }
    }

    expiredConnections.forEach(socketId => {
      this.connections.delete(socketId);
    });

    if (expiredConnections.length > 0) {
      logger.warn(`🧹 Cleaned up ${expiredConnections.length} stale socket connections`);
    }
  }
}

// Create global logger instance
const socketLogger = new SocketLogger();

// Clean up every 30 minutes
setInterval(() => {
  socketLogger.cleanup();
}, 30 * 60 * 1000);

export const loggingMiddleware = (socket: SocketType, next: (err?: any) => void) => {
  // Log connection
  socketLogger.logConnection(socket);

  // Wrap socket emit to log outgoing events
  const originalEmit = socket.emit.bind(socket);
  socket.emit = (event: string, ...args: any[]) => {
    socketLogger.logEvent(socket, `emit:${event}`, args);
    return originalEmit(event, ...args);
  };

  // Set up event logging for incoming events
  const originalOn = socket.on.bind(socket);
  socket.on = (event: string, listener: Function) => {
    const wrappedListener = (...args: any[]) => {
      try {
        socketLogger.logEvent(socket, event, args);
        return listener(...args);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        socketLogger.logEvent(socket, event, args, errorMessage);
        throw error;
      }
    };
    
    return originalOn(event, wrappedListener);
  };

  // Log disconnection
  socket.on('disconnect', (reason) => {
    socketLogger.logDisconnection(socket, reason);
  });

  // Log errors
  socket.on('error', (error) => {
    socketLogger.logEvent(socket, 'error', { error: error.message }, error.message);
  });

  next();
};

// Export functions for manual logging
export const logWebSocketEvent = (socket: SocketType, eventName: string, data?: any, error?: string) => {
  socketLogger.logEvent(socket, eventName, data, error);
};

export const getWebSocketStats = () => {
  return socketLogger.getConnectionStats();
};

// Performance monitoring
export const performanceLogger = {
  measureEventTime: (socket: SocketType, eventName: string) => {
    const startTime = Date.now();
    
    return {
      end: (success: boolean = true, additionalData?: any) => {
        const duration = Date.now() - startTime;
        
        if (duration > 1000) { // Log slow events (>1s)
          logger.warn(`🐌 Slow WebSocket Event: ${eventName}`, {
            socketId: socket.id,
            userId: socket.data?.user?.id,
            duration: `${duration}ms`,
            success,
            data: additionalData,
            timestamp: new Date().toISOString()
          });
        } else if (duration > 100) { // Log moderately slow events (>100ms)
          logger.info(`⏱️  WebSocket Event Timing: ${eventName}`, {
            socketId: socket.id,
            duration: `${duration}ms`,
            success
          });
        }
        
        return duration;
      }
    };
  }
};