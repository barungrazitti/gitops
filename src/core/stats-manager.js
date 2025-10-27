/**
 * Stats Manager - Tracks usage statistics
 */

const Conf = require('conf');

class StatsManager {
  constructor() {
    this.stats = new Conf({
      projectName: 'ai-commit-generator-stats',
      defaults: {
        totalCommits: 0,
        providerUsage: {},
        responseTimeHistory: [],
        cacheHits: 0,
        cacheMisses: 0,
        errorCount: 0,
        firstUsed: null,
        lastUsed: null,
      },
    });
  }

  /**
   * Record a successful commit
   */
  async recordCommit(provider, responseTime = 0) {
    try {
      const current = this.stats.store;
      const now = Date.now();

      this.stats.set('totalCommits', current.totalCommits + 1);
      this.stats.set('lastUsed', now);

      if (!current.firstUsed) {
        this.stats.set('firstUsed', now);
      }

      // Update provider usage
      const providerUsage = current.providerUsage || {};
      providerUsage[provider] = (providerUsage[provider] || 0) + 1;
      this.stats.set('providerUsage', providerUsage);

      // Update response time history (keep last 100)
      const responseTimeHistory = current.responseTimeHistory || [];
      responseTimeHistory.push({
        provider,
        time: responseTime,
        timestamp: now,
      });

      if (responseTimeHistory.length > 100) {
        responseTimeHistory.shift();
      }

      this.stats.set('responseTimeHistory', responseTimeHistory);
    } catch (error) {
      console.warn('Failed to record commit stats:', error.message);
    }
  }

  /**
   * Record cache hit
   */
  async recordCacheHit() {
    try {
      const current = this.stats.get('cacheHits') || 0;
      this.stats.set('cacheHits', current + 1);
    } catch (error) {
      console.warn('Failed to record cache hit:', error.message);
    }
  }

  /**
   * Record cache miss
   */
  async recordCacheMiss() {
    try {
      const current = this.stats.get('cacheMisses') || 0;
      this.stats.set('cacheMisses', current + 1);
    } catch (error) {
      console.warn('Failed to record cache miss:', error.message);
    }
  }

  /**
   * Record error
   */
  async recordError(error, provider) {
    try {
      const current = this.stats.get('errorCount') || 0;
      this.stats.set('errorCount', current + 1);

      // Store recent errors (keep last 50)
      const errors = this.stats.get('recentErrors') || [];
      errors.push({
        message: error.message,
        provider,
        timestamp: Date.now(),
      });

      if (errors.length > 50) {
        errors.shift();
      }

      this.stats.set('recentErrors', errors);
    } catch (err) {
      console.warn('Failed to record error stats:', err.message);
    }
  }

  /**
   * Get usage statistics
   */
  async getStats() {
    try {
      const data = this.stats.store;

      // Calculate derived statistics
      const totalCacheRequests =
        (data.cacheHits || 0) + (data.cacheMisses || 0);
      const cacheHitRate =
        totalCacheRequests > 0
          ? (((data.cacheHits || 0) / totalCacheRequests) * 100).toFixed(1)
          : 0;

      const responseTimeHistory = data.responseTimeHistory || [];
      const averageResponseTime =
        responseTimeHistory.length > 0
          ? Math.round(
              responseTimeHistory.reduce((sum, entry) => sum + entry.time, 0) /
                responseTimeHistory.length
            )
          : 0;

      const providerUsage = data.providerUsage || {};
      const mostUsedProvider =
        Object.entries(providerUsage).sort((a, b) => b[1] - a[1])[0]?.[0] ||
        'none';

      const daysSinceFirstUse = data.firstUsed
        ? Math.floor((Date.now() - data.firstUsed) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        totalCommits: data.totalCommits || 0,
        mostUsedProvider,
        averageResponseTime,
        cacheHitRate: parseFloat(cacheHitRate),
        errorCount: data.errorCount || 0,
        daysSinceFirstUse,
        providerBreakdown: providerUsage,
        cacheStats: {
          hits: data.cacheHits || 0,
          misses: data.cacheMisses || 0,
          hitRate: parseFloat(cacheHitRate),
        },
        usage: {
          firstUsed: data.firstUsed
            ? new Date(data.firstUsed).toISOString()
            : null,
          lastUsed: data.lastUsed
            ? new Date(data.lastUsed).toISOString()
            : null,
          commitsPerDay:
            daysSinceFirstUse > 0
              ? ((data.totalCommits || 0) / daysSinceFirstUse).toFixed(1)
              : 0,
        },
      };
    } catch (error) {
      console.warn('Failed to get stats:', error.message);
      return {
        totalCommits: 0,
        mostUsedProvider: 'none',
        averageResponseTime: 0,
        cacheHitRate: 0,
        errorCount: 0,
        daysSinceFirstUse: 0,
        providerBreakdown: {},
        cacheStats: { hits: 0, misses: 0, hitRate: 0 },
        usage: { firstUsed: null, lastUsed: null, commitsPerDay: 0 },
      };
    }
  }

