import { EventEmitter } from 'events';

/**
 * Priority-based Request Queue for Rate Limited Requests
 * Manages queued requests with priority handling and smart processing
 */
class RequestQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    
    const {
      maxSize = 1000,
      processingInterval = 100, // Check every 100ms
      priorityLevels = ['critical', 'high', 'normal', 'low'],
      maxProcessingConcurrency = 10
    } = options;
    
    this.maxSize = maxSize;
    this.processingInterval = processingInterval;
    this.priorityLevels = priorityLevels;
    this.maxProcessingConcurrency = maxProcessingConcurrency;
    
    // Priority queues
    this.queues = {};
    this.priorityLevels.forEach(level => {
      this.queues[level] = [];
    });
    
    // Processing state
    this.isProcessing = false;
    this.processingCount = 0;
    this.processingInterval = null;
    
    // Statistics
    this.stats = {
      totalAdded: 0,
      totalProcessed: 0,
      totalDropped: 0,
      averageWaitTime: 0,
      maxWaitTime: 0,
      processingStarted: Date.now()
    };
    
    // Age tracking for queue items
    this.itemAges = new Map(); // itemId -> timestamp
    this.maxAge = 300000; // 5 minutes default max age
    
    this.startProcessing();
  }

  /**
   * Add request to appropriate priority queue
   */
  add(request) {
    const {
      priority = 'normal',
      timestamp = Date.now(),
      maxAge = this.maxAge
    } = request;
    
    // Check if queue is full
    if (this.size() >= this.maxSize) {
      this.handleQueueFull(request);
      return false;
    }
    
    // Validate priority level
    if (!this.priorityLevels.includes(priority)) {
      request.priority = 'normal';
    }
    
    // Add unique ID and timestamp
    request.id = this.generateId();
    request.queuedAt = timestamp;
    request.maxAge = maxAge;
    
    // Add to appropriate queue
    this.queues[request.priority].push(request);
    this.itemAges.set(request.id, timestamp);
    
    this.stats.totalAdded++;
    
    this.emit('itemAdded', {
      priority: request.priority,
      queueSize: this.size(),
      request: this.sanitizeRequestForLogging(request)
    });
    
    return true;
  }

  /**
   * Get next request from queues based on priority
   */
  getNext() {
    // Process in priority order
    for (const priority of this.priorityLevels) {
      const queue = this.queues[priority];
      if (queue.length > 0) {
        const request = queue.shift();
        this.itemAges.delete(request.id);
        
        // Calculate wait time
        const waitTime = Date.now() - request.queuedAt;
        this.updateWaitTimeStats(waitTime);
        
        return request;
      }
    }
    return null;
  }

  /**
   * Peek at next request without removing it
   */
  peek() {
    for (const priority of this.priorityLevels) {
      const queue = this.queues[priority];
      if (queue.length > 0) {
        return queue[0];
      }
    }
    return null;
  }

  /**
   * Get total queue size across all priorities
   */
  size() {
    return Object.values(this.queues).reduce((total, queue) => total + queue.length, 0);
  }

  /**
   * Get size breakdown by priority
   */
  getSizeByPriority() {
    const sizes = {};
    this.priorityLevels.forEach(priority => {
      sizes[priority] = this.queues[priority].length;
    });
    return sizes;
  }

  /**
   * Check if queue is empty
   */
  isEmpty() {
    return this.size() === 0;
  }

  /**
   * Start automatic processing
   */
  startProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, this.processingInterval);
    
    this.emit('processingStarted');
  }

  /**
   * Stop automatic processing
   */
  stopProcessing() {
    if (!this.isProcessing) return;
    
    this.isProcessing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    this.emit('processingStopped');
  }

  /**
   * Process queued requests
   */
  async processQueue() {
    // Don't exceed max concurrency
    if (this.processingCount >= this.maxProcessingConcurrency) {
      return;
    }
    
    // Clean up expired requests first
    this.cleanupExpiredRequests();
    
    // Process available requests
    while (this.processingCount < this.maxProcessingConcurrency && !this.isEmpty()) {
      const request = this.getNext();
      if (!request) break;
      
      this.processingCount++;
      this.processRequest(request);
    }
    
    // Emit queue empty event if needed
    if (this.isEmpty() && this.processingCount === 0) {
      this.emit('queueEmpty');
    }
  }

  /**
   * Process individual request
   */
  async processRequest(request) {
    try {
      this.emit('itemProcessed', request);
      this.stats.totalProcessed++;
      
      this.emit('processingComplete', {
        requestId: request.id,
        success: true,
        processingTime: Date.now() - request.queuedAt
      });
      
    } catch (error) {
      this.emit('processingError', {
        requestId: request.id,
        error: error.message,
        request: this.sanitizeRequestForLogging(request)
      });
    } finally {
      this.processingCount--;
    }
  }

  /**
   * Handle queue full situation
   */
  handleQueueFull(request) {
    this.stats.totalDropped++;
    
    // Try to drop oldest low priority request
    const lowQueue = this.queues['low'];
    if (lowQueue.length > 0) {
      const droppedRequest = lowQueue.shift();
      this.itemAges.delete(droppedRequest.id);
      
      this.emit('itemDropped', {
        reason: 'queue_full',
        droppedRequest: this.sanitizeRequestForLogging(droppedRequest),
        newRequest: this.sanitizeRequestForLogging(request)
      });
      
      // Add the new request
      return this.add(request);
    }
    
    // If no low priority requests, drop the new request
    this.emit('itemDropped', {
      reason: 'queue_full_no_low_priority',
      droppedRequest: this.sanitizeRequestForLogging(request)
    });
    
    return false;
  }

  /**
   * Clean up expired requests
   */
  cleanupExpiredRequests() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const priority of this.priorityLevels) {
      const queue = this.queues[priority];
      
      // Remove expired items from the beginning of queue
      while (queue.length > 0) {
        const request = queue[0];
        const age = now - request.queuedAt;
        
        if (age > request.maxAge) {
          queue.shift();
          this.itemAges.delete(request.id);
          cleanedCount++;
          
          this.emit('itemExpired', {
            requestId: request.id,
            age,
            maxAge: request.maxAge,
            request: this.sanitizeRequestForLogging(request)
          });
        } else {
          break; // Queue is ordered by age, so we can stop here
        }
      }
    }
    
    if (cleanedCount > 0) {
      this.emit('expiredItemsCleaned', { count: cleanedCount });
    }
  }

  /**
   * Remove specific request from queue
   */
  remove(requestId) {
    for (const priority of this.priorityLevels) {
      const queue = this.queues[priority];
      const index = queue.findIndex(req => req.id === requestId);
      
      if (index !== -1) {
        const removedRequest = queue.splice(index, 1)[0];
        this.itemAges.delete(requestId);
        
        this.emit('itemRemoved', {
          requestId,
          priority,
          request: this.sanitizeRequestForLogging(removedRequest)
        });
        
        return removedRequest;
      }
    }
    
    return null;
  }

  /**
   * Clear all requests from queue
   */
  clear() {
    const totalCleared = this.size();
    
    this.priorityLevels.forEach(priority => {
      this.queues[priority] = [];
    });
    
    this.itemAges.clear();
    
    this.emit('queueCleared', { itemsCleared: totalCleared });
    
    return totalCleared;
  }

  /**
   * Get requests matching criteria
   */
  find(criteria) {
    const results = [];
    const { priority, exchange, endpoint, minAge, maxAge } = criteria;
    
    for (const level of this.priorityLevels) {
      if (priority && level !== priority) continue;
      
      const queue = this.queues[level];
      for (const request of queue) {
        let matches = true;
        
        if (exchange && request.exchange !== exchange) matches = false;
        if (endpoint && request.endpoint !== endpoint) matches = false;
        
        if (minAge !== undefined) {
          const age = Date.now() - request.queuedAt;
          if (age < minAge) matches = false;
        }
        
        if (maxAge !== undefined) {
          const age = Date.now() - request.queuedAt;
          if (age > maxAge) matches = false;
        }
        
        if (matches) {
          results.push({
            ...request,
            age: Date.now() - request.queuedAt
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Change priority of existing request
   */
  changePriority(requestId, newPriority) {
    if (!this.priorityLevels.includes(newPriority)) {
      throw new Error(`Invalid priority: ${newPriority}`);
    }
    
    // Find and remove request
    const request = this.remove(requestId);
    if (!request) {
      return false;
    }
    
    // Re-add with new priority
    request.priority = newPriority;
    return this.add(request);
  }

  /**
   * Get queue statistics
   */
  getStats() {
    const uptime = Date.now() - this.stats.processingStarted;
    const throughput = this.stats.totalProcessed > 0 ? 
      (this.stats.totalProcessed / uptime) * 1000 : 0; // items per second
    
    return {
      ...this.stats,
      currentSize: this.size(),
      sizeByPriority: this.getSizeByPriority(),
      processingCount: this.processingCount,
      uptime,
      throughput,
      dropRate: this.stats.totalAdded > 0 ? 
        this.stats.totalDropped / this.stats.totalAdded : 0
    };
  }

  /**
   * Get current status
   */
  getStatus() {
    const oldestRequest = this.findOldestRequest();
    
    return {
      isProcessing: this.isProcessing,
      size: this.size(),
      maxSize: this.maxSize,
      processingCount: this.processingCount,
      maxProcessingConcurrency: this.maxProcessingConcurrency,
      isEmpty: this.isEmpty(),
      isFull: this.size() >= this.maxSize,
      oldestRequestAge: oldestRequest ? Date.now() - oldestRequest.queuedAt : null,
      sizeByPriority: this.getSizeByPriority(),
      stats: this.getStats()
    };
  }

  /**
   * Find oldest request in queue
   */
  findOldestRequest() {
    let oldest = null;
    let oldestTime = Infinity;
    
    for (const queue of Object.values(this.queues)) {
      if (queue.length > 0) {
        const firstItem = queue[0];
        if (firstItem.queuedAt < oldestTime) {
          oldestTime = firstItem.queuedAt;
          oldest = firstItem;
        }
      }
    }
    
    return oldest;
  }

  /**
   * Update wait time statistics
   */
  updateWaitTimeStats(waitTime) {
    if (waitTime > this.stats.maxWaitTime) {
      this.stats.maxWaitTime = waitTime;
    }
    
    // Update running average
    const processed = this.stats.totalProcessed;
    this.stats.averageWaitTime = 
      (this.stats.averageWaitTime * (processed - 1) + waitTime) / processed;
  }

  /**
   * Generate unique ID for queue items
   */
  generateId() {
    return `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitize request for logging (remove sensitive data)
   */
  sanitizeRequestForLogging(request) {
    const sanitized = {
      id: request.id,
      exchange: request.exchange,
      endpoint: request.endpoint,
      priority: request.priority,
      queuedAt: request.queuedAt,
      maxAge: request.maxAge
    };
    
    // Don't log full params or functions
    if (request.params) {
      sanitized.paramsKeys = Object.keys(request.params);
    }
    
    return sanitized;
  }

  /**
   * Pause processing (keeps items in queue)
   */
  pause() {
    this.stopProcessing();
    this.emit('paused');
  }

  /**
   * Resume processing
   */
  resume() {
    this.startProcessing();
    this.emit('resumed');
  }

  /**
   * Set maximum queue size
   */
  setMaxSize(newMaxSize) {
    this.maxSize = newMaxSize;
    
    // If current size exceeds new max, drop low priority items
    while (this.size() > this.maxSize) {
      if (!this.handleQueueFull({ priority: 'low' })) {
        break; // No more items to drop
      }
    }
  }

  /**
   * Set maximum age for queue items
   */
  setMaxAge(newMaxAge) {
    this.maxAge = newMaxAge;
    this.cleanupExpiredRequests();
  }

  /**
   * Get items in queue (for debugging)
   */
  getQueueContents() {
    const contents = {};
    
    this.priorityLevels.forEach(priority => {
      contents[priority] = this.queues[priority].map(req => ({
        id: req.id,
        exchange: req.exchange,
        endpoint: req.endpoint,
        age: Date.now() - req.queuedAt,
        queuedAt: req.queuedAt
      }));
    });
    
    return contents;
  }

  /**
   * Export queue state for persistence
   */
  exportState() {
    return {
      queues: this.queues,
      stats: this.stats,
      itemAges: Array.from(this.itemAges.entries()),
      config: {
        maxSize: this.maxSize,
        processingInterval: this.processingInterval,
        priorityLevels: this.priorityLevels,
        maxProcessingConcurrency: this.maxProcessingConcurrency,
        maxAge: this.maxAge
      }
    };
  }

  /**
   * Import queue state from persistence
   */
  importState(state) {
    if (state.queues) {
      this.queues = state.queues;
    }
    
    if (state.stats) {
      this.stats = { ...this.stats, ...state.stats };
    }
    
    if (state.itemAges) {
      this.itemAges = new Map(state.itemAges);
    }
    
    if (state.config) {
      Object.assign(this, state.config);
    }
  }

  /**
   * Cleanup and shutdown
   */
  async cleanup() {
    this.stopProcessing();
    
    // Wait for current processing to complete
    while (this.processingCount > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.clear();
    this.removeAllListeners();
    
    this.emit('cleanup');
  }
}

export { RequestQueue };