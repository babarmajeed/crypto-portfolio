import { EventEmitter } from 'events';

/**
 * Circuit Breaker Implementation for API Endpoints
 * Prevents cascading failures by temporarily blocking requests to failing endpoints
 */
class CircuitBreaker extends EventEmitter {
  constructor(options = {}) {
    super();
    
    const {
      failureThreshold = 5,
      recoveryTimeout = 60000,
      monitoringPeriod = 10000,
      successThreshold = 3, // For half-open state
      name = 'unnamed'
    } = options;
    
    this.failureThreshold = failureThreshold;
    this.recoveryTimeout = recoveryTimeout;
    this.monitoringPeriod = monitoringPeriod;
    this.successThreshold = successThreshold;
    this.name = name;
    
    // Circuit breaker states: CLOSED, OPEN, HALF_OPEN
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    
    // Statistics
    this.stats = {
      totalRequests: 0,
      failures: 0,
      successes: 0,
      timeouts: 0,
      circuitOpenCount: 0,
      lastStateChange: Date.now(),
      createdAt: Date.now()
    };
    
    // Start monitoring
    this.startMonitoring();
  }

  /**
   * Check if request can be executed
   */
  canExecute() {
    this.updateState();
    return this.state !== 'OPEN';
  }

  /**
   * Record successful request
   */
  recordSuccess() {
    this.stats.totalRequests++;
    this.stats.successes++;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      
      // If enough successes in half-open state, close circuit
      if (this.successCount >= this.successThreshold) {
        this.closeCircuit();
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success
      this.failureCount = 0;
    }
  }

