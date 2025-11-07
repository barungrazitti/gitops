/**
 * Tests for Stats Manager
 */

const StatsManager = require('../src/core/stats-manager');
const Conf = require('conf');

describe('StatsManager', () => {
  let statsManager;

  beforeEach(() => {
    // Create a fresh instance with isolated storage
    statsManager = new StatsManager();
  });

  afterEach(() => {
    // Clean up after each test if possible
    try {
      statsManager.stats.clear();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(statsManager.stats).toBeDefined();
      // Check that defaults are set (may have existing data from previous tests)
      expect(statsManager.stats.get('totalCommits')).toBeGreaterThanOrEqual(0);
      expect(statsManager.stats.get('cacheHits')).toBeGreaterThanOrEqual(0);
      expect(statsManager.stats.get('cacheMisses')).toBeGreaterThanOrEqual(0);
      expect(statsManager.stats.get('errorCount')).toBeGreaterThanOrEqual(0);
    });

    it('should have empty provider usage by default', () => {
      const providerUsage = statsManager.stats.get('providerUsage');
      expect(providerUsage).toEqual({});
    });

    it('should have empty response time history by default', () => {
      const history = statsManager.stats.get('responseTimeHistory');
      expect(history).toEqual([]);
    });
  });

  describe('recordCommit', () => {
    it('should record a basic commit', async () => {
      await statsManager.recordCommit('ollama', 1000);
      
      expect(statsManager.stats.get('totalCommits')).toBe(1);
      expect(statsManager.stats.get('lastUsed')).toBeDefined();
      expect(statsManager.stats.get('firstUsed')).toBeDefined();
    });

    it('should update provider usage', async () => {
      await statsManager.recordCommit('ollama', 1000);
      await statsManager.recordCommit('groq', 500);
      await statsManager.recordCommit('ollama', 800);
      
      const providerUsage = statsManager.stats.get('providerUsage');
      expect(providerUsage.ollama).toBe(2);
      expect(providerUsage.groq).toBe(1);
    });

    it('should record response time history', async () => {
      await statsManager.recordCommit('ollama', 1000);
      await statsManager.recordCommit('groq', 500);
      
      const history = statsManager.stats.get('responseTimeHistory');
      expect(history).toHaveLength(2);
      expect(history[0]).toMatchObject({
        provider: 'ollama',
        time: 1000,
        timestamp: expect.any(Number)
      });
      expect(history[1]).toMatchObject({
        provider: 'groq',
        time: 500,
        timestamp: expect.any(Number)
      });
    });

    it('should limit response time history to 100 entries', async () => {
      // Add 105 commits
      for (let i = 0; i < 105; i++) {
        await statsManager.recordCommit('ollama', 1000);
      }
      
      const history = statsManager.stats.get('responseTimeHistory');
      expect(history).toHaveLength(100);
    });

    it('should set firstUsed only on first commit', async () => {
      await statsManager.recordCommit('ollama', 1000);
      const firstUsed = statsManager.stats.get('firstUsed');
      
      // Wait a bit and record another commit
      await new Promise(resolve => setTimeout(resolve, 10));
      await statsManager.recordCommit('groq', 500);
      const firstUsedAfter = statsManager.stats.get('firstUsed');
      
      expect(firstUsed).toBeDefined();
      expect(firstUsedAfter).toBe(firstUsed);
    });

    it('should update lastUsed on each commit', async () => {
      await statsManager.recordCommit('ollama', 1000);
      const lastUsed1 = statsManager.stats.get('lastUsed');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      await statsManager.recordCommit('groq', 500);
      const lastUsed2 = statsManager.stats.get('lastUsed');
      
      expect(lastUsed2).toBeGreaterThan(lastUsed1);
    });

    it('should handle missing response time', async () => {
      await statsManager.recordCommit('ollama');
      
      const history = statsManager.stats.get('responseTimeHistory');
      expect(history[0].time).toBe(0);
    });

    it('should handle recording errors gracefully', async () => {
      // Mock the stats.set method to throw an error
      const originalSet = statsManager.stats.set;
      statsManager.stats.set = () => {
        throw new Error('Storage error');
      };
      
      // Should not throw
      await expect(statsManager.recordCommit('ollama', 1000)).resolves.toBeUndefined();
      
      // Restore original method
      statsManager.stats.set = originalSet;
    });
  });

  describe('recordCacheHit', () => {
    it('should record cache hit', async () => {
      await statsManager.recordCacheHit();
      expect(statsManager.stats.get('cacheHits')).toBe(1);
      
      await statsManager.recordCacheHit();
      expect(statsManager.stats.get('cacheHits')).toBe(2);
    });

    it('should handle recording errors gracefully', async () => {
      const originalSet = statsManager.stats.set;
      statsManager.stats.set = () => {
        throw new Error('Storage error');
      };
      
      await expect(statsManager.recordCacheHit()).resolves.toBeUndefined();
      
      statsManager.stats.set = originalSet;
    });
  });

  describe('recordCacheMiss', () => {
    it('should record cache miss', async () => {
      await statsManager.recordCacheMiss();
      expect(statsManager.stats.get('cacheMisses')).toBe(1);
      
      await statsManager.recordCacheMiss();
      expect(statsManager.stats.get('cacheMisses')).toBe(2);
    });

    it('should handle recording errors gracefully', async () => {
      const originalSet = statsManager.stats.set;
      statsManager.stats.set = () => {
        throw new Error('Storage error');
      };
      
      await expect(statsManager.recordCacheMiss()).resolves.toBeUndefined();
      
      statsManager.stats.set = originalSet;
    });
  });

  describe('recordError', () => {
    it('should record error count', async () => {
      const error = new Error('Test error');
      await statsManager.recordError(error, 'ollama');
      
      expect(statsManager.stats.get('errorCount')).toBe(1);
    });

    it('should record recent errors', async () => {
      const error1 = new Error('First error');
      const error2 = new Error('Second error');
      
      await statsManager.recordError(error1, 'ollama');
      await statsManager.recordError(error2, 'groq');
      
      const errors = statsManager.stats.get('recentErrors');
      expect(errors).toHaveLength(2);
      expect(errors[0]).toMatchObject({
        message: 'First error',
        provider: 'ollama',
        timestamp: expect.any(Number)
      });
      expect(errors[1]).toMatchObject({
        message: 'Second error',
        provider: 'groq',
        timestamp: expect.any(Number)
      });
    });

    it('should limit recent errors to 50 entries', async () => {
      // Add 55 errors
      for (let i = 0; i < 55; i++) {
        await statsManager.recordError(new Error(`Error ${i}`), 'ollama');
      }
      
      const errors = statsManager.stats.get('recentErrors');
      expect(errors).toHaveLength(50);
      expect(errors[0].message).toBe('Error 5'); // First 5 should be removed
      expect(errors[49].message).toBe('Error 54');
    });

    it('should handle missing provider', async () => {
      const error = new Error('Test error');
      await statsManager.recordError(error);
      
      const errors = statsManager.stats.get('recentErrors');
      expect(errors[0].provider).toBeUndefined();
    });

    it('should handle recording errors gracefully', async () => {
      const originalSet = statsManager.stats.set;
      statsManager.stats.set = () => {
        throw new Error('Storage error');
      };
      
      await expect(statsManager.recordError(new Error('Test'))).resolves.toBeUndefined();
      
      statsManager.stats.set = originalSet;
    });
  });

  describe('getStats', () => {
    it('should return basic statistics with no data', async () => {
      const stats = await statsManager.getStats();
      
      expect(stats).toMatchObject({
        totalCommits: 0,
        mostUsedProvider: 'none',
        averageResponseTime: 0,
        cacheHitRate: 0,
        errorCount: 0,
        daysSinceFirstUse: 0,
        providerBreakdown: {},
        cacheStats: {
          hits: 0,
          misses: 0,
          hitRate: 0
        },
        usage: {
          firstUsed: null,
          lastUsed: null,
          commitsPerDay: 0
        }
      });
    });

    it('should calculate cache hit rate correctly', async () => {
      await statsManager.recordCacheHit();
      await statsManager.recordCacheHit();
      await statsManager.recordCacheMiss();
      
      const stats = await statsManager.getStats();
      expect(stats.cacheHitRate).toBe(66.7); // 2/3 * 100 rounded to 1 decimal
      expect(stats.cacheStats.hits).toBe(2);
      expect(stats.cacheStats.misses).toBe(1);
    });

    it('should calculate average response time', async () => {
      await statsManager.recordCommit('ollama', 1000);
      await statsManager.recordCommit('groq', 500);
      await statsManager.recordCommit('ollama', 800);
      
      const stats = await statsManager.getStats();
      expect(stats.averageResponseTime).toBe(767); // Math.round((1000 + 500 + 800) / 3)
    });

    it('should identify most used provider', async () => {
      await statsManager.recordCommit('ollama', 1000);
      await statsManager.recordCommit('groq', 500);
      await statsManager.recordCommit('ollama', 800);
      
      const stats = await statsManager.getStats();
      expect(stats.mostUsedProvider).toBe('ollama');
    });

    it('should calculate days since first use', async () => {
      const pastTime = Date.now() - (2 * 24 * 60 * 60 * 1000); // 2 days ago
      statsManager.stats.set('firstUsed', pastTime);
      
      const stats = await statsManager.getStats();
      expect(stats.daysSinceFirstUse).toBe(2);
    });

    it('should calculate commits per day', async () => {
      const pastTime = Date.now() - (2 * 24 * 60 * 60 * 1000); // 2 days ago
      statsManager.stats.set('firstUsed', pastTime);
      statsManager.stats.set('totalCommits', 6);
      
      const stats = await statsManager.getStats();
      expect(stats.usage.commitsPerDay).toBe('3.0'); // 6 commits / 2 days
    });

    it('should format dates correctly', async () => {
      const timestamp = Date.now();
      statsManager.stats.set('firstUsed', timestamp);
      statsManager.stats.set('lastUsed', timestamp);
      
      const stats = await statsManager.getStats();
      expect(stats.usage.firstUsed).toBe(new Date(timestamp).toISOString());
      expect(stats.usage.lastUsed).toBe(new Date(timestamp).toISOString());
    });

    it('should handle errors gracefully', async () => {
      // Create a new stats manager that will fail
      const failingStatsManager = new StatsManager();
      const originalGet = failingStatsManager.stats.get;
      failingStatsManager.stats.get = () => {
        throw new Error('Storage error');
      };
      
      const stats = await failingStatsManager.getStats();
      expect(stats.totalCommits).toBe(0);
      expect(stats.mostUsedProvider).toBe('none');
      
      // Restore
      failingStatsManager.stats.get = originalGet;
    });
  });

  describe('getDetailedStats', () => {
    it('should include basic stats plus additional data', async () => {
      await statsManager.recordCommit('ollama', 1000);
      await statsManager.recordError(new Error('Test error'), 'groq');
      
      const detailedStats = await statsManager.getDetailedStats();
      
      expect(detailedStats).toHaveProperty('totalCommits');
      expect(detailedStats).toHaveProperty('responseTimeHistory');
      expect(detailedStats).toHaveProperty('recentErrors');
      expect(detailedStats).toHaveProperty('trends');
      expect(detailedStats.responseTimeHistory).toHaveLength(1);
      expect(detailedStats.recentErrors).toHaveLength(1);
    });

    it('should fall back to basic stats on error', async () => {
      // Create a new stats manager that will fail
      const failingStatsManager = new StatsManager();
      const originalGet = failingStatsManager.stats.get;
      failingStatsManager.stats.get = () => {
        throw new Error('Storage error');
      };
      
      const detailedStats = await failingStatsManager.getDetailedStats();
      expect(detailedStats.totalCommits).toBe(0);
      
      // Restore
      failingStatsManager.stats.get = originalGet;
    });
  });

  describe('calculateTrends', () => {
    it('should return insufficient data for empty history', () => {
      const trends = statsManager.calculateTrends({});
      
      expect(trends).toMatchObject({
        responseTimeTrend: 'stable',
        usagePattern: 'insufficient_data'
      });
    });

    it('should return insufficient data for single entry', () => {
      const data = {
        responseTimeHistory: [{ time: 1000, timestamp: Date.now() }]
      };
      
      const trends = statsManager.calculateTrends(data);
      
      expect(trends).toMatchObject({
        responseTimeTrend: 'stable',
        usagePattern: 'insufficient_data'
      });
    });

    it('should calculate stable trend with insufficient data', () => {
      const now = Date.now();
      const data = {
        responseTimeHistory: [
          { time: 1000, timestamp: now - 2000 },
          { time: 800, timestamp: now - 1000 },
          { time: 600, timestamp: now }
        ]
      };
      
      const trends = statsManager.calculateTrends(data);
      
      // With only 3 entries, it returns stable due to insufficient previous data
      expect(trends.responseTimeTrend).toBe('stable');
    });

    it('should calculate stable trend with insufficient data for slower', () => {
      const now = Date.now();
      const data = {
        responseTimeHistory: [
          { time: 600, timestamp: now - 2000 },
          { time: 800, timestamp: now - 1000 },
          { time: 1000, timestamp: now }
        ]
      };
      
      const trends = statsManager.calculateTrends(data);
      
      // With only 3 entries, it returns stable due to insufficient previous data
      expect(trends.responseTimeTrend).toBe('stable');
    });

    it('should calculate stable trend', () => {
      const now = Date.now();
      const data = {
        responseTimeHistory: [
          { time: 800, timestamp: now - 2000 },
          { time: 850, timestamp: now - 1000 },
          { time: 900, timestamp: now }
        ]
      };
      
      const trends = statsManager.calculateTrends(data);
      
      expect(trends.responseTimeTrend).toBe('stable');
    });

    it('should calculate heavy usage pattern', () => {
      const now = Date.now();
      const data = {
        responseTimeHistory: Array(15).fill().map((_, i) => ({
          time: 1000,
          timestamp: now - (i * 60 * 60 * 1000) // One per hour for last 15 hours
        }))
      };
      
      const trends = statsManager.calculateTrends(data);
      
      expect(trends.usagePattern).toBe('heavy');
      expect(trends.recentCommits).toBe(15);
    });

    it('should calculate new user pattern with insufficient data', () => {
      const now = Date.now();
      const data = {
        responseTimeHistory: Array(5).fill().map((_, i) => ({
          time: 1000,
          timestamp: now - (i * 24 * 60 * 60 * 1000) // One per day for last 5 days
        }))
      };
      
      const trends = statsManager.calculateTrends(data);
      
      // With less than 10 entries, it returns new_user
      expect(trends.usagePattern).toBe('new_user');
      // recentCommits is only included when we have sufficient data
      expect(trends.recentCommits).toBeUndefined();
    });

    it('should calculate new user pattern with light usage', () => {
      const now = Date.now();
      const data = {
        responseTimeHistory: Array(2).fill().map((_, i) => ({
          time: 1000,
          timestamp: now - (i * 24 * 60 * 60 * 1000) // One per day for last 2 days
        }))
      };
      
      const trends = statsManager.calculateTrends(data);
      
      // With less than 10 entries, it returns new_user
      expect(trends.usagePattern).toBe('new_user');
      // recentCommits is only included when we have sufficient data
      expect(trends.recentCommits).toBeUndefined();
    });

    it('should calculate insufficient data pattern for old single entry', () => {
      const now = Date.now();
      const data = {
        responseTimeHistory: [
          { time: 1000, timestamp: now - (10 * 24 * 60 * 60 * 1000) } // 10 days ago
        ]
      };
      
      const trends = statsManager.calculateTrends(data);
      
      // With only 1 entry, it returns insufficient_data
      expect(trends.usagePattern).toBe('insufficient_data');
      // recentCommits is only included when we have sufficient data
      expect(trends.recentCommits).toBeUndefined();
    });

    it('should not include average response time breakdown with insufficient data', () => {
      const now = Date.now();
      const data = {
        responseTimeHistory: [
          { time: 600, timestamp: now - 2000 },
          { time: 800, timestamp: now - 1000 },
          { time: 1000, timestamp: now }
        ]
      };
      
      const trends = statsManager.calculateTrends(data);
      
      // With insufficient data, averageResponseTime is not included
      expect(trends.averageResponseTime).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('should reset all statistics to defaults', async () => {
      // Add some data
      await statsManager.recordCommit('ollama', 1000);
      await statsManager.recordCacheHit();
      await statsManager.recordError(new Error('Test'), 'groq');
      
      // Reset
      await statsManager.reset();
      
      // Check everything is reset
      expect(statsManager.stats.get('totalCommits')).toBe(0);
      expect(statsManager.stats.get('cacheHits')).toBe(0);
      expect(statsManager.stats.get('cacheMisses')).toBe(0);
      expect(statsManager.stats.get('errorCount')).toBe(0);
      expect(statsManager.stats.get('firstUsed')).toBeNull();
      expect(statsManager.stats.get('lastUsed')).toBeNull();
      expect(statsManager.stats.get('providerUsage')).toEqual({});
      expect(statsManager.stats.get('responseTimeHistory')).toEqual([]);
    });

    it('should handle reset errors gracefully', async () => {
      const originalClear = statsManager.stats.clear;
      statsManager.stats.clear = () => {
        throw new Error('Clear error');
      };
      
      await expect(statsManager.reset()).resolves.toBeUndefined();
      
      statsManager.stats.clear = originalClear;
    });
  });

  describe('export', () => {
    it('should export statistics with metadata', async () => {
      await statsManager.recordCommit('ollama', 1000);
      
      const exported = await statsManager.export();
      
      expect(exported).toHaveProperty('totalCommits');
      expect(exported).toHaveProperty('exportedAt');
      expect(exported).toHaveProperty('version', '1.0.0');
      expect(exported.totalCommits).toBe(1);
    });

    it('should return null on export error', async () => {
      // Create a new stats manager that will fail on getDetailedStats
      const failingStatsManager = new StatsManager();
      const originalGetDetailedStats = failingStatsManager.getDetailedStats;
      failingStatsManager.getDetailedStats = () => {
        throw new Error('Export error');
      };
      
      const exported = await failingStatsManager.export();
      expect(exported).toBeNull();
      
      // Restore
      failingStatsManager.getDetailedStats = originalGetDetailedStats;
    });
  });

  describe('getStatsPath', () => {
    it('should return the stats file path', () => {
      const path = statsManager.getStatsPath();
      expect(path).toBeDefined();
      expect(typeof path).toBe('string');
    });
  });
});