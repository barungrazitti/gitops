/**
 * Circuit Breaker Pattern Implementation for AI Provider Calls
 */

class CircuitBreaker {
  constructor(options = {}) {
    this.options = {
      threshold: options.threshold || 5,       // Number of failures before opening circuit
      timeout: options.timeout || 60000,       // Time in ms to keep circuit open (1 minute)
      resetTimeout: options.resetTimeout || 30000, // Time in ms before half-open state (30 seconds)
      ...options
    };

    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    this.successOnHalfOpen = false;
  }

  /**
   * Check if the circuit breaker allows the call
   */
  canExecute() {
    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      // Check if enough time has passed to transition to half-open
      if (Date.now() >= this.nextAttemptTime) {
        this.state = 'HALF_OPEN';
        this.successOnHalfOpen = false;
        return true;
      }
      return false;
    }

    // HALF_OPEN state - only allow one call to test recovery
    return !this.successOnHalfOpen;
  }

  /**
   * Record a successful execution
   */
  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.successOnHalfOpen = true;
  }

  /**
   * Record a failed execution
   */
  onFailure() {
    this.failureCount++;

    if (this.failureCount >= this.options.threshold) {
      this.state = 'OPEN';
      this.lastFailureTime = Date.now();
      this.nextAttemptTime = Date.now() + this.options.timeout;
    }
  }

  /**
   * Get current state information
   */
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      threshold: this.options.threshold,
      isOpen: this.state === 'OPEN',
      isClosed: this.state === 'CLOSED',
      isHalfOpen: this.state === 'HALF_OPEN',
      timeUntilReset: this.state === 'OPEN' ? this.nextAttemptTime - Date.now() : 0
    };
  }

  /**
   * Force reset the circuit breaker
   */
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    this.successOnHalfOpen = false;
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute(fn) {
    if (!this.canExecute()) {
      throw new Error(`Circuit breaker is OPEN. Call cannot be executed. State: ${this.state}`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
}

module.exports = CircuitBreaker;