/**
 * Health Check - System health monitoring utilities
 */

class HealthCheck {
  constructor() {
    this.checks = new Map();
    this.lastCheckTime = null;
  }

  /**
   * Register a health check
   */
  registerCheck(name, checkFn) {
    this.checks.set(name, {
      check: checkFn,
      lastResult: null,
      lastChecked: null,
    });
  }

  /**
   * Run all health checks
   */
  async runChecks() {
    const results = {
      timestamp: Date.now(),
      status: 'healthy',
      checks: {},
    };

    for (const [name, check] of this.checks) {
      try {
        const startTime = Date.now();
        const result = await Promise.resolve(check.check());
        const duration = Date.now() - startTime;

        results.checks[name] = {
          status: result ? 'pass' : 'fail',
          duration,
          timestamp: Date.now(),
        };

        if (!result) {
          results.status = 'degraded';
        }
      } catch (error) {
        results.checks[name] = {
          status: 'error',
          error: error.message,
          timestamp: Date.now(),
        };
        results.status = 'unhealthy';
      }
    }

    this.lastCheckTime = Date.now();
    return results;
  }

  /**
   * Get system health summary
   */
  getSummary() {
    const summary = {
      status: 'unknown',
      checksRegistered: this.checks.size,
      lastCheckTime: this.lastCheckTime,
    };

    if (this.lastCheckTime) {
      summary.timeSinceLastCheck = Date.now() - this.lastCheckTime;
    }

    return summary;
  }

  /**
   * Check if system is healthy
   */
  isHealthy() {
    for (const [, check] of this.checks) {
      if (check.lastResult === false) {
        return false;
      }
    }
    return true;
  }
}

/**
 * Metrics Collector - Collects and tracks system metrics
 */
class MetricsCollector {
  constructor() {
    this.metrics = new Map();
  }

  /**
   * Record a metric value
   */
  record(metric, value) {
    if (!this.metrics.has(metric)) {
      this.metrics.set(metric, {
        values: [],
        count: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
      });
    }

    const data = this.metrics.get(metric);
    data.values.push({ value, timestamp: Date.now() });
    data.count++;
    data.sum += value;
    data.min = Math.min(data.min, value);
    data.max = Math.max(data.max, value);
  }

  /**
   * Get metric statistics
   */
  getStats(metric) {
    const data = this.metrics.get(metric);
    if (!data) {
      return null;
    }

    return {
      count: data.count,
      sum: data.sum,
      avg: data.sum / data.count,
      min: data.min,
      max: data.max,
    };
  }

  /**
   * Get all metrics summary
   */
  getAllStats() {
    const stats = {};
    for (const [metric] of this.metrics) {
      stats[metric] = this.getStats(metric);
    }
    return stats;
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics.clear();
  }
}

module.exports = { HealthCheck, MetricsCollector };