  /**
   * Get detailed statistics
   */
  async getDetailedStats() {
    try {
      const basicStats = await this.getStats();
      const data = this.stats.store;

      return {
        ...basicStats,
        responseTimeHistory: data.responseTimeHistory || [],
        recentErrors: data.recentErrors || [],
        trends: this.calculateTrends(data),
      };
    } catch (error) {
      console.warn('Failed to get detailed stats:', error.message);
      return await this.getStats();
    }
  }

  /**
   * Calculate usage trends
   */
  calculateTrends(data) {
    const responseTimeHistory = data.responseTimeHistory || [];

    if (responseTimeHistory.length < 2) {
      return {
        responseTimeTrend: 'stable',
        usagePattern: 'insufficient_data',
      };
    }

    // Calculate response time trend (last 10 vs previous 10)
    const recent = responseTimeHistory.slice(-10);
    const previous = responseTimeHistory.slice(-20, -10);

    if (previous.length === 0) {
      return {
        responseTimeTrend: 'stable',
        usagePattern: 'new_user',
      };
    }

    const recentAvg =
      recent.reduce((sum, entry) => sum + entry.time, 0) / recent.length;
    const previousAvg =
      previous.reduce((sum, entry) => sum + entry.time, 0) / previous.length;

    const responseTimeTrend =
      recentAvg > previousAvg * 1.1
        ? 'slower'
        : recentAvg < previousAvg * 0.9
          ? 'faster'
          : 'stable';

    // Analyze usage pattern
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const recentCommits = responseTimeHistory.filter(
      (entry) => now - entry.timestamp < 7 * dayMs
    ).length;

    const usagePattern =
      recentCommits > 10
        ? 'heavy'
        : recentCommits > 3
          ? 'regular'
          : recentCommits > 0
            ? 'light'
            : 'inactive';

    return {
      responseTimeTrend,
      usagePattern,
      recentCommits,
      averageResponseTime: {
        recent: Math.round(recentAvg),
        previous: Math.round(previousAvg),
      },
    };
  }

  /**
   * Reset all statistics
   */
  async reset() {
    try {
      this.stats.clear();
      this.stats.store = {
        totalCommits: 0,
        providerUsage: {},
        responseTimeHistory: [],
        cacheHits: 0,
        cacheMisses: 0,
        errorCount: 0,
        firstUsed: null,
        lastUsed: null,
      };
    } catch (error) {
      console.warn('Failed to reset stats:', error.message);
    }
  }

  /**
   * Export statistics
   */
  async export() {
    try {
      const stats = await this.getDetailedStats();
      return {
        ...stats,
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
      };
    } catch (error) {
      console.warn('Failed to export stats:', error.message);
      return null;
    }
  }

  /**
   * Get statistics file path
   */
  getStatsPath() {
    return this.stats.path;
  }
}

module.exports = StatsManager;
