# CP-012: API Rate Limiting and Throttling

## Objective
Implement comprehensive API rate limiting and throttling mechanisms to protect the application from abuse, ensure fair usage, and maintain service quality while handling external exchange API limits effectively.

## Priority
High

## Category
Backend Security & Performance

## Acceptance Criteria
- [ ] Redis-based distributed rate limiting system
- [ ] Multiple rate limiting strategies (IP, user, endpoint-based)
- [ ] Dynamic rate limit adjustment based on user tier
- [ ] Exchange API rate limit management and coordination
- [ ] Graceful degradation under high load
- [ ] Rate limit headers in API responses
- [ ] Bypass mechanisms for internal services
- [ ] Real-time monitoring and alerting for rate limits
- [ ] Automatic blacklisting for severe abuse
- [ ] Documentation and error messages for developers

## Technical Implementation Details

### Rate Limiting Service
```javascript
// services/rateLimitService.js
const Redis = require('ioredis');
const { RateLimiterRedis } = require('rate-limiter-flexible');

class RateLimitService {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD
    });

    this.initializeLimiters();
  }

  initializeLimiters() {
    // General API rate limiter
    this.generalLimiter = new RateLimiterRedis({
      storeClient: this.redis,
      keyGenerator: (req) => `general:${this.getClientKey(req)}`,
      points: 100, // Number of requests
      duration: 60, // Per 60 seconds
      blockDuration: 60, // Block for 60 seconds if exceeded
    });

    // Authentication endpoints (stricter)
    this.authLimiter = new RateLimiterRedis({
      storeClient: this.redis,
      keyGenerator: (req) => `auth:${req.ip}`,
      points: 5, // 5 attempts
      duration: 900, // Per 15 minutes
      blockDuration: 900, // Block for 15 minutes
    });

    // Premium user rate limiter
    this.premiumLimiter = new RateLimiterRedis({
      storeClient: this.redis,
      keyGenerator: (req) => `premium:${req.user?.id || req.ip}`,
      points: 1000, // Higher limit for premium users
      duration: 60,
      blockDuration: 30,
    });

    // Exchange API coordination limiter
    this.exchangeLimiter = new RateLimiterRedis({
      storeClient: this.redis,
      keyGenerator: (exchange) => `exchange:${exchange}`,
      points: 1000, // Shared pool for all users per exchange
      duration: 60,
      blockDuration: 0, // Don't block, just delay
    });
  }

  getClientKey(req) {
    // Prioritize user ID, fallback to IP
    return req.user?.id || req.ip;
  }

  getUserTier(user) {
    if (!user) return 'anonymous';
    if (user.subscription === 'premium') return 'premium';
    if (user.subscription === 'pro') return 'pro';
    return 'basic';
  }

  getLimiterForUser(req) {
    const tier = this.getUserTier(req.user);
    
    switch (tier) {
      case 'premium':
      case 'pro':
        return this.premiumLimiter;
      default:
        return this.generalLimiter;
    }
  }

  async checkRateLimit(req, res, next) {
    try {
      const limiter = this.getLimiterForUser(req);
      const resRateLimiter = await limiter.consume(this.getClientKey(req));

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': limiter.points,
        'X-RateLimit-Remaining': resRateLimiter.remainingPoints,
        'X-RateLimit-Reset': new Date(Date.now() + resRateLimiter.msBeforeNext)
      });

      next();
    } catch (rejRes) {
      // Rate limit exceeded
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
      
      res.set({
        'X-RateLimit-Limit': rejRes.totalHits,
        'X-RateLimit-Remaining': 0,
        'X-RateLimit-Reset': new Date(Date.now() + rejRes.msBeforeNext),
        'Retry-After': secs
      });

      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${secs} seconds.`,
        retryAfter: secs
      });
    }
  }

  async checkAuthRateLimit(req, res, next) {
    try {
      await this.authLimiter.consume(req.ip);
      next();
    } catch (rejRes) {
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
      
      res.status(429).json({
        error: 'Too Many Authentication Attempts',
        message: `Too many login attempts. Try again in ${Math.ceil(secs / 60)} minutes.`,
        retryAfter: secs
      });
    }
  }
}
```

### Exchange Rate Limit Coordinator
```javascript
// services/exchangeRateLimitCoordinator.js
class ExchangeRateLimitCoordinator {
  constructor() {
    this.redis = new Redis();
    this.exchangeLimits = {
      binance: { points: 1200, duration: 60, weight: 1 },
      coinbase: { points: 10000, duration: 3600, weight: 1 },
      kraken: { points: 60, duration: 60, weight: 1 }
    };
    
    this.initializeExchangeLimiters();
  }

