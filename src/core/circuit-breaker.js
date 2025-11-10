/**
 * Circuit Breaker Pattern - Prevents cascading failures
 */

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.timeout = options.timeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds
    
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.successCount = 0;
    this.requestCount = 0;
    
    // Metrics for monitoring
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastStateChange: Date.now()
    };
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute(operation, context = {}) {
    this.metrics.totalRequests++;
    
    // Check circuit state
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.setState('HALF_OPEN');
        console.log(`🔄 Circuit breaker transitioning to HALF_OPEN for ${context.provider || 'unknown'}`);
      } else {
        const remainingTime = Math.ceil((this.timeout - (Date.now() - this.lastFailureTime)) / 1000);
        throw new Error(`Circuit breaker is OPEN. Retry in ${remainingTime}s`);
      }
    }

    const startTime = Date.now();
    
    try {
      const result = await operation();
      const responseTime = Date.now() - startTime;
      
      this.onSuccess(responseTime);
      return result;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.onFailure(error, responseTime, context);
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  onSuccess(responseTime) {
    this.metrics.successfulRequests++;
    this.metrics.averageResponseTime = this.calculateAverageResponseTime(responseTime);
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 2) { // Need 2 consecutive successes to close
        this.setState('CLOSED');
        this.successCount = 0;
      }
    } else {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  /**
   * Handle failed operation
   */
  onFailure(error, responseTime, context) {
    this.metrics.failedRequests++;
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    // Log detailed error information
    console.error(`⚡ Circuit breaker failure for ${context.provider || 'unknown'}:`, {
      error: error.message,
      responseTime,
      failureCount: this.failureCount,
      threshold: this.failureThreshold
    });

    if (this.failureCount >= this.failureThreshold) {
      this.setState('OPEN');
    }
  }

  /**
   * Set circuit breaker state
   */
  setState(newState) {
    const oldState = this.state;
    this.state = newState;
    this.metrics.lastStateChange = Date.now();
    
    console.log(`⚡ Circuit breaker state change: ${oldState} -> ${newState}`);
    
    if (newState === 'CLOSED') {
      this.failureCount = 0;
      this.successCount = 0;
    }
  }

  /**
   * Calculate running average response time
   */
  calculateAverageResponseTime(newResponseTime) {
    if (this.metrics.averageResponseTime === 0) {
      return newResponseTime;
    }
    
    // Weighted average (give more weight to recent measurements)
    const alpha = 0.3; // Smoothing factor
    return Math.round(
      alpha * newResponseTime + 
      (1 - alpha) * this.metrics.averageResponseTime
    );
  }

  /**
   * Get current circuit breaker status
   */
  getStatus() {
    const successRate = this.metrics.totalRequests > 0 
      ? Math.round((this.metrics.successfulRequests / this.metrics.totalRequests) * 100)
      : 0;

    return {
      state: this.state,
      failureCount: this.failureCount,
      failureThreshold: this.failureThreshold,
      successRate,
      averageResponseTime: this.metrics.averageResponseTime,
      totalRequests: this.metrics.totalRequests,
      timeSinceLastChange: Date.now() - this.metrics.lastStateChange,
      isOpen: this.state === 'OPEN',
      isHalfOpen: this.state === 'HALF_OPEN'
    };
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset() {
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.setState('CLOSED');
    
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastStateChange: Date.now()
    };
    
    console.log('🔄 Circuit breaker reset to CLOSED state');
  }

  /**
   * Get current state of the circuit breaker
   */
  getState() {
    return this.state;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats() {
    const now = Date.now();
    const activeWindowMs = now - this.metrics.lastStateChange;
    const successRate = this.metrics.totalRequests > 0 
      ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 
      : 100;

    return {
      state: this.state,
      successRate: Math.round(successRate * 100) / 100,
      totalRequests: this.metrics.totalRequests,
      successfulRequests: this.metrics.successfulRequests,
      failedRequests: this.metrics.failedRequests,
      lastFailureTime: this.lastFailureTime,
      failureCount: this.failureCount,
      successCount: this.successCount,
      windowDuration: activeWindowMs,
      isOpen: this.state === 'OPEN',
    };
  }

  /**
   * Get detailed metrics
   */
  getMetrics() {
    return this.metrics;
  }

  /**
   * Reset circuit breaker metrics
   */
  resetMetrics() {
    this.requestCount = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastStateChange: Date.now()
    };
  }

  /**
   * Clean up resources
   */
  dispose() {
    // Clear any scheduled timers or listeners if needed
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Check if circuit breaker should allow requests
   */
  canExecute() {
    if (this.state === 'CLOSED') {
      return true;
    }
    
    if (this.state === 'OPEN') {
      return Date.now() - this.lastFailureTime > this.timeout;
    }
    
    // HALF_OPEN - allow limited requests
    return this.successCount < 2;
  }
}

module.exports = CircuitBreaker;