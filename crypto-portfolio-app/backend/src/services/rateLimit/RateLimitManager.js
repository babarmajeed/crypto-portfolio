import { EventEmitter } from 'events';
import { TokenBucketLimiter } from './TokenBucketLimiter.js';
import { RequestQueue } from './RequestQueue.js';
import { RetryHandler } from './RetryHandler.js';
import { UsageMonitor } from './UsageMonitor.js';
import { CircuitBreaker } from './CircuitBreaker.js';
import { RATE_LIMITS } from '../../config/rate-limits.js';
import { exchangeService } from '../exchanges/exchangeService.js';
import { loggingService } from '../loggingService.js';
import { redis } from '../../config/redis.js';

/**
 * Advanced Rate Limit Manager
 * Handles sophisticated rate limiting with queuing, prioritization, 
 * automatic retry, and circuit breaking for exchange APIs
 */
class RateLimitManager extends EventEmitter {
  constructor() {
    super();
    this.limiters = new Map(); // exchange:endpoint -> TokenBucketLimiter
    this.requestQueue = new RequestQueue();
    this.retryHandler = new RetryHandler();
    this.usageMonitor = new UsageMonitor();
    this.circuitBreakers = new Map(); // exchange:endpoint -> CircuitBreaker
    
    // Request tracking
    this.activeRequests = new Map(); // requestId -> request info
    this.requestCounter = 0;
    
    // Configuration
    this.emergencyThrottleEnabled = false;
    this.emergencyThrottleRate = 0.1; // 10% of normal rate
    this.apiKeyRotation = new Map(); // exchange -> current key index
    
    // Metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      rateLimitedRequests: 0,
      queuedRequests: 0,
      retriedRequests: 0,
      circuitBreakerTrips: 0,
      averageResponseTime: 0,
      emergencyThrottleActivations: 0
    };
    
