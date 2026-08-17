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
   * Get usage statistics
   */
  async getStats() {
    try {
      const data = this.stats.store;

      // Calculate derived statistics
      const totalCacheRequests = (data.cacheHits || 0) + (data.cacheMisses || 0);
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
        Object.entries(providerUsage).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';

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
          firstUsed: data.firstUsed ? new Date(data.firstUsed).toISOString() : null,
          lastUsed: data.lastUsed ? new Date(data.lastUsed).toISOString() : null,
          commitsPerDay:
            daysSinceFirstUse > 0 ? ((data.totalCommits || 0) / daysSinceFirstUse).toFixed(1) : 0,
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

}

module.exports = StatsManager;