  initializeExchangeLimiters() {
    this.exchangeLimiters = {};
    
    for (const [exchange, config] of Object.entries(this.exchangeLimits)) {
      this.exchangeLimiters[exchange] = new RateLimiterRedis({
        storeClient: this.redis,
        keyGenerator: () => `exchange:${exchange}`,
        points: config.points,
        duration: config.duration,
        blockDuration: 0 // Don't block, use queuing instead
      });
    }
  }

  async acquireExchangeRequest(exchange, weight = 1) {
    const limiter = this.exchangeLimiters[exchange];
    
    if (!limiter) {
      throw new Error(`Unknown exchange: ${exchange}`);
    }

    try {
      const result = await limiter.consume(exchange, weight);
      return {
        allowed: true,
        remaining: result.remainingPoints,
        resetTime: Date.now() + result.msBeforeNext
      };
    } catch (rejRes) {
      // Calculate delay needed
      const delay = rejRes.msBeforeNext;
      
      return {
        allowed: false,
        delay,
        resetTime: Date.now() + delay
      };
    }
  }

  async waitForExchangeAvailability(exchange, weight = 1) {
    const result = await this.acquireExchangeRequest(exchange, weight);
    
    if (!result.allowed) {
      // Wait for the rate limit to reset
      await new Promise(resolve => setTimeout(resolve, result.delay));
      return this.acquireExchangeRequest(exchange, weight);
    }
    
    return result;
  }
}
```

### Middleware Implementation
```javascript
// middleware/rateLimitMiddleware.js
const rateLimitService = new RateLimitService();

// General rate limiting middleware
const rateLimitMiddleware = (req, res, next) => {
  return rateLimitService.checkRateLimit(req, res, next);
};

// Authentication rate limiting
const authRateLimitMiddleware = (req, res, next) => {
  return rateLimitService.checkAuthRateLimit(req, res, next);
};

// Endpoint-specific rate limiting
const createEndpointLimiter = (points, duration) => {
  const limiter = new RateLimiterRedis({
    storeClient: rateLimitService.redis,
    keyGenerator: (req) => `endpoint:${req.route.path}:${rateLimitService.getClientKey(req)}`,
    points,
    duration,
    blockDuration: 60
  });

  return async (req, res, next) => {
    try {
      await limiter.consume(rateLimitService.getClientKey(req));
      next();
    } catch (rejRes) {
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
      
      res.status(429).json({
        error: 'Endpoint Rate Limit Exceeded',
        message: `This endpoint allows ${points} requests per ${duration} seconds.`,
        retryAfter: secs
      });
    }
  };
};

// Bypass for internal services
const bypassRateLimit = (req, res, next) => {
  const internalToken = req.headers['x-internal-token'];
  
  if (internalToken === process.env.INTERNAL_SERVICE_TOKEN) {
    return next();
  }
  
  return rateLimitMiddleware(req, res, next);
};

module.exports = {
  rateLimitMiddleware,
  authRateLimitMiddleware,
  createEndpointLimiter,
  bypassRateLimit
};
```

### Usage in Routes
```javascript
// routes/api.js
const express = require('express');
const { 
  rateLimitMiddleware, 
  authRateLimitMiddleware, 
  createEndpointLimiter 
} = require('../middleware/rateLimitMiddleware');

const router = express.Router();

// Apply general rate limiting to all routes
router.use(rateLimitMiddleware);

// Strict rate limiting for auth endpoints
router.use('/auth', authRateLimitMiddleware);

// Endpoint-specific limits
router.get('/portfolio', 
  createEndpointLimiter(60, 60), // 60 requests per minute
  portfolioController.getPortfolio
);

router.post('/portfolio/calculate', 
  createEndpointLimiter(10, 60), // 10 calculations per minute
  portfolioController.calculateMetrics
);

router.get('/prices/:symbol', 
  createEndpointLimiter(120, 60), // 120 price requests per minute
  priceController.getPrice
);

// Premium endpoints with higher limits
router.get('/analytics/advanced', 
  authenticateUser,
  requirePremium,
  createEndpointLimiter(200, 60), // Higher limit for premium users
  analyticsController.getAdvancedAnalytics
);
```

### Exchange API Wrapper
```javascript
// services/exchangeApiWrapper.js
class ExchangeApiWrapper {
  constructor(exchange) {
    this.exchange = exchange;
    this.coordinator = new ExchangeRateLimitCoordinator();
    this.api = ExchangeFactory.create(exchange);
  }

  async makeRequest(method, ...args) {
    // Wait for rate limit availability
    await this.coordinator.waitForExchangeAvailability(this.exchange);
    
    try {
      const result = await this.api[method](...args);
      return result;
    } catch (error) {
      if (this.isRateLimitError(error)) {
        // If we get rate limited, back off exponentially
        const backoffTime = this.calculateBackoff();
        console.warn(`Exchange ${this.exchange} rate limited, backing off for ${backoffTime}ms`);
        
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        return this.makeRequest(method, ...args);
      }
      
      throw error;
    }
  }

