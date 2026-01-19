/**
 * Unit tests for StatsManager
 */

describe('StatsManager', () => {
  let StatsManager;
  let statsManager;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    
    jest.mock('fs-extra', () => ({
      pathExists: jest.fn().mockResolvedValue(false),
      readJson: jest.fn().mockResolvedValue({}),
      writeJson: jest.fn().mockResolvedValue(),
      ensureDir: jest.fn().mockResolvedValue(),
    }));
    
    StatsManager = require('../src/core/stats-manager');
    statsManager = new StatsManager();
  });

  describe('constructor', () => {
    it('should initialize with default stats', () => {
      expect(statsManager.stats).toBeDefined();
      expect(statsManager.stats.totalCommits).toBe(0);
    });
  });

  describe('recordCommit', () => {
    it('should record commit for provider', () => {
      statsManager.recordCommit('groq');
      expect(statsManager.stats.totalCommits).toBe(1);
      expect(statsManager.stats.providerUsage.groq).toBe(1);
    });

    it('should increment provider count', () => {
      statsManager.recordCommit('groq');
      statsManager.recordCommit('groq');
      statsManager.recordCommit('ollama');
      expect(statsManager.stats.providerUsage.groq).toBe(2);
      expect(statsManager.stats.providerUsage.ollama).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return current stats', () => {
      statsManager.recordCommit('groq');
      const stats = statsManager.getStats();
      expect(stats.totalCommits).toBe(1);
    });
  });

  describe('reset', () => {
    it('should reset all stats', () => {
      statsManager.recordCommit('groq');
      statsManager.reset();
      expect(statsManager.stats.totalCommits).toBe(0);
    });
  });

  describe('getProviderStats', () => {
    it('should return stats for provider', () => {
      statsManager.recordCommit('groq');
      const providerStats = statsManager.getProviderStats('groq');
      expect(providerStats.count).toBe(1);
    });
  });

  describe('getMostUsedProvider', () => {
    it('should return most used provider', () => {
      statsManager.recordCommit('groq');
      statsManager.recordCommit('groq');
      statsManager.recordCommit('ollama');
      const mostUsed = statsManager.getMostUsedProvider();
      expect(mostUsed).toBe('groq');
    });

    it('should return null when no commits', () => {
      const mostUsed = statsManager.getMostUsedProvider();
      expect(mostUsed).toBeNull();
    });
  });

  describe('save', () => {
    it('should save stats', async () => {
      const fs = require('fs-extra');
      statsManager.recordCommit('groq');
      await statsManager.save();
      expect(fs.writeJson).toHaveBeenCalled();
    });
  });
});
