/**
 * Tests for StatsManager (Conf-backed usage statistics)
 */

// jest.mock is NOT hoisted (transform: {} — no babel), so register the mock
// BEFORE requiring the module under test or it never applies.
jest.mock('conf', () => {
  const makeStore = () => ({
    totalCommits: 0,
    providerUsage: {},
    responseTimeHistory: [],
    cacheHits: 0,
    cacheMisses: 0,
    errorCount: 0,
    firstUsed: null,
    lastUsed: null,
  });
  const store = makeStore();
  const mockConf = jest.fn().mockImplementation(() => ({
    store,
    path: '/test/stats.json',
    get: jest.fn(key => store[key]),
    set: jest.fn((key, value) => {
      store[key] = value;
    }),
    clear: jest.fn(() => {
      Object.assign(store, makeStore());
    }),
  }));
  mockConf.__store = store;
  mockConf.__makeStore = makeStore;
  return mockConf;
});

const Conf = require('conf');
const StatsManager = require('../src/core/stats-manager');

describe('StatsManager', () => {
  let statsManager;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the shared backing store between tests
    Object.assign(Conf.__store, Conf.__makeStore());
    statsManager = new StatsManager();
  });

  describe('recordCommit / getStats round-trip', () => {
    it('aggregates commits, provider usage, and average response time', async () => {
      await statsManager.recordCommit('groq', 120);
      await statsManager.recordCommit('groq', 120);

      const stats = await statsManager.getStats();

      expect(stats.totalCommits).toBe(2);
      expect(stats.providerBreakdown.groq).toBe(2);
      expect(stats.mostUsedProvider).toBe('groq');
      expect(stats.averageResponseTime).toBe(120);
      expect(stats.usage.firstUsed).not.toBeNull();
      expect(stats.usage.lastUsed).not.toBeNull();
    });

    it('caps response time history at 100 entries', async () => {
      for (let i = 0; i < 105; i++) {
        await statsManager.recordCommit('groq', 100);
      }

      expect(Conf.__store.responseTimeHistory.length).toBe(100);

      const stats = await statsManager.getStats();
      expect(stats.totalCommits).toBe(105);
      expect(stats.averageResponseTime).toBe(100);
    });

    it('returns zeros and mostUsedProvider none on an empty store', async () => {
      const stats = await statsManager.getStats();

      expect(stats.totalCommits).toBe(0);
      expect(stats.mostUsedProvider).toBe('none');
      expect(stats.averageResponseTime).toBe(0);
      expect(stats.providerBreakdown).toEqual({});
      expect(stats.cacheHitRate).toBe(0);
      expect(stats.errorCount).toBe(0);
      expect(stats.usage.firstUsed).toBeNull();
      expect(stats.usage.lastUsed).toBeNull();
    });
  });
});
