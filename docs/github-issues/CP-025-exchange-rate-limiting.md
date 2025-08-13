# CP-025: Exchange API Rate Limiting and Request Management

## Overview
Implement sophisticated rate limiting and request management system to handle exchange API limits efficiently while maximizing data throughput and preventing API bans.

## Objectives
- Implement intelligent rate limiting for all exchange APIs
- Create request queuing and prioritization system
- Build automatic retry mechanisms with exponential backoff
- Monitor and optimize API usage patterns

## Acceptance Criteria
- [ ] Rate limiting implementation for all supported exchanges
- [ ] Request queue with priority handling
- [ ] Automatic retry with exponential backoff
- [ ] API usage monitoring and alerting
- [ ] Request batching where supported
- [ ] Circuit breaker pattern for failed endpoints
- [ ] API key rotation support
- [ ] Usage analytics and optimization suggestions
- [ ] Emergency throttling for approaching limits

## Technical Implementation

### File Structure
```
src/
  services/
    rateLimit/
      RateLimitManager.js
      RequestQueue.js
      RetryHandler.js
      UsageMonitor.js
      CircuitBreaker.js
  types/
    rateLimit.types.js
  config/
    rate-limits.js
```

### Core Implementation
```javascript
// RateLimitManager.js
class RateLimitManager {
  constructor() {
    this.limiters = new Map();
    this.requestQueue = new RequestQueue();
    this.retryHandler = new RetryHandler();
    this.usageMonitor = new UsageMonitor();
  }

  async makeRequest(exchange, endpoint, params = {}, priority = 'normal') {
    const limiter = this.getLimiter(exchange, endpoint);
    
    // Check if we can make the request immediately
    if (!limiter.canMakeRequest()) {
      return this.queueRequest(exchange, endpoint, params, priority);
    }

    try {
      const response = await this.executeRequest(exchange, endpoint, params);
      limiter.recordRequest();
      this.usageMonitor.recordSuccess(exchange, endpoint);
      return response;
    } catch (error) {
      return this.handleRequestError(error, exchange, endpoint, params, priority);
    }
  }

  getLimiter(exchange, endpoint) {
    const key = `${exchange}:${endpoint}`;
    
    if (!this.limiters.has(key)) {
      const config = RATE_LIMITS[exchange][endpoint] || RATE_LIMITS[exchange].default;
      this.limiters.set(key, new TokenBucketLimiter(config));
    }
    
    return this.limiters.get(key);
  }

  async queueRequest(exchange, endpoint, params, priority) {
    return new Promise((resolve, reject) => {
      this.requestQueue.add({
        exchange,
        endpoint,
        params,
        priority,
        resolve,
        reject,
        timestamp: Date.now()
      });
    });
  }

  async handleRequestError(error, exchange, endpoint, params, priority) {
    if (this.isRateLimitError(error)) {
      this.usageMonitor.recordRateLimit(exchange, endpoint);
      
      // Extract retry-after header if available
      const retryAfter = this.extractRetryAfter(error);
      if (retryAfter) {
        await this.delay(retryAfter * 1000);
      }
      
      return this.queueRequest(exchange, endpoint, params, priority);
    }

    if (this.retryHandler.shouldRetry(error, exchange, endpoint)) {
      return this.retryHandler.retry(() => 
        this.makeRequest(exchange, endpoint, params, priority)
      );
    }

    throw error;
  }
}
```

### Token Bucket Rate Limiter
```javascript
// TokenBucketLimiter.js
class TokenBucketLimiter {
  constructor(config) {
    this.capacity = config.requestsPerInterval;
    this.tokens = config.requestsPerInterval;
    this.refillRate = config.requestsPerInterval / config.intervalMs;
    this.lastRefill = Date.now();
  }

  canMakeRequest() {
    this.refill();
    return this.tokens >= 1;
  }

  recordRequest() {
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  refill() {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  getTimeUntilNextToken() {
    if (this.tokens >= 1) return 0;
    
    const tokensNeeded = 1 - this.tokens;
    return Math.ceil(tokensNeeded / this.refillRate);
  }
}
```

### Request Queue with Prioritization
```javascript
// RequestQueue.js
class RequestQueue {
  constructor() {
    this.queues = {
      high: [],
      normal: [],
      low: []
    };
    this.processing = false;
  }

  add(request) {
    this.queues[request.priority].push(request);
    if (!this.processing) {
      this.processQueue();
    }
  }

  async processQueue() {
    this.processing = true;
    
    while (this.hasRequests()) {
      const request = this.getNextRequest();
      if (!request) break;

      try {
        const limiter = this.getLimiter(request.exchange, request.endpoint);
        
        if (limiter.canMakeRequest()) {
          const response = await this.executeRequest(request);
          limiter.recordRequest();
          request.resolve(response);
        } else {
          // Put request back at front of queue
          this.queues[request.priority].unshift(request);
          
          // Wait until we can make next request
          const waitTime = limiter.getTimeUntilNextToken();
          await this.delay(waitTime);
        }
      } catch (error) {
        request.reject(error);
      }
    }
    
    this.processing = false;
  }

  getNextRequest() {
    // Process high priority first, then normal, then low
    if (this.queues.high.length > 0) {
      return this.queues.high.shift();
    }
    if (this.queues.normal.length > 0) {
      return this.queues.normal.shift();
    }
    if (this.queues.low.length > 0) {
      return this.queues.low.shift();
    }
    return null;
  }

  hasRequests() {
    return this.queues.high.length > 0 || 
           this.queues.normal.length > 0 || 
           this.queues.low.length > 0;
  }
}
```