  /**
   * Record failed request
   */
  recordFailure() {
    this.stats.totalRequests++;
    this.stats.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'CLOSED' || this.state === 'HALF_OPEN') {
      this.failureCount++;
      this.successCount = 0; // Reset success count
      
      // Open circuit if failure threshold exceeded
      if (this.failureCount >= this.failureThreshold) {
        this.openCircuit();
      }
    }
  }

  /**
   * Record timeout (treated as failure)
   */
  recordTimeout() {
    this.stats.timeouts++;
    this.recordFailure();
  }

  /**
   * Open the circuit (block requests)
   */
  openCircuit() {
    if (this.state === 'OPEN') return;
    
    this.state = 'OPEN';
    this.nextAttemptTime = Date.now() + this.recoveryTimeout;
    this.stats.circuitOpenCount++;
    this.stats.lastStateChange = Date.now();
    
    this.emit('open', {
      name: this.name,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
    });
  }

  /**
   * Close the circuit (allow requests)
   */
  closeCircuit() {
    if (this.state === 'CLOSED') return;
    
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = null;
    this.stats.lastStateChange = Date.now();
    
    this.emit('close', {
      name: this.name
    });
  }

  /**
   * Set circuit to half-open (allow limited requests)
   */
  halfOpenCircuit() {
    if (this.state === 'HALF_OPEN') return;
    
    this.state = 'HALF_OPEN';
    this.successCount = 0;
    this.stats.lastStateChange = Date.now();
    
    this.emit('halfOpen', {
      name: this.name
    });
  }

  /**
   * Update circuit state based on time and conditions
   */
  updateState() {
    const now = Date.now();
    
    // If open and recovery timeout passed, try half-open
    if (this.state === 'OPEN' && this.nextAttemptTime && now >= this.nextAttemptTime) {
      this.halfOpenCircuit();
    }
  }

  /**
   * Get current state
   */
  getState() {
    this.updateState();
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      canExecute: this.canExecute()
    };
  }

  /**
   * Get detailed statistics
   */
  getStats() {
    const uptime = Date.now() - this.stats.createdAt;
    const requestRate = this.stats.totalRequests > 0 ? 
      (this.stats.totalRequests / uptime) * 1000 : 0;
    
    return {
      ...this.stats,
      currentState: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      uptime,
      requestRate,
      failureRate: this.stats.totalRequests > 0 ? 
        this.stats.failures / this.stats.totalRequests : 0,
      successRate: this.stats.totalRequests > 0 ? 
        this.stats.successes / this.stats.totalRequests : 0,
      timeoutRate: this.stats.totalRequests > 0 ? 
        this.stats.timeouts / this.stats.totalRequests : 0
    };
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset() {
    this.closeCircuit();
    this.lastFailureTime = null;
    
    // Reset stats but keep creation time
    const createdAt = this.stats.createdAt;
    this.stats = {
      totalRequests: 0,
      failures: 0,
      successes: 0,
      timeouts: 0,
      circuitOpenCount: 0,
      lastStateChange: Date.now(),
      createdAt
    };
    
    this.emit('reset', { name: this.name });
  }

  /**
   * Force circuit to specific state (for testing)
   */
  forceState(newState) {
    const validStates = ['CLOSED', 'OPEN', 'HALF_OPEN'];
    if (!validStates.includes(newState)) {
      throw new Error(`Invalid state: ${newState}`);
    }
    
    const oldState = this.state;
    this.state = newState;
    this.stats.lastStateChange = Date.now();
    
    if (newState === 'OPEN') {
      this.nextAttemptTime = Date.now() + this.recoveryTimeout;
    } else {
      this.nextAttemptTime = null;
    }
    
    this.emit('stateForced', {
      name: this.name,
      oldState,
      newState
    });
  }

  /**
   * Start monitoring interval
   */
  startMonitoring() {
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.monitoringPeriod);
  }

  /**
   * Perform health check
   */
  performHealthCheck() {
    this.updateState();
    
    const stats = this.getStats();
    
    // Emit health check event with current stats
    this.emit('healthCheck', {
      name: this.name,
      ...stats
    });
    
    // Check for concerning patterns
    if (stats.failureRate > 0.5 && stats.totalRequests > 10) {
      this.emit('highFailureRate', {
        name: this.name,
        failureRate: stats.failureRate,
        totalRequests: stats.totalRequests
      });
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    const {
      failureThreshold,
      recoveryTimeout,
      monitoringPeriod,
      successThreshold
    } = newConfig;

    if (failureThreshold !== undefined) this.failureThreshold = failureThreshold;
    if (recoveryTimeout !== undefined) this.recoveryTimeout = recoveryTimeout;
    if (successThreshold !== undefined) this.successThreshold = successThreshold;
    
    if (monitoringPeriod !== undefined && monitoringPeriod !== this.monitoringPeriod) {
      this.monitoringPeriod = monitoringPeriod;
      
      // Restart monitoring with new period
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.startMonitoring();
      }
    }
  }

  /**
   * Get configuration
   */
  getConfig() {
    return {
      failureThreshold: this.failureThreshold,
      recoveryTimeout: this.recoveryTimeout,
      monitoringPeriod: this.monitoringPeriod,
      successThreshold: this.successThreshold,
      name: this.name
    };
  }

  /**
   * Check if circuit is healthy
   */
  isHealthy() {
    const stats = this.getStats();
    return this.state === 'CLOSED' && stats.failureRate < 0.1;
  }

  /**
   * Get time until next attempt (for OPEN state)
   */
  getTimeUntilNextAttempt() {
    if (this.state !== 'OPEN' || !this.nextAttemptTime) {
      return 0;
    }
    
    return Math.max(0, this.nextAttemptTime - Date.now());
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute(fn) {
    if (!this.canExecute()) {
      const error = new Error(`Circuit breaker is OPEN for ${this.name}`);
      error.code = 'CIRCUIT_BREAKER_OPEN';
      error.nextAttemptTime = this.nextAttemptTime;
      throw error;
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      if (error.name === 'TimeoutError' || error.code === 'TIMEOUT') {
        this.recordTimeout();
      } else {
        this.recordFailure();
      }
      throw error;
    }
  }

  /**
   * Create a wrapped version of a function with circuit breaker protection
   */
  wrap(fn) {
    return async (...args) => {
      return this.execute(() => fn(...args));
    };
  }

  /**
   * Export circuit breaker state for persistence
   */
  exportState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      stats: this.stats,
      config: this.getConfig()
    };
  }

  /**
   * Import circuit breaker state from persistence
   */
  importState(data) {
    if (data.state) this.state = data.state;
    if (data.failureCount !== undefined) this.failureCount = data.failureCount;
    if (data.successCount !== undefined) this.successCount = data.successCount;
    if (data.lastFailureTime) this.lastFailureTime = data.lastFailureTime;
    if (data.nextAttemptTime) this.nextAttemptTime = data.nextAttemptTime;
    if (data.stats) this.stats = { ...this.stats, ...data.stats };
    if (data.config) this.updateConfig(data.config);
  }

  /**
   * Get human-readable status
   */
  toString() {
    const state = this.getState();
    const stats = this.getStats();
    
    return `CircuitBreaker(${this.name}): ${state.state} - ` +
           `Failures: ${state.failureCount}/${this.failureThreshold}, ` +
           `Success Rate: ${(stats.successRate * 100).toFixed(1)}%`;
  }

  /**
   * Cleanup and shutdown
   */
  cleanup() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.removeAllListeners();
  }
}

export { CircuitBreaker };