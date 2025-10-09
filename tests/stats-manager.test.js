/**
 * StatsManager Tests
 */

const StatsManager = require('../src/core/stats-manager.js');

// Mock Date.now() to control timestamps
const MOCK_DATE = 1672531200000; // 2023-01-01T00:00:00.000Z
jest.spyOn(Date, 'now').mockImplementation(() => MOCK_DATE);

describe('StatsManager', () => {
  let statsManager;

  beforeEach(async () => {
    statsManager = new StatsManager();
    await statsManager.reset(); // Reset stats before each test
  });

  afterAll(async () => {
    await new StatsManager().reset(); // Clean up after all tests
    jest.restoreAllMocks(); // Restore mocks
  });

  test('should instantiate correctly', () => {
    expect(statsManager).toBeInstanceOf(StatsManager);
  });

  test('should get initial stats', async () => {
    const stats = await statsManager.getStats();
    expect(stats).toEqual({
      totalCommits: 0,
      mostUsedProvider: 'none',
      averageResponseTime: 0,
      cacheHitRate: 0,
      errorCount: 0,
      daysSinceFirstUse: 0,
      providerBreakdown: {},
      cacheStats: { hits: 0, misses: 0, hitRate: 0 },
      usage: {
        firstUsed: null,
        lastUsed: null,
        commitsPerDay: 0,
      },
    });
  });

  test('should record a single commit and a cache miss', async () => {
    await statsManager.recordCommit('openai', 500);
    await statsManager.recordCacheMiss();
    const stats = await statsManager.getStats();

    expect(stats.totalCommits).toBe(1);
    expect(stats.providerBreakdown.openai).toBe(1);
    expect(stats.averageResponseTime).toBe(500);
    expect(stats.cacheStats.misses).toBe(1);
    expect(stats.mostUsedProvider).toBe('openai');
    expect(stats.usage.firstUsed).not.toBeNull();
    expect(stats.usage.lastUsed).not.toBeNull();
  });

  test('should record a commit and a cache hit', async () => {
    await statsManager.recordCommit('anthropic', 300);
    await statsManager.recordCacheHit();
    const stats = await statsManager.getStats();

    expect(stats.totalCommits).toBe(1);
    expect(stats.cacheStats.hits).toBe(1);
    expect(stats.cacheStats.misses).toBe(0);
    expect(stats.cacheStats.hitRate).toBe(100);
  });

  test('should handle multiple commits and calculate averages', async () => {
    await statsManager.recordCommit('openai', 500);
    await statsManager.recordCacheMiss();
    await statsManager.recordCommit('anthropic', 700);
    await statsManager.recordCacheMiss();
    await statsManager.recordCommit('openai', 300);
    await statsManager.recordCacheHit();
    const stats = await statsManager.getStats();

    expect(stats.totalCommits).toBe(3);
    expect(stats.providerBreakdown.openai).toBe(2);
    expect(stats.providerBreakdown.anthropic).toBe(1);
    expect(stats.averageResponseTime).toBe(500); // (500 + 700 + 300) / 3
    expect(stats.cacheStats.hits).toBe(1);
    expect(stats.cacheStats.misses).toBe(2);
    expect(stats.cacheStats.hitRate).toBeCloseTo(33.3);
    expect(stats.mostUsedProvider).toBe('openai');
  });

  test('should reset statistics', async () => {
    await statsManager.recordCommit('openai', 500);
    await statsManager.reset();
    const stats = await statsManager.getStats();

    expect(stats.totalCommits).toBe(0);
    expect(stats.providerBreakdown).toEqual({});
  });

  test('should record errors', async () => {
    await statsManager.recordError(new Error('Test Error'), 'openai');
    const stats = await statsManager.getStats();
    expect(stats.errorCount).toBe(1);
  });
});