    this.setupEventHandlers();
    this.startHealthMonitoring();
  }

  /**
   * Make a rate-limited API request with queuing and retry logic
   */
  async makeRequest(exchange, endpoint, params = {}, options = {}) {
    const {
      priority = 'normal',
      timeout = 30000,
      retryCount = 0,
      skipQueue = false,
      headers = {},
      method = 'GET'
    } = options;

    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      // Check circuit breaker first
      const circuitBreaker = this.getCircuitBreaker(exchange, endpoint);
      if (!circuitBreaker.canExecute()) {
        throw new Error(`Circuit breaker is OPEN for ${exchange}:${endpoint}`);
      }

      // Check if emergency throttling is active
      if (this.emergencyThrottleEnabled && !this.shouldBypassThrottle(priority)) {
        await this.applyEmergencyThrottle();
      }

      // Get rate limiter for this exchange/endpoint
      const limiter = this.getLimiter(exchange, endpoint);
      
      // Check if we can make the request immediately
      if (limiter.canMakeRequest() && skipQueue) {
        return await this.executeRequest(requestId, exchange, endpoint, params, {
          ...options,
          headers,
          method,
          startTime
        });
      }

      // Queue the request if rate limited or queue not skipped
      if (!limiter.canMakeRequest() || !skipQueue) {
        this.metrics.queuedRequests++;
        return await this.queueRequest(requestId, exchange, endpoint, params, {
          ...options,
          headers,
          method,
          startTime,
          priority
        });
      }

      // Execute request directly
      return await this.executeRequest(requestId, exchange, endpoint, params, {
        ...options,
        headers,
        method,
        startTime
      });

    } catch (error) {
      return this.handleRequestError(error, requestId, exchange, endpoint, params, options);
    }
  }

  /**
   * Execute the actual API request
   */
  async executeRequest(requestId, exchange, endpoint, params, options) {
    const { headers, method, startTime, timeout = 30000 } = options;
    
    try {
      // Record active request
      this.activeRequests.set(requestId, {
        exchange,
        endpoint,
        startTime,
        params: this.sanitizeParamsForLogging(params)
      });

      // Get rate limiter and record request
      const limiter = this.getLimiter(exchange, endpoint);
      const circuitBreaker = this.getCircuitBreaker(exchange, endpoint);
      
      if (!limiter.recordRequest()) {
        throw new Error('Rate limit exceeded - tokens not available');
      }

      loggingService.debug('Executing API request', {
        requestId,
        exchange,
        endpoint,
        method
      });

      // Make the actual API call with timeout
      const response = await Promise.race([
        exchangeService.makeApiCall(exchange, endpoint, params, { headers, method }),
        this.createTimeoutPromise(timeout, `Request timeout for ${exchange}:${endpoint}`)
      ]);

      // Record success metrics
      const responseTime = Date.now() - startTime;
      this.recordSuccessMetrics(requestId, exchange, endpoint, responseTime);
      
      // Record success in circuit breaker
      circuitBreaker.recordSuccess();
      
      // Record success in usage monitor
      this.usageMonitor.recordSuccess(exchange, endpoint, responseTime);

      return response;

    } catch (error) {
      // Record failure in circuit breaker
      const circuitBreaker = this.getCircuitBreaker(exchange, endpoint);
      circuitBreaker.recordFailure();
      
      throw error;
    } finally {
      // Remove from active requests
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Queue a request for later execution
   */
  async queueRequest(requestId, exchange, endpoint, params, options) {
    return new Promise((resolve, reject) => {
      const queueItem = {
        requestId,
        exchange,
        endpoint,
        params,
        options,
        resolve,
        reject,
        timestamp: Date.now(),
        priority: options.priority || 'normal'
      };

      this.requestQueue.add(queueItem);
      
      loggingService.debug('Request queued', {
        requestId,
        exchange,
        endpoint,
        priority: queueItem.priority,
        queueSize: this.requestQueue.size()
      });
    });
  }

  /**
   * Handle request errors with retry logic
   */
  async handleRequestError(error, requestId, exchange, endpoint, params, options) {
    const { retryCount = 0, maxRetries = 3 } = options;

    loggingService.warn('Request failed', {
      requestId,
      exchange,
      endpoint,
      error: error.message,
      retryCount
    });

    // Check if this is a rate limit error
    if (this.isRateLimitError(error)) {
      this.metrics.rateLimitedRequests++;
      this.usageMonitor.recordRateLimit(exchange, endpoint);
      
      // Extract retry-after header if available
      const retryAfter = this.extractRetryAfter(error);
      if (retryAfter) {
        await this.delay(retryAfter * 1000);
      }
      
      // Queue the request for retry
      return this.queueRequest(requestId, exchange, endpoint, params, {
        ...options,
        priority: 'high' // Increase priority for retried requests
      });
    }

    // Check if we should retry this error
    if (this.retryHandler.shouldRetry(error, exchange, endpoint, retryCount)) {
      this.metrics.retriedRequests++;
      
      const retryDelay = this.retryHandler.getRetryDelay(retryCount);
      await this.delay(retryDelay);
      
      return this.makeRequest(exchange, endpoint, params, {
        ...options,
        retryCount: retryCount + 1
      });
    }

    // Check if we should activate emergency throttling
    if (this.shouldActivateEmergencyThrottle(error)) {
      this.activateEmergencyThrottle();
    }

    // Record final failure
    this.recordFailureMetrics(requestId, exchange, endpoint, error);
    throw error;
  }

  /**
   * Get or create rate limiter for exchange/endpoint
   */
  getLimiter(exchange, endpoint) {
    const key = `${exchange}:${endpoint}`;
    
    if (!this.limiters.has(key)) {
      const config = this.getRateLimitConfig(exchange, endpoint);
      const limiter = new TokenBucketLimiter(config);
      this.limiters.set(key, limiter);
      
      loggingService.debug('Created rate limiter', {
        exchange,
        endpoint,
        config
      });
    }
    
    return this.limiters.get(key);
  }

  /**
   * Get or create circuit breaker for exchange/endpoint
   */
  getCircuitBreaker(exchange, endpoint) {
    const key = `${exchange}:${endpoint}`;
    
    if (!this.circuitBreakers.has(key)) {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 5,
        recoveryTimeout: 60000,
        monitoringPeriod: 10000
      });
      
      this.circuitBreakers.set(key, circuitBreaker);
      
      // Listen for circuit breaker events
      circuitBreaker.on('open', () => {
        this.metrics.circuitBreakerTrips++;
        loggingService.warn('Circuit breaker opened', { exchange, endpoint });
        this.emit('circuitBreakerOpen', { exchange, endpoint });
      });
      
      circuitBreaker.on('halfOpen', () => {
        loggingService.info('Circuit breaker half-open', { exchange, endpoint });
        this.emit('circuitBreakerHalfOpen', { exchange, endpoint });
      });
      
      circuitBreaker.on('close', () => {
        loggingService.info('Circuit breaker closed', { exchange, endpoint });
        this.emit('circuitBreakerClose', { exchange, endpoint });
      });
    }
    
    return this.circuitBreakers.get(key);
  }

  /**
   * Get rate limit configuration for exchange/endpoint
   */
  getRateLimitConfig(exchange, endpoint) {
    const exchangeConfig = RATE_LIMITS[exchange];
    if (!exchangeConfig) {
      throw new Error(`No rate limit configuration found for exchange: ${exchange}`);
    }
    
    // Try to find endpoint-specific config
    let config = exchangeConfig[endpoint];
    if (!config) {
      // Fall back to default config
      config = exchangeConfig.default;
    }
    
    if (!config) {
      throw new Error(`No rate limit configuration found for ${exchange}:${endpoint}`);
    }
    
    // Apply emergency throttling if active
    if (this.emergencyThrottleEnabled) {
      config = {
        ...config,
        requestsPerInterval: Math.floor(config.requestsPerInterval * this.emergencyThrottleRate)
      };
    }
    
    return config;
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // Handle queue processing events
    this.requestQueue.on('itemProcessed', (item) => {
      this.executeRequest(
        item.requestId, 
        item.exchange, 
        item.endpoint, 
        item.params, 
        item.options
      ).then(item.resolve).catch(item.reject);
    });
    
    this.requestQueue.on('queueEmpty', () => {
      this.emit('queueEmpty');
    });
    
    // Handle usage monitor alerts
    this.usageMonitor.on('approachingLimit', (alert) => {
      loggingService.warn('Approaching rate limit', alert);
      this.emit('approachingLimit', alert);
    });
    
    this.usageMonitor.on('excessiveRateLimits', (alert) => {
      loggingService.error('Excessive rate limits detected', alert);
      this.emit('excessiveRateLimits', alert);
      
      // Consider activating emergency throttling
      if (alert.rateLimitRatio > 0.5) {
        this.activateEmergencyThrottle();
      }
    });
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    // Monitor queue health every 30 seconds
    this.healthMonitorInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000);
    
    // Generate usage reports every hour
    this.reportInterval = setInterval(() => {
      this.generateAndEmitUsageReport();
    }, 3600000);
  }

  /**
   * Perform health check
   */
  performHealthCheck() {
    const queueSize = this.requestQueue.size();
    const activeRequestCount = this.activeRequests.size;
    
    // Check for queue backup
    if (queueSize > 100) {
      loggingService.warn('Request queue backup detected', {
        queueSize,
        activeRequests: activeRequestCount
      });
      this.emit('queueBackup', { queueSize, activeRequestCount });
    }
    
    // Check for stale active requests
    const staleRequests = this.findStaleRequests(300000); // 5 minutes
    if (staleRequests.length > 0) {
      loggingService.warn('Stale requests detected', {
        count: staleRequests.length,
        requests: staleRequests
      });
      this.emit('staleRequests', staleRequests);
    }
    
    // Update circuit breaker states
    for (const [key, circuitBreaker] of this.circuitBreakers) {
      circuitBreaker.updateState();
    }
  }

  /**
   * Find stale active requests
   */
  findStaleRequests(maxAge) {
    const now = Date.now();
    const staleRequests = [];
    
    for (const [requestId, request] of this.activeRequests) {
      if (now - request.startTime > maxAge) {
        staleRequests.push({
          requestId,
          ...request,
          age: now - request.startTime
        });
      }
    }
    
    return staleRequests;
  }

  /**
   * Generate and emit usage report
   */
  generateAndEmitUsageReport() {
    const report = this.usageMonitor.generateUsageReport('1h');
    
    loggingService.info('Hourly rate limit usage report', report);
    this.emit('usageReport', report);
    
    // Check for optimization opportunities
    const recommendations = this.generateOptimizationRecommendations(report);
    if (recommendations.length > 0) {
      this.emit('optimizationRecommendations', recommendations);
    }
  }

  /**
   * Generate optimization recommendations
   */
  generateOptimizationRecommendations(report) {
    const recommendations = [];
    
    for (const [exchange, stats] of Object.entries(report.exchanges)) {
      // Check for high rate limit ratio
      if (stats.rateLimits / stats.requests > 0.2) {
        recommendations.push({
          type: 'reduce_request_rate',
          exchange,
          message: `Consider reducing request rate for ${exchange} (${(stats.rateLimits / stats.requests * 100).toFixed(1)}% rate limited)`,
          priority: 'high'
        });
      }
      
      // Check for inefficient endpoints
      for (const [endpoint, endpointStats] of Object.entries(stats.endpoints)) {
        if (endpointStats.rateLimits > 10 && endpointStats.rateLimits / endpointStats.requests > 0.3) {
          recommendations.push({
            type: 'optimize_endpoint',
            exchange,
            endpoint,
            message: `Endpoint ${endpoint} has high rate limit ratio (${(endpointStats.rateLimits / endpointStats.requests * 100).toFixed(1)}%)`,
            priority: 'medium'
          });
        }
      }
    }
    
    return recommendations;
  }

  /**
   * Activate emergency throttling
   */
  activateEmergencyThrottle() {
    if (this.emergencyThrottleEnabled) return;
    
    this.emergencyThrottleEnabled = true;
    this.metrics.emergencyThrottleActivations++;
    
    loggingService.warn('Emergency throttling activated', {
      throttleRate: this.emergencyThrottleRate
    });
    
    this.emit('emergencyThrottleActivated', {
      throttleRate: this.emergencyThrottleRate
    });
    
    // Auto-deactivate after 10 minutes
    setTimeout(() => {
      this.deactivateEmergencyThrottle();
    }, 600000);
  }

  /**
   * Deactivate emergency throttling
   */
  deactivateEmergencyThrottle() {
    if (!this.emergencyThrottleEnabled) return;
    
    this.emergencyThrottleEnabled = false;
    
    loggingService.info('Emergency throttling deactivated');
    this.emit('emergencyThrottleDeactivated');
    
    // Recreate rate limiters with normal rates
    this.limiters.clear();
  }

  /**
   * Apply emergency throttle delay
   */
  async applyEmergencyThrottle() {
    const delay = Math.random() * 5000 + 1000; // 1-6 seconds
    await this.delay(delay);
  }

  /**
   * Check if request should bypass emergency throttling
   */
  shouldBypassThrottle(priority) {
    return priority === 'critical' || priority === 'emergency';
  }

  /**
   * Check if error should activate emergency throttling
   */
  shouldActivateEmergencyThrottle(error) {
    // Check for 429 (Too Many Requests) or similar
    if (this.isRateLimitError(error)) {
      return true;
    }
    
    // Check for 503 (Service Unavailable) which might indicate overload
    if (error.status === 503 || error.statusCode === 503) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if error indicates rate limiting
   */
  isRateLimitError(error) {
    if (!error) return false;
    
    // Check status code
    const status = error.status || error.statusCode || error.response?.status;
    if (status === 429) return true;
    
    // Check error message
    const message = error.message?.toLowerCase() || '';
    const rateLimitKeywords = [
      'rate limit',
      'too many requests',
      'request limit',
      'quota exceeded',
      'api limit'
    ];
    
    return rateLimitKeywords.some(keyword => message.includes(keyword));
  }

  /**
   * Extract retry-after header from error
   */
  extractRetryAfter(error) {
    if (!error.response?.headers) return null;
    
    const retryAfter = error.response.headers['retry-after'] || 
                      error.response.headers['Retry-After'];
    
    if (retryAfter) {
      const seconds = parseInt(retryAfter);
      return isNaN(seconds) ? null : seconds;
    }
    
    return null;
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${++this.requestCounter}`;
  }

  /**
   * Create timeout promise
   */
  createTimeoutPromise(timeout, message) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(message));
      }, timeout);
    });
  }

  /**
   * Sanitize parameters for logging (remove sensitive data)
   */
  sanitizeParamsForLogging(params) {
    const sanitized = { ...params };
    const sensitiveKeys = ['apiKey', 'signature', 'timestamp', 'recvWindow'];
    
    sensitiveKeys.forEach(key => {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  /**
   * Record success metrics
   */
  recordSuccessMetrics(requestId, exchange, endpoint, responseTime) {
    this.metrics.totalRequests++;
    this.metrics.successfulRequests++;
    
    // Update average response time
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.successfulRequests - 1) + responseTime) / 
      this.metrics.successfulRequests;
    
    loggingService.debug('Request completed successfully', {
      requestId,
      exchange,
      endpoint,
      responseTime
    });
  }

  /**
   * Record failure metrics
   */
  recordFailureMetrics(requestId, exchange, endpoint, error) {
    this.metrics.totalRequests++;
    
    loggingService.error('Request failed permanently', {
      requestId,
      exchange,
      endpoint,
      error: error.message
    });
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      queueSize: this.requestQueue.size(),
      activeRequests: this.activeRequests.size,
      limitersCount: this.limiters.size,
      circuitBreakersCount: this.circuitBreakers.size,
      emergencyThrottleEnabled: this.emergencyThrottleEnabled
    };
  }

  /**
   * Get current status
   */
  getStatus() {
    const circuitBreakerStates = {};
    for (const [key, cb] of this.circuitBreakers) {
      circuitBreakerStates[key] = cb.getState();
    }
    
    return {
      isHealthy: this.requestQueue.size() < 50 && this.activeRequests.size < 20,
      queueSize: this.requestQueue.size(),
      activeRequests: this.activeRequests.size,
      emergencyThrottleEnabled: this.emergencyThrottleEnabled,
      circuitBreakerStates,
      metrics: this.getMetrics()
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      loggingService.info('Cleaning up RateLimitManager');
      
      // Stop monitoring
      if (this.healthMonitorInterval) {
        clearInterval(this.healthMonitorInterval);
      }
      if (this.reportInterval) {
        clearInterval(this.reportInterval);
      }
      
      // Clear all limiters and circuit breakers
      this.limiters.clear();
      this.circuitBreakers.clear();
      
      // Clear active requests
      this.activeRequests.clear();
      
      // Cleanup queue
      await this.requestQueue.cleanup();
      
      // Remove all listeners
      this.removeAllListeners();
      
    } catch (error) {
      loggingService.error('Error during RateLimitManager cleanup', {
        error: error.message
      });
    }
  }
}

export const rateLimitManager = new RateLimitManager();
export { RateLimitManager };