  isRateLimitError(error) {
    const rateLimitIndicators = [
      'rate limit',
      'too many requests',
      '429',
      'exceeded',
      'throttled'
    ];
    
    const errorMessage = error.message?.toLowerCase() || '';
    return rateLimitIndicators.some(indicator => errorMessage.includes(indicator));
  }

  calculateBackoff() {
    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const exponentialDelay = baseDelay * Math.pow(2, Math.random() * 4);
    
    return Math.min(exponentialDelay, maxDelay);
  }
}
```

## Required Technologies
- **rate-limiter-flexible** - Flexible rate limiting
- **Redis** - Distributed rate limit storage
- **Express.js** - Web framework middleware
- **ioredis** - Redis client

## Testing Requirements

### Unit Tests
```javascript
describe('RateLimitService', () => {
  test('should allow requests within limit', async () => {
    const req = { ip: '127.0.0.1', user: null };
    const res = { set: jest.fn() };
    const next = jest.fn();

    await rateLimitService.checkRateLimit(req, res, next);
    
    expect(next).toHaveBeenCalled();
    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
      'X-RateLimit-Limit': expect.any(Number),
      'X-RateLimit-Remaining': expect.any(Number)
    }));
  });

  test('should block requests when limit exceeded', async () => {
    const req = { ip: '127.0.0.2' };
    const res = { 
      set: jest.fn(), 
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    // Exhaust rate limit
    for (let i = 0; i < 101; i++) {
      try {
        await rateLimitService.generalLimiter.consume('127.0.0.2');
      } catch (e) {
        break;
      }
    }

    await rateLimitService.checkRateLimit(req, res, () => {});
    
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Too Many Requests'
    }));
  });
});
```

### Load Testing
```javascript
// Load test with Artillery or similar
const loadTest = {
  config: {
    target: 'http://localhost:3000',
    phases: [
      { duration: 60, arrivalRate: 50 }, // 50 requests/second for 1 minute
      { duration: 120, arrivalRate: 100 }, // 100 requests/second for 2 minutes
    ]
  },
  scenarios: [
    {
      name: 'API Rate Limit Test',
      requests: [
        { get: { url: '/api/portfolio' } },
        { get: { url: '/api/prices/BTC' } }
      ]
    }
  ]
};
```

## Dependencies
- CP-008: Caching Layer and Performance Optimization
- CP-002: User Authentication and Authorization
- CP-016-025: Exchange Integration issues

## Rate Limit Tiers

### Anonymous Users
- 100 requests per minute
- 1000 requests per hour
- 10000 requests per day

### Basic Users
- 200 requests per minute
- 5000 requests per hour
- 50000 requests per day

### Premium Users
- 1000 requests per minute
- 20000 requests per hour
- 200000 requests per day

### Internal Services
- Unlimited (with proper authentication)

## Monitoring and Alerting
```javascript
// monitoring/rateLimitMonitor.js
class RateLimitMonitor {
  static async getMetrics() {
    const redis = new Redis();
    
    const metrics = {
      totalRequests: await redis.get('metrics:total_requests') || 0,
      blockedRequests: await redis.get('metrics:blocked_requests') || 0,
      averageResponseTime: await redis.get('metrics:avg_response_time') || 0,
      topOffenders: await redis.zrevrange('metrics:ip_requests', 0, 9, 'WITHSCORES')
    };
    
    return metrics;
  }

  static async alertOnHighUsage() {
    const metrics = await this.getMetrics();
    const blockRate = metrics.blockedRequests / metrics.totalRequests;
    
    if (blockRate > 0.1) { // More than 10% blocked
      await alertService.sendAlert({
        type: 'high_rate_limit_blocking',
        message: `High rate limit blocking detected: ${(blockRate * 100).toFixed(2)}%`,
        metrics
      });
    }
  }
}
```

## Definition of Done
- [ ] Redis-based rate limiting system implemented
- [ ] Multiple rate limiting strategies active
- [ ] User tier-based rate limits working
- [ ] Exchange API coordination implemented
- [ ] Rate limit headers in all responses
- [ ] Monitoring and alerting functional
- [ ] Bypass mechanisms for internal services
- [ ] Comprehensive error messages for developers
- [ ] Load testing completed successfully
- [ ] Documentation with integration examples
- [ ] Production deployment with monitoring

## Estimated Time
**Beginner Developer**: 6-8 days
**Intermediate Developer**: 4-5 days
**Senior Developer**: 3-4 days

## Required Skills
- Redis and distributed systems concepts
- Rate limiting algorithms understanding
- Express.js middleware development
- Performance testing and monitoring
- API design best practices
- Error handling and graceful degradation
- Security concepts for API protection

## Related Issues
- CP-008: Caching Layer and Performance Optimization
- CP-013: Logging, Monitoring and Analytics
- CP-016: Binance Exchange Integration
- CP-021: Exchange Rate Limiting and Error Handling