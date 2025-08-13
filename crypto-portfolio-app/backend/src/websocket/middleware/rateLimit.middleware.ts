import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import { RedisService } from '../../services/redisService';

interface RateLimitConfig {
  windowMs: number;
  maxConnections: number;
  maxEventsPerWindow: number;
  skipSuccessfulRequests?: boolean;
}

export class SocketRateLimiter {
  private redis: RedisService;
  private config: RateLimitConfig;

  constructor(redis: RedisService, config: RateLimitConfig) {
    this.redis = redis;
    this.config = {
      windowMs: 60000, // 1 minute
      maxConnections: 100,
      maxEventsPerWindow: 1000,
      ...config
    };
  }

  connectionLimiter = async (
    socket: Socket,
    next: (err?: ExtendedError) => void
  ): Promise<void> => {
    try {
      const clientIP = this.getClientIP(socket);
      const connectionKey = `socket_connections:${clientIP}`;
      
      const currentConnections = await this.redis.incr(connectionKey);
      
      if (currentConnections === 1) {
        await this.redis.expire(connectionKey, Math.ceil(this.config.windowMs / 1000));
      }
      
      if (currentConnections > this.config.maxConnections) {
        console.warn(`Rate limit exceeded for IP ${clientIP}: ${currentConnections} connections`);
        return next(new Error('Too many connections from this IP'));
      }
      
      // Track connection for cleanup
      socket.on('disconnect', async () => {
        await this.redis.decr(connectionKey);
      });
      
      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      next();
    }
  };

  eventLimiter = async (socket: Socket, eventName: string): Promise<boolean> => {
    try {
      const clientIP = this.getClientIP(socket);
      const eventKey = `socket_events:${clientIP}:${eventName}`;
      
      const currentEvents = await this.redis.incr(eventKey);
      
      if (currentEvents === 1) {
        await this.redis.expire(eventKey, Math.ceil(this.config.windowMs / 1000));
      }
      
      if (currentEvents > this.config.maxEventsPerWindow) {
        console.warn(`Event rate limit exceeded for IP ${clientIP}, event: ${eventName}`);
        socket.emit('rate_limit_exceeded', {
          event: eventName,
          retryAfter: Math.ceil(this.config.windowMs / 1000)
        });
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Event rate limiting error:', error);
      return true; // Allow event on error
    }
  };

  private getClientIP(socket: Socket): string {
    const forwarded = socket.handshake.headers['x-forwarded-for'];
    const realIP = socket.handshake.headers['x-real-ip'];
    
    if (forwarded) {
      return (forwarded as string).split(',')[0].trim();
    }
    
    return (realIP as string) || socket.handshake.address || 'unknown';
  }
}

export const createRateLimitMiddleware = (
  redis: RedisService,
  config?: Partial<RateLimitConfig>
) => {
  const defaultConfig: RateLimitConfig = {
    windowMs: 60000,
    maxConnections: 100,
    maxEventsPerWindow: 1000,
    skipSuccessfulRequests: false
  };
  const limiter = new SocketRateLimiter(redis, { ...defaultConfig, ...config });
  return limiter.connectionLimiter;
};

export const createEventRateLimiter = (
  redis: RedisService,
  config?: Partial<RateLimitConfig>
) => {
  const defaultConfig: RateLimitConfig = {
    windowMs: 60000,
    maxConnections: 100,
    maxEventsPerWindow: 1000,
    skipSuccessfulRequests: false
  };
  const limiter = new SocketRateLimiter(redis, { ...defaultConfig, ...config });
  return limiter.eventLimiter;
};