### Usage Monitor and Analytics
```javascript
// UsageMonitor.js
class UsageMonitor {
  constructor() {
    this.usage = new Map();
    this.alerts = new Map();
  }

  recordSuccess(exchange, endpoint) {
    const key = `${exchange}:${endpoint}`;
    const stats = this.getStats(key);
    
    stats.requests++;
    stats.successes++;
    stats.lastSuccess = Date.now();
    
    this.checkThresholds(exchange, endpoint, stats);
  }

  recordRateLimit(exchange, endpoint) {
    const key = `${exchange}:${endpoint}`;
    const stats = this.getStats(key);
    
    stats.requests++;
    stats.rateLimits++;
    stats.lastRateLimit = Date.now();
    
    // Alert if rate limits are too frequent
    this.checkRateLimitAlert(exchange, endpoint, stats);
  }

  getStats(key) {
    if (!this.usage.has(key)) {
      this.usage.set(key, {
        requests: 0,
        successes: 0,
        rateLimits: 0,
        errors: 0,
        lastSuccess: null,
        lastRateLimit: null,
        firstRequest: Date.now()
      });
    }
    return this.usage.get(key);
  }

  checkThresholds(exchange, endpoint, stats) {
    const config = RATE_LIMITS[exchange][endpoint];
    if (!config) return;

    const usage = stats.requests / config.requestsPerInterval;
    if (usage > 0.8) { // 80% of limit used
      this.emitAlert('approaching_limit', {
        exchange,
        endpoint,
        usage: usage * 100,
        remaining: config.requestsPerInterval - stats.requests
      });
    }
  }

  generateUsageReport(timeframe = '24h') {
    const cutoff = Date.now() - this.parseTimeframe(timeframe);
    const report = {
      exchanges: {},
      totalRequests: 0,
      totalRateLimits: 0,
      efficiency: 0
    };

    for (const [key, stats] of this.usage) {
      if (stats.firstRequest < cutoff) continue;
      
      const [exchange, endpoint] = key.split(':');
      
      if (!report.exchanges[exchange]) {
        report.exchanges[exchange] = {
          requests: 0,
          rateLimits: 0,
          endpoints: {}
        };
      }

      report.exchanges[exchange].requests += stats.requests;
      report.exchanges[exchange].rateLimits += stats.rateLimits;
      report.exchanges[exchange].endpoints[endpoint] = stats;
      
      report.totalRequests += stats.requests;
      report.totalRateLimits += stats.rateLimits;
    }

    report.efficiency = (1 - (report.totalRateLimits / report.totalRequests)) * 100;
    
    return report;
  }
}
```

### Rate Limit Configuration
```javascript
// rate-limits.js
export const RATE_LIMITS = {
  binance: {
    default: { requestsPerInterval: 1200, intervalMs: 60000 }, // 1200/minute
    '/api/v3/ticker/price': { requestsPerInterval: 40, intervalMs: 1000 },
    '/api/v3/order': { requestsPerInterval: 10, intervalMs: 1000 },
    '/api/v3/account': { requestsPerInterval: 20, intervalMs: 1000 }
  },
  coinbase: {
    default: { requestsPerInterval: 10000, intervalMs: 3600000 }, // 10k/hour
    '/accounts': { requestsPerInterval: 25, intervalMs: 1000 },
    '/orders': { requestsPerInterval: 5, intervalMs: 1000 }
  },
  kraken: {
    default: { requestsPerInterval: 20, intervalMs: 1000 }, // 20/second
    '/0/private/Balance': { requestsPerInterval: 2, intervalMs: 1000 },
    '/0/private/AddOrder': { requestsPerInterval: 1, intervalMs: 1000 }
  }
};
```

## Testing Requirements
- Unit tests for rate limiting algorithms
- Integration tests with mock API responses
- Load testing for queue performance
- Rate limit scenario testing
- Monitoring and alerting tests

## Dependencies
- Depends on: CP-003 (Exchange API Integration)
- Blocks: All exchange-related features

## Time Estimate
**Beginner**: 7-8 days
**Intermediate**: 4-5 days
**Advanced**: 2-3 days

## Required Skills
- Rate limiting algorithms (token bucket, sliding window)
- Queue management and prioritization
- Promise handling and async patterns
- Error handling and retry logic
- Performance monitoring and optimization