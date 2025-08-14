/**
 * Token Bucket Rate Limiter Implementation
 * Uses the token bucket algorithm to control request rates
 */
class TokenBucketLimiter {
  constructor(config) {
    const {
      requestsPerInterval,
      intervalMs,
      burstSize = null, // If null, uses requestsPerInterval as burst size
      name = 'unnamed'
    } = config;

    this.capacity = burstSize || requestsPerInterval;
    this.tokens = this.capacity; // Start with full bucket
    this.refillRate = requestsPerInterval / intervalMs; // tokens per millisecond
    this.lastRefill = Date.now();
    this.intervalMs = intervalMs;
    this.name = name;
    
    // Statistics
    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      deniedRequests: 0,
      lastRequest: null,
      createdAt: Date.now()
    };
  }

  /**
   * Check if a request can be made without consuming tokens
   */
  canMakeRequest(tokensNeeded = 1) {
    this.refill();
    return this.tokens >= tokensNeeded;
  }

  /**
   * Attempt to consume tokens for a request
   * Returns true if tokens were successfully consumed
   */
  recordRequest(tokensNeeded = 1) {
    this.refill();
    this.stats.totalRequests++;
    this.stats.lastRequest = Date.now();

    if (this.tokens >= tokensNeeded) {
      this.tokens -= tokensNeeded;
      this.stats.allowedRequests++;
      return true;
    } else {
      this.stats.deniedRequests++;
      return false;
    }
  }

  /**
   * Refill tokens based on time elapsed
   */
  refill() {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    
    if (timePassed <= 0) return;

    const tokensToAdd = timePassed * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Get time until next token is available (in milliseconds)
   */
  getTimeUntilNextToken(tokensNeeded = 1) {
    this.refill();
    
    if (this.tokens >= tokensNeeded) {
      return 0;
    }
    
    const tokensShortage = tokensNeeded - this.tokens;
    return Math.ceil(tokensShortage / this.refillRate);
  }

  /**
   * Get time until bucket is full (in milliseconds)
   */
  getTimeUntilFull() {
    this.refill();
    
    if (this.tokens >= this.capacity) {
      return 0;
    }
    
    const tokensNeeded = this.capacity - this.tokens;
    return Math.ceil(tokensNeeded / this.refillRate);
  }

  /**
   * Get current token count
   */
  getAvailableTokens() {
    this.refill();
    return Math.floor(this.tokens);
  }

  /**
   * Get bucket capacity
   */
  getCapacity() {
    return this.capacity;
  }

  /**
   * Get fill percentage (0-1)
   */
  getFillPercentage() {
    this.refill();
    return this.tokens / this.capacity;
  }

  /**
   * Check if bucket is full
   */
  isFull() {
    this.refill();
    return this.tokens >= this.capacity;
  }

  /**
   * Check if bucket is empty
   */
  isEmpty() {
    this.refill();
    return this.tokens < 1;
  }

  /**
   * Force refill to full capacity (useful for testing or reset)
   */
  refillToFull() {
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
  }

  /**
   * Drain all tokens (useful for testing or emergency stops)
   */
  drain() {
    this.tokens = 0;
    this.lastRefill = Date.now();
  }

  /**
   * Get statistics about this limiter
   */
  getStats() {
    this.refill();
    
    const uptime = Date.now() - this.stats.createdAt;
    const requestRate = this.stats.totalRequests > 0 ? 
      (this.stats.totalRequests / uptime) * 1000 : 0; // requests per second
    
    return {
      ...this.stats,
      currentTokens: Math.floor(this.tokens),
      capacity: this.capacity,
      fillPercentage: this.getFillPercentage(),
      refillRate: this.refillRate * 1000, // tokens per second
      uptime,
      requestRate,
      allowedRatio: this.stats.totalRequests > 0 ? 
        this.stats.allowedRequests / this.stats.totalRequests : 0,
      deniedRatio: this.stats.totalRequests > 0 ? 
        this.stats.deniedRequests / this.stats.totalRequests : 0
    };
  }

  /**
   * Get detailed status information
   */
  getStatus() {
    this.refill();
    
    return {
      name: this.name,
      healthy: true,
      tokens: {
        available: Math.floor(this.tokens),
        capacity: this.capacity,
        percentage: this.getFillPercentage()
      },
      timing: {
        timeUntilNextToken: this.getTimeUntilNextToken(),
        timeUntilFull: this.getTimeUntilFull(),
        lastRefill: this.lastRefill,
        intervalMs: this.intervalMs
      },
      stats: this.getStats()
    };
  }

  /**
   * Create a rate limiter with sliding window behavior
   * This is useful for APIs that enforce sliding window limits
   */
  static createSlidingWindow(config) {
    const {
      requestsPerWindow,
      windowMs,
      name = 'sliding-window'
    } = config;

    // For sliding window, we use a smaller refill interval
    // to approximate the sliding behavior
    const refillInterval = windowMs / 100; // Refill every 1% of window
    const tokensPerRefill = requestsPerWindow / 100;

    return new TokenBucketLimiter({
      requestsPerInterval: tokensPerRefill,
      intervalMs: refillInterval,
      burstSize: requestsPerWindow,
      name
    });
  }

  /**
   * Create a leaky bucket rate limiter
   * This enforces a steady rate without allowing bursts
   */
  static createLeakyBucket(config) {
    const {
      requestsPerSecond,
      name = 'leaky-bucket'
    } = config;

    return new TokenBucketLimiter({
      requestsPerInterval: requestsPerSecond,
      intervalMs: 1000,
      burstSize: 1, // No burst allowed
      name
    });
  }

  /**
   * Create a bursty rate limiter that allows significant bursts
   */
  static createBurstyLimiter(config) {
    const {
      sustainedRate,
      burstSize,
      burstDurationMs = 60000,
      name = 'bursty'
    } = config;

    return new TokenBucketLimiter({
      requestsPerInterval: sustainedRate,
      intervalMs: burstDurationMs,
      burstSize: burstSize,
      name
    });
  }

  /**
   * Reset statistics (but keep current token count and refill time)
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      deniedRequests: 0,
      lastRequest: null,
      createdAt: Date.now()
    };
  }

  /**
   * Clone this limiter with the same configuration but fresh state
   */
  clone(name = null) {
    return new TokenBucketLimiter({
      requestsPerInterval: this.refillRate * this.intervalMs,
      intervalMs: this.intervalMs,
      burstSize: this.capacity,
      name: name || `${this.name}-clone`
    });
  }

  /**
   * Serialize configuration for storage/transmission
   */
  serialize() {
    return {
      type: 'TokenBucketLimiter',
      config: {
        requestsPerInterval: this.refillRate * this.intervalMs,
        intervalMs: this.intervalMs,
        burstSize: this.capacity,
        name: this.name
      },
      state: {
        tokens: this.tokens,
        lastRefill: this.lastRefill,
        stats: this.stats
      }
    };
  }

  /**
   * Restore from serialized data
   */
  static deserialize(data) {
    const limiter = new TokenBucketLimiter(data.config);
    
    if (data.state) {
      limiter.tokens = data.state.tokens;
      limiter.lastRefill = data.state.lastRefill;
      limiter.stats = data.state.stats || limiter.stats;
    }
    
    return limiter;
  }

  /**
   * Update configuration dynamically
   */
  updateConfig(newConfig) {
    const {
      requestsPerInterval,
      intervalMs,
      burstSize
    } = newConfig;

    if (requestsPerInterval !== undefined && intervalMs !== undefined) {
      this.refillRate = requestsPerInterval / intervalMs;
      this.intervalMs = intervalMs;
    }

    if (burstSize !== undefined) {
      this.capacity = burstSize;
      // Ensure current tokens don't exceed new capacity
      this.tokens = Math.min(this.tokens, this.capacity);
    }

    this.refill(); // Update tokens based on new config
  }

  /**
   * Wait until tokens are available
   * Returns a promise that resolves when the request can be made
   */
  async waitForTokens(tokensNeeded = 1, maxWaitMs = 60000) {
    const startTime = Date.now();
    
    while (!this.canMakeRequest(tokensNeeded)) {
      const waitTime = this.getTimeUntilNextToken(tokensNeeded);
      const elapsedTime = Date.now() - startTime;
      
      if (elapsedTime + waitTime > maxWaitMs) {
        throw new Error(`Timeout waiting for rate limit tokens (waited ${elapsedTime}ms)`);
      }
      
      // Wait for the calculated time, but check periodically in case of clock adjustments
      await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 1000)));
    }
    
    return this.recordRequest(tokensNeeded);
  }

  /**
   * Get a human-readable string representation
   */
  toString() {
    const status = this.getStatus();
    return `TokenBucketLimiter(${this.name}): ${status.tokens.available}/${status.tokens.capacity} tokens (${(status.tokens.percentage * 100).toFixed(1)}%)`;
  }
}

export { TokenBucketLimiter };