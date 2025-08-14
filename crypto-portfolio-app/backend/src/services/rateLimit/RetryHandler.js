/**
 * Retry Handler for Failed API Requests
 * Implements exponential backoff and intelligent retry logic
 */
class RetryHandler {
  constructor(options = {}) {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 30000,
      backoffMultiplier = 2,
      jitterEnabled = true,
      retryableErrors = [
        'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND',
        'NETWORK_ERROR', 'TIMEOUT_ERROR'
      ],
      retryableStatusCodes = [429, 500, 502, 503, 504]
    } = options;

    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
    this.backoffMultiplier = backoffMultiplier;
    this.jitterEnabled = jitterEnabled;
    this.retryableErrors = new Set(retryableErrors);
    this.retryableStatusCodes = new Set(retryableStatusCodes);
    
    // Track retry attempts per endpoint
    this.retryStats = new Map(); // key -> { attempts, lastRetry, successAfterRetry }
  }

  /**
   * Determine if an error should be retried
   */
  shouldRetry(error, exchange, endpoint, currentRetryCount = 0) {
    // Check retry count limit
    if (currentRetryCount >= this.maxRetries) {
      return false;
    }

    // Check if error is retryable
    if (!this.isRetryableError(error)) {
      return false;
    }

    // Check exchange-specific retry rules
    if (!this.isRetryableForExchange(error, exchange)) {
      return false;
    }

    return true;
  }

  /**
   * Check if error is retryable based on error type/status
   */
  isRetryableError(error) {
    // Check status code
    const statusCode = error.status || error.statusCode || error.response?.status;
    if (statusCode && this.retryableStatusCodes.has(statusCode)) {
      return true;
    }

    // Check error code/type
    if (error.code && this.retryableErrors.has(error.code)) {
      return true;
    }

    // Check error message for network-related issues
    const message = error.message?.toLowerCase() || '';
    const networkErrors = [
      'network error', 'connection timeout', 'request timeout',
      'socket timeout', 'connect timeout', 'read timeout',
      'connection reset', 'connection refused'
    ];
    
    if (networkErrors.some(err => message.includes(err))) {
      return true;
    }

    return false;
  }

  /**
   * Check exchange-specific retry rules
   */
  isRetryableForExchange(error, exchange) {
    const statusCode = error.status || error.statusCode || error.response?.status;
    
    switch (exchange) {
      case 'binance':
        // Binance specific rules
        if (statusCode === 418) return false; // IP banned
        if (statusCode === 451) return false; // Banned for legal reasons
        break;
        
      case 'coinbase':
        // Coinbase specific rules
        if (statusCode === 400 && error.message?.includes('invalid_request')) {
          return false; // Invalid request format
        }
        break;
        
      case 'kraken':
        // Kraken specific rules
        if (error.message?.includes('EService:Unavailable')) {
          return true; // Kraken service temporarily unavailable
        }
        break;
        
      case 'kucoin':
        // KuCoin specific rules
        if (statusCode === 400 && error.message?.includes('KC-API-KEY')) {
          return false; // API key issues
        }
        break;
    }

    return true;
  }

  /**
   * Get retry delay with exponential backoff and jitter
   */
  getRetryDelay(retryCount) {
    // Calculate exponential backoff
    let delay = this.baseDelay * Math.pow(this.backoffMultiplier, retryCount);
    
    // Apply maximum delay limit
    delay = Math.min(delay, this.maxDelay);
    
    // Add jitter to prevent thundering herd
    if (this.jitterEnabled) {
      const jitter = delay * 0.1 * (Math.random() * 2 - 1); // ±10% jitter
      delay = Math.max(0, delay + jitter);
    }
    
    return Math.round(delay);
  }

  /**
   * Execute retry with exponential backoff
   */
  async retry(fn, options = {}) {
    const {
      maxRetries = this.maxRetries,
      exchange = 'unknown',
      endpoint = 'unknown',
      onRetry = null
    } = options;

    const key = `${exchange}:${endpoint}`;
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn();
        
        // Record success after retry
        if (attempt > 0) {
          this.recordRetrySuccess(key, attempt);
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        
        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }
        
        // Check if we should retry this error
        if (!this.shouldRetry(error, exchange, endpoint, attempt)) {
          break;
        }
        
        // Record retry attempt
        this.recordRetryAttempt(key);
        
        // Calculate delay
        const delay = this.getRetryDelay(attempt);
        
        // Call retry callback if provided
        if (onRetry) {
          onRetry({
            attempt: attempt + 1,
            maxRetries,
            delay,
            error,
            exchange,
            endpoint
          });
        }
        
        // Wait before retrying
        await this.delay(delay);
      }
    }
    
    // All retries exhausted
    this.recordRetryFailure(key);
    throw lastError;
  }

  /**
   * Record retry attempt
   */
  recordRetryAttempt(key) {
    if (!this.retryStats.has(key)) {
      this.retryStats.set(key, {
        attempts: 0,
        successes: 0,
        failures: 0,
        lastRetry: null,
        firstRetry: Date.now()
      });
    }
    
    const stats = this.retryStats.get(key);
    stats.attempts++;
    stats.lastRetry = Date.now();
  }

  /**
   * Record successful retry
   */
  recordRetrySuccess(key, attemptNumber) {
    if (this.retryStats.has(key)) {
      const stats = this.retryStats.get(key);
      stats.successes++;
      stats.lastSuccess = Date.now();
      stats.lastSuccessfulAttempt = attemptNumber;
    }
  }

  /**
   * Record failed retry (all attempts exhausted)
   */
  recordRetryFailure(key) {
    if (this.retryStats.has(key)) {
      const stats = this.retryStats.get(key);
      stats.failures++;
      stats.lastFailure = Date.now();
    }
  }

  /**
   * Get retry statistics for a specific endpoint
   */
  getRetryStats(exchange, endpoint) {
    const key = `${exchange}:${endpoint}`;
    const stats = this.retryStats.get(key);
    
    if (!stats) {
      return {
        attempts: 0,
        successes: 0,
        failures: 0,
        successRate: 0,
        lastRetry: null
      };
    }
    
    return {
      ...stats,
      successRate: stats.attempts > 0 ? stats.successes / stats.attempts : 0,
      failureRate: stats.attempts > 0 ? stats.failures / stats.attempts : 0
    };
  }

  /**
   * Get overall retry statistics
   */
  getOverallStats() {
    let totalAttempts = 0;
    let totalSuccesses = 0;
    let totalFailures = 0;
    
    for (const stats of this.retryStats.values()) {
      totalAttempts += stats.attempts;
      totalSuccesses += stats.successes;
      totalFailures += stats.failures;
    }
    
    return {
      totalAttempts,
      totalSuccesses,
      totalFailures,
      successRate: totalAttempts > 0 ? totalSuccesses / totalAttempts : 0,
      failureRate: totalAttempts > 0 ? totalFailures / totalAttempts : 0,
      endpointsWithRetries: this.retryStats.size
    };
  }

  /**
   * Get retry recommendations based on statistics
   */
  getRetryRecommendations() {
    const recommendations = [];
    
    for (const [key, stats] of this.retryStats.entries()) {
      const successRate = stats.attempts > 0 ? stats.successes / stats.attempts : 0;
      
      if (stats.attempts > 10) {
        if (successRate < 0.3) {
          recommendations.push({
            endpoint: key,
            type: 'reduce_retries',
            message: `Consider reducing retries for ${key} (success rate: ${(successRate * 100).toFixed(1)}%)`,
            priority: 'high'
          });
        } else if (successRate > 0.8 && stats.attempts > 20) {
          recommendations.push({
            endpoint: key,
            type: 'increase_retries',
            message: `Consider increasing retries for ${key} (high success rate: ${(successRate * 100).toFixed(1)}%)`,
            priority: 'low'
          });
        }
      }
    }
    
    return recommendations;
  }

  /**
   * Clear statistics for specific endpoint
   */
  clearStats(exchange, endpoint) {
    const key = `${exchange}:${endpoint}`;
    this.retryStats.delete(key);
  }

  /**
   * Clear all statistics
   */
  clearAllStats() {
    this.retryStats.clear();
  }

  /**
   * Update retry configuration
   */
  updateConfig(newConfig) {
    const {
      maxRetries,
      baseDelay,
      maxDelay,
      backoffMultiplier,
      jitterEnabled,
      retryableErrors,
      retryableStatusCodes
    } = newConfig;

    if (maxRetries !== undefined) this.maxRetries = maxRetries;
    if (baseDelay !== undefined) this.baseDelay = baseDelay;
    if (maxDelay !== undefined) this.maxDelay = maxDelay;
    if (backoffMultiplier !== undefined) this.backoffMultiplier = backoffMultiplier;
    if (jitterEnabled !== undefined) this.jitterEnabled = jitterEnabled;
    
    if (retryableErrors !== undefined) {
      this.retryableErrors = new Set(retryableErrors);
    }
    
    if (retryableStatusCodes !== undefined) {
      this.retryableStatusCodes = new Set(retryableStatusCodes);
    }
  }

  /**
   * Add custom retryable error
   */
  addRetryableError(errorCode) {
    this.retryableErrors.add(errorCode);
  }

  /**
   * Remove retryable error
   */
  removeRetryableError(errorCode) {
    this.retryableErrors.delete(errorCode);
  }

  /**
   * Add custom retryable status code
   */
  addRetryableStatusCode(statusCode) {
    this.retryableStatusCodes.add(statusCode);
  }

  /**
   * Remove retryable status code
   */
  removeRetryableStatusCode(statusCode) {
    this.retryableStatusCodes.delete(statusCode);
  }

  /**
   * Check if specific error would be retried
   */
  wouldRetry(error, exchange, endpoint, currentRetryCount = 0) {
    return this.shouldRetry(error, exchange, endpoint, currentRetryCount);
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      maxRetries: this.maxRetries,
      baseDelay: this.baseDelay,
      maxDelay: this.maxDelay,
      backoffMultiplier: this.backoffMultiplier,
      jitterEnabled: this.jitterEnabled,
      retryableErrors: Array.from(this.retryableErrors),
      retryableStatusCodes: Array.from(this.retryableStatusCodes)
    };
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export { RetryHandler };