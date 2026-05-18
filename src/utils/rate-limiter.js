/**
 * Rate Limiter - Simple rate limiting for CLI usage
 */

class RateLimiter {
  constructor(options = {}) {
    this.maxRequests = options.maxRequests || 60; // requests per window
    this.windowMs = options.windowMs || 60000; // 1 minute window
    this.requests = [];
  }

  /**
   * Check if a request is allowed
   */
  canMakeRequest() {
    const now = Date.now();
    // Remove requests outside current window
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      return false;
    }

    return true;
  }

  /**
   * Record a request
   */
  recordRequest() {
    this.requests.push(Date.now());
  }

  /**
   * Get time until next request is allowed (in ms)
   */
  getWaitTime() {
    if (this.requests.length < this.maxRequests) {
      return 0;
    }
    const oldestRequest = this.requests[0];
    return Math.max(0, this.windowMs - (Date.now() - oldestRequest));
  }

  /**
   * Reset the rate limiter
   */
  reset() {
    this.requests = [];
  }

  /**
   * Get current status
   */
  getStatus() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    return {
      currentRequests: this.requests.length,
      maxRequests: this.maxRequests,
      windowMs: this.windowMs,
      canMakeRequest: this.requests.length < this.maxRequests,
      waitTimeMs: this.getWaitTime(),
    };
  }
}

module.exports = RateLimiter;