/**
 * Provider Performance Manager - Tracks AI provider performance and health
 */

const RetryUtility = require('../utils/retry-utility');

class ProviderPerformanceManager {
  constructor(options = {}) {
    this.providerStats = new Map(); // Map of provider -> stats
    this.healthChecks = new Map(); // Map of provider -> health status
    this.requestQueue = []; // Queue for tracking ongoing requests
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      lastUpdated: Date.now()
    };

    // Initialize retry utility with default options
    this.retryUtility = new RetryUtility({
      maxRetries: options.maxRetries || 2,
      baseDelay: options.baseDelay || 1000,
      maxDelay: options.maxDelay || 10000,
      ...options.retryOptions
    });
  }

  /**
   * Initialize provider stats
   */
  initProvider(providerName) {
    if (!this.providerStats.has(providerName)) {
      this.providerStats.set(providerName, {
        name: providerName,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgResponseTime: 0,
        lastRequestTime: null,
        lastSuccessTime: null,
        lastError: null,
        consecutiveFailures: 0,
        successRate: 0,
        isHealthy: true,
        responseTimes: [], // Keep last N response times for moving average
        maxResponseTimes: 10 // Keep only last 10 response times
      });
    }
  }

  /**
   * Record a request attempt
   */
  recordRequest(providerName, startTime) {
    this.initProvider(providerName);
    this.metrics.totalRequests++;
    
    const stats = this.providerStats.get(providerName);
    stats.totalRequests++;
    stats.lastRequestTime = Date.now();
    
    // Add to request queue for tracking
    const requestId = `req_${Date.now()}_${Math.random()}`;
    this.requestQueue.push({
      id: requestId,
      provider: providerName,
      startTime,
      completed: false
    });
    
    return requestId;
  }

  /**
   * Record a successful request
   */
  recordSuccess(requestId, providerName, responseTime, _result) {
    this.initProvider(providerName);
    
    const stats = this.providerStats.get(providerName);
    stats.successfulRequests++;
    stats.lastSuccessTime = Date.now();
    stats.consecutiveFailures = 0;
    stats.isHealthy = true;
    
    // Update response time tracking
    stats.responseTimes.push(responseTime);
    if (stats.responseTimes.length > stats.maxResponseTimes) {
      stats.responseTimes.shift();
    }
    
    // Calculate moving average
    if (stats.responseTimes.length > 0) {
      stats.avgResponseTime = stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length;
    }
    
    // Update success rate
    stats.successRate = (stats.successfulRequests / stats.totalRequests) * 100;
    
    this.metrics.successfulRequests++;
    this.metrics.avgResponseTime = ((this.metrics.avgResponseTime * (this.metrics.successfulRequests - 1)) + responseTime) / this.metrics.successfulRequests;
    
    // Mark request as completed
    const requestIndex = this.requestQueue.findIndex(req => req.id === requestId);
    if (requestIndex !== -1) {
      this.requestQueue[requestIndex].completed = true;
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(requestId, providerName, error) {
    this.initProvider(providerName);
    
    const stats = this.providerStats.get(providerName);
    stats.failedRequests++;
    stats.consecutiveFailures++;
    stats.lastError = error.message || error.toString();
    stats.isHealthy = stats.consecutiveFailures < 3; // Mark unhealthy after 3 consecutive failures
    
    // Update success rate
    stats.successRate = (stats.successfulRequests / stats.totalRequests) * 100;
    
    this.metrics.failedRequests++;
    
    // Mark request as completed
    const requestIndex = this.requestQueue.findIndex(req => req.id === requestId);
    if (requestIndex !== -1) {
      this.requestQueue[requestIndex].completed = true;
    }
  }

  /**
   * Get provider statistics
   */
  getProviderStats(providerName) {
    return this.providerStats.get(providerName) || null;
  }

  /**
   * Get all provider statistics
   */
  getAllProviderStats() {
    const allStats = {};
    for (const [name, stats] of this.providerStats) {
      allStats[name] = { ...stats };
    }
    return allStats;
  }

  /**
   * Get the best performing provider based on current metrics
   */
  getBestProvider(preferredProvider = null) {
    if (preferredProvider && this.providerStats.has(preferredProvider)) {
      const preferredStats = this.providerStats.get(preferredProvider);
      if (preferredStats.isHealthy) {
        return preferredProvider;
      }
    }

    // Filter healthy providers
    const healthyProviders = Array.from(this.providerStats.entries())
      .filter(([_, stats]) => stats.isHealthy)
      .map(([name, stats]) => ({ name, stats }));

    if (healthyProviders.length === 0) {
      // If no healthy providers, return the one with least consecutive failures
      const allProviders = Array.from(this.providerStats.entries());
      if (allProviders.length === 0) return null;
      
      return allProviders.sort((a, b) => 
        a[1].consecutiveFailures - b[1].consecutiveFailures
      )[0][0];
    }

    // Choose provider with highest success rate and lowest avg response time
    const bestProvider = healthyProviders.reduce((best, current) => {
      // Prefer providers with higher success rate
      if (current.stats.successRate > best.stats.successRate) {
        return current;
      }
      
      // If success rates are similar, prefer lower response time
      if (Math.abs(current.stats.successRate - best.stats.successRate) < 5) {
        if (current.stats.avgResponseTime < best.stats.avgResponseTime) {
          return current;
        }
      }
      
      return best;
    });

    return bestProvider.name;
  }

  /**
   * Check if a provider is healthy
   */
  isProviderHealthy(providerName) {
    const stats = this.providerStats.get(providerName);
    return stats ? stats.isHealthy : false;
  }

  /**
   * Get overall metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      lastUpdated: Date.now()
    };
  }

  /**
   * Cleanup old requests from queue
   */
  cleanupRequestQueue() {
    const now = Date.now();
    this.requestQueue = this.requestQueue.filter(req => 
      !req.completed || (now - req.startTime) < 300000 // Keep for 5 minutes after completion
    );
  }

  /**
   * Execute a provider call with retry logic and performance tracking
   */
  async executeWithRetry(providerName, fn, options = {}) {
    // Initialize provider if not already done
    this.initProvider(providerName);

    // Record the request attempt
    const requestId = this.recordRequest(providerName, Date.now());
    const startTime = Date.now();

    try {
      // Execute with retry logic
      const result = await this.retryUtility.execute(async (attempt) => {
        if (attempt > 0) {
          console.log(`Retry attempt ${attempt} for ${providerName}`);
        }
        return await fn(attempt);
      }, options);

      // Record successful execution
      const responseTime = Date.now() - startTime;
      this.recordSuccess(requestId, providerName, responseTime, result);

      return result;
    } catch (error) {
      // Record failed execution
      this.recordFailure(requestId, providerName, error);
      throw error;
    }
  }

  /**
   * Get provider health summary
   */
  getHealthSummary() {
    const summary = {};
    for (const [name, stats] of this.providerStats) {
      summary[name] = {
        healthy: stats.isHealthy,
        successRate: stats.successRate.toFixed(2),
        avgResponseTime: stats.avgResponseTime.toFixed(2),
        consecutiveFailures: stats.consecutiveFailures,
        totalRequests: stats.totalRequests
      };
    }
    return summary;
  }
}

module.exports = ProviderPerformanceManager;